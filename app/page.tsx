"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
	Archive,
	ArrowUpRight,
	Bell,
	CalendarDays,
	Check,
	ChevronDown,
	Clock3,
	FileCheck2,
	LayoutDashboard,
	LockKeyhole,
	Menu,
	Package,
	Search,
	ShieldCheck,
	UserRound,
	Users,
	X,
} from "lucide-react";

type Scope = "Individual Personnel" | "Squadron / SDM Admin" | "ADJT Admin";
type Squadron = "All squadrons" | "Alpha" | "Bravo" | "Charlie" | "HQ" | "Officers";
type ApprovalState = "pending" | "approved" | "rejected";

const scopes: Scope[] = ["Individual Personnel", "Squadron / SDM Admin", "ADJT Admin"];
const squadrons: Squadron[] = ["All squadrons", "Alpha", "Bravo", "Charlie", "HQ", "Officers"];

const unitData: Record<Squadron, { strength: number; available: number; leave: number; tdy: number }> = {
	"All squadrons": { strength: 187, available: 174, leave: 8, tdy: 5 },
	Alpha: { strength: 42, available: 39, leave: 2, tdy: 1 },
	Bravo: { strength: 38, available: 35, leave: 1, tdy: 2 },
	Charlie: { strength: 41, available: 38, leave: 2, tdy: 1 },
	HQ: { strength: 36, available: 34, leave: 1, tdy: 1 },
	Officers: { strength: 30, available: 28, leave: 2, tdy: 0 },
};

const personnel = [
	{ service: "CAV-1042", identity: "A•••• S••••", name: "Arjun Singh", rank: "Risso", trade: "Gunner", unit: "Bravo", status: "Available", tone: "green" },
	{ service: "CAV-0981", identity: "V•••• C••••", name: "Vikram Chauhan", rank: "Major", trade: "Armour", unit: "HQ", status: "On leave", tone: "amber" },
	{ service: "CAV-1127", identity: "R•••• P••••", name: "Rakesh Pradhan", rank: "Naib Risaldar", trade: "Fitter", unit: "Alpha", status: "Available", tone: "green" },
	{ service: "CAV-1073", identity: "S•••• B••••", name: "Sanjay Bhati", rank: "Captain", trade: "Signals", unit: "Charlie", status: "Course / TDY", tone: "blue" },
	{ service: "CAV-1159", identity: "K•••• Y••••", name: "Karan Yadav", rank: "Havildar", trade: "Driver", unit: "Bravo", status: "Available", tone: "green" },
	{ service: "CAV-1016", identity: "N•••• R••••", name: "Naveen Rathore", rank: "Lieutenant", trade: "Armour", unit: "Officers", status: "Available", tone: "green" },
];

const nav = [
	{ label: "Command overview", icon: LayoutDashboard },
	{ label: "Nominal roll", icon: Users },
	{ label: "Leave management", icon: CalendarDays, badge: "03" },
	{ label: "Material", icon: Package },
];

