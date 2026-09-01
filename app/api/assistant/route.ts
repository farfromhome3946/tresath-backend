export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { ...corsHeaders, ...init?.headers } });
}

function extractEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) return null;
  return value.trim();
}

function makeFallbackAnswer(message: string, context: Record<string, unknown>) {
  const role = typeof context.role === "string" ? context.role : "USER";
  const squadron = typeof context.squadron === "string" ? context.squadron : "your squadron";
  const leaveCount = typeof context.leaveCount === "number" ? context.leaveCount : 0;
  const peopleCount = typeof context.peopleCount === "number" ? context.peopleCount : 0;

  const lower = message.toLowerCase();

  if (lower.includes("leave") || lower.includes("status") || lower.includes("pending")) {
    return `Current status: ${leaveCount} leave records are in the system across ${peopleCount} personnel. Review pending approvals first, then check overlap and return dates before approving or rejecting any request.`;
  }

  if (lower.includes("summary") || lower.includes("overview") || lower.includes("readiness")) {
    return `${role} command summary for ${squadron}: ${peopleCount} personnel are tracked and ${leaveCount} leave entries are active. Prioritize immediate return dates, pending approvals, and squadron availability before issuing further tasking.`;
  }

  return `I can help with leave tracking, command readiness, and operational follow-ups for ${squadron}. Right now, the assistant is running in offline fallback mode until Azure AI Foundry credentials are configured in the environment.`;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string; context?: Record<string, unknown> };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return json({ error: "Message is required." }, { status: 400 });

    const endpoint = extractEnv("AZURE_OPENAI_ENDPOINT");
    const apiKey = extractEnv("AZURE_OPENAI_API_KEY");
    const deployment = extractEnv("AZURE_OPENAI_DEPLOYMENT");

    if (!endpoint || !apiKey || !deployment) {
      return json({ answer: makeFallbackAnswer(message, body.context ?? {}) });
    }

    const response = await fetch(`${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-10-21`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are a tactical command assistant for a 63 Cavalry operations app. Keep responses concise, practical, and focused on leave, readiness, and squadron coordination.",
          },
          { role: "user", content: message }
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return json({ error: data?.error?.message || "The Azure AI request failed." }, { status: 502 });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return json({ error: "The AI model returned an empty response." }, { status: 502 });
    }

    return json({ answer: answer.trim() });
  } catch (error) {
    console.error("AI assistant failed:", error);
    return json({ error: "Unable to process the assistant request." }, { status: 500 });
  }
}
