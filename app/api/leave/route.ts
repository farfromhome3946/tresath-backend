import { Prisma, LeaveType, Role, Squadron } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const leaveSelect = {
  id: true,
  personnelId: true,
  squadron: true,
  leaveType: true,
  status: true,
  fromDate: true,
  toDate: true,
  prefixDate: true,
  suffixDate: true,
  reportingDate: true,
  requestedDays: true,
  balanceBefore: true,
  balanceReduction: true,
  balanceAfter: true,
  sdmApproved: true,
  sdmApprovedAt: true,
  adjtApproved: true,
  adjtApprovedAt: true,
  rejectionReason: true,
  remarks: true,
  createdAt: true,
  personnel: { select: { serviceNumber: true, fullName: true, rank: true } },
} satisfies Prisma.LeaveRequestSelect;

type LeaveInput = {
  id?: unknown;
  personnelId?: unknown;
  serviceNumber?: unknown;
  squadron?: unknown;
  leaveType?: unknown;
  fromDate?: unknown;
  toDate?: unknown;
  prefixDate?: unknown;
  suffixDate?: unknown;
  reportingDate?: unknown;
  requestedDays?: unknown;
  remarks?: unknown;
  action?: unknown;
  actorId?: unknown;
  actorRole?: unknown;
  rejectionReason?: unknown;
};

function text(value: unknown, field: string, maxLength = 500) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) throw new Error(`${field} must be a non-empty string of at most ${maxLength} characters.`);
  return value.trim();
}

