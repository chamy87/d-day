import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "./supabase";

/**
 * Provider-agnostic AI helper for reasoning tasks (news triage, pick
 * rationales, start/sit explanations). Server-only.
 *
 * Dormant until a key is set in .env.local / Vercel env:
 *   ANTHROPIC_API_KEY — preferred (Claude)
 *   OPENAI_API_KEY    — alternative (ChatGPT)
 *
 * The active model comes from the ai_models table (refreshed by
 * /api/cron/models) with hardcoded fallbacks.
 */
export type AIProvider = "anthropic" | "openai";

const FALLBACK_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-5",
};

export function activeProvider(): AIProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export async function currentModel(provider: AIProvider): Promise<string> {
  try {
    const { data } = await supabaseAdmin()
      .from("ai_models")
      .select("model_id")
      .eq("provider", provider)
      .eq("is_default", true)
      .maybeSingle();
    return data?.model_id ?? FALLBACK_MODELS[provider];
  } catch {
    return FALLBACK_MODELS[provider];
  }
}

/** One-shot reasoning call. Throws if no provider key is configured. */
export async function aiReason(prompt: string, system?: string): Promise<string> {
  const provider = activeProvider();
  if (!provider) {
    throw new Error(
      "No AI provider configured — set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local",
    );
  }
  const model = await currentModel(provider);

  if (provider === "anthropic") {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // Server-side refusal fallback: on a policy decline the API re-runs the
      // request on the fallback model inside the same call.
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") {
      throw new Error("AI declined the request");
    }
    return response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  // OpenAI branch (raw HTTP; no SDK dependency until it's actually used)
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message.content ?? "";
}
