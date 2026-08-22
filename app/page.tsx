"use client";

import { useState, type FormEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowRight, LockKeyhole, LogOut } from "lucide-react";

type Account = { id: string; serviceNumber: string; fullName: string; rank: string; role: string };

const CLOUD_API_ORIGIN = "https://vercel.app";

function apiUrl(path: string) {
  return typeof window !== "undefined" && Capacitor.isNativePlatform() ? `${CLOUD_API_ORIGIN}${path}` : path;
}

export default function Home() {
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  if (!account) return <AuthScreen mode={mode} setMode={setMode} onAuthenticated={setAccount} />;
  return <AppShell account={account} onLogout={() => setAccount(null)} />;
}

function AuthScreen({ mode, setMode, onAuthenticated }: { mode: "login" | "register"; setMode: (m: "login" | "register") => void; onAuthenticated: (a: Account) => void }) {
  const [form, setForm] = useState({ serviceNumber: "", password: "", fullName: "Test User", rank: "Personnel", trade: "General Duty", hometown: "Base", role: "PERSONNEL", squadron: "AGNI" });
  const [error, setError] = useState(""); 
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((curr) => ({ ...curr, [key]: value }));
  
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const payload = { ...form, action: mode };
      const response = await fetch(apiUrl("/api/personnel"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Authentication failed.");
      onAuthenticated(data.account); 
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected network error occurred.");
    } finally { setBusy(false); }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#edf4ef] p-5 text-[#193c30]">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
        <section className="bg-[#183f31] p-10 text-white flex flex-col justify-between min-h-[400px]">
          <div className="text-lg font-black tracking-wider">TRESATH</div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">One unit.<br /><span className="text-[#b9dbc7]">One picture.</span></h1>
            <p className="mt-4 text-sm text-[#b7d0c1]">Secure terminal node operational workspace.</p>
          </div>
          <div className="text-xs text-[#a9c9b7]"><LockKeyhole size={12} className="inline mr-1"/> Data masked by default.</div>
        </section>
        <section className="p-10 bg-gray-50 flex flex-col justify-center">
          <h2 className="text-xl font-bold text-[#204736] mb-6">{mode === "login" ? "Welcome back" : "Create Profile"}</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Army No.</label>
              <input type="text" value={form.serviceNumber} onChange={(e) => set("serviceNumber", e.target.value)} placeholder="630001" className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Password</label>
              <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:outline-none" />
            </div>
            {error && <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p>}
            <button disabled={busy} className="w-full rounded-xl bg-[#1d513c] py-3 text-sm font-bold text-white flex items-center justify-center gap-2">
              {busy ? "Connecting..." : mode === "login" ? "Sign In Securely" : "Create Profile"} <ArrowRight size={14} />
            </button>
          </form>
          <div className="mt-6 text-center text-xs text-gray-500">
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="font-bold text-[#1d513c] hover:underline">
              {mode === "login" ? "Switch to Register Mode" : "Switch to Login Mode"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function AppShell({ account, onLogout }: { account: Account; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-[#f1f5f2] w-full p-8 flex flex-col justify-between">
      <header className="flex justify-between items-center border-b pb-4 border-gray-300">
        <div className="text-sm font-bold text-gray-700">{account?.fullName || "Personnel Node"} ({account?.rank || "Member"})</div>
        <div className="text-xs px-3 py-1 bg-green-100 text-green-800 rounded-full font-bold">Secure Node Connected</div>
      </header>
      <main className="flex-1 py-8">
        <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-lg">Unit Overview Dashboard</h3>
          <p className="text-sm text-gray-500 mt-1">Active operations matrix status: Nominal.</p>
        </div>
      </main>
      <button onClick={onLogout} className="w-full max-w-xs mx-auto text-center px-4 py-3 text-sm font-semibold text-white bg-red-600 rounded-xl flex items-center justify-center gap-2 shadow-md">
        <LogOut size={16} /> Sign Out of Node
      </button>
    </div>
  );
}
