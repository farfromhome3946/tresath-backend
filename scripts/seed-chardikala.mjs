import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const records = [
  ["IC-80970N", "MAJ", "Manoj Kumar Tiwari", "Officer"],
  ["IC-81498H", "MAJ", "Aman Dhaka", "Officer"],
  ["SS-50034H", "CAPT", "Ajeet Singh Bhinder", "Officer"],
  ["IC-89263L", "CAPT", "Upasak Singh", "Officer"],
  ["JC-249073N", "RIS", "Surjit Singh", "DVR"],
  ["JC-250016L", "RIS", "Rajinder Singh", "DVR"],
  ["JC-251137Y", "RIS", "Rajinder Pal Singh", "DVR"],
  ["JC-251087Y", "RIS", "Yadwinder Singh", "GNR"],
  ["JC-251158P", "RIS", "Gurjit Singh", "GNR"],
  ["JC-251159X", "NB RIS", "Kulwinder Singh", "OPR"],
  ["JC-251423A", "NB RIS", "Jugraj Singh", "GNR"],
  ["JC-251813H", "NB RIS", "Jaswinder Singh", "DVR"],
  ["JC-252338K", "NB RIS", "Navjeet Singh", "DVR"],
  ["JC-252526L", "NB RIS", "Harmail Singh", "OPR"],
  ["15487237L", "DFR", "Ravinder Singh", "DVR"],
  ["15488576X", "DFR", "Sukhwinder Singh", "DVR"],
  ["15489728A", "SDM", "Jernel Singh", "DVR"],
  ["15492433P", "SQMD", "Amarjit Singh", "DVR"],
  ["15492827N", "DFR", "Balvinder Singh", "GNR"],
  ["15494378H", "DFR", "Kamaldeep Singh", "GNR"],
  ["15499896M", "DFR", "Gurjit Singh", "OPR"],
  ["15504368P", "DFR", "Jatinder Singh", "OPR"],
  ["15505290F", "DFR", "Ramandeep Singh", "GNR"],
  ["15505438P", "DFR", "Ranjit Singh", "OPR"],
  ["15506437Y", "DFR", "Gajjan Singh", "GNR"],
  ["15509741N", "DFR", "Vijender Singh", "DVR"],
  ["15509770H", "DFR", "Farminder Singh", "DVR"],
];

function passwordHash(fullName) {
  const firstName = fullName.split(/\s+/)[0];
  const password = `${firstName[0].toUpperCase()}${firstName.slice(1).toLowerCase()}@123`;
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

for (const [serviceNumber, rank, fullName, trade] of records) {
  await prisma.personnel.upsert({
    where: { serviceNumber },
    update: { fullName, rank, trade, squadron: "CHARDIKALA", role: "PERSONNEL", isActive: true },
    create: { serviceNumber, fullName, rank, trade, hometown: "Not provided", squadron: "CHARDIKALA", role: "PERSONNEL", passwordHash: passwordHash(fullName) },
  });
}

console.log(`Imported ${records.length} Chardikala personnel records.`);
await prisma.$disconnect();
