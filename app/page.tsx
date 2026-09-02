"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { Award, Bell, Bot, Briefcase, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Eye, EyeOff, Filter, Fingerprint, HeartPulse, LayoutDashboard, LockKeyhole, LogOut, Megaphone, Menu, Plus, Search, ShieldCheck, Trash2, UserRound, Users, X } from "lucide-react";

type Role = "PERSONNEL" | "SDM" | "ADJT" | "WORTHY_MAJOR";
type TableRow = Record<string, string>;
type ProfileMetadata = { family?: Record<string, string>; military?: Record<string, string>; medical?: Record<string, string>; fitness?: Record<string, string>; courses?: TableRow[]; postings?: TableRow[]; honours?: TableRow[]; medicalHistory?: TableRow[]; medicalExams?: TableRow[]; vaccinations?: TableRow[]; bpetPpt?: TableRow[] };
type Account = { id: string; serviceNumber: string; fullName: string; rank: string; trade: string; hometown: string; role: Role; squadron: string; metadata?: ProfileMetadata; annualLeaveBalance?: number; casualLeaveBalance?: number };
type Amendment = { fromDate: string; toDate: string; reportingDate: string; requestedDays: number; status: "PENDING" | "SDM_APPROVED" | "ADJT_APPROVED" | "APPROVED" | "REJECTED"; sdmApproved: boolean; adjtApproved: boolean; from?: string; to?: string };
type Leave = { id: string; armyNo?: string; name?: string; rank?: string; squadron?: string; type: "AL" | "CL"; from: string; to: string; reportingDate: string; status: string; requestedDays?: number; balanceAfter?: number; amendment?: Amendment | null; sdmApproved?: boolean; adjtApproved?: boolean };
type TDY = { id: string; armyNo?: string; name?: string; rank?: string; squadron?: string; reason: string; location: string; from: string; to: string };
type DailyOrder = { date: string; content: string; postedByName?: string; updatedAt?: string } | null;
type Person = Account & { isActive: boolean };
const API = process.env.NEXT_PUBLIC_API_URL ?? "";
const api = (path: string) => `${API}${path}`;
const SQUADRONS = ["AGNI", "BHARAT", "CHARDIKALA", "JHANGI"];
const LEAVE_ALLOWANCES = { AL: 60, CL: 30 } as const;
const EDUCATION_LEVELS = ["Below Matric", "Matric", "Higher Secondary", "Diploma", "Graduate", "Post-Graduate", "Doctorate"];
const QUALIFICATION_TAGS = ["Drone Course Qualified", "Medically Fit", "CI/CT Tenure Done", "HAA Tenure Done"];
const RANK_ORDER = ["Sowar", "L Dfr", "Dfr", "Nb Ris", "Ris", "Ris Maj", "Lt", "Capt", "Maj", "Lt Col", "Col", "Brig"];


function computeAge(dob?: string) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear = today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

function computeYearsOfService(dateOfEnrolment?: string) {
  return computeAge(dateOfEnrolment);
}

type ListFieldType = "number" | "select" | "text" | "boolean";
type ListFieldDef = { key: string; label: string; type: ListFieldType; options?: string[] };
const LIST_FIELDS: ListFieldDef[] = [
  { key: "age", label: "Age", type: "number" },
  { key: "service", label: "Service (years)", type: "number" },
  { key: "rank", label: "Rank", type: "select", options: RANK_ORDER },
  { key: "education", label: "Qualification (highest degree)", type: "select", options: EDUCATION_LEVELS },
  { key: "nativePlace", label: "Native place", type: "text" },
  { key: "gamesPlayed", label: "Games played", type: "text" },
  { key: "status", label: "Status", type: "select", options: ["Available", "On leave", "On TDY"] },
  { key: "cpt", label: "CPT recorded", type: "boolean" },
  ...QUALIFICATION_TAGS.map((tag) => ({ key: `tag:${tag}`, label: tag, type: "boolean" as const })),
];

type ListFilterBox = { field: string; min: string; max: string; comparator: string; select: string; text: string; bool: string };
const blankListFilterBox = (): ListFilterBox => ({ field: "ANY", min: "", max: "", comparator: "ABOVE", select: "", text: "", bool: "YES" });

function listFieldValue(person: Person, key: string, status: string) {
  const military = person.metadata?.military ?? {};
  if (key === "age") return computeAge(military.dateOfBirth);
  if (key === "service") return computeYearsOfService(military.dateOfEnrolment);
  if (key === "rank") return person.rank;
  if (key === "education") return military.highestDegree || "";
  if (key === "nativePlace") return person.hometown || "";
  if (key === "gamesPlayed") return military.gamesPlayed || "";
  if (key === "status") return status;
  if (key === "cpt") return (person.metadata?.bpetPpt?.length ?? 0) > 0;
  if (key.startsWith("tag:")) {
    const tag = key.slice(4);
    const tags = (military.qualifications || "").split(",").map((value) => value.trim());
    return tags.includes(tag);
  }
  return null;
}

function listBoxPasses(box: ListFilterBox, fieldDef: ListFieldDef, value: unknown) {
  if (box.field === "ANY") return true;
  if (fieldDef.type === "number") {
    if (value === null) return false;
    const numeric = value as number;
    if (box.min !== "" && numeric < Number(box.min)) return false;
    if (box.max !== "" && numeric > Number(box.max)) return false;
    return true;
  }
  if (fieldDef.type === "select") {
    if (box.select === "") return true;
    if (fieldDef.key === "status") return box.select === value;
    const order = fieldDef.options ?? [];
    const valueIndex = order.findIndex((option) => option.toLowerCase() === String(value).toLowerCase());
    const targetIndex = order.findIndex((option) => option.toLowerCase() === box.select.toLowerCase());
    if (valueIndex < 0) return false;
    if (box.comparator === "ABOVE") return valueIndex > targetIndex;
    if (box.comparator === "BELOW") return valueIndex < targetIndex;
    return valueIndex === targetIndex;
  }
  if (fieldDef.type === "text") {
    if (box.text.trim() === "") return true;
    return String(value).toLowerCase().includes(box.text.trim().toLowerCase());
  }
  if (fieldDef.type === "boolean") {
    if (box.bool === "ANY") return true;
    return Boolean(value) === (box.bool === "YES");
  }
  return true;
}

function RajputCrestIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#7a1f2b" />
      <path d="M14 20 L50 44" stroke="#d9ded8" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 20 L14 44" stroke="#d9ded8" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 16 L44 22 V34 C44 42 38 47 32 50 C26 47 20 42 20 34 V22 Z" fill="#d7ae3d" stroke="#5d4720" strokeWidth="1.5" />
      <path d="M32 10 C34 14 34 17 32 20 C30 17 30 14 32 10 Z" fill="#e8622c" />
    </svg>
  );
}

function JatCrestIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#1d6047" />
      <path d="M16 18 L48 46" stroke="#d9ded8" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 18 L16 46" stroke="#d9ded8" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 14 L43 20 V31 C43 39 38 44 32 47 C26 44 21 39 21 31 V20 Z" fill="#d7ae3d" stroke="#5d4720" strokeWidth="1.5" />
      <path d="M24 48 C27 44 29 40 29 36" stroke="#f2c14e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M40 48 C37 44 35 40 35 36" stroke="#f2c14e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 50 C32 45 32 40 32 35" stroke="#f2c14e" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function KhandaIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#0b2e57" />
      <circle cx="32" cy="32" r="18" stroke="#f2c14e" strokeWidth="3" fill="none" />
      <path d="M18 16 L46 48" stroke="#d9ded8" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M46 16 L18 48" stroke="#d9ded8" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 8 L36 14 L34 44 L32 52 L30 44 L28 14 Z" fill="#eef3f5" stroke="#8aa095" strokeWidth="1" />
      <rect x="26" y="17" width="12" height="3.5" rx="1" fill="#f2c14e" />
    </svg>
  );
}

function CavalrySaberIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#33505a" />
      <path d="M16 44 C24 36 30 30 40 20" stroke="#eef3f5" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 44 C40 36 34 30 24 20" stroke="#eef3f5" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="5" fill="#f2c14e" />
    </svg>
  );
}

const SQUADRON_THEME: Record<string, { community: string | null; accent: string; Icon: (props: { size?: number }) => ReactNode }> = {
  AGNI: { community: "Rajput", accent: "#7a1f2b", Icon: RajputCrestIcon },
  BHARAT: { community: "Jat", accent: "#1d6047", Icon: JatCrestIcon },
  CHARDIKALA: { community: "Sikh", accent: "#0b2e57", Icon: KhandaIcon },
  JHANGI: { community: null, accent: "#33505a", Icon: CavalrySaberIcon },
};

function SquadronBadge({ squadron, size = 48, showLabel = true }: { squadron: string; size?: number; showLabel?: boolean }) {
  const theme = SQUADRON_THEME[squadron];
  if (!theme) return null;
  const Icon = theme.Icon;
  return <div className="flex items-center gap-3"><Icon size={size} />{showLabel && <div><p className="text-sm font-black" style={{ color: theme.accent }}>{squadron}</p>{theme.community && <p className="text-[10px] font-bold uppercase tracking-wider text-[#8aa095]">{theme.community} squadron</p>}</div>}</div>;
}

function LeaveBalance({ type, remaining }: { type: "AL" | "CL"; remaining?: number }) {
  const total = LEAVE_ALLOWANCES[type];
  const safeRemaining = Math.max(0, Math.min(total, Number.isFinite(remaining) ? Number(remaining) : total));
  const used = total - safeRemaining;
  const percentage = Math.round((safeRemaining / total) * 100);
  return <div className="rounded-xl border border-[#d8e5dc] bg-[#f7fbf8] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black tracking-wide text-[#214a38]">{type === "AL" ? "Annual Leave" : "Casual Leave"}</p><p className="mt-1 text-xs text-[#789489]">{used} of {total} days availed</p></div><b className="text-lg text-[#1d6047]">{percentage}%</b></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#dfeae2]"><div className="h-full rounded-full bg-[#39835d]" style={{ width: `${percentage}%` }} /></div><div className="mt-3 flex items-end justify-between"><span className="text-xs font-semibold text-[#789489]">{total} days total</span><span className="text-sm font-black text-[#214a38]">{safeRemaining} days remaining</span></div></div>;
}

function calendarDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysElapsedInclusive(fromISO: string, todayISO: string) {
  return Math.floor((new Date(todayISO).getTime() - new Date(fromISO).getTime()) / 86400000) + 1;
}

function dailyEffectiveBalance(committed: number, records: Leave[], type: "AL" | "CL", today: string) {
  let addBack = 0;
  for (const item of records) {
    if (item.type !== type || item.status !== "Approved" || !item.requestedDays) continue;
    const elapsed = today < item.from ? 0 : today > item.to ? item.requestedDays : Math.min(Math.max(daysElapsedInclusive(item.from, today), 0), item.requestedDays);
    addBack += item.requestedDays - elapsed;
  }
  return committed + addBack;
}

export default function Home() {
  const [account, setAccount] = useState<Account | null>(null);
  const [register, setRegister] = useState(false);
  useEffect(() => { void CapacitorUpdater.notifyAppReady(); }, []);
  return account ? <Workspace account={account} setAccount={setAccount} /> : <Auth register={register} setRegister={setRegister} onLogin={setAccount} />;
}

