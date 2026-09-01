import { Prisma, Squadron } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, init?: ResponseInit) {
	return NextResponse.json(data, { ...init, headers: { ...corsHeaders, ...init?.headers } });
}

function text(value: unknown, field: string, max = 500) {
	if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${field} is required.`);
	return value.trim();
}

function date(value: unknown, field: string) {
	const parsed = new Date(text(value, field, 40));
	if (Number.isNaN(parsed.getTime())) throw new Error(`${field} must be a valid date.`);
	return parsed;
}

export function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders });
}

const withPersonnel = { personnel: { select: { serviceNumber: true, fullName: true, rank: true } } } satisfies Prisma.TemporaryDutyInclude;

function serialize(record: Awaited<ReturnType<typeof prisma.temporaryDuty.findMany>>[number] & { personnel?: { serviceNumber: string; fullName: string; rank: string } }) {
	return { ...record, armyNo: record.personnel?.serviceNumber, name: record.personnel?.fullName, rank: record.personnel?.rank, from: record.fromDate.toISOString().slice(0, 10), to: record.toDate.toISOString().slice(0, 10) };
}

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const serviceNumber = url.searchParams.get("serviceNumber")?.trim().toUpperCase();
		const squadron = url.searchParams.get("squadron")?.toUpperCase() as Squadron | undefined;
		const records = await prisma.temporaryDuty.findMany({
			where: {
				...(serviceNumber ? { personnel: { serviceNumber } } : {}),
				...(squadron && Object.values(Squadron).includes(squadron) ? { squadron } : {}),
			},
			include: withPersonnel,
			orderBy: { fromDate: "desc" },
		});
		return json({ temporaryDuty: records.map(serialize) });
	} catch (error) {
		console.error("GET /api/temporary-duty failed", error);
		return json({ error: "Unable to load temporary duty records." }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const fromDate = date(body.fromDate, "fromDate");
		const toDate = date(body.toDate, "toDate");
		if (toDate < fromDate) throw new Error("To date must be on or after the from date.");
		const reason = text(body.reason, "reason", 300);
		const location = text(body.location, "location", 200);
		const personnel = await prisma.personnel.findUnique({ where: { serviceNumber: text(body.serviceNumber, "serviceNumber", 40).toUpperCase() } });
		if (!personnel || !personnel.isActive) return json({ error: "Active personnel record not found." }, { status: 404 });
		const record = await prisma.temporaryDuty.create({ data: { personnelId: personnel.id, squadron: personnel.squadron, reason, location, fromDate, toDate }, include: withPersonnel });
		return json({ temporaryDuty: serialize(record) }, { status: 201 });
	} catch (error) {
		if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to create temporary duty record." }, { status: 500 });
	}
}
