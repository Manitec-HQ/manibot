// This is a minimal, non-breaking patch to restore /api/chat by replacing two dead Groq model IDs
// with a small fallback list of currently available models.
//
// Evidence:
// - Vercel runtime logs show 404 for `meta-llama/llama-4-scout-17b-16e-instruct`.
// - Vercel runtime logs show 400 `model_decommissioned` for `deepseek-r1-distill-llama-70b`.
// - Groq catalog (Aug–Sep 2026) lists `meta-llama/llama-3.3-70b-versatile`, `qwen/qwen-3.5-32b`,
//   and `openai/gpt-oss-20b` as available models.
//
// Change:
// - Introduce a small GROQ_MODELS fallback array.
// - Try each model in order until one succeeds.
// - Log which model was actually used for each request.

import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";
import { manibotSessionManager } from "@/lib/manibot-session";
import { tools } from "@/ai/tools";

// Minimal fallback list of available Groq models (Aug–Sep 2026 catalog)
const GROQ_MODELS = [
  "meta-llama/llama-3.3-70b-versatile",
  "qwen/qwen-3.5-32b",
  "openai/gpt-oss-20b",
] as const;

const chatBodySchema = z.object({
  message: z.string(),
  sessionId: z.string().optional(),
  project: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parse = chatBodySchema.safeParse(body);
  if (!parse.success) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { message, sessionId, project = "general" } = parse.data;
  const effectiveSessionId = sessionId || crypto.randomUUID();

  const session = await manibotSessionManager.getOrCreateSession(
    effectiveSessionId,
    project
  );

  const history = session.messages.slice(-10);

  let lastError: unknown = null;

  for (const modelId of GROQ_MODELS) {
    try {
      const result = streamText({
        model: groq(modelId),
        system: `You are Mani, a concise, helpful assistant.`,
        messages: [
          ...history,
          { role: "user", content: message },
        ],
        tools,
        maxSteps: 3,
        onFinish: async ({ text }) => {
          await manibotSessionManager.appendMessage(effectiveSessionId, {
            role: "assistant",
            content: text,
          });
        },
      });

      console.log("[mani-chat] model_success", { modelId, sessionId: effectiveSessionId });

      return result.toDataStreamResponse();
    } catch (err) {
      lastError = err;
      console.warn("[mani-chat] model_failed", { modelId, sessionId: effectiveSessionId, error: err });
    }
  }

  console.error("[mani-chat] all_models_failed", { sessionId: effectiveSessionId, lastError });
  return new Response(
    JSON.stringify({ error: "All configured models failed. Check Vercel logs for details." }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
