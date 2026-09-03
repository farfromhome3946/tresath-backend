import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

const withOngoingJourney = { journeys: { where: { status: "ONGOING" }, take: 1, orderBy: { startedAt: "desc" } } } satisfies Prisma.VehicleInclude;

function serialize(vehicle: Awaited<ReturnType<typeof prisma.vehicle.findMany>>[number] & { journeys?: Awaited<ReturnType<typeof prisma.vehicleJourney.findMany>> }) {
	const journey = vehicle.journeys?.[0];
	return {
		id: vehicle.id,
		vehicleNumber: vehicle.vehicleNumber,
		vehicleType: vehicle.vehicleType,
		isActive: vehicle.isActive,
		ongoingJourney: journey
			? {
					id: journey.id,
					vehicleId: journey.vehicleId,
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
				}
			: null,
	};
}

export async function GET() {
	try {
		const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, include: withOngoingJourney, orderBy: { vehicleNumber: "asc" } });
		return json({ vehicles: vehicles.map(serialize) });
	} catch (error) {
		console.error("GET /api/vehicles failed", error);
		return json({ error: "Unable to load vehicles." }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const vehicleNumber = text(body.vehicleNumber, "vehicleNumber", 40).toUpperCase();
		const vehicleType = text(body.vehicleType, "vehicleType", 80);
		const actorRole = body.actorRole === "ADJT" || body.actorRole === "ATO" || body.actorRole === "TO" ? (body.actorRole as Role) : (() => { throw new Error("Only the Adjutant, ATO or TO can add vehicles."); })();
		void actorRole;
		const existing = await prisma.vehicle.findUnique({ where: { vehicleNumber } });
		if (existing) {
			if (existing.isActive) return json({ error: "A vehicle with this number already exists." }, { status: 409 });
			const revived = await prisma.vehicle.update({ where: { id: existing.id }, data: { isActive: true, vehicleType }, include: withOngoingJourney });
			return json({ vehicle: serialize(revived) }, { status: 201 });
		}
		const vehicle = await prisma.vehicle.create({ data: { vehicleNumber, vehicleType }, include: withOngoingJourney });
		return json({ vehicle: serialize(vehicle) }, { status: 201 });
	} catch (error) {
		if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to add vehicle." }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const id = text(body.id, "id", 40);
		if (body.actorRole !== "ADJT" && body.actorRole !== "ATO" && body.actorRole !== "TO") return json({ error: "Only the Adjutant, ATO or TO can remove vehicles." }, { status: 403 });
		const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: withOngoingJourney });
		if (!vehicle) return json({ error: "Vehicle not found." }, { status: 404 });
		if (vehicle.journeys?.length) return json({ error: "This vehicle is currently on a journey and cannot be removed." }, { status: 409 });
		await prisma.vehicle.update({ where: { id }, data: { isActive: false } });
		return json({ success: true });
	} catch (error) {
		if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to remove vehicle." }, { status: 500 });
	}
}
