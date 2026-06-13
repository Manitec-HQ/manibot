import { model, modelID } from "@/ai/providers";
import { weatherTool, kairosSearchTool } from "@/ai/tools";
import { convertToModelMessages, stepCountIs, streamText, UIMessage } from "ai";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

export const maxDuration = 60;

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts", "manibot-system.md"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// In-memory rate limiter
// ---------------------------------------------------------------------------

const RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_PER_HOUR = 60;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

interface RateEntry {
  minute: { count: number; windowStart: number };
  hour: { count: number; windowStart: number };
}

const rateLimitMap = new Map<string, RateEntry>();

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) ?? {
    minute: { count: 0, windowStart: now },
    hour: { count: 0, windowStart: now },
  };

  if (now - entry.minute.windowStart > ONE_MINUTE_MS) {
    entry.minute = { count: 0, windowStart: now };
  }

  if (now - entry.hour.windowStart > ONE_HOUR_MS) {
    entry.hour = { count: 0, windowStart: now };
  }

  if (entry.minute.count >= RATE_LIMIT_PER_MINUTE) {
    rateLimitMap.set(ip, entry);
    return { allowed: false, reason: "minute" };
  }

  if (entry.hour.count >= RATE_LIMIT_PER_HOUR) {
    rateLimitMap.set(ip, entry);
    return { allowed: false, reason: "hour" };
  }

  entry.minute.count++;
  entry.hour.count++;
  rateLimitMap.set(ip, entry);

  return { allowed: true };
}

let pruneCounter = 0;
function maybePrune() {
  if (++pruneCounter < 100) return;
  pruneCounter = 0;
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (
      now - entry.minute.windowStart > ONE_MINUTE_MS &&
      now - entry.hour.windowStart > ONE_HOUR_MS
    ) {
      rateLimitMap.delete(ip);
    }
  }
}

// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  maybePrune();
  const { allowed, reason } = checkRateLimit(ip);

  if (!allowed) {
    const message =
      reason === "minute"
        ? "Slow down — you're sending messages too quickly. Try again in a minute."
        : "You've hit the hourly message limit. Come back in a little while.";
    return new Response(JSON.stringify({ error: message }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    messages,
    selectedModel,
  }: { messages: UIMessage[]; selectedModel: modelID } = await req.json();

  const result = streamText({
    model: model.languageModel(selectedModel),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      getWeather: weatherTool,
      kairosSearch: kairosSearchTool,
    },
    experimental_telemetry: {
      isEnabled: false,
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => {
      if (error instanceof Error) {
        if (error.message.includes("Rate limit")) {
          return "Rate limit exceeded. Please try again later.";
        }
      }
      console.error(error);
      return "An error occurred.";
    },
  });
}
