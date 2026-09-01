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

type Amendment = { fromDate: string; toDate: string; reportingDate: string; requestedDays: number; status: "PENDING" | "SDM_APPROVED" | "ADJT_APPROVED" | "APPROVED" | "REJECTED"; sdmApproved: boolean; adjtApproved: boolean };
const amendmentPrefix = "LEAVE_AMENDMENT:";
function readAmendment(remarks: string | null): Amendment | null { if (!remarks?.startsWith(amendmentPrefix)) return null; try { return JSON.parse(remarks.slice(amendmentPrefix.length)) as Amendment; } catch { return null; } }
function writeAmendment(amendment: Amendment) { return `${amendmentPrefix}${JSON.stringify(amendment)}`; }
async function overlap(personnelId: string, fromDate: Date, reportingDate: Date, excludeId?: string) { return prisma.leaveRequest.findFirst({ where: { personnelId, ...(excludeId ? { id: { not: excludeId } } : {}), status: { notIn: ["REJECTED", "CANCELLED"] }, fromDate: { lt: reportingDate }, reportingDate: { gt: fromDate } }, select: { id: true } }); }

function serialize(request: Awaited<ReturnType<typeof prisma.leaveRequest.findMany>>[number] & { personnel?: { serviceNumber: string; fullName: string; rank: string } }) {
	const amendment = readAmendment(request.remarks);
	return { ...request, amendment: amendment ? { ...amendment, from: amendment.fromDate, to: amendment.toDate } : null, armyNo: request.personnel?.serviceNumber, name: request.personnel?.fullName, rank: request.personnel?.rank, type: request.leaveType, from: request.fromDate.toISOString().slice(0, 10), to: request.toDate.toISOString().slice(0, 10), prefix: request.prefixDate?.toISOString().slice(0, 10) ?? "None", suffix: request.suffixDate?.toISOString().slice(0, 10) ?? "None", reportingDate: request.reportingDate.toISOString().slice(0, 10), status: request.status === "REJECTED" ? "Rejected" : request.status === "APPROVED" || request.status === "SDM_APPROVED" || request.status === "ADJT_APPROVED" ? "Approved" : "Pending" };
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
		if (await overlap(personnel.id, fromDate, reportingDate)) return json({ error: "These dates overlap an existing leave record. You cannot be on leave twice; please enter the correct dates." }, { status: 409 });
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
		const current = await prisma.leaveRequest.findUnique({ where: { id }, include: withPersonnel });
		if (!current) return json({ error: "Leave request not found." }, { status: 404 });
		if (body.action === "request_amendment") {
			if (current.personnel?.serviceNumber !== text(body.serviceNumber, "serviceNumber", 40).toUpperCase()) return json({ error: "You can modify only your own leave record." }, { status: 403 });
			if (current.status !== "APPROVED") return json({ error: "Only approved leave can be amended." }, { status: 409 });
			const fromDate = date(body.fromDate, "fromDate")!; const toDate = date(body.toDate, "toDate")!; const reportingDate = date(body.reportingDate, "reportingDate")!;
			if (toDate < fromDate || reportingDate < toDate) throw new Error("Leave dates are inconsistent.");
			const requestedDays = Number(body.requestedDays); if (!Number.isInteger(requestedDays) || requestedDays !== daysBetween(fromDate, toDate)) throw new Error("requestedDays must match the inclusive date range.");
			if (await overlap(current.personnelId, fromDate, reportingDate, id)) return json({ error: "These replacement dates overlap another leave record. Please enter the correct dates." }, { status: 409 });
			const amendment: Amendment = { fromDate: fromDate.toISOString(), toDate: toDate.toISOString(), reportingDate: reportingDate.toISOString(), requestedDays, status: "PENDING", sdmApproved: false, adjtApproved: false };
			const leave = await prisma.leaveRequest.update({ where: { id }, data: { remarks: writeAmendment(amendment) }, include: withPersonnel }); return json({ leave: serialize(leave) });
		}
		const action = body.action === "approve" || body.action === "reject" || body.action === "approve_amendment" || body.action === "reject_amendment" ? body.action : (() => { throw new Error("action is invalid."); })();
		const actorRole = body.actorRole === "SDM" || body.actorRole === "ADJT" ? body.actorRole as Role : (() => { throw new Error("actorRole must be SDM or ADJT."); })();
		const amendment = readAmendment(current.remarks);
		if (action.endsWith("amendment")) {
			if (!amendment || amendment.status === "APPROVED" || amendment.status === "REJECTED") return json({ error: "No pending leave modification was found." }, { status: 409 });
			const approved = action === "approve_amendment"; amendment[actorRole === "SDM" ? "sdmApproved" : "adjtApproved"] = approved;
			amendment.status = !approved ? "REJECTED" : amendment.sdmApproved && amendment.adjtApproved ? "APPROVED" : actorRole === "SDM" ? "SDM_APPROVED" : "ADJT_APPROVED";
			if (amendment.status !== "APPROVED") { const leave = await prisma.leaveRequest.update({ where: { id }, data: { remarks: writeAmendment(amendment) }, include: withPersonnel }); return json({ leave: serialize(leave) }); }
			const fromDate = new Date(amendment.fromDate); const toDate = new Date(amendment.toDate); const reportingDate = new Date(amendment.reportingDate); if (await overlap(current.personnelId, fromDate, reportingDate, id)) return json({ error: "The amended dates now overlap another leave record." }, { status: 409 });
			const balanceChange = current.requestedDays - amendment.requestedDays;
			const leave = await prisma.$transaction(async (tx) => { const person = await tx.personnel.findUniqueOrThrow({ where: { id: current.personnelId } }); const currentBalance = current.leaveType === "AL" ? person.annualLeaveBalance : person.casualLeaveBalance; if (balanceChange < 0 && currentBalance < -balanceChange) throw new Error(`Insufficient ${current.leaveType} balance for the amended leave.`); const balanceAfter = currentBalance + balanceChange; await tx.personnel.update({ where: { id: person.id }, data: current.leaveType === "AL" ? { annualLeaveBalance: balanceAfter } : { casualLeaveBalance: balanceAfter } }); return tx.leaveRequest.update({ where: { id }, data: { fromDate, toDate, reportingDate, requestedDays: amendment.requestedDays, balanceReduction: amendment.requestedDays, balanceAfter, remarks: writeAmendment(amendment) }, include: withPersonnel }); }); return json({ leave: serialize(leave) });
		}
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
