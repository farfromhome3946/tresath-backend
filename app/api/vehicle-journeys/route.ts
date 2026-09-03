import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, init?: ResponseInit) {
	return NextResponse.json(data, { ...init, headers: { ...corsHeaders, ...init?.headers } });
}

function text(value: unknown, field: string, max = 200) {
	if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${field} is required.`);
	return value.trim();
}

export function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders });
}

async function geocode(place: string): Promise<{ lat: number; lng: number } | null> {
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(place)}`;
		const response = await fetch(url, { headers: { "User-Agent": "TresathVehicleTracker/1.0" }, signal: AbortSignal.timeout(5000) });
		if (!response.ok) return null;
		const results = (await response.json()) as Array<{ lat: string; lon: string }>;
		if (!results.length) return null;
		return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
	} catch {
		return null;
	}
}

const withVehicle = { vehicle: { select: { vehicleNumber: true, vehicleType: true } } } satisfies Prisma.VehicleJourneyInclude;

function serialize(journey: Awaited<ReturnType<typeof prisma.vehicleJourney.findMany>>[number] & { vehicle?: { vehicleNumber: string; vehicleType: string } }) {
	return {
		id: journey.id,
		vehicleId: journey.vehicleId,
		vehicleNumber: journey.vehicle?.vehicleNumber,
		vehicleType: journey.vehicle?.vehicleType,
		driverServiceNumber: journey.driverServiceNumber,
		driverName: journey.driverName,
		driverRank: journey.driverRank,
		journeyType: journey.journeyType,
		origin: journey.origin,
		originLat: journey.originLat,
		originLng: journey.originLng,
		destination: journey.destination,
		destinationLat: journey.destinationLat,
		destinationLng: journey.destinationLng,
		turningPoint: journey.turningPoint,
		turningPointLat: journey.turningPointLat,
		turningPointLng: journey.turningPointLng,
		currentLat: journey.currentLat,
		currentLng: journey.currentLng,
		locationUpdatedAt: journey.locationUpdatedAt?.toISOString() ?? null,
		status: journey.status,
		startedAt: journey.startedAt.toISOString(),
		endedAt: journey.endedAt?.toISOString() ?? null,
	};
}

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const status = url.searchParams.get("status")?.toUpperCase();
		const vehicleId = url.searchParams.get("vehicleId") ?? undefined;
		const journeys = await prisma.vehicleJourney.findMany({
			where: { ...(status === "ONGOING" || status === "COMPLETED" ? { status } : {}), ...(vehicleId ? { vehicleId } : {}) },
			include: withVehicle,
			orderBy: { startedAt: "desc" },
			take: status ? undefined : 50,
		});
		return json({ journeys: journeys.map(serialize) });
	} catch (error) {
		console.error("GET /api/vehicle-journeys failed", error);
		return json({ error: "Unable to load vehicle journeys." }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const vehicleId = text(body.vehicleId, "vehicleId", 40);
		const serviceNumber = text(body.serviceNumber, "serviceNumber", 40).toUpperCase();
		const journeyType = body.journeyType === "TWO_WAY" ? "TWO_WAY" : body.journeyType === "ONE_WAY" ? "ONE_WAY" : (() => { throw new Error("journeyType must be ONE_WAY or TWO_WAY."); })();
		const origin = text(body.origin, "origin", 200);
		const turningPoint = journeyType === "TWO_WAY" ? text(body.turningPoint, "turningPoint", 200) : null;
		const destination = journeyType === "TWO_WAY" ? origin : text(body.destination, "destination", 200);

		const [vehicle, driver] = await Promise.all([
			prisma.vehicle.findUnique({ where: { id: vehicleId } }),
			prisma.personnel.findUnique({ where: { serviceNumber } }),
		]);
		if (!vehicle || !vehicle.isActive) return json({ error: "Vehicle not found." }, { status: 404 });
		if (!driver || !driver.isActive) return json({ error: "Active personnel record not found." }, { status: 404 });
		const ongoing = await prisma.vehicleJourney.findFirst({ where: { vehicleId, status: "ONGOING" } });
		if (ongoing) return json({ error: "This vehicle is already on a journey." }, { status: 409 });

		const [originPoint, turningPointGeo, destinationPoint] = await Promise.all([
			geocode(origin),
			turningPoint ? geocode(turningPoint) : Promise.resolve(null),
			journeyType === "TWO_WAY" ? Promise.resolve(null) : geocode(destination),
		]);

		const journey = await prisma.vehicleJourney.create({
			data: {
				vehicleId,
				driverServiceNumber: driver.serviceNumber,
				driverName: driver.fullName,
				driverRank: driver.rank,
				journeyType,
				origin,
				originLat: originPoint?.lat,
				originLng: originPoint?.lng,
				destination,
				destinationLat: journeyType === "TWO_WAY" ? originPoint?.lat : destinationPoint?.lat,
				destinationLng: journeyType === "TWO_WAY" ? originPoint?.lng : destinationPoint?.lng,
				turningPoint,
				turningPointLat: turningPointGeo?.lat,
				turningPointLng: turningPointGeo?.lng,
			},
			include: withVehicle,
		});
		return json({ journey: serialize(journey) }, { status: 201 });
	} catch (error) {
		if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to start journey." }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const id = text(body.id, "id", 40);
		const current = await prisma.vehicleJourney.findUnique({ where: { id } });
		if (!current) return json({ error: "Journey not found." }, { status: 404 });
		if (current.status !== "ONGOING") return json({ error: "This journey has already ended." }, { status: 409 });
		const serviceNumber = typeof body.serviceNumber === "string" ? body.serviceNumber.trim().toUpperCase() : "";

		if (body.action === "update_location") {
			if (serviceNumber !== current.driverServiceNumber) return json({ error: "Only the assigned driver can share this journey's location." }, { status: 403 });
			const lat = Number(body.lat);
			const lng = Number(body.lng);
			if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("A valid location is required.");
			const journey = await prisma.vehicleJourney.update({ where: { id }, data: { currentLat: lat, currentLng: lng, locationUpdatedAt: new Date() }, include: withVehicle });
			return json({ journey: serialize(journey) });
		}

		const actorRole = body.actorRole;
		const isOwnJourney = serviceNumber && serviceNumber === current.driverServiceNumber;
		const isVehicleAdmin = actorRole === "ADJT" || actorRole === "ATO" || actorRole === "TO";
		if (!isOwnJourney && !isVehicleAdmin) return json({ error: "Only the driver, the Adjutant, ATO or TO can end this journey." }, { status: 403 });
		const journey = await prisma.vehicleJourney.update({ where: { id }, data: { status: "COMPLETED", endedAt: new Date() }, include: withVehicle });
		return json({ journey: serialize(journey) });
	} catch (error) {
		if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to update journey." }, { status: 500 });
	}
}