function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(text(value, field, 30));
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid date.`);
  return date;
}

function requiredDate(value: unknown, field: string) {
  const date = optionalDate(value, field);
  if (!date) throw new Error(`${field} is required.`);
  return date;
}

function integer(value: unknown, field: string) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 366) throw new Error(`${field} must be a whole number between 1 and 366.`);
  return number;
}

function objectId(value: unknown, field: string) {
  const candidate = text(value, field, 24);
  if (!/^[a-f\d]{24}$/i.test(candidate)) throw new Error(`${field} must be a valid MongoDB ObjectId.`);
  return candidate;
}

function inclusiveDays(from: Date, to: Date) {
  const milliseconds = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.floor(milliseconds / 86400000) + 1;
}

function serialize(item: Prisma.LeaveRequestGetPayload<{ select: typeof leaveSelect }>) {
  return {
    id: item.id,
    armyNo: item.personnel.serviceNumber,
    name: item.personnel.fullName.replace(/(\w)\w+/g, "$1••••"),
    rank: item.personnel.rank,
    squadron: item.squadron[0] + item.squadron.slice(1).toLowerCase(),
    type: item.leaveType,
    status: item.status === "APPROVED" || item.status === "SDM_APPROVED" || item.status === "ADJT_APPROVED" ? "Approved" : item.status === "REJECTED" ? "Rejected" : "Pending",
    from: item.fromDate.toISOString().slice(0, 10),
    to: item.toDate.toISOString().slice(0, 10),
    prefix: item.prefixDate?.toISOString().slice(0, 10) ?? "None",
    suffix: item.suffixDate?.toISOString().slice(0, 10) ?? "None",
    reportingDate: item.reportingDate.toISOString().slice(0, 10),
    requestedDays: item.requestedDays,
    sdmApproved: item.sdmApproved,
    adjtApproved: item.adjtApproved,
    balanceBefore: item.balanceBefore,
    balanceAfter: item.balanceAfter,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const personnelId = url.searchParams.get("personnelId") ?? undefined;
    const serviceNumber = url.searchParams.get("serviceNumber")?.trim().toUpperCase();
    const squadron = url.searchParams.get("squadron")?.toUpperCase() as Squadron | undefined;
    const where: Prisma.LeaveRequestWhereInput = {
      ...(personnelId ? { personnelId } : {}),
      ...(serviceNumber ? { personnel: { serviceNumber } } : {}),
      ...(squadron && Object.values(Squadron).includes(squadron) ? { squadron } : {}),
    };
    const leave = await prisma.leaveRequest.findMany({ where, select: leaveSelect, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ leave: leave.map(serialize) });
  } catch (error) {
    console.error("GET /api/leave failed", error);
    return NextResponse.json({ error: "Unable to load leave records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as LeaveInput;
    const leaveType = body.leaveType === "AL" || body.leaveType === "CL" ? body.leaveType as LeaveType : (() => { throw new Error("leaveType must be AL or CL."); })();
    const fromDate = requiredDate(body.fromDate, "fromDate");
    const toDate = requiredDate(body.toDate, "toDate");
    const reportingDate = requiredDate(body.reportingDate, "reportingDate");
    const prefixDate = optionalDate(body.prefixDate, "prefixDate");
    const suffixDate = optionalDate(body.suffixDate, "suffixDate");
    if (toDate < fromDate) throw new Error("toDate cannot be before fromDate.");
    if (reportingDate < toDate) throw new Error("reportingDate cannot be before toDate.");
    const calculatedDays = inclusiveDays(fromDate, toDate);
    const requestedDays = body.requestedDays === undefined ? calculatedDays : integer(body.requestedDays, "requestedDays");
    if (requestedDays !== calculatedDays) throw new Error("requestedDays must match the inclusive date range.");
    const personnel = body.personnelId ? await prisma.personnel.findUnique({ where: { id: text(body.personnelId, "personnelId", 40) } }) : await prisma.personnel.findUnique({ where: { serviceNumber: text(body.serviceNumber, "serviceNumber", 40).toUpperCase() } });
    if (!personnel || !personnel.isActive) return NextResponse.json({ error: "Active personnel record not found." }, { status: 404 });
    const balanceBefore = leaveType === "AL" ? personnel.annualLeaveBalance : personnel.casualLeaveBalance;
    if (balanceBefore < requestedDays) return NextResponse.json({ error: `Insufficient ${leaveType} balance.` }, { status: 409 });
    const balanceAfter = balanceBefore - requestedDays;
    const created = await prisma.$transaction(async (tx) => {
      const update = leaveType === "AL" ? { annualLeaveBalance: balanceAfter } : { casualLeaveBalance: balanceAfter };
      await tx.personnel.update({ where: { id: personnel.id }, data: update });
      return tx.leaveRequest.create({ data: { personnelId: personnel.id, squadron: personnel.squadron, leaveType, fromDate, toDate, prefixDate, suffixDate, reportingDate, requestedDays, balanceBefore, balanceReduction: requestedDays, balanceAfter, remarks: body.remarks === undefined ? undefined : text(body.remarks, "remarks") }, select: leaveSelect });
    });
    return NextResponse.json({ leave: serialize(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    if (error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError)) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("POST /api/leave failed", error);
    return NextResponse.json({ error: "Unable to create leave request." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as LeaveInput;
    const id = objectId(body.id, "id");
    const action = body.action === "approve" || body.action === "reject" ? body.action : (() => { throw new Error("action must be approve or reject."); })();
    const actorRole = body.actorRole === "SDM" || body.actorRole === "ADJT" ? body.actorRole as Role : (() => { throw new Error("actorRole must be SDM or ADJT."); })();
    const leave = await prisma.leaveRequest.findUnique({ where: { id }, select: leaveSelect });
    if (!leave) return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
    if (leave.status === "REJECTED" || leave.status === "CANCELLED" || leave.status === "APPROVED") return NextResponse.json({ error: "This leave request is already closed." }, { status: 409 });
    if (actorRole === "SDM" && leave.sdmApproved) return NextResponse.json({ error: "SDM has already decided this request." }, { status: 409 });
    if (actorRole === "ADJT" && leave.adjtApproved) return NextResponse.json({ error: "ADJT has already decided this request." }, { status: 409 });
    const now = new Date();
    const approved = action === "approve";
    const reviewerId = body.actorId ? objectId(body.actorId, "actorId") : undefined;
    const data: Prisma.LeaveRequestUpdateInput = actorRole === "SDM" ? { sdmApproved: approved, sdmApprovedAt: approved ? now : null, sdmApprovedById: reviewerId, status: approved ? (leave.adjtApproved ? "APPROVED" : "SDM_APPROVED") : "REJECTED", rejectionReason: approved ? null : body.rejectionReason ? text(body.rejectionReason, "rejectionReason") : "Rejected by SDM" } : { adjtApproved: approved, adjtApprovedAt: approved ? now : null, adjtApprovedById: reviewerId, status: approved ? (leave.sdmApproved ? "APPROVED" : "ADJT_APPROVED") : "REJECTED", rejectionReason: approved ? null : body.rejectionReason ? text(body.rejectionReason, "rejectionReason") : "Rejected by ADJT" };
    const updated = await prisma.leaveRequest.update({ where: { id }, data, select: leaveSelect });
    return NextResponse.json({ leave: serialize(updated) });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    if (error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError)) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("PATCH /api/leave failed", error);
    return NextResponse.json({ error: "Unable to update leave request." }, { status: 500 });
  }
}