function Auth({ register, setRegister, onLogin }: { register: boolean; setRegister: (value: boolean) => void; onLogin: (account: Account) => void }) {
  const [form, setForm] = useState({ serviceNumber: "", password: "", fullName: "", rank: "Personnel", trade: "General Duty", hometown: "", role: "PERSONNEL", squadron: "AGNI" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch(api("/api/personnel"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, action: register ? "register" : "login" }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Authentication failed."); onLogin(data.account); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to connect to Tresath."); } finally { setBusy(false); } }
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06130d] text-white selection:bg-[#d7ae3d] selection:text-[#06130d]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img src="/ghost-regiment.jpg" alt="" className="absolute left-1/2 top-1/2 h-[min(74vh,42rem)] w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.23] lg:left-[29%] lg:h-[min(78vh,48rem)] lg:w-[min(56vw,48rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,19,13,0.7),rgba(6,19,13,0.3)_50%,rgba(6,19,13,0.9))]" />
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[#9d3032]" />
        <div className="absolute inset-x-0 top-[2px] h-[2px] bg-[#d9ded8]" />
        <div className="absolute inset-x-0 top-[4px] h-[2px] bg-[#d7ae3d]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-24 lg:px-12 xl:px-16">
        <section className="mx-auto flex w-full max-w-lg flex-col items-center text-center lg:mx-0 lg:min-h-[38rem] lg:items-start lg:text-left">
          <div className="flex items-center gap-4">
            <img src="/ghost-regiment.jpg" alt="63 Cavalry insignia" className="h-16 w-16 rounded-full border border-[#d7ae3d]/70 bg-[#08140e] object-cover p-1 shadow-[0_0_28px_rgba(215,174,61,0.18)]" />
            <div className="text-left"><p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#d7ae3d]">63 Cavalry</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">The Ghost Regiment</p></div>
          </div>
          <div className="mt-12 rounded-sm border-y border-white/10 bg-[#06130d]/35 px-6 py-5 text-center backdrop-blur-[1px] lg:mt-auto lg:w-full"><p lang="hi" className="text-3xl font-bold leading-none text-white/70 sm:text-4xl">पराक्रम ही धर्म है</p><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.26em] text-[#d7ae3d]">Parakram hi dharam hai</p></div>
          <div className="mt-6 hidden items-center gap-3 lg:flex"><Fingerprint size={18} className="text-[#d7ae3d]" /><p className="text-xs font-semibold text-white/50">Personal data is secured.</p></div>
        </section>

        <section className="mx-auto w-full max-w-md border border-white/15 bg-[#0a1911]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-6"><div><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#d7ae3d]">Secure access</p><h2 className="mt-2 text-2xl font-black text-white">{register ? "Create profile" : "Sign in"}</h2></div><div className="grid h-10 w-10 place-items-center border border-[#d7ae3d]/35 bg-[#d7ae3d]/10 text-[#d7ae3d]"><LockKeyhole size={18} /></div></div>
          <form onSubmit={submit} className="mt-7 space-y-5">
            {register && <DarkField label="Full name" value={form.fullName} onChange={(value) => update("fullName", value)} />}
            <DarkField label="Army No." value={form.serviceNumber} onChange={(value) => update("serviceNumber", value)} />
            <DarkField label="Password" type={passwordVisible ? "text" : "password"} value={form.password} onChange={(value) => update("password", value)} endAdornment={<button type="button" onClick={() => setPasswordVisible((visible) => !visible)} className="p-1 text-white/45 transition hover:text-[#d7ae3d]" aria-label={passwordVisible ? "Hide password" : "Show password"}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button>} />
            {register && <div className="grid gap-4 sm:grid-cols-2"><DarkSelect label="Profile type" value={form.role} options={["PERSONNEL", "SDM", "ADJT", "WORTHY_MAJOR"]} onChange={(value) => update("role", value)} /><DarkSelect label="Squadron" value={form.squadron} options={SQUADRONS} onChange={(value) => update("squadron", value)} /></div>}
            {error && <p role="alert" className="border-l-2 border-red-400 bg-red-500/10 px-3 py-3 text-xs font-semibold text-red-200">{error}</p>}
            <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 bg-[#d7ae3d] px-4 py-3 text-sm font-black text-[#07120d] transition hover:bg-[#ebc653] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Connecting..." : register ? "Create profile" : "Continue to workspace"}<ChevronRight size={18} /></button>
          </form>
          <button onClick={() => { setRegister(!register); setError(""); }} className="mt-7 text-left text-xs font-bold text-white/55 transition hover:text-[#d7ae3d]">{register ? "Already registered? Sign in" : "First time using Tresath? Create a profile"}</button>
          <p className="mt-7 flex items-center gap-2 border-t border-white/10 pt-5 text-[11px] font-semibold leading-5 text-white/40 lg:hidden"><Fingerprint size={16} className="shrink-0 text-[#d7ae3d]" /> Personal data is secured.</p>
        </section>
      </div>
    </main>
  );
}
function DarkField({ label, value, onChange, type = "text", required = true, endAdornment }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; endAdornment?: ReactNode }) { return <label className="block"><span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</span><span className="flex min-h-12 items-center border border-white/15 bg-white/[0.04] transition focus-within:border-[#d7ae3d]/80"><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/30" />{endAdornment && <span className="mr-2">{endAdornment}</span>}</span></label>; }
function DarkSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-white/40">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-[#cba135]/70">{options.map((option) => <option key={option} className="bg-[#0c1410]">{option}</option>)}</select></label>; }
function Field({ label, value, onChange, type = "text", required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#789589]">{label}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[#d8e3dc] px-4 py-3 text-sm outline-none focus:border-[#5c9b79]" /></label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#789589]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[#d8e3dc] px-3 py-3 text-sm outline-none">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label} value={value} onChange={onChange} type="date" />; }
function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: ReactNode }) { return <section className="rounded-2xl border border-[#d8e5dc] bg-white p-6"><h3 className="mb-6 flex items-center gap-3 font-black text-[#315642]"><span className="rounded-lg bg-[#e5f3e9] p-2 text-[#39835d]"><Icon size={17} /></span>{title}</h3>{children}</section>; }
function Intro({ title, detail }: { title: string; detail: string }) { return <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7d9b8d]">TRESATH WORKSPACE</p><h2 className="mt-2 text-3xl font-black text-[#214a38]">{title}</h2><p className="mt-2 text-sm text-[#789489]">{detail}</p></div>; }
function Status({ value }: { value: string }) { return <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${value === "Approved" ? "bg-[#e2f3e7] text-[#347c55]" : value === "Rejected" ? "bg-[#fae6e5] text-[#ad5652]" : "bg-[#fff1d9] text-[#a8762c]"}`}>{value}</span>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-[#cbded1] p-8 text-center text-sm text-[#829c8f]">{text}</div>; }

function Workspace({ account, setAccount }: { account: Account; setAccount: (account: Account | null) => void }) {
  const command = account.role === "SDM" || account.role === "ADJT";
  const [view, setView] = useState(command ? "overview" : account.role === "WORTHY_MAJOR" ? "orders" : "personal");
  const [menu, setMenu] = useState(false);
  const [leave, setLeave] = useState<Leave[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [tdy, setTdy] = useState<TDY[]>([]);
  const [todayOrder, setTodayOrder] = useState<DailyOrder>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    async function load() {
      const query = account.role === "SDM" ? `?squadron=${account.squadron}` : account.role === "PERSONNEL" || account.role === "WORTHY_MAJOR" ? `?serviceNumber=${encodeURIComponent(account.serviceNumber)}` : "";
      const [leaveResponse, peopleResponse, tdyResponse, orderResponse] = await Promise.all([fetch(api(`/api/leave${query}`)), fetch(api(`/api/personnel${query}`)), fetch(api(`/api/temporary-duty${query}`)), fetch(api(`/api/orders?date=${calendarDate()}`))]);
      if (leaveResponse.ok) setLeave((await leaveResponse.json()).leave ?? []);
      if (peopleResponse.ok) setPeople((await peopleResponse.json()).personnel ?? []);
      if (tdyResponse.ok) setTdy((await tdyResponse.json()).temporaryDuty ?? []);
      if (orderResponse.ok) setTodayOrder((await orderResponse.json()).order ?? null);
    }
    void load();
    if (!command) return;
    const interval = setInterval(() => void load(), 30000);
    return () => clearInterval(interval);
  }, [account.role, account.serviceNumber, account.squadron, command]);
  const nav = command ? [{ id: "overview", text: "Overview", icon: LayoutDashboard }, { id: "assistant", text: "AI assistant", icon: Bot }, { id: "leave", text: "Leave details", icon: ClipboardList }, { id: "tdy", text: "Temporary duty / course", icon: Briefcase }, { id: "reports", text: "Make a list", icon: Filter }, { id: "orders", text: "Worthy Major's orders", icon: Megaphone }, { id: "people", text: "All personnel", icon: Users }] : [{ id: "personal", text: "Personal details", icon: UserRound }, { id: "medical", text: "Medical details", icon: HeartPulse }, { id: "courses", text: "Courses & qualifications", icon: Award }, { id: "fitness", text: "CPT results", icon: ShieldCheck }, { id: "assistant", text: "AI assistant", icon: Bot }, { id: "leave", text: "Leave details", icon: CalendarDays }, { id: "tdy", text: "Temporary duty / course", icon: Briefcase }, { id: "orders", text: "Worthy Major's orders", icon: Megaphone }];
  const titles: Record<string, string> = { overview: "Command overview", assistant: "AI assistant", leave: command ? "Leave details" : "Leave details", tdy: "Temporary duty / course", reports: "Make a list", orders: "Worthy Major's orders", people: "All personnel", personal: "Personal details", medical: "Medical details", courses: "Courses & qualifications", fitness: "CPT results" };
  return <div className="min-h-screen bg-[#edf3ef] text-[#1c3e30]">{command && <PendingNotifications account={account} leave={leave} onUpdated={(updated) => setLeave((current) => current.map((item) => item.id === updated.id ? updated : item))} />}<aside className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-[#d8e6dd] bg-[#f8fbf9] p-6 lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}><b className="tracking-[0.2em]">TRESATH<small className="block text-[10px] tracking-[0.3em] text-[#7c9b8b]">63 CAVALRY</small></b><p className="mt-12 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8aa296]">{account.role} workspace</p><nav className="mt-4 space-y-1">{nav.map((item) => <button key={item.id} onClick={() => { setView(item.id); setMenu(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${view === item.id ? "bg-[#dff1e5] text-[#1c684c]" : "text-[#6b8779]"}`}><item.icon size={17} />{item.text}</button>)}</nav></aside><div className="lg:pl-72"><header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#d9e5dd] bg-[#edf3ef]/90 px-5 py-4 backdrop-blur sm:px-8"><button onClick={() => setMenu(!menu)} className="p-2 lg:hidden" aria-label="Open menu"><Menu size={21} /></button><div className="flex items-center gap-3">{!(command && account.role === "ADJT") && <SquadronBadge squadron={account.squadron} size={34} showLabel={false} />}<div><p className="text-xs font-bold uppercase tracking-wider text-[#86a095]">{command && account.role === "ADJT" ? "All squadrons" : `${account.squadron} squadron`}</p><h1 className="mt-1 text-xl font-black text-[#214a38]">{titles[view]}</h1></div></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-bold">{account.fullName}</p><p className="text-[11px] text-[#7d988b]">{account.rank} · {account.role}</p></div><button onClick={() => setAccount(null)} className="rounded-xl border border-[#d3e2d8] bg-white p-2.5 text-[#a44d49]" aria-label="Sign out"><LogOut size={17} /></button></div></header><main className="mx-auto max-w-7xl p-5 sm:p-8">{notice && <p className="mb-5 rounded-xl border border-[#bde1c8] bg-[#e7f7eb] p-3 text-sm font-semibold text-[#2e7950]">{notice}</p>}{view !== "orders" && todayOrder?.content && <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#ffd6a5] bg-[#fff9f0] p-4"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff1d9] text-[#a8762c]"><Megaphone size={16} /></span><div><p className="text-xs font-black uppercase tracking-wider text-[#a8762c]">Worthy Major&apos;s order · Today</p><p className="mt-1 whitespace-pre-line text-sm font-semibold text-[#5d4720]">{todayOrder.content}</p></div></div>}{["personal", "medical", "courses", "fitness"].includes(view) && <ProfileSections account={account} section={view} onSaved={(updated) => { setAccount(updated); setNotice("Profile details saved."); }} />}{view === "overview" && <Overview account={account} leave={leave} people={people} tdy={tdy} />}{view === "leave" && (command ? <LeaveBoard account={account} leave={leave} people={people} tdy={tdy} onUpdated={(updated) => setLeave((current) => current.map((item) => item.id === updated.id ? updated : item))} /> : <Availed account={account} leave={leave} onAdded={(record) => { setLeave((current) => [record, ...current]); setNotice(record.status === "Pending" ? "Leave request sent for approval." : "Availed leave saved."); }} />)}{view === "tdy" && (command ? <TdyBoard tdy={tdy} /> : <TdyForm account={account} tdy={tdy} onAdded={(record) => { setTdy((current) => [record, ...current]); setNotice("Temporary duty / course record saved."); }} />)}{view === "reports" && command && <ListBuilder account={account} people={people} leave={leave} tdy={tdy} />}{view === "orders" && <OrdersBoard account={account} />}{view === "people" && <People people={people} />}</main></div></div>;
}

