import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Prisma, Role, Squadron } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCallback);
const publicPersonnel = {
  id: true,
  serviceNumber: true,
  fullName: true,
  rank: true,
  trade: true,
  hometown: true,
  squadron: true,
  role: true,
  isActive: true,
  maskedEmail: true,
  maskedPhone: true,
  maskedAddress: true,
  maskedId: true,
  metadata: true,
  annualLeaveBalance: true,
  casualLeaveBalance: true,
} satisfies Prisma.PersonnelSelect;

type PersonnelInput = {
  action?: "login" | "register";
  serviceNumber?: unknown;
  password?: unknown;
  fullName?: unknown;
  rank?: unknown;
  trade?: unknown;
  hometown?: unknown;
  squadron?: unknown;
  role?: unknown;
  maskedEmail?: unknown;
  maskedPhone?: unknown;
  maskedAddress?: unknown;
  maskedId?: unknown;
  metadata?: unknown;
};

function text(value: unknown, field: string, maxLength = 120) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`${field} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, maxLength = 200) {
  if (value === undefined || value === null || value === "") return null;
  return text(value, field, maxLength);
}

function enumValue<T extends string>(value: unknown, field: string, values: readonly T[]) {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`${field} is invalid.`);
  return value as T;
}

async function hashPassword(password: string) {
  if (password.length < 6 || password.length > 200) throw new Error("Password must be between 6 and 200 characters.");
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

function maskName(name: string) {
  return name.split(/\s+/).map((part) => part.length > 1 ? `${part[0]}${"•".repeat(Math.min(4, part.length - 1))}` : part).join(" ");
}

function sanitize(personnel: { id: string; serviceNumber: string; fullName: string; rank: string; trade: string; hometown: string; squadron: Squadron; role: Role; isActive: boolean; maskedEmail: string | null; maskedPhone: string | null; maskedAddress: string | null; maskedId: string | null; metadata: Prisma.JsonValue | null; annualLeaveBalance: number; casualLeaveBalance: number }) {
  return { ...personnel, maskedName: maskName(personnel.fullName) };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serviceNumber = url.searchParams.get("serviceNumber")?.trim().toUpperCase();
    const squadron = url.searchParams.get("squadron");
    const role = url.searchParams.get("role");
    const personnel = await prisma.personnel.findMany({
      where: {
        ...(serviceNumber ? { serviceNumber } : {}),
        ...(squadron && Object.values(Squadron).includes(squadron as Squadron) ? { squadron: squadron as Squadron } : {}),
        ...(role && Object.values(Role).includes(role as Role) ? { role: role as Role } : {}),
        isActive: true,
      },
      select: publicPersonnel,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ personnel: personnel.map(sanitize) });
  } catch (error) {
    console.error("GET /api/personnel failed", error);
    return NextResponse.json({ error: "Unable to load personnel." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as PersonnelInput;
    const action = body.action ?? "register";
    const serviceNumber = text(body.serviceNumber, "serviceNumber", 40).toUpperCase();
    const password = text(body.password, "password", 200);
    const existing = await prisma.personnel.findUnique({ where: { serviceNumber } });

    if (action === "login") {
      if (!existing || !existing.isActive || !(await verifyPassword(password, existing.passwordHash))) {
        return NextResponse.json({ error: "Army No. or password is incorrect." }, { status: 401 });
      }
      return NextResponse.json({ account: sanitize(existing) });
    }

    if (action !== "register") return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    if (existing) return NextResponse.json({ error: "That Army No. already has a profile." }, { status: 409 });

    const fullName = text(body.fullName, "fullName");
    const rank = text(body.rank ?? "Personnel", "rank");
    const trade = text(body.trade ?? "General Duty", "trade");
    const hometown = text(body.hometown ?? "Not provided", "hometown");
    const role = enumValue(body.role ?? "PERSONNEL", "role", Object.values(Role));
    const squadron = enumValue(body.squadron, "squadron", Object.values(Squadron));
    const metadata = body.metadata === undefined ? undefined : body.metadata;
    if (metadata !== undefined && (typeof metadata !== "object" || metadata === null || Array.isArray(metadata))) throw new Error("metadata must be a JSON object.");

    const created = await prisma.$transaction(async (tx) => {
      const personnel = await tx.personnel.create({
        data: {
          serviceNumber,
          passwordHash: await hashPassword(password),
          fullName,
          rank,
          trade,
          hometown,
          role,
          squadron,
          maskedEmail: optionalText(body.maskedEmail, "maskedEmail"),
          maskedPhone: optionalText(body.maskedPhone, "maskedPhone"),
          maskedAddress: optionalText(body.maskedAddress, "maskedAddress"),
          maskedId: optionalText(body.maskedId, "maskedId"),
          metadata: metadata as Prisma.InputJsonValue | undefined,
        },
        select: publicPersonnel,
      });
      await tx.auditLog.create({ data: { personnelId: personnel.id, action: "PROFILE_CREATED", newValues: { serviceNumber, role, squadron } } });
      return personnel;
    });
    return NextResponse.json({ account: sanitize(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    if (error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError)) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That Army No. already has a profile." }, { status: 409 });
    console.error("POST /api/personnel failed", error);
    return NextResponse.json({ error: "Unable to save personnel profile." }, { status: 500 });
  }
}
