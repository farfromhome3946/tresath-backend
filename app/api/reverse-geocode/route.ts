import { NextResponse } from "next/server";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, init?: ResponseInit) {
	return NextResponse.json(data, { ...init, headers: { ...corsHeaders, ...init?.headers } });
}

export function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const lat = Number(url.searchParams.get("lat"));
		const lng = Number(url.searchParams.get("lng"));
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("A valid lat and lng are required.");
		const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
		const response = await fetch(nominatimUrl, { headers: { "User-Agent": "TresathVehicleTracker/1.0" }, signal: AbortSignal.timeout(5000) });
		if (!response.ok) return json({ placeName: null });
		const data = (await response.json()) as { display_name?: string };
		return json({ placeName: data.display_name ?? null });
	} catch (error) {
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to resolve location." }, { status: 500 });
	}
}
