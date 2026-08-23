export const dynamic = "force-dynamic";
export const revalidate = 0;

import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { Prisma, Role, Squadron } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCallback);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { ...corsHeaders, ...init?.headers } });
}

function text(value: unknown, field: string, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${field} is required.`);
  return value.trim();
}

function enumValue<T extends string>(value: unknown, field: string, values: readonly T[]) {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`${field} is invalid.`);
  return value as T;
}

async function hashPassword(password: string) {
  if (password.length < 6) throw new Error("Password must contain at least 6 characters.");
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

function publicAccount(personnel: Awaited<ReturnType<typeof prisma.personnel.create>>) {
  const { passwordHash, ...safe } = personnel;
  void passwordHash;
  return { ...safe, maskedName: personnel.fullName.replace(/(\w)\w+/g, "$1••••") };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serviceNumber = url.searchParams.get("serviceNumber")?.trim().toUpperCase();
    const squadron = url.searchParams.get("squadron")?.toUpperCase();
    const personnel = await prisma.personnel.findMany({
      where: {
        isActive: true,
        ...(serviceNumber ? { serviceNumber } : {}),
        ...(squadron && Object.values(Squadron).includes(squadron as Squadron) ? { squadron: squadron as Squadron } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return json({ personnel: personnel.map(publicAccount) });
  } catch (error) {
    console.error("GET /api/personnel failed", error);
    return json({ error: "Unable to load personnel." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action === "login" ? "login" : "register";
    const serviceNumber = text(body.serviceNumber, "serviceNumber", 40).toUpperCase();
    const password = text(body.password, "password", 200);
    const existing = await prisma.personnel.findUnique({ where: { serviceNumber } });

    if (action === "login") {
      if (!existing || !existing.isActive) return json({ error: "Army No. or password is incorrect." }, { status: 401 });
      const [salt, stored] = existing.passwordHash.split(":");
      const derived = (await scrypt(password, salt, 64)) as Buffer;
      if (!salt || !stored || derived.toString("hex") !== stored) return json({ error: "Army No. or password is incorrect." }, { status: 401 });
      return json({ account: publicAccount(existing) });
    }

    if (existing) return json({ error: "That Army No. already has a profile." }, { status: 409 });
    const role = enumValue(body.role ?? "PERSONNEL", "role", Object.values(Role));
    const squadron = enumValue(body.squadron, "squadron", Object.values(Squadron));
    const personnel = await prisma.personnel.create({
      data: {
        serviceNumber,
        passwordHash: await hashPassword(password),
        fullName: text(body.fullName, "fullName"),
        rank: text(body.rank ?? "Personnel", "rank"),
        trade: text(body.trade ?? "General Duty", "trade"),
        hometown: text(body.hometown || "Not provided", "hometown"),
        role,
        squadron,
        maskedEmail: typeof body.maskedEmail === "string" ? body.maskedEmail : undefined,
        maskedPhone: typeof body.maskedPhone === "string" ? body.maskedPhone : undefined,
        maskedAddress: typeof body.maskedAddress === "string" ? body.maskedAddress : undefined,
        maskedId: typeof body.maskedId === "string" ? body.maskedId : undefined,
        metadata: body.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await prisma.auditLog.create({ data: { personnelId: personnel.id, action: "PROFILE_CREATED", newValues: { serviceNumber, role, squadron } } });
    return json({ account: publicAccount(personnel) }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return json({ error: "That Army No. already has a profile." }, { status: 409 });
    if (error instanceof Error) return json({ error: error.message }, { status: 400 });
    return json({ error: "Unable to save personnel." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const serviceNumber = text(body.serviceNumber, "serviceNumber", 40).toUpperCase();
    const current = await prisma.personnel.findUnique({ where: { serviceNumber } });
    if (!current || !current.isActive) return json({ error: "Active personnel record not found." }, { status: 404 });
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata as Prisma.InputJsonValue : current.metadata;
    const personnel = await prisma.personnel.update({
      where: { serviceNumber },
      data: {
        fullName: body.fullName === undefined ? undefined : text(body.fullName, "fullName"),
        rank: body.rank === undefined ? undefined : text(body.rank, "rank"),
        trade: body.trade === undefined ? undefined : text(body.trade, "trade"),
        hometown: body.hometown === undefined ? undefined : text(body.hometown, "hometown"),
        metadata,
      },
    });
    await prisma.auditLog.create({ data: { personnelId: personnel.id, action: "PROFILE_UPDATED", changedFields: { fullName: body.fullName !== undefined, rank: body.rank !== undefined, trade: body.trade !== undefined, hometown: body.hometown !== undefined, metadata: body.metadata !== undefined }, actorId: personnel.id, actorRole: personnel.role } });
    return json({ account: publicAccount(personnel) });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Request body must be valid JSON." }, { status: 400 });
    if (error instanceof Error) return json({ error: error.message }, { status: 400 });
    return json({ error: "Unable to update personnel." }, { status: 500 });
  }
}