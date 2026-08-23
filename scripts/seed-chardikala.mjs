import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const records = [
  ["TEST-CH-001", "Lt", "Aarav Mehta", "DVR"],
  ["TEST-CH-002", "Lt", "Ishaan Kapoor", "OPR"],
  ["TEST-CH-003", "Capt", "Kabir Malhotra", "GNR"],
  ["TEST-CH-004", "Capt", "Rohan Bedi", "DVR"],
  ["TEST-CH-005", "Ris", "Aditya Rao", "OPR"],
  ["TEST-CH-006", "Ris", "Vivaan Sethi", "GNR"],
  ["TEST-CH-007", "Ris", "Arjun Nair", "DVR"],
  ["TEST-CH-008", "Ris", "Dev Khanna", "OPR"],
  ["TEST-CH-009", "Nb Ris", "Neil Verma", "GNR"],
  ["TEST-CH-010", "Nb Ris", "Yuvan Arora", "DVR"],
  ["TEST-CH-011", "Nb Ris", "Karan Joshi", "OPR"],
  ["TEST-CH-012", "Nb Ris", "Manav Gill", "GNR"],
  ["TEST-CH-013", "Dfr", "Ayaan Bose", "DVR"],
  ["TEST-CH-014", "Dfr", "Dhruv Anand", "OPR"],
  ["TEST-CH-015", "Dfr", "Reyansh Jain", "GNR"],
  ["TEST-CH-016", "Dfr", "Samar Oberoi", "DVR"],
  ["TEST-CH-017", "Dfr", "Veer Chawla", "OPR"],
  ["TEST-CH-018", "Dfr", "Rudra Iyer", "GNR"],
  ["TEST-CH-019", "Dfr", "Atharv Menon", "DVR"],
  ["TEST-CH-020", "Dfr", "Harsh Vora", "OPR"],
  ["TEST-CH-021", "Dfr", "Anay Chopra", "GNR"],
  ["TEST-CH-022", "Dfr", "Shivam Das", "DVR"],
  ["TEST-CH-023", "Dfr", "Krish Puri", "OPR"],
  ["TEST-CH-024", "Dfr", "Moksh Talwar", "GNR"],
  ["TEST-CH-025", "Dfr", "Parth Sood", "DVR"],
  ["TEST-CH-026", "Dfr", "Laksh Vyas", "OPR"],
  ["TEST-CH-027", "Dfr", "Vihaan Shah", "GNR"],
];

function passwordHash(fullName) {
  const firstName = fullName.split(/\s+/)[0];
  const password = `${firstName[0].toUpperCase()}${firstName.slice(1).toLowerCase()}@123`;
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const oldPersonnel = await prisma.personnel.findMany({ where: { squadron: "CHARDIKALA" }, select: { id: true } });
const oldIds = oldPersonnel.map(({ id }) => id);
if (oldIds.length) {
  await prisma.leaveRequest.deleteMany({ where: { personnelId: { in: oldIds } } });
  await prisma.auditLog.deleteMany({ where: { personnelId: { in: oldIds } } });
  await prisma.personnel.deleteMany({ where: { id: { in: oldIds } } });
}

const created = [];
for (const [serviceNumber, rank, fullName, trade] of records) {
  const personnel = await prisma.personnel.create({
    data: { serviceNumber, fullName, rank, trade, hometown: "Test City", squadron: "CHARDIKALA", role: "PERSONNEL", passwordHash: passwordHash(fullName) },
  });
  created.push(personnel);
}

const today = new Date();
for (const personnel of created.slice(0, 9)) {
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 2);
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 3);
  const reportingDate = new Date(today);
  reportingDate.setDate(reportingDate.getDate() + 4);
  await prisma.leaveRequest.create({
    data: {
      personnelId: personnel.id,
      squadron: "CHARDIKALA",
      leaveType: "AL",
      status: "APPROVED",
      fromDate,
      toDate,
      reportingDate,
      requestedDays: 6,
      balanceBefore: 60,
      balanceReduction: 6,
      balanceAfter: 54,
      sdmApproved: true,
      adjtApproved: true,
      sdmApprovedAt: today,
      adjtApprovedAt: today,
    },
  });
}

console.log(`Replaced ${oldIds.length} old Chardikala records with ${records.length} synthetic records; 9 are on leave.`);
await prisma.$disconnect();
