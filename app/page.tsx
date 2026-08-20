"use client";

import { useState } from "react";
import {
  Activity,
  Archive,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  FileCheck2,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

type Role = "Personnel" | "SDM" | "ADJT";

const nominalRoll = [
  { name: "A. Singh", rank: "Risso", serviceNo: "CAV-1042", posting: "B Sqn", status: "Present", initials: "AS", color: "bg-[#d6e6de] text-[#245b49]" },
  { name: "V. Chauhan", rank: "Major", serviceNo: "CAV-0981", posting: "HQ 63 Cav", status: "On leave", initials: "VC", color: "bg-[#e5ddd0] text-[#805f39]" },
  { name: "R. Pradhan", rank: "Naib Risaldar", serviceNo: "CAV-1127", posting: "A Sqn", status: "Present", initials: "RP", color: "bg-[#dbe3ed] text-[#315274]" },
  { name: "S. Bhati", rank: "Captain", serviceNo: "CAV-1073", posting: "C Sqn", status: "TD / Field", initials: "SB", color: "bg-[#e9d9da] text-[#8b4248]" },
  { name: "K. Yadav", rank: "Havildar", serviceNo: "CAV-1159", posting: "B Sqn", status: "Present", initials: "KY", color: "bg-[#e4e0ea] text-[#5c4c76]" },
];

const navItems = [
  { label: "Command overview", icon: LayoutDashboard },
  { label: "Nominal roll", icon: Users },
  { label: "Leave management", icon: CalendarDays, count: "03" },
  { label: "Material", icon: Package },
];

export default function Home() {
  const [role, setRole] = useState<Role>("Personnel");
  const [activeNav, setActiveNav] = useState("Command overview");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<"AL" | "CL">("AL");
  const [days, setDays] = useState(4);
  const [submitted, setSubmitted] = useState(false);

  const filteredRoll = nominalRoll.filter((person) =>
    `${person.name} ${person.rank} ${person.serviceNo} ${person.posting}`.toLowerCase().includes(search.toLowerCase()),
  );
  const balance = leaveType === "AL" ? 60 : 30;
  const canSubmit = days > 0 && days <= balance;

  function submitLeave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit) setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-[#f3f6f3] text-[#1c2925] selection:bg-[#b8d8c8]">
      <div className="fixed inset-0 -z-0 bg-[radial-gradient(circle_at_70%_0%,rgba(212,231,219,0.68),transparent_33%),linear-gradient(135deg,#f5f7f4_0%,#edf3ef_55%,#f8f5ee_100%)]" />
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[#d5e0da] bg-[#f8faf8]/95 px-5 py-6 backdrop-blur-xl transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-12 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#183b30] text-[#dceee4] shadow-lg shadow-[#183b30]/15"><ShieldCheck size={21} /></div>
            <div><div className="text-lg font-bold tracking-[-0.04em] text-[#183b30]">tresath</div><div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#75867d]">63 Cavalry</div></div>
          </div>
          <button aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="text-[#788a80] lg:hidden"><X size={20} /></button>
        </div>
        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9aaba2]">Workspace</div>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon, count }) => <button key={label} onClick={() => { setActiveNav(label); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition ${activeNav === label ? "bg-[#e1eee7] text-[#1c6048]" : "text-[#6f8077] hover:bg-[#edf3ef] hover:text-[#274b3c]"}`}><Icon size={17} strokeWidth={1.8} /><span className="flex-1">{label}</span>{count && <span className="rounded-md bg-[#f4e1d5] px-1.5 py-0.5 text-[10px] font-bold text-[#a35f40]">{count}</span>}</button>)}
        </nav>
        <div className="mt-auto rounded-2xl border border-[#d8e4dc] bg-white/70 p-4"><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-[#587168]"><LockKeyhole size={14} /> Secure workspace</div><p className="text-[11px] leading-5 text-[#8a9b92]">Your session is encrypted and access logged under Army Data Protection protocol.</p><div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4c8d6f]"><span className="h-1.5 w-1.5 rounded-full bg-[#58a77e]" /> System operational</div></div>
      </aside>
      {sidebarOpen && <button aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-[#183b30]/20 backdrop-blur-sm lg:hidden" />}

      <main className="relative z-10 min-h-screen lg:ml-[260px]">
        <header className="flex h-[78px] items-center justify-between border-b border-[#dce6df] bg-[#f7faf7]/65 px-5 backdrop-blur-xl sm:px-8 lg:px-10"><div className="flex items-center gap-3"><button aria-label="Open menu" onClick={() => setSidebarOpen(true)} className="text-[#355f4e] lg:hidden"><Menu size={22} /></button><div className="hidden items-center gap-2 text-xs text-[#899a91] sm:flex"><span>Operations</span><span>/</span><span className="font-semibold text-[#385a4b]">Command overview</span></div><div className="text-sm font-semibold text-[#385a4b] sm:hidden">Tresath / Overview</div></div><div className="flex items-center gap-3"><button aria-label="Notifications" className="relative rounded-full p-2 text-[#687f73] hover:bg-white"><Bell size={18} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#d17b58]" /></button><div className="hidden h-7 w-px bg-[#dce6df] sm:block" /><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c8dcd1] text-[10px] font-bold text-[#285d49]">AK</div><div className="hidden text-right sm:block"><div className="text-xs font-bold text-[#2d5141]">Arjun K.</div><div className="text-[10px] text-[#8a9b92]">Risso • B Sqn</div></div><ChevronDown size={14} className="text-[#92a198]" /></div></div></header>

        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#739183]"><Activity size={13} /> Live operations desk <span className="h-1 w-1 rounded-full bg-[#6ca685]" /> 21 Aug 2026</div><h1 className="text-[clamp(1.8rem,4vw,2.5rem)] font-bold tracking-[-0.05em] text-[#193c30]">Good morning, Arjun</h1><p className="mt-1 text-sm text-[#81938a]">Here is the current readiness picture for 63 Cavalry.</p></div><div className="flex items-center gap-2 rounded-xl border border-[#d5e3db] bg-white/70 p-1"><span className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#91a29a]">View as</span>{(["Personnel", "SDM", "ADJT"] as Role[]).map((item) => <button key={item} onClick={() => setRole(item)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${role === item ? "bg-[#1c4f3d] text-white shadow-sm" : "text-[#7c8e85] hover:text-[#315b48]"}`}>{item}</button>)}</div></section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total strength" value="187" note="of 192 sanctioned" icon={Users} accent="green" /><StatCard label="Present today" value="174" note="93.0% availability" icon={ShieldCheck} accent="blue" /><StatCard label="On leave" value="08" note="03 pending approval" icon={CalendarDays} accent="amber" /><StatCard label="Readiness index" value="91.4%" note="↑ 2.8% this month" icon={Activity} accent="rose" /></section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"><div className="rounded-2xl border border-[#d9e5dd] bg-white/80 p-5 shadow-[0_12px_35px_rgba(47,83,65,0.04)] sm:p-6"><div className="mb-6 flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#88a095]">Unit manpower</div><h2 className="text-base font-bold tracking-[-0.02em] text-[#244b3b]">Strength distribution</h2></div><button className="flex items-center gap-1 text-xs font-semibold text-[#418364]">View report <ArrowUpRight size={14} /></button></div><div className="grid grid-cols-2 gap-5 sm:grid-cols-4"><RingStat label="Officers" value="24" total="28" percent={86} color="bg-[#3d8c69]" /><RingStat label="JCOs" value="31" total="32" percent={97} color="bg-[#5d7890]" /><RingStat label="ORs" value="132" total="132" percent={100} color="bg-[#c48a5e"} /><RingStat label="Civilians" value="10" total="10" percent={100} color="bg-[#a882aa"} /></div><div className="mt-7 flex items-center gap-3 border-t border-[#edf1ed] pt-4 text-xs text-[#84958c]"><span className="h-2 w-2 rounded-full bg-[#3d8c69]" /> Available <strong className="text-[#476d5b]">174</strong><span className="ml-2 h-2 w-2 rounded-full bg-[#edd5c6]" /> Committed <strong className="text-[#8d796b]">13</strong></div></div><div className="rounded-2xl border border-[#d9e5dd] bg-[#1d4435] p-6 text-[#e1f0e8] shadow-[0_12px_35px_rgba(47,83,65,0.08)]"><div className="mb-8 flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#9fc4ae]">Action centre</div><span className="rounded-full bg-[#32634f] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#b9d8c6]">{role} view</span></div><h2 className="max-w-[220px] text-xl font-bold leading-tight tracking-[-0.04em]">Keep the unit moving.</h2><p className="mt-2 max-w-[230px] text-xs leading-5 text-[#abc8b8]">Three requests need your attention before end of day.</p><button onClick={() => setLeaveOpen(true)} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d7e9df] py-3 text-xs font-bold text-[#21553f] transition hover:bg-white"><Plus size={16} /> Request leave</button></div></section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"><div className="overflow-hidden rounded-2xl border border-[#d9e5dd] bg-white/80 shadow-[0_12px_35px_rgba(47,83,65,0.04)]"><div className="flex flex-col gap-4 border-b border-[#edf1ed] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#88a095]">Personnel registry</div><h2 className="text-base font-bold text-[#244b3b]">Nominal roll <span className="ml-1 text-xs font-medium text-[#a0ada5]">/ 187 personnel</span></h2></div><label className="flex h-9 items-center gap-2 rounded-lg border border-[#dbe6df] bg-[#fbfdfb] px-3 text-xs text-[#8a9b92] sm:w-52"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search personnel..." className="w-full bg-transparent outline-none placeholder:text-[#a6b2ac]" /></label></div><div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-xs"><thead className="bg-[#f6f9f6] text-[10px] font-bold uppercase tracking-wider text-[#9aaba2]"><tr><th className="px-6 py-3 font-bold">Personnel</th><th className="px-4 py-3 font-bold">Service no.</th><th className="px-4 py-3 font-bold">Posting</th><th className="px-4 py-3 font-bold">Status</th><th className="px-6 py-3" /></tr></thead><tbody className="divide-y divide-[#eff3ef]">{filteredRoll.map((person) => <tr key={person.serviceNo} className="transition hover:bg-[#f7faf7]"><td className="px-6 py-3.5"><div className="flex items-center gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ${person.color}`}>{person.initials}</div><div><div className="font-bold text-[#365748]">{person.name}</div><div className="mt-0.5 text-[10px] text-[#95a39b]">{person.rank}</div></div></div></td><td className="px-4 font-mono text-[11px] text-[#84958c]">{person.serviceNo}</td><td className="px-4 font-medium text-[#637b6e]">{person.posting}</td><td className="px-4"><span className={`inline-flex items-center gap-1.5 ${person.status === "Present" ? "text-[#458362]" : person.status === "On leave" ? "text-[#a97147]" : "text-[#6d7c9d]"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{person.status}</span></td><td className="px-6 text-right text-[#9aaba2]"><ArrowUpRight size={15} /></td></tr>)}{filteredRoll.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-[#8a9b92]">No personnel match that search.</td></tr>}</tbody></table></div></div>

            <div className="rounded-2xl border border-[#d9e5dd] bg-white/80 p-5 shadow-[0_12px_35px_rgba(47,83,65,0.04)] sm:p-6"><div className="mb-6 flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#88a095]">Leave desk</div><h2 className="text-base font-bold text-[#244b3b]">Approval tracker</h2></div><button aria-label="Open leave request" onClick={() => setLeaveOpen(true)} className="rounded-lg bg-[#e4f0e8] p-2 text-[#3f8363] hover:bg-[#d5e9dd]"><Plus size={17} /></button></div><div className="mb-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#f7f3eb] p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-[#a18a70]">AL balance</div><div className="mt-1 text-xl font-bold text-[#6d5b48]">60 <span className="text-xs font-medium">days</span></div></div><div className="rounded-xl bg-[#edf4f0] p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-[#799184]">CL balance</div><div className="mt-1 text-xl font-bold text-[#416c58]">30 <span className="text-xs font-medium">days</span></div></div></div><div className="space-y-5"><Approval label="Personnel request" detail="Your leave application" state="complete" /><Approval label="SDM review" detail="Awaiting review" state="current" /><Approval label="ADJT approval" detail="Final sign-off" state="pending" /></div><button onClick={() => setLeaveOpen(true)} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-[#cfe0d5] py-3 text-xs font-bold text-[#3c765c] hover:bg-[#f3f8f4]"><FileCheck2 size={15} /> View all requests</button></div></section>

          <section className="mt-6 rounded-2xl border border-[#d9e5dd] bg-[#f7faf7]/80 p-5 sm:p-6"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6edf0] text-[#607d8d]"><Package size={19} /></div><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#8da098]">Logistics & stores</div><h2 className="text-base font-bold text-[#345447]">Material management</h2></div></div><span className="rounded-full border border-[#e7d6bd] bg-[#fbf4e9] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a47c4a]">Coming soon</span></div><div className="mt-5 flex flex-col justify-between gap-4 border-t border-[#e1ebe4] pt-5 sm:flex-row sm:items-center"><p className="max-w-xl text-xs leading-5 text-[#8a9b92]">Track equipment holdings, vehicle serviceability, indents and demand forecasts in one secure material ledger.</p><button className="flex items-center gap-2 text-xs font-bold text-[#5c7d6d]">Notify me on launch <ArrowUpRight size={14} /></button></div></section>

          <footer className="mt-7 flex flex-col justify-between gap-3 border-t border-[#dce6df] py-5 text-[10px] text-[#9aa9a1] sm:flex-row"><span className="flex items-center gap-1.5"><LockKeyhole size={12} /> Protected by Tresath secure access</span><span>Last synced 2 mins ago • v1.0.4</span></footer>
        </div>
      </main>

      {leaveOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17382d]/30 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="w-full max-w-md rounded-t-3xl border border-[#d5e3da] bg-[#fbfdfb] p-6 shadow-2xl sm:rounded-2xl"><div className="mb-6 flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#7e978b]">New request</div><h2 className="text-xl font-bold tracking-[-0.04em] text-[#1c4434]">Apply for leave</h2></div><button aria-label="Close leave form" onClick={() => { setLeaveOpen(false); setSubmitted(false); }} className="rounded-full p-1.5 text-[#87988f] hover:bg-[#edf4ef]"><X size={18} /></button></div>{submitted ? <div className="rounded-xl bg-[#e4f2e9] p-6 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#4e9a72] text-white"><Check size={20} /></div><h3 className="mt-3 font-bold text-[#285d48]">Request submitted</h3><p className="mt-1 text-xs leading-5 text-[#6c8c7a]">Your application is queued for SDM review and ADJT approval.</p><button onClick={() => { setLeaveOpen(false); setSubmitted(false); }} className="mt-5 text-xs font-bold text-[#39805e]">Done</button></div> : <form onSubmit={submitLeave} className="space-y-5"><div><label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#83988b]">Leave type</label><div className="grid grid-cols-2 gap-2">{(["AL", "CL"] as const).map((type) => <button type="button" key={type} onClick={() => setLeaveType(type)} className={`rounded-xl border py-3 text-left px-4 ${leaveType === type ? "border-[#75ad8c] bg-[#eaf4ed] text-[#286047]" : "border-[#dce7df] text-[#81938a]"}`}><span className="block text-sm font-bold">{type}</span><span className="text-[10px]">{type === "AL" ? "Annual leave" : "Casual leave"}</span></button>)}</div></div><div><label htmlFor="leave-days" className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#83988b]">Number of days <span className="font-normal normal-case tracking-normal">(balance: {balance})</span></label><input id="leave-days" type="number" min={1} max={balance} value={days} onChange={(event) => setDays(Number(event.target.value))} className="w-full rounded-xl border border-[#dce7df] bg-white px-4 py-3 text-sm font-semibold text-[#345a49] outline-none focus:border-[#75ad8c]" /></div><div><label htmlFor="leave-reason" className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[#83988b]">Reason</label><textarea id="leave-reason" required placeholder="Add a short reason for your request..." className="h-20 w-full resize-none rounded-xl border border-[#dce7df] bg-white px-4 py-3 text-xs text-[#345a49] outline-none placeholder:text-[#a6b2ac] focus:border-[#75ad8c]" /></div>{!canSubmit && <p className="text-xs font-semibold text-[#b9684e]">Requested days exceed your available {leaveType} balance.</p>}<button type="submit" disabled={!canSubmit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1c503c] py-3.5 text-xs font-bold text-white transition hover:bg-[#286b50] disabled:cursor-not-allowed disabled:opacity-40"><FileText size={15} /> Submit for dual approval</button><p className="flex items-center justify-center gap-1.5 text-[10px] text-[#91a097]"><LockKeyhole size={11} /> Your request is visible only to authorized reviewers</p></form>}</div></div>}
    </div>
  );
}

function StatCard({ label, value, note, icon: Icon, accent }: { label: string; value: string; note: string; icon: typeof Users; accent: string }) {
  const accents: Record<string, string> = { green: "bg-[#e1f0e7] text-[#3c8362]", blue: "bg-[#e5edf1] text-[#5f7d8e]", amber: "bg-[#f6eddf] text-[#b4814d]", rose: "bg-[#f0e5e1] text-[#a86f60]" };
  return <div className="rounded-2xl border border-[#d9e5dd] bg-white/80 p-5 shadow-[0_12px_35px_rgba(47,83,65,0.035)]"><div className="flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8c9d94]">{label}</div><div className={`rounded-lg p-2 ${accents[accent]}`}><Icon size={16} /></div></div><div className="mt-4 text-2xl font-bold tracking-[-0.05em] text-[#274c3c]">{value}</div><div className="mt-1 text-[11px] text-[#91a198]">{note}</div></div>;
}

function RingStat({ label, value, total, percent, color }: { label: string; value: string; total: string; percent: number; color: string }) {
  return <div className="flex flex-col items-center text-center"><div className="relative flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--ring-color) ${percent}%, #e8f0eb 0)` } as React.CSSProperties}><div className="flex h-[64px] w-[64px] flex-col items-center justify-center rounded-full bg-white"><span className="text-lg font-bold tracking-[-0.05em] text-[#345a49]">{value}</span><span className="text-[9px] text-[#9aaa9f]">/ {total}</span></div><style>{`:root { --ring-color: ${color === "bg-[#3d8c69]" ? "#3d8c69" : color === "bg-[#5d7890]" ? "#5d7890" : color === "bg-[#c48a5e]" ? "#c48a5e" : "#a882aa"}; }`}</style></div><div className="mt-3 text-[11px] font-semibold text-[#71877b]">{label}</div></div>;
}

function Approval({ label, detail, state }: { label: string; detail: string; state: "complete" | "current" | "pending" }) {
  return <div className="flex items-center gap-3"><div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${state === "complete" ? "bg-[#4b9870] text-white" : state === "current" ? "border-2 border-[#69a783] bg-[#e5f2e9] text-[#4c966f]" : "border border-[#d7e2db] bg-[#f8fbf8] text-[#b0bcb5]"}`}>{state === "complete" ? <Check size={14} strokeWidth={3} /> : state === "current" ? <Clock3 size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</div><div className="flex-1"><div className="text-xs font-bold text-[#526e61]">{label}</div><div className="text-[10px] text-[#9aa9a1]">{detail}</div></div><span className={`text-[9px] font-bold uppercase tracking-wider ${state === "complete" ? "text-[#4b9870]" : state === "current" ? "text-[#b47b4b]" : "text-[#a2afa8]"}`}>{state === "complete" ? "Signed" : state === "current" ? "In review" : "Pending"}</span></div>;
}
