import { tool } from "ai";
import { z } from "zod";

export const weatherTool = tool({
  description: "Get the weather in a location",
  inputSchema: z.object({
    location: z.string().describe("The location to get the weather for"),
  }),
  execute: async ({ location }) => ({
    location,
    temperature: 72 + Math.floor(Math.random() * 21) - 10,
  }),
});

// ---------------------------------------------------------------------------
// Kairos Search
// Calls the Kairos search → answer pipeline.
// Tavily fetches live web results; Groq synthesizes a grounded answer.
// Returns { answer, sources } — Mani can quote both in its response.
// Requires KAIROS_URL env var (e.g. https://kairos-orcin-eight.vercel.app)
// ---------------------------------------------------------------------------

export const kairosSearchTool = tool({
  description:
    "Search the web using Kairos — Manitec's search engine. Use this when the user asks about current events, factual questions, or anything that requires live information beyond your training data. Returns a synthesized answer with sources.",
  inputSchema: z.object({
    query: z.string().describe("The search query to look up"),
  }),
  execute: async ({ query }) => {
    const base = process.env.KAIROS_URL ?? "https://kairos-orcin-eight.vercel.app";

    try {
      // Step 1 — fetch raw search results from Kairos /api/search
      const searchRes = await fetch(`${base}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!searchRes.ok) {
        return { error: `Kairos search failed: ${searchRes.status}` };
      }

      const results = await searchRes.json();

      if (!Array.isArray(results) || results.length === 0) {
        return { error: "No results found for that query." };
      }

      // Step 2 — synthesize answer from Kairos /api/answer
      const answerRes = await fetch(`${base}/api/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, results }),
      });

      if (!answerRes.ok) {
        return { error: `Kairos answer failed: ${answerRes.status}` };
      }

      const { answer, sources } = await answerRes.json();

      return { answer, sources };
    } catch (err: any) {
      return { error: `Kairos unreachable: ${err?.message ?? "unknown error"}` };
    }
  },
});