type PendingNotice = { id: string; kind: "request" | "amendment"; leave: Leave };

function PendingNotifications({ account, leave, onUpdated }: { account: Account; leave: Leave[]; onUpdated: (leave: Leave) => void }) {
  const seenKey = `tresath_seen_notifications_${account.serviceNumber}`;
  const [initialSeen] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(seenKey) || "[]") as string[]); } catch { return new Set(); }
  });
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const candidates: PendingNotice[] = [];
  for (const item of leave) {
    if (item.status !== "Approved" && item.status !== "Rejected") {
      const approvedByMe = account.role === "SDM" ? item.sdmApproved : item.adjtApproved;
      if (!approvedByMe) candidates.push({ id: `request-${item.id}`, kind: "request", leave: item });
    }
    if (item.amendment && item.amendment.status !== "APPROVED" && item.amendment.status !== "REJECTED") {
      const approvedByMe = account.role === "SDM" ? item.amendment.sdmApproved : item.amendment.adjtApproved;
      if (!approvedByMe) candidates.push({ id: `amendment-${item.id}`, kind: "amendment", leave: item });
    }
  }
  const toasts = candidates.filter((candidate) => !initialSeen.has(candidate.id) && !dismissed.has(candidate.id));

  useEffect(() => {
    let stored: string[] = [];
    try { stored = JSON.parse(localStorage.getItem(seenKey) || "[]") as string[]; } catch { stored = []; }
    const storedSet = new Set(stored);
    let changed = false;
    for (const candidate of candidates) { if (!storedSet.has(candidate.id)) { storedSet.add(candidate.id); changed = true; } }
    if (changed) { try { localStorage.setItem(seenKey, JSON.stringify([...storedSet])); } catch { /* ignore */ } }
  });

  async function decide(notice: PendingNotice, approve: boolean) {
    setBusyId(notice.id);
    try {
      const action = notice.kind === "amendment" ? (approve ? "approve_amendment" : "reject_amendment") : (approve ? "approve" : "reject");
      const response = await fetch(api("/api/leave"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notice.leave.id, action, actorRole: account.role }) });
      if (response.ok) { onUpdated((await response.json()).leave); setDismissed((current) => new Set(current).add(notice.id)); }
    } finally {
      setBusyId(null);
    }
  }

  if (!toasts.length) return null;
  return (
    <div className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 sm:right-6 sm:top-6">
      {toasts.map((toast) => (
        <div key={toast.id} className="rounded-2xl border border-[#d8e5dc] bg-white p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e5f3e9] text-[#1d6047]"><Bell size={16} /></span>
              <div>
                <p className="text-sm font-bold text-[#214a38]">{toast.leave.name ?? "Personnel"} wants leave</p>
                <p className="mt-1 text-xs text-[#58786a]">{toast.kind === "amendment" && toast.leave.amendment ? <>Modification: {toast.leave.amendment.from} to {toast.leave.amendment.to}</> : <>{toast.leave.from} to {toast.leave.to} · {toast.leave.type}</>}</p>
              </div>
            </div>
            <button onClick={() => setDismissed((current) => new Set(current).add(toast.id))} className="p-1 text-[#8aa095] hover:text-[#5a7568]" aria-label="Dismiss"><X size={15} /></button>
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={busyId === toast.id} onClick={() => decide(toast, true)} className="flex-1 rounded-lg bg-[#1d6047] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Approve</button>
            <button disabled={busyId === toast.id} onClick={() => decide(toast, false)} className="flex-1 rounded-lg border border-[#e3ece6] px-3 py-2 text-xs font-bold text-[#a44d49] disabled:opacity-60">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersBoard({ account }: { account: Account }) {
  const canPost = account.role === "WORTHY_MAJOR";
  const [selectedDate, setSelectedDate] = useState(calendarDate());
  const [order, setOrder] = useState<DailyOrder>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const response = await fetch(api(`/api/orders?date=${selectedDate}`));
        if (!response.ok) throw new Error("Unable to load orders.");
        const data = await response.json();
        if (!cancelled) { setOrder(data.order ?? null); setDraft(data.order?.content ?? ""); }
      } catch {
        if (!cancelled) setError("Unable to load orders for this date.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [selectedDate]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(api("/api/orders"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: selectedDate, content: draft, serviceNumber: account.serviceNumber }) });
      const data = await response.json();
      if (response.ok) { setOrder(data.order); setNotice("Order posted."); } else { setError(data.error || "Unable to save the order."); }
    } catch {
      setError("Unable to connect to server.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <Intro title="Worthy Major's orders" detail="The order of the day, posted by the Worthy Major. Browse any past or future date below." />
    <Panel title="Select date" icon={CalendarDays}>
      <DateInput label="Date" value={selectedDate} onChange={setSelectedDate} />
    </Panel>
    <Panel title={selectedDate === calendarDate() ? "Today's order" : `Order for ${selectedDate}`} icon={Megaphone}>
      {loading ? <p className="text-sm text-[#789489]">Loading...</p> : canPost ? (
        <div>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={6} placeholder="Write the order for this date..." className="w-full rounded-xl border border-[#d8e3dc] px-4 py-3 text-sm outline-none focus:border-[#5c9b79]" />
          {error && <p role="alert" className="mt-3 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{error}</p>}
          {notice && <p className="mt-3 rounded-xl border border-[#bde1c8] bg-[#e7f7eb] p-3 text-sm font-semibold text-[#2e7950]">{notice}</p>}
          <button disabled={saving} onClick={() => void save()} className="mt-4 rounded-xl bg-[#1d6047] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Post order"}</button>
          {order?.postedByName && <p className="mt-3 text-xs text-[#8aa095]">Last posted by {order.postedByName}</p>}
        </div>
      ) : order?.content ? (
        <div>
          <p className="whitespace-pre-line text-sm font-semibold text-[#214a38]">{order.content}</p>
          {order.postedByName && <p className="mt-3 text-xs text-[#8aa095]">Posted by {order.postedByName}</p>}
        </div>
      ) : <Empty text="No orders posted for this date." />}
    </Panel>
  </>;
}

function AIAssistant({ account, leave, people }: { account: Account; leave: Leave[]; people: Person[] }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: `Welcome, ${account.fullName}. I can help review leave status, summarize personnel data, and suggest actions for ${account.role === "ADJT" ? "all squadrons" : account.squadron}.` }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    const nextMessages: Array<{ role: "user" | "assistant"; text: string }> = [...messages, { role: "user", text: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const response = await fetch(api("/api/assistant"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          context: {
            role: account.role,
            squadron: account.squadron,
            serviceNumber: account.serviceNumber,
            leaveCount: leave.length,
            peopleCount: people.length,
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to reach the AI assistant.");
      setMessages((current) => [...current, { role: "assistant", text: data.answer ?? "I do not have a response yet." }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to connect to the assistant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Intro title="AI assistant" detail="Ask for summaries, leave insights, command guidance, and quick next steps from your Azure AI Foundry connected assistant." />
      <section className="rounded-2xl border border-[#d8e5dc] bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e5f3e9] text-[#1d6047]"><Bot size={20} /></span>
            <div>
              <p className="text-sm font-black text-[#214a38]">Tresath command assistant</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#7d9b8d]">Azure AI Foundry</p>
            </div>
          </div>
        </div>

        <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-[#e3ece6] bg-[#f7faf8] p-4">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "assistant" ? "bg-[#eaf5ee] text-[#1c3e30]" : "ml-auto bg-[#123a2d] text-white"}`}>
              {message.text}
            </div>
          ))}
        </div>

        {error && <p role="alert" className="mt-3 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{error}</p>}

        <form onSubmit={sendMessage} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about leave, squadron readiness, or next actions..."
            className="w-full rounded-xl border border-[#d8e3dc] bg-[#f9fbfa] px-4 py-3 text-sm outline-none focus:border-[#5c9b79]"
          />
          <button disabled={busy} className="rounded-xl bg-[#1d6047] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
            {busy ? "Thinking..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Profile({ account, onSaved }: { account: Account; onSaved: (account: Account) => void }) {
  const family = account.metadata?.family ?? {};
  const military = account.metadata?.military ?? {};
  const medical = account.metadata?.medical ?? {};
  const fitness = account.metadata?.fitness ?? {};
  const [form, setForm] = useState({
    serviceNumber: account.serviceNumber, fullName: account.fullName, rank: account.rank, trade: account.trade, hometown: account.hometown,
    parentUnit: military.parentUnit ?? "", presentUnit: military.presentUnit ?? "", dateOfBirth: military.dateOfBirth ?? "", dateOfEnrolment: military.dateOfEnrolment ?? "", dateOfPresentRank: military.dateOfPresentRank ?? "", superannuationDate: military.superannuationDate ?? "", totalService: military.totalService ?? "", coursesAttended: military.coursesAttended ?? "", courseInstitution: military.courseInstitution ?? "", courseGradings: military.courseGradings ?? "", courseCompletionDate: military.courseCompletionDate ?? "", postings: military.postings ?? "", decorations: military.decorations ?? "", securityClearance: military.securityClearance ?? "", conductRecord: military.conductRecord ?? "",
    nokName: family.nokName ?? "", nokRelationship: family.nokRelationship ?? "", nokContact: family.nokContact ?? "", alternateContact: family.alternateContact ?? "", permanentAddress: family.permanentAddress ?? "", dependentName: family.dependentName ?? "", dependentRelation: family.dependentRelation ?? "", dependentDob: family.dependentDob ?? "", nationalId: family.nationalId ?? "", dependencyStatus: family.dependencyStatus ?? "Active", dependentOccupation: family.dependentOccupation ?? "", schoolDetails: family.schoolDetails ?? "", educationAllowance: family.educationAllowance ?? "", welfareActivities: family.welfareActivities ?? "", emergencyContact: family.emergencyContact ?? "", emergencyRelation: family.emergencyRelation ?? "", emergencyPhone: family.emergencyPhone ?? "",
    shapeS: medical.shapeS ?? "", shapeH: medical.shapeH ?? "", shapeA: medical.shapeA ?? "", shapeP: medical.shapeP ?? "", shapeE: medical.shapeE ?? "", medicalCategory: medical.medicalCategory ?? "SHAPE-1", lastMedicalBoard: medical.lastMedicalBoard ?? "", nextReviewDate: medical.nextReviewDate ?? "", surgeries: medical.surgeries ?? "", chronicConditions: medical.chronicConditions ?? "", medications: medical.medications ?? "", allergies: medical.allergies ?? "", height: medical.height ?? "", weight: medical.weight ?? "", ibw: medical.ibw ?? "", bmi: medical.bmi ?? "", bloodGroup: medical.bloodGroup ?? "", rhFactor: medical.rhFactor ?? "", ameDate: medical.ameDate ?? "", vaccinations: medical.vaccinations ?? "",
    testDate: fitness.testDate ?? "", runTime: fitness.runTime ?? "", pushups: fitness.pushups ?? "", situps: fitness.situps ?? "", obstacleResults: fitness.obstacleResults ?? "", fitnessGrade: fitness.fitnessGrade ?? ""
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const field = (label: string, key: keyof typeof form, type = "text", required = false) => <Field label={label} value={form[key]} onChange={(value) => set(key, value)} type={type} required={required} />;
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const response = await fetch(api("/api/personnel"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceNumber: account.serviceNumber, fullName: form.fullName, rank: form.rank, trade: form.trade, hometown: form.hometown, metadata: { military: { parentUnit: form.parentUnit, presentUnit: form.presentUnit, dateOfBirth: form.dateOfBirth, dateOfEnrolment: form.dateOfEnrolment, dateOfPresentRank: form.dateOfPresentRank, superannuationDate: form.superannuationDate, totalService: form.totalService, coursesAttended: form.coursesAttended, courseInstitution: form.courseInstitution, courseGradings: form.courseGradings, courseCompletionDate: form.courseCompletionDate, postings: form.postings, decorations: form.decorations, securityClearance: form.securityClearance, conductRecord: form.conductRecord }, family: { nokName: form.nokName, nokRelationship: form.nokRelationship, nokContact: form.nokContact, alternateContact: form.alternateContact, permanentAddress: form.permanentAddress, dependentName: form.dependentName, dependentRelation: form.dependentRelation, dependentDob: form.dependentDob, nationalId: form.nationalId, dependencyStatus: form.dependencyStatus, dependentOccupation: form.dependentOccupation, schoolDetails: form.schoolDetails, educationAllowance: form.educationAllowance, welfareActivities: form.welfareActivities, emergencyContact: form.emergencyContact, emergencyRelation: form.emergencyRelation, emergencyPhone: form.emergencyPhone }, medical: { shapeS: form.shapeS, shapeH: form.shapeH, shapeA: form.shapeA, shapeP: form.shapeP, shapeE: form.shapeE, medicalCategory: form.medicalCategory, lastMedicalBoard: form.lastMedicalBoard, nextReviewDate: form.nextReviewDate, surgeries: form.surgeries, chronicConditions: form.chronicConditions, medications: form.medications, allergies: form.allergies, height: form.height, weight: form.weight, ibw: form.ibw, bmi: form.bmi, bloodGroup: form.bloodGroup, rhFactor: form.rhFactor, ameDate: form.ameDate, vaccinations: form.vaccinations }, fitness: { testDate: form.testDate, runTime: form.runTime, pushups: form.pushups, situps: form.situps, obstacleResults: form.obstacleResults, fitnessGrade: form.fitnessGrade } } }) }); const data = await response.json(); if (response.ok) onSaved(data.account); }
  return <form onSubmit={save}><Intro title="Service record" detail="Maintain one secure profile for service, family, medical, and fitness readiness." /><div className="grid gap-6 xl:grid-cols-2"><Panel title="Core profile" icon={UserRound}><div className="grid gap-4 sm:grid-cols-2">{field("Full name", "fullName", "text", true)}{field("Army / service no.", "serviceNumber")}{field("Rank", "rank", "text", true)}{field("Arm / service", "trade", "text", true)}{field("Parent unit", "parentUnit")}{field("Present unit", "presentUnit")}{field("Date of birth", "dateOfBirth", "date")}{field("Hometown / address", "hometown", "text", true)}</div></Panel><Panel title="Service milestones" icon={ShieldCheck}><div className="grid gap-4 sm:grid-cols-2">{field("Date of enrolment / commission", "dateOfEnrolment", "date")}{field("Date of present rank", "dateOfPresentRank", "date")}{field("Total length of service", "totalService")}{field("Superannuation date", "superannuationDate", "date")}{field("Security clearance", "securityClearance")}{field("Conduct / ACR summary", "conductRecord")}</div></Panel><Panel title="Courses & qualifications" icon={Award}><div className="grid gap-4 sm:grid-cols-2">{field("Course name", "coursesAttended")}{field("Institution", "courseInstitution")}{field("Grading / class", "courseGradings")}{field("Completion date", "courseCompletionDate", "date")}{field("Postings & deployments", "postings")}{field("Decorations & honours", "decorations")}</div></Panel><Panel title="Family & next of kin" icon={Users}><div className="grid gap-4 sm:grid-cols-2">{field("Primary NOK name", "nokName")}{field("NOK relationship", "nokRelationship")}{field("NOK contact number", "nokContact")}{field("Alternate contact", "alternateContact")}{field("Permanent address", "permanentAddress")}{field("Dependent name", "dependentName")}{field("Dependent relationship", "dependentRelation")}{field("Dependent date of birth", "dependentDob", "date")}{field("Aadhar / national ID", "nationalId")}{field("Dependency status", "dependencyStatus")}{field("Dependent occupation", "dependentOccupation")}{field("School / college details", "schoolDetails")}{field("Education allowance", "educationAllowance")}{field("AWWA / welfare activities", "welfareActivities")}{field("Emergency contact", "emergencyContact")}{field("Emergency relation", "emergencyRelation")}{field("Verified emergency phone", "emergencyPhone")}</div></Panel><Panel title="Medical classification & history" icon={HeartPulse}><div className="grid gap-4 sm:grid-cols-2">{field("SHAPE - Psychiatric (S)", "shapeS")}{field("SHAPE - Hearing (H)", "shapeH")}{field("SHAPE - Appendages (A)", "shapeA")}{field("SHAPE - Physical capacity (P)", "shapeP")}{field("SHAPE - Eyesight (E)", "shapeE")}{field("Current medical category", "medicalCategory")}{field("Last medical board", "lastMedicalBoard", "date")}{field("Next review date", "nextReviewDate", "date")}{field("Major surgeries / hospital", "surgeries")}{field("Chronic conditions", "chronicConditions")}{field("Prescribed medications", "medications")}{field("Allergies", "allergies")}</div></Panel><Panel title="Physical parameters & checkups" icon={HeartPulse}><div className="grid gap-4 sm:grid-cols-2">{field("Height (cm)", "height", "number")}{field("Weight (kg)", "weight", "number")}{field("Ideal body weight", "ibw", "number")}{field("BMI", "bmi", "number")}{field("Blood group", "bloodGroup")}{field("Rh factor", "rhFactor")}{field("Annual medical exam date", "ameDate", "date")}{field("Vaccination log", "vaccinations")}</div></Panel><Panel title="BPET / PPT fitness test" icon={Award}><div className="grid gap-4 sm:grid-cols-2">{field("Test date", "testDate", "date")}{field("2.4 km / 5 km run time", "runTime")}{field("Push-ups", "pushups", "number")}{field("Sit-ups", "situps", "number")}{field("Rope / ditch results", "obstacleResults")}{field("Overall grade", "fitnessGrade")}</div></Panel></div><button className="mt-6 rounded-xl bg-[#1d6047] px-5 py-3 text-sm font-bold text-white">Save service record</button></form>;
}

type RecordColumn = { key: string; label: string; type?: string };
const courseColumns: RecordColumn[] = [{ key: "course", label: "Course" }, { key: "institution", label: "Institution" }, { key: "grade", label: "Grade" }, { key: "completed", label: "Completion date", type: "date" }];
const postingColumns: RecordColumn[] = [{ key: "unit", label: "Unit / appointment" }, { key: "location", label: "Location" }, { key: "from", label: "From", type: "date" }, { key: "to", label: "To", type: "date" }];
const honourColumns: RecordColumn[] = [{ key: "honour", label: "Honour / decoration" }, { key: "year", label: "Year" }, { key: "citation", label: "Citation / remarks" }];
const medicalHistoryColumns: RecordColumn[] = [{ key: "date", label: "Date", type: "date" }, { key: "condition", label: "Condition / procedure" }, { key: "treatment", label: "Treatment" }, { key: "remarks", label: "Hospital / remarks" }];
const medicalExamColumns: RecordColumn[] = [{ key: "date", label: "Exam date", type: "date" }, { key: "category", label: "Medical category / SHAPE" }, { key: "height", label: "Height (cm)", type: "number" }, { key: "weight", label: "Weight (kg)", type: "number" }, { key: "bmi", label: "BMI", type: "number" }, { key: "bloodGroup", label: "Blood group" }];
const vaccinationColumns: RecordColumn[] = [{ key: "date", label: "Date", type: "date" }, { key: "vaccine", label: "Vaccine" }, { key: "dose", label: "Dose" }, { key: "remarks", label: "Remarks" }];
const fitnessColumns: RecordColumn[] = [{ key: "date", label: "Test date", type: "date" }, { key: "runTime", label: "Run time" }, { key: "pushups", label: "Push-ups", type: "number" }, { key: "situps", label: "Sit-ups", type: "number" }, { key: "obstacles", label: "Rope / ditch" }, { key: "grade", label: "Grade" }];

function blankRow(columns: RecordColumn[]) { return Object.fromEntries(columns.map((column) => [column.key, ""])) as TableRow; }
function legacyRows(rows: TableRow[] | undefined, columns: RecordColumn[], legacy?: TableRow) { return rows?.length ? rows : legacy && Object.values(legacy).some(Boolean) ? [{ ...blankRow(columns), ...legacy }] : []; }
function RecordTableEditor({ title, columns, rows, onChange }: { title: string; columns: RecordColumn[]; rows: TableRow[]; onChange: (rows: TableRow[]) => void }) { return <Panel title={title} icon={ClipboardList}><div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="border-b border-[#e3ece6] text-[10px] uppercase tracking-wider text-[#8aa095]"><tr>{columns.map((column) => <th key={column.key} className="pb-3 pr-3">{column.label}</th>)}<th className="w-12 pb-3"><span className="sr-only">Remove</span></th></tr></thead><tbody className="divide-y divide-[#edf2ee]">{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column.key} className="py-2 pr-3"><input type={column.type ?? "text"} value={row[column.key] ?? ""} onChange={(event) => onChange(rows.map((current, rowIndex) => rowIndex === index ? { ...current, [column.key]: event.target.value } : current))} className="w-full min-w-28 border border-[#d8e3dc] bg-white px-2.5 py-2 text-sm outline-none focus:border-[#5c9b79]" /></td>)}<td className="py-2"><button type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} className="p-2 text-[#a44d49] hover:bg-[#fae6e5]" aria-label={`Remove ${title} entry`}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div><button type="button" onClick={() => onChange([...rows, blankRow(columns)])} className="mt-4 flex items-center gap-2 border border-[#bcd8c6] px-3 py-2 text-xs font-bold text-[#287052] hover:bg-[#e5f3e9]"><Plus size={15} />Add entry</button></Panel>; }
function RecordTable({ title, columns, rows }: { title: string; columns: RecordColumn[]; rows: TableRow[] }) { return <Panel title={title} icon={ClipboardList}>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-[#e3ece6] text-[10px] uppercase tracking-wider text-[#8aa095]"><tr>{columns.map((column) => <th key={column.key} className="pb-3 pr-4">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-[#edf2ee]">{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column.key} className="py-3 pr-4 text-[#315642]">{row[column.key] || "-"}</td>)}</tr>)}</tbody></table></div> : <Empty text={`No ${title.toLowerCase()} entries recorded.`} />}</Panel>; }

function ProfileSections({ account, section, onSaved }: { account: Account; section: string; onSaved: (account: Account) => void }) {
  const metadata = account.metadata ?? {};
  const military = metadata.military ?? {};
  const medical = metadata.medical ?? {};
  const fitness = metadata.fitness ?? {};
  const [personal, setPersonal] = useState({ fullName: account.fullName, rank: account.rank, trade: account.trade, hometown: account.hometown, parentUnit: military.parentUnit ?? "", presentUnit: military.presentUnit ?? "", dateOfBirth: military.dateOfBirth ?? "", dateOfEnrolment: military.dateOfEnrolment ?? "", dateOfPresentRank: military.dateOfPresentRank ?? "", superannuationDate: military.superannuationDate ?? "", totalService: military.totalService ?? "", securityClearance: military.securityClearance ?? "", conductRecord: military.conductRecord ?? "", highestDegree: military.highestDegree ?? "", numberOfChildren: military.numberOfChildren ?? "", gamesPlayed: military.gamesPlayed ?? "", qualifications: military.qualifications ?? "" });
  const [courses, setCourses] = useState(() => legacyRows(metadata.courses, courseColumns, { course: military.coursesAttended ?? "", institution: military.courseInstitution ?? "", grade: military.courseGradings ?? "", completed: military.courseCompletionDate ?? "" }));
  const [postings, setPostings] = useState(() => legacyRows(metadata.postings, postingColumns, { unit: military.postings ?? "" }));
  const [honours, setHonours] = useState(() => legacyRows(metadata.honours, honourColumns, { honour: military.decorations ?? "" }));
  const [medicalHistory, setMedicalHistory] = useState(() => legacyRows(metadata.medicalHistory, medicalHistoryColumns, { condition: medical.chronicConditions ?? "", treatment: medical.medications ?? "", remarks: medical.surgeries ?? "" }));
  const [medicalExams, setMedicalExams] = useState(() => legacyRows(metadata.medicalExams, medicalExamColumns, { date: medical.ameDate ?? "", category: medical.medicalCategory ?? "", height: medical.height ?? "", weight: medical.weight ?? "", bmi: medical.bmi ?? "", bloodGroup: medical.bloodGroup ?? "" }));
  const [vaccinations, setVaccinations] = useState(() => legacyRows(metadata.vaccinations, vaccinationColumns, { vaccine: medical.vaccinations ?? "" }));
  const [fitnessRows, setFitnessRows] = useState(() => legacyRows(metadata.bpetPpt, fitnessColumns, { date: fitness.testDate ?? "", runTime: fitness.runTime ?? "", pushups: fitness.pushups ?? "", situps: fitness.situps ?? "", obstacles: fitness.obstacleResults ?? "", grade: fitness.fitnessGrade ?? "" }));
  async function save() { const nextMetadata: ProfileMetadata = { ...metadata, military: { ...military, parentUnit: personal.parentUnit, presentUnit: personal.presentUnit, dateOfBirth: personal.dateOfBirth, dateOfEnrolment: personal.dateOfEnrolment, dateOfPresentRank: personal.dateOfPresentRank, superannuationDate: personal.superannuationDate, totalService: personal.totalService, securityClearance: personal.securityClearance, conductRecord: personal.conductRecord, highestDegree: personal.highestDegree, numberOfChildren: personal.numberOfChildren, gamesPlayed: personal.gamesPlayed, qualifications: personal.qualifications }, courses, postings, honours, medicalHistory, medicalExams, vaccinations, bpetPpt: fitnessRows }; const response = await fetch(api("/api/personnel"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceNumber: account.serviceNumber, ...(section === "personal" ? { fullName: personal.fullName, rank: personal.rank, trade: personal.trade, hometown: personal.hometown } : {}), metadata: nextMetadata }) }); if (response.ok) onSaved((await response.json()).account); }
  const personalField = (label: string, key: keyof typeof personal, type = "text") => <Field label={label} value={personal[key]} onChange={(value) => setPersonal((current) => ({ ...current, [key]: value }))} type={type} required={key === "fullName" || key === "rank" || key === "trade" || key === "hometown"} />;
  const content = section === "personal" ? <div className="grid gap-6 xl:grid-cols-2"><Panel title="Service profile" icon={UserRound}><div className="grid gap-4 sm:grid-cols-2">{personalField("Full name", "fullName")}<div className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#789589]">Army / service no.</span><p className="border border-[#d8e3dc] bg-[#f5f9f6] px-4 py-3 text-sm font-semibold">{account.serviceNumber}</p></div>{personalField("Rank", "rank")}{personalField("Arm / service", "trade")}{personalField("Parent unit", "parentUnit")}{personalField("Present unit", "presentUnit")}{personalField("Date of birth", "dateOfBirth", "date")}{personalField("Hometown / address", "hometown")}<Select label="Highest degree achieved" value={personal.highestDegree} options={["", ...EDUCATION_LEVELS]} onChange={(value) => setPersonal((current) => ({ ...current, highestDegree: value }))} />{personalField("Number of children", "numberOfChildren", "number")}</div></Panel><Panel title="Service milestones" icon={ShieldCheck}><div className="grid gap-4 sm:grid-cols-2">{personalField("Date of enrolment / commission", "dateOfEnrolment", "date")}{personalField("Date of present rank", "dateOfPresentRank", "date")}{personalField("Total length of service", "totalService")}{personalField("Superannuation date", "superannuationDate", "date")}{personalField("Security clearance", "securityClearance")}{personalField("Conduct / ACR summary", "conductRecord")}</div></Panel></div> : section === "medical" ? <div className="grid gap-6"><RecordTableEditor title="Medical history" columns={medicalHistoryColumns} rows={medicalHistory} onChange={setMedicalHistory} /><RecordTableEditor title="Medical examinations" columns={medicalExamColumns} rows={medicalExams} onChange={setMedicalExams} /><RecordTableEditor title="Vaccination log" columns={vaccinationColumns} rows={vaccinations} onChange={setVaccinations} /></div> : section === "courses" ? <div className="grid gap-6"><RecordTableEditor title="Courses & qualifications" columns={courseColumns} rows={courses} onChange={setCourses} /><RecordTableEditor title="Postings & deployments" columns={postingColumns} rows={postings} onChange={setPostings} /><RecordTableEditor title="Honours & decorations" columns={honourColumns} rows={honours} onChange={setHonours} /><Panel title="Special qualifications & tenures" icon={ShieldCheck}><div className="grid gap-4 sm:grid-cols-2">{personalField("Games played", "gamesPlayed")}</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{QUALIFICATION_TAGS.map((tag) => { const selected = personal.qualifications.split(",").map((value) => value.trim()).filter(Boolean); const checked = selected.includes(tag); return <label key={tag} className="flex items-center gap-2 rounded-xl border border-[#d8e3dc] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={(event) => { const next = event.target.checked ? [...selected, tag] : selected.filter((value) => value !== tag); setPersonal((current) => ({ ...current, qualifications: next.join(", ") })); }} />{tag}</label>; })}</div></Panel></div> : <RecordTableEditor title="CPT results" columns={fitnessColumns} rows={fitnessRows} onChange={setFitnessRows} />;
  const detail = section === "personal" ? "Maintain core service and personal information." : section === "medical" ? "Keep a dated history of medical care, examinations, and vaccinations." : section === "courses" ? "Add each course, posting, and honour as its own record." : "Record every CPT assessment separately.";
  return <><Intro title={section === "personal" ? "Personal details" : section === "medical" ? "Medical details" : section === "courses" ? "Courses & qualifications" : "CPT results"} detail={detail} />{content}<button type="button" onClick={() => void save()} className="mt-6 bg-[#1d6047] px-5 py-3 text-sm font-bold text-white">Save {section === "personal" ? "details" : "records"}</button></>;
}

function Availed({ account, leave, onAdded }: { account: Account; leave: Leave[]; onAdded: (record: Leave) => void }) {
  const [form, setForm] = useState({ mode: "AVAILED", leaveType: "AL", fromDate: "", toDate: "", reportingDate: "", requestedDays: "" });
  const [balances, setBalances] = useState({ AL: account.annualLeaveBalance, CL: account.casualLeaveBalance });
  const today = calendarDate();
  const displayBalances = { AL: dailyEffectiveBalance(balances.AL ?? LEAVE_ALLOWANCES.AL, leave, "AL", today), CL: dailyEffectiveBalance(balances.CL ?? LEAVE_ALLOWANCES.CL, leave, "CL", today) };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amendForm, setAmendForm] = useState({ fromDate: "", toDate: "", reportingDate: "", requestedDays: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const setAmend = (key: keyof typeof amendForm, value: string) => setAmendForm((current) => ({ ...current, [key]: value }));
  const days = form.fromDate && form.toDate ? Math.floor((new Date(form.toDate).getTime() - new Date(form.fromDate).getTime()) / 86400000) + 1 : 0;
  const amendDays = amendForm.fromDate && amendForm.toDate ? Math.floor((new Date(amendForm.toDate).getTime() - new Date(amendForm.fromDate).getTime()) / 86400000) + 1 : 0;
  
  async function submit(event: FormEvent<HTMLFormElement>) { 
    event.preventDefault(); 
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(api("/api/leave"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recordType: form.mode, serviceNumber: account.serviceNumber, requestedDays: Number(form.requestedDays || days) })
      });
      const data = await response.json();
      if (response.ok) {
        onAdded(data.leave);
        setBalances((current) => ({ ...current, [data.leave.type]: data.leave.balanceAfter }));
        setForm({ mode: form.mode, leaveType: "AL", fromDate: "", toDate: "", reportingDate: "", requestedDays: "" });
        setError("");
      } else {
        setError(data.error || "Unable to save leave record.");
      }
    } catch (err) {
      setError("Unable to connect to server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestAmendment(leaveId: string) {
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(api("/api/leave"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: leaveId,
          action: "request_amendment",
          serviceNumber: account.serviceNumber,
          fromDate: amendForm.fromDate,
          toDate: amendForm.toDate,
          reportingDate: amendForm.reportingDate,
          requestedDays: Number(amendForm.requestedDays || amendDays)
        })
      });
      const data = await response.json();
      if (response.ok) {
        onAdded(data.leave);
        setEditingId(null);
        setAmendForm({ fromDate: "", toDate: "", reportingDate: "", requestedDays: "" });
        setError("");
      } else {
        setError(data.error || "Unable to request amendment.");
      }
    } catch (err) {
      setError("Unable to connect to server.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: Leave) {
    setEditingId(item.id);
    setAmendForm({
      fromDate: item.from,
      toDate: item.to,
      reportingDate: item.reportingDate,
      requestedDays: String(item.requestedDays || "")
    });
    setError("");
  }

  return <><Intro title="Leave details" detail="Track leave availed, days used, and the balance still available." /><div className="mb-6 grid gap-4 sm:grid-cols-2"><LeaveBalance type="AL" remaining={displayBalances.AL} /><LeaveBalance type="CL" remaining={displayBalances.CL} /></div><div className="grid gap-6 xl:grid-cols-2"><form onSubmit={submit}><Panel title={form.mode === "REQUEST" ? "Request leave approval" : "Add availed leave"} icon={CalendarDays}><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Select label="Type" value={form.mode} options={["AVAILED", "REQUEST"]} onChange={(value) => set("mode", value)} /><p className="mt-1 text-xs text-[#789489]">{form.mode === "REQUEST" ? "Sends a request to your SDM and Adjutant for approval before it counts as leave." : "Records leave you have already availed or are currently on."}</p></div><Select label="Leave type" value={form.leaveType} options={["AL", "CL"]} onChange={(value) => set("leaveType", value)} /><Field label="Days" value={form.requestedDays || String(days || "")} onChange={(value) => set("requestedDays", value)} type="number" /><DateInput label="From" value={form.fromDate} onChange={(value) => set("fromDate", value)} /><DateInput label="To" value={form.toDate} onChange={(value) => set("toDate", value)} /><DateInput label="Return date" value={form.reportingDate} onChange={(value) => set("reportingDate", value)} /></div>{error && !editingId && <p role="alert" className="mt-3 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{error}</p>}<button disabled={submitting} className="mt-6 rounded-xl bg-[#1d6047] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{submitting ? "Saving..." : form.mode === "REQUEST" ? "Send for approval" : "Save leave record"}</button></Panel></form><Panel title="Leave history" icon={ClipboardList}>{leave.length ? leave.map((item) => {
    const isEditing = editingId === item.id;
    const canEdit = item.status === "Approved" && !item.amendment;
    return (
      <div key={item.id}>
        {isEditing ? (
          <div className="mb-3 rounded-xl border border-[#e3ece6] bg-[#f5f9f6] p-4">
            <p className="mb-3 text-sm font-bold text-[#315642]">Request leave modification for early recall</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <DateInput label="New from date" value={amendForm.fromDate} onChange={(value) => setAmend("fromDate", value)} />
              <DateInput label="New to date" value={amendForm.toDate} onChange={(value) => setAmend("toDate", value)} />
              <DateInput label="New return date" value={amendForm.reportingDate} onChange={(value) => setAmend("reportingDate", value)} />
              <Field label="Days" value={amendForm.requestedDays || String(amendDays || "")} onChange={(value) => setAmend("requestedDays", value)} type="number" />
            </div>
            {error && <p role="alert" className="mt-2 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={() => requestAmendment(item.id)} disabled={submitting} className="rounded-lg bg-[#1d6047] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{submitting ? "Requesting..." : "Send to SDM & Adjutant"}</button>
              <button onClick={() => { setEditingId(null); setError(""); }} className="rounded-lg border border-[#bcd8c6] px-3 py-2 text-xs font-bold text-[#287052]">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-[#f5f9f6] p-3">
            <div className="flex-1">
              <span className="text-sm font-bold">{item.type} · {item.from} to {item.to}<small className="block text-xs font-normal text-[#829c8f]">{item.requestedDays ?? "-"} days · Return {item.reportingDate}</small></span>
              {item.amendment && <small className="mt-2 block text-xs text-[#8d6725]">Amendment pending: {item.amendment.from} to {item.amendment.to} ({item.amendment.status})</small>}
            </div>
            <div className="flex items-center gap-2">
              <Status value={item.status} />
              {canEdit && <button onClick={() => startEdit(item)} className="rounded-lg border border-[#bcd8c6] p-2 text-[#287052] hover:bg-[#e5f3e9]" aria-label="Modify leave" title="Recall or adjust leave dates"><ChevronRight size={16} /></button>}
            </div>
          </div>
        )}
      </div>
    );
  }) : <Empty text="No leave records yet." />}</Panel></div></>;
}

function TdyForm({ account, tdy, onAdded }: { account: Account; tdy: TDY[]; onAdded: (record: TDY) => void }) {
  const [form, setForm] = useState({ reason: "", location: "", fromDate: "", toDate: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(api("/api/temporary-duty"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, serviceNumber: account.serviceNumber })
      });
      const data = await response.json();
      if (response.ok) {
        onAdded(data.temporaryDuty);
        setForm({ reason: "", location: "", fromDate: "", toDate: "" });
      } else {
        setError(data.error || "Unable to save temporary duty record.");
      }
    } catch (err) {
      setError("Unable to connect to server.");
    } finally {
      setSubmitting(false);
    }
  }

  return <><Intro title="Temporary duty / course" detail="Record any temporary duty or course period away from the squadron." /><div className="grid gap-6 xl:grid-cols-2"><form onSubmit={submit}><Panel title="Add temporary duty / course" icon={Briefcase}><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Reason of temporary duty / course" value={form.reason} onChange={(value) => set("reason", value)} /></div><div className="sm:col-span-2"><Field label="Location" value={form.location} onChange={(value) => set("location", value)} /></div><DateInput label="From" value={form.fromDate} onChange={(value) => set("fromDate", value)} /><DateInput label="To" value={form.toDate} onChange={(value) => set("toDate", value)} /></div>{error && <p role="alert" className="mt-3 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{error}</p>}<button disabled={submitting} className="mt-6 rounded-xl bg-[#1d6047] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{submitting ? "Saving..." : "Save record"}</button></Panel></form><Panel title="Temporary duty / course history" icon={ClipboardList}>{tdy.length ? tdy.map((item) => <div key={item.id} className="mb-3 rounded-xl bg-[#f5f9f6] p-3"><b className="text-sm font-bold">{item.reason}</b><small className="block text-xs font-normal text-[#829c8f]">{item.location} · {item.from} to {item.to}</small></div>) : <Empty text="No temporary duty / course records yet." />}</Panel></div></>;
}

function TdyBoard({ tdy }: { tdy: TDY[] }) {
  const [search, setSearch] = useState("");
  const filtered = tdy.filter((item) => `${item.name} ${item.armyNo} ${item.squadron}`.toLowerCase().includes(search.toLowerCase()));
  return <><Intro title="Temporary duty / course" detail="Personnel currently away from the squadron on temporary duty or a course, across your command." /><Panel title={`${filtered.length} temporary duty / course records`} icon={Briefcase}><label className="mb-5 flex max-w-sm items-center gap-2 rounded-xl border border-[#d8e3dc] px-3 py-2"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search personnel" className="w-full bg-transparent outline-none" /></label>{filtered.length ? filtered.map((item) => <div key={item.id} className="mb-3 flex flex-col gap-2 rounded-xl border border-[#e3ece6] p-4 sm:flex-row sm:items-center sm:justify-between"><div><b>{item.name ?? "Personnel name unavailable"} <small className="font-normal text-[#8aa095]">{item.armyNo}</small></b><p className="mt-1 text-xs text-[#789489]">{item.rank} · {item.squadron} · {item.reason}</p><p className="mt-1 text-xs font-semibold text-[#287052]">{item.location} · {item.from} to {item.to}</p></div></div>) : <Empty text="No temporary duty / course records found." />}</Panel></>;
}

function Overview({ account, leave, people, tdy }: { account: Account; leave: Leave[]; people: Person[]; tdy: TDY[] }) {
  const today = calendarDate();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = calendarDate(tomorrowDate);
  const onLeaveRecords = leave.filter((item) => item.status === "Approved" && item.from <= today && item.reportingDate > today);
  const onTdyRecords = tdy.filter((item) => item.from <= today && item.to >= today);
  const returning = onLeaveRecords.filter((item) => item.reportingDate === tomorrow);
  const onLeave = onLeaveRecords.length;
  const onTdy = onTdyRecords.length;
  const squadrons = account.role === "ADJT" ? SQUADRONS : [account.squadron];
  return <><Intro title="Command overview" detail={account.role === "SDM" ? `${account.squadron} squadron strength and leave picture.` : "All four squadrons in one operating picture."} />{account.role === "ADJT" ? <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{SQUADRONS.map((squadron) => <div key={squadron} className="rounded-2xl border border-[#d8e5dc] bg-white p-4"><SquadronBadge squadron={squadron} size={40} /></div>)}</div> : <div className="mb-6 rounded-2xl border border-[#d8e5dc] bg-white p-4"><SquadronBadge squadron={account.squadron} size={48} /></div>}{returning.length > 0 && <Panel title={`Returning tomorrow · ${returning.length}`} icon={Bell}><p className="mb-4 text-sm text-[#789489]">Personnel due to report back tomorrow.</p><div className="space-y-2">{returning.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#fff6e2] p-3"><div><p className="font-bold text-[#5d4720]">{item.name ?? "Personnel name unavailable"}</p><p className="text-xs text-[#8d6725]">{item.rank} · {item.squadron} · {item.armyNo}</p></div><span className="text-xs font-bold text-[#8d6725]">Return {item.reportingDate}</span></div>)}</div></Panel>}<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Total strength" value={String(people.length)} icon={Users} /><Metric label="Available" value={String(Math.max(0, people.length - onLeave - onTdy))} icon={ShieldCheck} /><Metric label="Leave strength" value={String(onLeave)} icon={CalendarDays} /><Metric label="Temporary duty" value={String(onTdy)} icon={Briefcase} /><Metric label="Return tomorrow" value={String(returning.length)} icon={Bell} /></div><div className="mt-6 grid gap-6 xl:grid-cols-3"><Panel title={account.role === "ADJT" ? "All squadron state" : `${account.squadron} squadron state`} icon={Users}><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-[#e3ece6] text-[10px] uppercase tracking-wider text-[#8aa095]"><tr><th className="pb-3">Squadron</th><th className="pb-3">Strength</th><th className="pb-3">On leave</th><th className="pb-3">On TDY</th><th className="pb-3">Available</th></tr></thead><tbody className="divide-y divide-[#edf2ee]">{squadrons.map((squadron) => { const strength = people.filter((person) => person.squadron === squadron).length; const leaveStrength = onLeaveRecords.filter((item) => item.squadron === squadron).length; const tdyStrength = onTdyRecords.filter((item) => item.squadron === squadron).length; return <tr key={squadron}><td className="py-3 font-bold">{squadron}</td><td className="py-3">{strength}</td><td className="py-3">{leaveStrength}</td><td className="py-3">{tdyStrength}</td><td className="py-3">{Math.max(0, strength - leaveStrength - tdyStrength)}</td></tr>; })}</tbody></table></div></Panel><Panel title={`Personnel on leave · ${onLeave}`} icon={CalendarDays}>{onLeaveRecords.length ? onLeaveRecords.map((item) => <div key={item.id} className="mb-3 rounded-xl bg-[#eef7f0] p-3"><p className="font-bold text-[#214a38]">{item.name ?? "Personnel name unavailable"}</p><p className="mt-1 text-xs text-[#58786a]">{item.rank} · {item.squadron} · {item.armyNo}</p><p className="mt-1 text-xs text-[#58786a]">{item.type} · {item.from} to {item.to} · Return {item.reportingDate}</p></div>) : <Empty text="No personnel are currently on leave." />}</Panel><Panel title={`Personnel on temporary duty / course · ${onTdy}`} icon={Briefcase}>{onTdyRecords.length ? onTdyRecords.map((item) => <div key={item.id} className="mb-3 rounded-xl bg-[#eef4f7] p-3"><p className="font-bold text-[#1e4a5f]">{item.name ?? "Personnel name unavailable"}</p><p className="mt-1 text-xs text-[#5a7c8a]">{item.rank} · {item.squadron} · {item.armyNo}</p><p className="mt-1 text-xs text-[#5a7c8a]">{item.reason} · {item.location} · {item.from} to {item.to}</p></div>) : <Empty text="No personnel are currently on temporary duty / course." />}</Panel></div><div className="mt-6"><Panel title="Leave activity" icon={ClipboardList}>{leave.length ? leave.slice(0, 8).map((item) => <div key={item.id} className="mb-3 flex items-center justify-between rounded-xl bg-[#f5f9f6] p-3"><span className="text-sm font-bold">{item.name ?? "Personnel name unavailable"}<small className="block text-xs font-normal text-[#829c8f]">{item.type} · {item.from} to {item.to} · Return {item.reportingDate}</small></span><Status value={item.status} /></div>) : <Empty text="No leave records found." />}</Panel></div></>;
}
function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) { return <div className="rounded-2xl border border-[#d8e5dc] bg-white p-5"><Icon className="mb-5 text-[#39835d]" size={20} /><p className="text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#8aa095]">{label}</p></div>; }
function LeaveBoard({ account, leave, people, tdy, onUpdated }: { account: Account; leave: Leave[]; people: Person[]; tdy: TDY[]; onUpdated: (leave: Leave) => void }) {
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const today = calendarDate();
  const visible = leave.filter((item) => item.reportingDate > today && `${item.name} ${item.armyNo} ${item.squadron}`.toLowerCase().includes(search.toLowerCase()));
  const pendingLeaves = visible.filter((item) => item.status !== "Approved" && item.status !== "Rejected");
  const amendmentRequests = visible.filter((item) => item.amendment && item.amendment.status !== "APPROVED" && item.amendment.status !== "REJECTED");

  const onLeaveByArmyNo = new Map<string, Leave>();
  const lastReturnedByArmyNo = new Map<string, Leave>();
  for (const item of leave) {
    if (!item.armyNo || item.status !== "Approved") continue;
    if (item.from <= today && item.reportingDate > today) {
      onLeaveByArmyNo.set(item.armyNo, item);
    } else if (item.reportingDate <= today) {
      const existing = lastReturnedByArmyNo.get(item.armyNo);
      if (!existing || item.reportingDate > existing.reportingDate) lastReturnedByArmyNo.set(item.armyNo, item);
    }
  }
  const onTdyByArmyNo = new Map<string, TDY>();
  for (const item of tdy) { if (item.armyNo && item.from <= today && item.to >= today) onTdyByArmyNo.set(item.armyNo, item); }
  const roster = [...people]
    .filter((person) => `${person.fullName} ${person.serviceNumber} ${person.squadron}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const onLeaveA = onLeaveByArmyNo.get(a.serviceNumber);
      const onLeaveB = onLeaveByArmyNo.get(b.serviceNumber);
      if (onLeaveA && onLeaveB) return onLeaveA.reportingDate.localeCompare(onLeaveB.reportingDate);
      if (onLeaveA) return -1;
      if (onLeaveB) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

  if (selectedPerson) return <IndividualLeaveDetail person={selectedPerson} leave={leave.filter((item) => item.armyNo === selectedPerson.serviceNumber)} tdy={tdy.filter((item) => item.armyNo === selectedPerson.serviceNumber)} onBack={() => setSelectedPerson(null)} />;

  async function decide(id: string, action: "approve" | "reject") { 
    const response = await fetch(api("/api/leave"), { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ id, action, actorRole: account.role }) 
    }); 
    if (response.ok) onUpdated((await response.json()).leave); 
  }

  async function decideAmendment(id: string, action: "approve_amendment" | "reject_amendment") {
    const response = await fetch(api("/api/leave"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, actorRole: account.role })
    });
    if (response.ok) onUpdated((await response.json()).leave);
  }

  return <>
    <Intro title="Leave board" detail="Review and approve current/upcoming leave and modification requests across your command. Personnel are removed automatically on their reporting date." />

    <Panel title={account.role === "ADJT" ? `Squadron roster · ${roster.length}` : `${account.squadron} roster · ${roster.length}`} icon={Users}>
      <label className="mb-5 flex max-w-sm items-center gap-2 rounded-xl border border-[#d8e3dc] px-3 py-2"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or army no." className="w-full bg-transparent outline-none" /></label>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#e3ece6] text-[10px] uppercase tracking-wider text-[#8aa095]">
            <tr>
              <th className="pb-3 pr-4">Personnel</th>
              {account.role === "ADJT" && <th className="pb-3 pr-4">Squadron</th>}
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">AL left</th>
              <th className="pb-3 pr-4">CL left</th>
              <th className="pb-3"><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2ee]">
            {roster.map((person) => {
              const onLeaveRecord = onLeaveByArmyNo.get(person.serviceNumber);
              const onTdyRecord = !onLeaveRecord ? onTdyByArmyNo.get(person.serviceNumber) : undefined;
              const lastReturned = !onLeaveRecord && !onTdyRecord ? lastReturnedByArmyNo.get(person.serviceNumber) : undefined;
              const al = person.annualLeaveBalance ?? LEAVE_ALLOWANCES.AL;
              const cl = person.casualLeaveBalance ?? LEAVE_ALLOWANCES.CL;
              return (
                <tr key={person.id} onClick={() => setSelectedPerson(person)} className="cursor-pointer hover:bg-[#f5f9f6]">
                  <td className="py-3 pr-4">
                    <b>{person.fullName}</b> <small className="font-normal text-[#8aa095]">{person.rank} · {person.serviceNumber}</small>
                    {lastReturned && <small className="mt-1 block text-xs font-semibold text-[#8d6725]">Returned · {lastReturned.type} · {lastReturned.requestedDays} days</small>}
                  </td>
                  {account.role === "ADJT" && <td className="py-3 pr-4">{person.squadron}</td>}
                  <td className="py-3 pr-4">{onLeaveRecord ? <span className="rounded-full bg-[#fff1d9] px-3 py-1.5 text-[11px] font-bold text-[#a8762c]">On leave · Returns {onLeaveRecord.reportingDate}</span> : onTdyRecord ? <span className="rounded-full bg-[#e4edf7] px-3 py-1.5 text-[11px] font-bold text-[#3b6ea5]">On TDY · Returns {onTdyRecord.to}</span> : <span className="rounded-full bg-[#e2f3e7] px-3 py-1.5 text-[11px] font-bold text-[#347c55]">Available</span>}</td>
                  <td className={`py-3 pr-4 font-bold ${al <= 0 ? "text-[#ad5652]" : "text-[#214a38]"}`}>{al <= 0 ? "Finished" : al}</td>
                  <td className={`py-3 pr-4 font-bold ${cl <= 0 ? "text-[#ad5652]" : "text-[#214a38]"}`}>{cl <= 0 ? "Finished" : cl}</td>
                  <td className="py-3 text-right"><ChevronRight size={16} className="text-[#8aa095]" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!roster.length && <Empty text="No personnel records found." />}
      </div>
    </Panel>

    {amendmentRequests.length > 0 && (
      <Panel title={`${amendmentRequests.length} pending leave modification requests`} icon={Bell}>
        <p className="mb-4 text-xs font-semibold text-[#8d6725]">Personnel recalled early requesting to adjust their leave dates. Both SDM and Adjutant approval required.</p>
        {amendmentRequests.map((item) => (
          <div key={item.id} className="mb-3 flex flex-col gap-3 rounded-xl border border-[#ffd6a5] bg-[#fff9f0] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <b>{item.name ?? "Personnel name unavailable"} <small className="font-normal text-[#8aa095]">{item.armyNo}</small></b>
              <p className="mt-1 text-xs text-[#789489]">{item.rank} · {item.squadron} · {item.type}</p>
              <p className="mt-1 text-xs font-semibold text-[#8d6725]">Original: {item.from} to {item.to} · Return {item.reportingDate}</p>
              {item.amendment && (
                <p className="mt-1 text-xs font-semibold text-[#5d4720]">
                  Requested: {item.amendment.from} to {item.amendment.to} · Return {item.amendment.reportingDate} ({item.amendment.requestedDays} days)
                </p>
              )}
              {item.amendment && (
                <small className="mt-1 block text-xs text-[#8d6725]">
                  Status: {item.amendment.sdmApproved ? "✓ SDM" : "SDM"} · {item.amendment.adjtApproved ? "✓ Adjutant" : "Adjutant"}
                </small>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => decideAmendment(item.id, "approve_amendment")} className="rounded-lg bg-[#e1f3e6] p-2 text-[#328158]" aria-label="Approve amendment" title="Approve modification"><Check size={16} /></button>
              <button onClick={() => decideAmendment(item.id, "reject_amendment")} className="rounded-lg bg-[#fae6e5] p-2 text-[#b45753]" aria-label="Reject amendment" title="Reject modification"><X size={16} /></button>
            </div>
          </div>
        ))}
      </Panel>
    )}

    <Panel title={`${pendingLeaves.length} pending leave requests`} icon={ClipboardList}>
      {pendingLeaves.length ? pendingLeaves.map((item) => (
        <div key={item.id} className="mb-3 flex flex-col gap-3 rounded-xl border border-[#e3ece6] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <b>{item.name ?? "Personnel name unavailable"} <small className="font-normal text-[#8aa095]">{item.armyNo}</small></b>
            <p className="mt-1 text-xs text-[#789489]">{item.rank} · {item.squadron} · {item.type} · {item.from} to {item.to} · Return {item.reportingDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <Status value={item.status} />
            {item.status !== "Approved" && item.status !== "Rejected" && <>
              <button onClick={() => decide(item.id, "approve")} className="rounded-lg bg-[#e1f3e6] p-2 text-[#328158]" aria-label="Approve"><Check size={16} /></button>
              <button onClick={() => decide(item.id, "reject")} className="rounded-lg bg-[#fae6e5] p-2 text-[#b45753]" aria-label="Reject"><X size={16} /></button>
            </>}
          </div>
        </div>
      )) : <Empty text="No pending leave requests." />}
    </Panel>
  </>;
}

function IndividualLeaveDetail({ person, leave, tdy, onBack }: { person: Person; leave: Leave[]; tdy: TDY[]; onBack: () => void }) {
  const sortedLeave = [...leave].sort((a, b) => b.from.localeCompare(a.from));
  const sortedTdy = [...tdy].sort((a, b) => b.from.localeCompare(a.from));
  const al = person.annualLeaveBalance ?? LEAVE_ALLOWANCES.AL;
  const cl = person.casualLeaveBalance ?? LEAVE_ALLOWANCES.CL;
  return <>
    <button type="button" onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-bold text-[#287052]"><ChevronLeft size={17} />Back to roster</button>
    <Intro title={person.fullName} detail={`${person.rank} · ${person.serviceNumber} · ${person.squadron} squadron`} />
    <div className="mb-6 grid gap-4 sm:grid-cols-2"><LeaveBalance type="AL" remaining={al} /><LeaveBalance type="CL" remaining={cl} /></div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title={`Leave log · ${sortedLeave.length}`} icon={ClipboardList}>
        {sortedLeave.length ? sortedLeave.map((item) => (
          <div key={item.id} className="mb-3 rounded-xl bg-[#f5f9f6] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold">{item.type} · {item.from} to {item.to}<small className="block text-xs font-normal text-[#829c8f]">{item.requestedDays ?? "-"} days · Return {item.reportingDate}</small></span>
              <Status value={item.status} />
            </div>
            {item.amendment && <small className="mt-2 block text-xs font-semibold text-[#8d6725]">Amendment: {item.amendment.from} to {item.amendment.to} ({item.amendment.status})</small>}
          </div>
        )) : <Empty text="No leave records for this individual." />}
      </Panel>
      <Panel title={`Temporary duty / course log · ${sortedTdy.length}`} icon={Briefcase}>
        {sortedTdy.length ? sortedTdy.map((item) => (
          <div key={item.id} className="mb-3 rounded-xl bg-[#f5f9f6] p-3">
            <b className="text-sm font-bold">{item.reason}</b>
            <small className="block text-xs font-normal text-[#829c8f]">{item.location} · {item.from} to {item.to}</small>
          </div>
        )) : <Empty text="No temporary duty / course records for this individual." />}
      </Panel>
    </div>
  </>;
}

function ListFilterBoxEditor({ index, box, onChange }: { index: number; box: ListFilterBox; onChange: (box: ListFilterBox) => void }) {
  const fieldDef = LIST_FIELDS.find((candidate) => candidate.key === box.field);
  return (
    <div className="rounded-xl border border-[#d8e3dc] p-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#789589]">Box {index + 1}</p>
      <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#789589]">Field</span><select value={box.field} onChange={(event) => onChange({ ...blankListFilterBox(), field: event.target.value })} className="w-full rounded-xl border border-[#d8e3dc] px-3 py-3 text-sm outline-none"><option value="ANY">Any</option>{LIST_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></label>
      {fieldDef && (
        <div className="mt-3">
          {fieldDef.type === "number" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min" value={box.min} onChange={(value) => onChange({ ...box, min: value })} type="number" required={false} />
              <Field label="Max" value={box.max} onChange={(value) => onChange({ ...box, max: value })} type="number" required={false} />
            </div>
          )}
          {fieldDef.type === "select" && fieldDef.key !== "status" && (
            <div className="grid grid-cols-2 gap-2">
              <Select label="Comparator" value={box.comparator} options={["ABOVE", "BELOW", "EXACTLY"]} onChange={(value) => onChange({ ...box, comparator: value })} />
              <Select label="Value" value={box.select || fieldDef.options![0]} options={fieldDef.options!} onChange={(value) => onChange({ ...box, select: value })} />
            </div>
          )}
          {fieldDef.type === "select" && fieldDef.key === "status" && (
            <Select label="Value" value={box.select || fieldDef.options![0]} options={fieldDef.options!} onChange={(value) => onChange({ ...box, select: value })} />
          )}
          {fieldDef.type === "text" && <Field label="Contains" value={box.text} onChange={(value) => onChange({ ...box, text: value })} required={false} />}
          {fieldDef.type === "boolean" && <Select label="Value" value={box.bool} options={["YES", "NO"]} onChange={(value) => onChange({ ...box, bool: value })} />}
        </div>
      )}
    </div>
  );
}

function ListBuilder({ account, people, leave, tdy }: { account: Account; people: Person[]; leave: Leave[]; tdy: TDY[] }) {
  const [boxes, setBoxes] = useState<ListFilterBox[]>(() => Array.from({ length: 5 }, blankListFilterBox));
  const today = calendarDate();

  const onLeaveByArmyNo = new Map<string, Leave>();
  for (const item of leave) { if (item.armyNo && item.status === "Approved" && item.from <= today && item.reportingDate > today) onLeaveByArmyNo.set(item.armyNo, item); }
  const onTdyByArmyNo = new Map<string, TDY>();
  for (const item of tdy) { if (item.armyNo && item.from <= today && item.to >= today) onTdyByArmyNo.set(item.armyNo, item); }

  const rows = people.map((person) => {
    const military = person.metadata?.military ?? {};
    const status = onLeaveByArmyNo.has(person.serviceNumber) ? "On leave" : onTdyByArmyNo.has(person.serviceNumber) ? "On TDY" : "Available";
    const tags = (military.qualifications || "").split(",").map((value) => value.trim()).filter(Boolean);
    return {
      person, status,
      age: computeAge(military.dateOfBirth),
      service: computeYearsOfService(military.dateOfEnrolment),
      education: military.highestDegree || "-",
      nativePlace: person.hometown || "-",
      gamesPlayed: military.gamesPlayed || "-",
      tags,
    };
  }).filter(({ person, status }) => {
    return boxes.every((box) => {
      if (box.field === "ANY") return true;
      const fieldDef = LIST_FIELDS.find((candidate) => candidate.key === box.field);
      if (!fieldDef) return true;
      const value = listFieldValue(person, box.field, status);
      return listBoxPasses(box, fieldDef, value);
    });
  });

  return <>
    <Intro title="Make a list" detail="Choose up to five criteria below, in any order, to build a fully custom personnel list." />
    <Panel title="Filters" icon={Filter}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {boxes.map((box, index) => (
          <ListFilterBoxEditor key={index} index={index} box={box} onChange={(next) => setBoxes((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))} />
        ))}
      </div>
    </Panel>
    <Panel title={`${rows.length} matching personnel`} icon={ClipboardList}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-[#e3ece6] text-[10px] uppercase tracking-wider text-[#8aa095]">
            <tr>
              <th className="pb-3 pr-4">Personnel</th>
              {account.role === "ADJT" && <th className="pb-3 pr-4">Squadron</th>}
              <th className="pb-3 pr-4">Age</th>
              <th className="pb-3 pr-4">Service</th>
              <th className="pb-3 pr-4">Qualification</th>
              <th className="pb-3 pr-4">Native place</th>
              <th className="pb-3 pr-4">Games played</th>
              <th className="pb-3 pr-4">Tags</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2ee]">
            {rows.map(({ person, status, age, service, education, nativePlace, gamesPlayed, tags }) => (
              <tr key={person.id}>
                <td className="py-3 pr-4"><b>{person.fullName}</b> <small className="font-normal text-[#8aa095]">{person.rank} · {person.serviceNumber}</small></td>
                {account.role === "ADJT" && <td className="py-3 pr-4">{person.squadron}</td>}
                <td className="py-3 pr-4">{age ?? "-"}</td>
                <td className="py-3 pr-4">{service ?? "-"}</td>
                <td className="py-3 pr-4">{education}</td>
                <td className="py-3 pr-4">{nativePlace}</td>
                <td className="py-3 pr-4">{gamesPlayed}</td>
                <td className="py-3 pr-4">{tags.length ? tags.join(", ") : "-"}</td>
                <td className="py-3">{status === "On leave" ? <span className="rounded-full bg-[#fff1d9] px-3 py-1.5 text-[11px] font-bold text-[#a8762c]">On leave</span> : status === "On TDY" ? <span className="rounded-full bg-[#e4edf7] px-3 py-1.5 text-[11px] font-bold text-[#3b6ea5]">On TDY</span> : <span className="rounded-full bg-[#e2f3e7] px-3 py-1.5 text-[11px] font-bold text-[#347c55]">Available</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text="No personnel match these filters." />}
      </div>
    </Panel>
  </>;
}

function People({ people }: { people: Person[] }) { const [selected, setSelected] = useState<Person | null>(null); if (selected) return <PersonDetail person={selected} onBack={() => setSelected(null)} />; return <><Intro title="All personnel" detail="Select a person to view their personal, medical, course, posting, honour, vaccination, and CPT records." /><Panel title={`${people.length} personnel records`} icon={Users}><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-[#e3ece6] text-[10px] uppercase tracking-wider text-[#8aa095]"><tr><th className="pb-3">Personnel</th><th className="pb-3">Rank / trade</th><th className="pb-3">Squadron</th><th className="pb-3"><span className="sr-only">View</span></th></tr></thead><tbody className="divide-y divide-[#edf2ee]">{people.map((person) => <tr key={person.id} className="hover:bg-[#f5f9f6]"><td className="py-4"><b>{person.fullName}</b><small className="block text-xs text-[#8aa095]">{person.serviceNumber}</small></td><td className="py-4">{person.rank}<small className="block text-xs text-[#8aa095]">{person.trade}</small></td><td className="py-4">{person.squadron}</td><td className="py-4 text-right"><button type="button" onClick={() => setSelected(person)} className="border border-[#bcd8c6] p-2 text-[#287052] hover:bg-[#e5f3e9]" aria-label={`View ${person.fullName}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>{!people.length && <Empty text="No personnel records found." />}</div></Panel></>; }

function PersonDetail({ person, onBack }: { person: Person; onBack: () => void }) { const [tab, setTab] = useState("personal"); const metadata = person.metadata ?? {}; const military = metadata.military ?? {}; const medical = metadata.medical ?? {}; const fitness = metadata.fitness ?? {}; const courses = legacyRows(metadata.courses, courseColumns, { course: military.coursesAttended ?? "", institution: military.courseInstitution ?? "", grade: military.courseGradings ?? "", completed: military.courseCompletionDate ?? "" }); const postings = legacyRows(metadata.postings, postingColumns, { unit: military.postings ?? "" }); const honours = legacyRows(metadata.honours, honourColumns, { honour: military.decorations ?? "" }); const medicalHistory = legacyRows(metadata.medicalHistory, medicalHistoryColumns, { condition: medical.chronicConditions ?? "", treatment: medical.medications ?? "", remarks: medical.surgeries ?? "" }); const medicalExams = legacyRows(metadata.medicalExams, medicalExamColumns, { date: medical.ameDate ?? "", category: medical.medicalCategory ?? "", height: medical.height ?? "", weight: medical.weight ?? "", bmi: medical.bmi ?? "", bloodGroup: medical.bloodGroup ?? "" }); const vaccinations = legacyRows(metadata.vaccinations, vaccinationColumns, { vaccine: medical.vaccinations ?? "" }); const bpetPpt = legacyRows(metadata.bpetPpt, fitnessColumns, { date: fitness.testDate ?? "", runTime: fitness.runTime ?? "", pushups: fitness.pushups ?? "", situps: fitness.situps ?? "", obstacles: fitness.obstacleResults ?? "", grade: fitness.fitnessGrade ?? "" }); const tabs = [{ id: "personal", text: "Personal" }, { id: "medical", text: "Medical" }, { id: "courses", text: "Courses & qualifications" }, { id: "fitness", text: "CPT" }]; const personalRows = [{ label: "Army / service no.", value: person.serviceNumber }, { label: "Rank", value: person.rank }, { label: "Arm / service", value: person.trade }, { label: "Hometown / address", value: person.hometown }, { label: "Parent unit", value: military.parentUnit ?? "-" }, { label: "Present unit", value: military.presentUnit ?? "-" }, { label: "Date of enrolment", value: military.dateOfEnrolment ?? "-" }, { label: "Security clearance", value: military.securityClearance ?? "-" }]; return <><button type="button" onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-bold text-[#287052]"><ChevronLeft size={17} />All personnel</button><Intro title={person.fullName} detail={`${person.rank} · ${person.serviceNumber} · ${person.squadron} squadron`} /><div className="mb-6 flex flex-wrap gap-2 border-b border-[#d8e5dc] pb-4">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`px-3 py-2 text-xs font-bold ${tab === item.id ? "bg-[#1d6047] text-white" : "border border-[#cbded1] text-[#527363]"}`}>{item.text}</button>)}</div>{tab === "personal" && <Panel title="Personal details" icon={UserRound}><table className="w-full text-left text-sm"><tbody className="divide-y divide-[#edf2ee]">{personalRows.map((row) => <tr key={row.label}><th className="w-1/3 py-3 text-xs uppercase tracking-wider text-[#789489]">{row.label}</th><td className="py-3 font-semibold">{row.value}</td></tr>)}</tbody></table></Panel>}{tab === "medical" && <div className="grid gap-6"><RecordTable title="Medical history" columns={medicalHistoryColumns} rows={medicalHistory} /><RecordTable title="Medical examinations" columns={medicalExamColumns} rows={medicalExams} /><RecordTable title="Vaccination log" columns={vaccinationColumns} rows={vaccinations} /></div>}{tab === "courses" && <div className="grid gap-6"><RecordTable title="Courses & qualifications" columns={courseColumns} rows={courses} /><RecordTable title="Postings & deployments" columns={postingColumns} rows={postings} /><RecordTable title="Honours & decorations" columns={honourColumns} rows={honours} /></div>}{tab === "fitness" && <RecordTable title="CPT results" columns={fitnessColumns} rows={bpetPpt} />}</>; }
