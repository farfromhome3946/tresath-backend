import { Squadron } from "@prisma/client";
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

export function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const date = text(url.searchParams.get("date"), "date", 10);
		const squadronParam = url.searchParams.get("squadron")?.toUpperCase();

		if (squadronParam) {
			if (!Object.values(Squadron).includes(squadronParam as Squadron)) throw new Error("squadron is invalid.");
			const order = await prisma.squadronOrder.findUnique({ where: { date_squadron: { date, squadron: squadronParam as Squadron } } });
			return json({ order });
		}

		const orders = await prisma.squadronOrder.findMany({ where: { date } });
		return json({ orders });
	} catch (error) {
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to load squadron orders." }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const date = text(body.date, "date", 10);
		const content = text(body.content, "content", 4000);
		const serviceNumber = text(body.serviceNumber, "serviceNumber", 40).toUpperCase();
		const personnel = await prisma.personnel.findUnique({ where: { serviceNumber } });
		if (!personnel || !personnel.isActive) return json({ error: "Active personnel record not found." }, { status: 404 });
		if (personnel.role !== "SDM") return json({ error: "Only the SDM can post a squadron order." }, { status: 403 });
		const order = await prisma.squadronOrder.upsert({
			where: { date_squadron: { date, squadron: personnel.squadron } },
			create: { date, squadron: personnel.squadron, content, postedById: personnel.id, postedByName: personnel.fullName },
			update: { content, postedById: personnel.id, postedByName: personnel.fullName },
		});
		return json({ order });
	} catch (error) {
		if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to save the squadron order." }, { status: 500 });
	}
}
