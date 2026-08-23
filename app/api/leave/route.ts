import { Prisma, LeaveType, Role, Squadron } from "@prisma/client";
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

function text(value: unknown, field: string, max = 500) {
	if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${field} is required.`);
	return value.trim();
}

function date(value: unknown, field: string, optional = false) {
	if (optional && (value === undefined || value === null || value === "")) return null;
	const parsed = new Date(text(value, field, 40));
	if (Number.isNaN(parsed.getTime())) throw new Error(`${field} must be a valid date.`);
	return parsed;
}

function daysBetween(from: Date, to: Date) {
	return Math.floor((Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) / 86400000) + 1;
}

function serialize(request: Awaited<ReturnType<typeof prisma.leaveRequest.findMany>>[number] & { personnel?: { serviceNumber: string; fullName: string; rank: string } }) {
	return { ...request, armyNo: request.personnel?.serviceNumber, name: request.personnel?.fullName.replace(/(\w)\w+/g, "$1••••"), rank: request.personnel?.rank, type: request.leaveType, from: request.fromDate.toISOString().slice(0, 10), to: request.toDate.toISOString().slice(0, 10), prefix: request.prefixDate?.toISOString().slice(0, 10) ?? "None", suffix: request.suffixDate?.toISOString().slice(0, 10) ?? "None", reportingDate: request.reportingDate.toISOString().slice(0, 10), status: request.status === "REJECTED" ? "Rejected" : request.status === "APPROVED" || request.status === "SDM_APPROVED" || request.status === "ADJT_APPROVED" ? "Approved" : "Pending" };
}

export function OPTIONS() {
	return new Response(null, { status: 204, headers: corsHeaders });
}

const withPersonnel = { personnel: { select: { serviceNumber: true, fullName: true, rank: true } } } satisfies Prisma.LeaveRequestInclude;

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const serviceNumber = url.searchParams.get("serviceNumber")?.trim().toUpperCase();
		const squadron = url.searchParams.get("squadron")?.toUpperCase() as Squadron | undefined;
		const leave = await prisma.leaveRequest.findMany({ where: { ...(serviceNumber ? { personnel: { serviceNumber } } : {}), ...(squadron && Object.values(Squadron).includes(squadron) ? { squadron } : {}) }, include: withPersonnel, orderBy: { createdAt: "desc" } });
		return json({ leave: leave.map(serialize) });
	} catch (error) {
		console.error("GET /api/leave failed", error);
		return json({ error: "Unable to load leave records." }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json() as Record<string, unknown>;
		const leaveType = body.leaveType === "AL" || body.leaveType === "CL" ? body.leaveType as LeaveType : (() => { throw new Error("leaveType must be AL or CL."); })();
		const fromDate = date(body.fromDate, "fromDate")!;
		const toDate = date(body.toDate, "toDate")!;
		const reportingDate = date(body.reportingDate, "reportingDate")!;
		const prefixDate = date(body.prefixDate, "prefixDate", true);
		const suffixDate = date(body.suffixDate, "suffixDate", true);
		if (toDate < fromDate || reportingDate < toDate) throw new Error("Leave dates are inconsistent.");
		const requestedDays = Number(body.requestedDays);
		const calculatedDays = daysBetween(fromDate, toDate);
		if (!Number.isInteger(requestedDays) || requestedDays !== calculatedDays) throw new Error("requestedDays must match the inclusive date range.");
		const personnel = await prisma.personnel.findUnique({ where: { serviceNumber: text(body.serviceNumber, "serviceNumber", 40).toUpperCase() } });
		if (!personnel || !personnel.isActive) return json({ error: "Active personnel record not found." }, { status: 404 });
		const balanceBefore = leaveType === "AL" ? personnel.annualLeaveBalance : personnel.casualLeaveBalance;
		if (requestedDays > balanceBefore) return json({ error: `Insufficient ${leaveType} balance.` }, { status: 409 });
		const balanceAfter = balanceBefore - requestedDays;
		const availed = body.recordType === "AVAILED";
		const leave = await prisma.$transaction(async (tx) => {
			await tx.personnel.update({ where: { id: personnel.id }, data: leaveType === "AL" ? { annualLeaveBalance: balanceAfter } : { casualLeaveBalance: balanceAfter } });
			return tx.leaveRequest.create({ data: { personnelId: personnel.id, squadron: personnel.squadron, leaveType, status: availed ? "APPROVED" : "PENDING", fromDate, toDate, prefixDate, suffixDate, reportingDate, requestedDays, balanceBefore, balanceReduction: requestedDays, balanceAfter }, include: withPersonnel });
		});
		return json({ leave: serialize(leave) }, { status: 201 });
	} catch (error) {
		if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to create leave request." }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	try {
		const body = await request.json() as Record<string, unknown>;
		const id = text(body.id, "id", 40);
		const action = body.action === "approve" || body.action === "reject" ? body.action : (() => { throw new Error("action must be approve or reject."); })();
		const actorRole = body.actorRole === "SDM" || body.actorRole === "ADJT" ? body.actorRole as Role : (() => { throw new Error("actorRole must be SDM or ADJT."); })();
		const current = await prisma.leaveRequest.findUnique({ where: { id } });
		if (!current) return json({ error: "Leave request not found." }, { status: 404 });
		const approved = action === "approve";
		const status = !approved ? "REJECTED" : actorRole === "SDM" ? current.adjtApproved ? "APPROVED" : "SDM_APPROVED" : current.sdmApproved ? "APPROVED" : "ADJT_APPROVED";
		const leave = await prisma.leaveRequest.update({ where: { id }, data: actorRole === "SDM" ? { sdmApproved: approved, sdmApprovedAt: approved ? new Date() : null, status } : { adjtApproved: approved, adjtApprovedAt: approved ? new Date() : null, status }, include: withPersonnel });
		return json({ leave: serialize(leave) });
	} catch (error) {
		if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
		if (error instanceof Error) return json({ error: error.message }, { status: 400 });
		return json({ error: "Unable to update leave request." }, { status: 500 });
	}
}