export default function Home() {
	const [scope, setScope] = useState<Scope>("Individual Personnel");
	const [squadron, setSquadron] = useState<Squadron>("All squadrons");
	const [activeNav, setActiveNav] = useState("Command overview");
	const [query, setQuery] = useState("");
	const [menuOpen, setMenuOpen] = useState(false);
	const [leaveType, setLeaveType] = useState<"AL" | "CL">("AL");
	const [requestedDays, setRequestedDays] = useState(4);
	const [reason, setReason] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [sdmStatus, setSdmStatus] = useState<ApprovalState>("pending");
	const [adjtStatus, setAdjtStatus] = useState<ApprovalState>("pending");

	const metrics = unitData[squadron];
	const balance = leaveType === "AL" ? 60 : 30;
	const filteredPersonnel = useMemo(() => personnel.filter((person) => {
		const matchesUnit = squadron === "All squadrons" || person.unit === squadron;
		const haystack = `${person.service} ${person.identity} ${person.name} ${person.rank} ${person.trade} ${person.unit}`.toLowerCase();
		return matchesUnit && haystack.includes(query.toLowerCase());
	}), [query, squadron]);

	function submitLeave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (requestedDays > 0 && requestedDays <= balance && reason.trim()) setSubmitted(true);
	}

	return (
		<div className="min-h-screen bg-[#f1f5f2] text-[#1b3027]">
			<div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_78%_0%,rgba(196,222,207,0.7),transparent_34%),linear-gradient(135deg,#f7faf7,#edf3ef_58%,#f7f3ed)]" />
			<aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-[#d5e1d9] bg-[#f8faf8]/95 px-5 py-6 backdrop-blur-xl transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
				<div className="mb-12 flex items-center justify-between px-2">
					<div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173b2e] text-[#dceee3]"><ShieldCheck size={21} /></div><div><div className="text-lg font-bold tracking-[-0.05em] text-[#173b2e]">tresath</div><div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#7e9287]">63 Cavalry</div></div></div>
					<button aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="text-[#789087] lg:hidden"><X size={20} /></button>
				</div>
				<div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9aaba2]">Workspace</div>
				<nav className="space-y-1">{nav.map(({ label, icon: Icon, badge }) => <button key={label} onClick={() => { setActiveNav(label); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition ${activeNav === label ? "bg-[#e0eee6] text-[#246147]" : "text-[#71847a] hover:bg-[#edf3ef]"}`}><Icon size={17} strokeWidth={1.8} /><span className="flex-1">{label}</span>{badge && <span className="rounded-md bg-[#f5e3d8] px-1.5 py-0.5 text-[10px] text-[#a76142]">{badge}</span>}</button>)}</nav>
				<div className="mt-auto rounded-2xl border border-[#d7e3db] bg-white/65 p-4"><div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-[#587268]"><LockKeyhole size={14} /> Secure workspace</div><p className="text-[11px] leading-5 text-[#8b9b92]">Access is logged and identity data is protected under unit privacy controls.</p><div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4b936d]"><span className="h-1.5 w-1.5 rounded-full bg-[#5aaa7d]" /> System operational</div></div>
			</aside>
			{menuOpen && <button aria-label="Close sidebar overlay" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-[#173b2e]/20 lg:hidden" />}

			<main className="relative z-10 min-h-screen lg:ml-[264px]">
				<header className="flex h-[78px] items-center justify-between border-b border-[#dce6df] bg-[#f7faf7]/70 px-5 backdrop-blur-xl sm:px-8 lg:px-10"><div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={() => setMenuOpen(true)} className="text-[#315d4b] lg:hidden"><Menu size={22} /></button><div className="hidden items-center gap-2 text-xs text-[#899a91] sm:flex"><span>Operations</span><span>/</span><span className="font-bold text-[#385a4b]">{activeNav}</span></div><span className="text-sm font-bold text-[#385a4b] sm:hidden">Tresath / {activeNav}</span></div><div className="flex items-center gap-3"><button aria-label="Notifications" className="relative rounded-full p-2 text-[#688075] hover:bg-white"><Bell size={18} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#cf7756]" /></button><div className="hidden h-7 w-px bg-[#dce6df] sm:block" /><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c8ddd1] text-[10px] font-bold text-[#285d49]">AK</div><div className="hidden text-right sm:block"><div className="text-xs font-bold text-[#2d5141]">Arjun K.</div><div className="text-[10px] text-[#8a9b92]">Risso / Bravo Sqn</div></div><ChevronDown size={14} className="text-[#91a198]" /></div></div></header>

				<div className="mx-auto max-w-[1450px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
					<section className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#739183]"><ShieldCheck size={13} /> 63 Cavalry readiness desk <span className="h-1 w-1 rounded-full bg-[#6ca685]" /> 21 Aug 2026</div><h1 className="text-[clamp(1.8rem,4vw,2.6rem)] font-bold tracking-[-0.055em] text-[#193c30]">Command overview</h1><p className="mt-1 text-sm text-[#81938a]">A current picture of personnel strength, availability and approvals.</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><ScopeButton scope={scope} setScope={setScope} /><Filter label="Unit view" value={squadron} onChange={(value) => setSquadron(value as Squadron)} options={squadrons} /></div></section>

					<section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total strength" value={metrics.strength} helper="personnel on roll" icon={Users} accent="green" /><MetricCard label="Available" value={metrics.available} helper={`${Math.round((metrics.available / metrics.strength) * 100)}% of selected strength`} icon={ShieldCheck} accent="blue" /><MetricCard label="On leave" value={metrics.leave} helper="approved absence" icon={CalendarDays} accent="amber" /><MetricCard label="On course / TDY" value={metrics.tdy} helper="temporarily committed" icon={Archive} accent="rose" /></section>

					<section className="mb-6 grid gap-6 xl:grid-cols-[1.32fr_0.68fr]"><div className="rounded-2xl border border-[#d8e4dc] bg-white/80 p-5 shadow-[0_12px_35px_rgba(47,83,65,0.04)] sm:p-6"><div className="mb-6 flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#88a095]">Selected scope</div><h2 className="text-base font-bold tracking-[-0.02em] text-[#244b3b]">Readiness snapshot</h2></div><div className="rounded-lg bg-[#edf5ef] px-3 py-2 text-[10px] font-bold text-[#438064]">{scope}</div></div><div className="grid grid-cols-2 gap-5 sm:grid-cols-4"><Progress value={metrics.strength} max={200} label="Strength" color="#3d8c69" /><Progress value={metrics.available} max={metrics.strength} label="Available" color="#5d7890" /><Progress value={metrics.leave} max={15} label="Leave" color="#c48a5e" /><Progress value={metrics.tdy} max={10} label="Course / TDY" color="#a882aa" /></div><div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#edf1ed] pt-4 text-[11px] text-[#84958c]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#3d8c69]" /> Ready</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#c48a5e]" /> Committed</span><span className="ml-auto flex items-center gap-1.5"><Clock3 size={13} /> Synced 2 mins ago</span></div></div><div className="rounded-2xl border border-[#d8e4dc] bg-[#1d4435] p-6 text-[#e1f0e8] shadow-[0_12px_35px_rgba(47,83,65,0.08)]"><div className="mb-8 flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#9fc4ae]">Role context</div><span className="rounded-full bg-[#32634f] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#b9d8c6]">{scope === "Individual Personnel" ? "Personal" : scope === "Squadron / SDM Admin" ? "SDM" : "ADJT"}</span></div><h2 className="max-w-[240px] text-xl font-bold leading-tight tracking-[-0.04em]">One operating picture for every decision.</h2><p className="mt-2 max-w-[245px] text-xs leading-5 text-[#abc8b8]">Switch administrative scope to review the right level of personnel and approvals.</p><button onClick={() => setActiveNav("Leave management")} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d7e9df] py-3 text-xs font-bold text-[#21553f] transition hover:bg-white"><FileCheck2 size={15} /> Review approvals</button></div></section>

					<section className="mb-6 overflow-hidden rounded-2xl border border-[#d8e4dc] bg-white/80 shadow-[0_12px_35px_rgba(47,83,65,0.04)]"><div className="flex flex-col gap-4 border-b border-[#edf1ed] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#88a095]">Personnel registry</div><h2 className="text-base font-bold text-[#244b3b]">Nominal roll <span className="ml-1 text-xs font-medium text-[#a0ada5]">/ {filteredPersonnel.length} shown</span></h2></div><label className="flex h-9 items-center gap-2 rounded-lg border border-[#dbe6df] bg-[#fbfdfb] px-3 text-xs text-[#8a9b92] sm:w-64"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search service, rank, trade..." className="w-full bg-transparent outline-none placeholder:text-[#a6b2ac]" /></label></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="bg-[#f6f9f6] text-[10px] font-bold uppercase tracking-wider text-[#9aaba2]"><tr><th className="px-6 py-3">Service number</th><th className="px-4 py-3">Masked identity</th><th className="px-4 py-3">Full rank</th><th className="px-4 py-3">Trade</th><th className="px-4 py-3">Squadron</th><th className="px-4 py-3">Status</th><th className="px-6 py-3" /></tr></thead><tbody className="divide-y divide-[#eff3ef]">{filteredPersonnel.map((person) => <tr key={person.service} className="transition hover:bg-[#f7faf7]"><td className="px-6 py-3.5 font-mono text-[11px] font-bold text-[#547466]">{person.service}</td><td className="px-4"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e3eee7] text-[#43755e]"><UserRound size={13} /></div><span className="font-semibold text-[#526e61]">{person.identity}</span></div></td><td className="px-4 font-semibold text-[#637b6e]">{person.rank}</td><td className="px-4 text-[#7a8d83]">{person.trade}</td><td className="px-4 text-[#637b6e]">{person.unit}</td><td className="px-4"><Status tone={person.tone} label={person.status} /></td><td className="px-6 text-right text-[#9aaba2]"><ArrowUpRight size={15} /></td></tr>)}{filteredPersonnel.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-[#8a9b92]">No personnel match the current filters.</td></tr>}</tbody></table></div></section>

					<section className="grid gap-6 xl:grid-cols-[0.7fr_0.8fr_0.5fr]"><LeaveCalculator leaveType={leaveType} setLeaveType={setLeaveType} requestedDays={requestedDays} setRequestedDays={setRequestedDays} reason={reason} setReason={setReason} balance={balance} submitted={submitted} onSubmit={submitLeave} /><ApprovalTracker sdmStatus={sdmStatus} adjtStatus={adjtStatus} setSdmStatus={setSdmStatus} setAdjtStatus={setAdjtStatus} /><ComingSoon /></section>
					<footer className="mt-7 flex flex-col justify-between gap-3 border-t border-[#dce6df] py-5 text-[10px] text-[#9aa9a1] sm:flex-row"><span className="flex items-center gap-1.5"><LockKeyhole size={12} /> Protected by Tresath secure access</span><span>Data masked by default • v1.0.4</span></footer>
				</div>
			</main>
		</div>
	);
}

function ScopeButton({ scope, setScope }: { scope: Scope; setScope: (scope: Scope) => void }) {
	const [open, setOpen] = useState(false);
	return <div className="relative"><button onClick={() => setOpen(!open)} className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-[#d4e2d9] bg-white/80 px-3 text-left text-xs font-bold text-[#416451] sm:w-56"><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#4b936d]" />{scope}</span><ChevronDown size={14} /></button>{open && <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-xl border border-[#d5e3da] bg-white p-1 shadow-xl">{scopes.map((item) => <button key={item} onClick={() => { setScope(item); setOpen(false); }} className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold ${item === scope ? "bg-[#e6f2e9] text-[#2c7454]" : "text-[#71847a] hover:bg-[#f2f7f3]"}`}>{item}</button>)}</div>}</div>;
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
	return <label className="flex h-10 items-center gap-2 rounded-xl border border-[#d4e2d9] bg-white/80 px-3 text-[10px] font-bold uppercase tracking-wider text-[#93a39a]"><span className="hidden sm:inline">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="max-w-[125px] bg-transparent text-xs font-bold normal-case tracking-normal text-[#416451] outline-none"><option value="All squadrons">All squadrons</option>{options.filter((option) => option !== "All squadrons").map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function MetricCard({ label, value, helper, icon: Icon, accent }: { label: string; value: number; helper: string; icon: LucideIcon; accent: string }) {
	const colors: Record<string, string> = { green: "bg-[#e1f0e7] text-[#3c8362]", blue: "bg-[#e5edf1] text-[#5f7d8e]", amber: "bg-[#f6eddf] text-[#b4814d]", rose: "bg-[#f0e5e1] text-[#a86f60]" };
	return <div className="rounded-2xl border border-[#d8e4dc] bg-white/80 p-5 shadow-[0_12px_35px_rgba(47,83,65,0.035)]"><div className="flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8c9d94]">{label}</div><div className={`rounded-lg p-2 ${colors[accent]}`}><Icon size={16} /></div></div><div className="mt-4 text-2xl font-bold tracking-[-0.05em] text-[#274c3c]">{value}</div><div className="mt-1 text-[11px] text-[#91a198]">{helper}</div></div>;
}

function Progress({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
	const percent = Math.min(100, Math.round((value / max) * 100));
	return <div className="flex flex-col items-center text-center"><div className="relative flex h-[78px] w-[78px] items-center justify-center rounded-full" style={{ background: `conic-gradient(${color} ${percent}%, #e8f0eb 0)` }}><div className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full bg-white"><span className="text-lg font-bold tracking-[-0.05em] text-[#345a49]">{value}</span><span className="text-[9px] text-[#9aaa9f]">{percent}%</span></div></div><div className="mt-3 text-[11px] font-semibold text-[#71877b]">{label}</div></div>;
}

function Status({ tone, label }: { tone: string; label: string }) {
	const colors: Record<string, string> = { green: "text-[#458362]", amber: "text-[#a97147]", blue: "text-[#607c9c]" };
	return <span className={`inline-flex items-center gap-1.5 font-semibold ${colors[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}

function LeaveCalculator({ leaveType, setLeaveType, requestedDays, setRequestedDays, reason, setReason, balance, submitted, onSubmit }: { leaveType: "AL" | "CL"; setLeaveType: (value: "AL" | "CL") => void; requestedDays: number; setRequestedDays: (value: number) => void; reason: string; setReason: (value: string) => void; balance: number; submitted: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
	const valid = requestedDays > 0 && requestedDays <= balance && reason.trim().length > 0;
	return <div className="rounded-2xl border border-[#d8e4dc] bg-white/80 p-5 shadow-[0_12px_35px_rgba(47,83,65,0.04)] sm:p-6"><div className="mb-5 flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#88a095]">Leave calculator</div><h2 className="text-base font-bold text-[#244b3b]">Your allowance</h2></div><CalendarDays size={18} className="text-[#6e9d82]" /></div><div className="mb-5 grid grid-cols-2 gap-2"><button onClick={() => setLeaveType("AL")} className={`rounded-xl p-3 text-left ${leaveType === "AL" ? "bg-[#f7f0e5] ring-1 ring-[#e1cba8]" : "bg-[#f7faf7]"}`}><div className="text-[10px] font-bold uppercase tracking-wider text-[#a18a70]">Annual leave</div><div className="mt-1 text-xl font-bold text-[#6d5b48]">60 <span className="text-xs font-medium">days</span></div></button><button onClick={() => setLeaveType("CL")} className={`rounded-xl p-3 text-left ${leaveType === "CL" ? "bg-[#e7f2eb] ring-1 ring-[#a9ceb6]" : "bg-[#f7faf7]"}`}><div className="text-[10px] font-bold uppercase tracking-wider text-[#799184]">Casual leave</div><div className="mt-1 text-xl font-bold text-[#416c58]">30 <span className="text-xs font-medium">days</span></div></button></div>{submitted ? <div className="rounded-xl bg-[#e4f2e9] p-5 text-center"><Check size={20} className="mx-auto text-[#4e9a72]" /><div className="mt-2 text-xs font-bold text-[#285d48]">Request submitted for review</div><p className="mt-1 text-[10px] text-[#6c8c7a]">The SDM and ADJT signature chain is now active.</p></div> : <form onSubmit={onSubmit} className="space-y-3"><div className="flex gap-3"><label className="flex-1 text-[10px] font-bold uppercase tracking-wider text-[#83988b]">Request days<input type="number" min={1} value={requestedDays} onChange={(event) => setRequestedDays(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-[#dce7df] bg-white px-3 py-2.5 text-sm font-bold text-[#345a49] outline-none focus:border-[#75ad8c]" /></label><div className="flex-1 pt-5 text-[10px] text-[#8b9b92]">Remaining balance<div className="mt-1 text-base font-bold text-[#47705d]">{Math.max(0, balance - requestedDays)} days</div></div></div><label className="block text-[10px] font-bold uppercase tracking-wider text-[#83988b]">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Brief reason..." className="mt-1.5 h-16 w-full resize-none rounded-lg border border-[#dce7df] bg-white px-3 py-2.5 text-xs text-[#345a49] outline-none placeholder:text-[#a6b2ac] focus:border-[#75ad8c]" /></label>{requestedDays > balance && <p className="text-[10px] font-bold text-[#b9684e]">Requested days exceed the {leaveType} allowance.</p>}<button type="submit" disabled={!valid} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1c503c] py-3 text-xs font-bold text-white hover:bg-[#286b50] disabled:cursor-not-allowed disabled:opacity-40"><FileCheck2 size={14} /> Submit leave request</button></form>}</div>;
}

function ApprovalTracker({ sdmStatus, adjtStatus, setSdmStatus, setAdjtStatus }: { sdmStatus: ApprovalState; adjtStatus: ApprovalState; setSdmStatus: (state: ApprovalState) => void; setAdjtStatus: (state: ApprovalState) => void }) {
	return <div className="rounded-2xl border border-[#d8e4dc] bg-white/80 p-5 shadow-[0_12px_35px_rgba(47,83,65,0.04)] sm:p-6"><div className="mb-5 flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#88a095]">Dual approval</div><h2 className="text-base font-bold text-[#244b3b]">Signature tracker</h2></div><LockKeyhole size={17} className="text-[#6e9d82]" /></div><div className="mb-5 rounded-xl bg-[#f4f8f5] p-3 text-[10px] leading-5 text-[#81958a]">Leave requests require both authorities before they become effective.</div><Signature label="SDM authority" status={sdmStatus} onApprove={() => setSdmStatus("approved")} onReject={() => setSdmStatus("rejected")} /><div className="my-4 ml-3 h-5 border-l border-dashed border-[#cbdad0]" /><Signature label="ADJT authority" status={adjtStatus} onApprove={() => setAdjtStatus("approved")} onReject={() => setAdjtStatus("rejected")} /><div className="mt-6 flex items-center justify-between border-t border-[#edf1ed] pt-4"><span className="text-[10px] font-bold uppercase tracking-wider text-[#98a8a0]">Overall decision</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${sdmStatus === "approved" && adjtStatus === "approved" ? "bg-[#e1f0e7] text-[#438064]" : "bg-[#f7eee0] text-[#a2764c]"}`}>{sdmStatus === "approved" && adjtStatus === "approved" ? "Approved" : "Awaiting signatures"}</span></div></div>;
}

function Signature({ label, status, onApprove, onReject }: { label: string; status: ApprovalState; onApprove: () => void; onReject: () => void }) {
	return <div className="flex items-center gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-full ${status === "approved" ? "bg-[#4b9870] text-white" : status === "rejected" ? "bg-[#f1deda] text-[#a85d4e]" : "border-2 border-[#79af8e] bg-[#e7f3eb] text-[#4c966f]"}`}>{status === "approved" ? <Check size={15} strokeWidth={3} /> : status === "rejected" ? <X size={15} /> : <Clock3 size={14} />}</div><div className="flex-1"><div className="text-xs font-bold text-[#526e61]">{label}</div><div className="text-[10px] text-[#99a8a0]">{status === "pending" ? "Pending signature decision" : status === "approved" ? "Digitally signed" : "Decision returned"}</div></div>{status === "pending" ? <div className="flex gap-1"><button onClick={onApprove} aria-label={`Approve ${label}`} className="rounded-lg bg-[#e4f2e9] p-2 text-[#438064] hover:bg-[#d3eadc]"><Check size={14} /></button><button onClick={onReject} aria-label={`Reject ${label}`} className="rounded-lg bg-[#f8eae6] p-2 text-[#a85d4e] hover:bg-[#f3ddd8]"><X size={14} /></button></div> : <span className={`text-[9px] font-bold uppercase tracking-wider ${status === "approved" ? "text-[#4b9870]" : "text-[#a85d4e]"}`}>{status}</span>}</div>;
}

function ComingSoon() {
	return <div className="relative overflow-hidden rounded-2xl border border-[#d8e4dc] bg-[#edf3f0] p-5 sm:p-6"><div className="absolute -right-10 -top-10 h-32 w-32 rounded-full border-[18px] border-[#dce9e1]" /><div className="relative flex h-full flex-col"><div className="mb-5 flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#88a095]">Logistics & stores</div><h2 className="text-base font-bold text-[#345447]">Material module</h2></div><Package size={19} className="text-[#668e7b]" /></div><div className="mt-2 flex-1"><span className="rounded-full border border-[#e7d6bd] bg-[#fbf4e9] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a47c4a]">Coming soon</span><p className="mt-5 text-sm font-semibold leading-5 text-[#4b6d5d]">Your secure stores ledger is being prepared.</p><p className="mt-2 text-[11px] leading-5 text-[#8a9b92]">Equipment holdings, vehicle serviceability and indents will be available here.</p></div><button className="mt-6 flex items-center gap-2 text-xs font-bold text-[#5c7d6d]">Notify me on launch <ArrowUpRight size={14} /></button></div></div>;
}
