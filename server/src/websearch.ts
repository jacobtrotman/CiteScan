// Fallback for claims the scholarly indexes couldn't support: Claude searches the web
// (reports, official statistics, reputable news, books) and reports sources through a
// strict tool. Only URLs that actually appeared in the search results are accepted,
// so a source can never be invented.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { formatApa, formatMla } from "./citations.js";
import { recordUsage } from "./cost.js";
import type { Source } from "./sources.js";

const MAX_CONTINUATIONS = 4;

const ReportSchema = z.object({
  results: z.array(
    z.object({
      claimIndex: z.number().int(),
      sources: z.array(
        z.object({
          url: z.string(),
          title: z.string(),
          publisher: z.string().nullable(),
          year: z.number().int().nullable(),
          strength: z.enum(["strong", "possible"]),
          explanation: z.string(),
        }),
      ),
    }),
  ),
});

const REPORT_TOOL: Anthropic.Beta.BetaTool = {
  name: "report_sources",
  description:
    "Report the sources you found for each claim. Call this exactly once, after searching, with every claim " +
    "index you were given (use an empty sources list when nothing reliable was found).",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claimIndex", "sources"],
          properties: {
            claimIndex: { type: "integer" },
            sources: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["url", "title", "publisher", "year", "strength", "explanation"],
                properties: {
                  url: { type: "string", description: "Copied exactly from a search result" },
                  title: { type: "string" },
                  publisher: { type: ["string", "null"], description: "Organisation or site that published it" },
                  year: { type: ["integer", "null"] },
                  strength: { type: "string", enum: ["strong", "possible"] },
                  explanation: { type: "string", description: "Under 20 words: how it supports the claim" },
                },
              },
            },
          },
        },
      },
    },
  },
};

export interface WebMatch {
  claimIndex: number;
  source: Source;
  strength: "strong" | "possible";
  explanation: string;
  apa: string;
  mla: string;
}

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return url;
  }
}

export async function findWebSources(
  client: Anthropic,
  model: string,
  claims: { claimIndex: number; quote: string }[],
): Promise<WebMatch[]> {
  if (claims.length === 0) return [];

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: JSON.stringify(claims) }];
  const seenUrls = new Set<string>();

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 8000,
      system:
        "You help students find sources for statements in their essays. For each claim, search the web for a " +
        "reliable source a teacher would accept: official statistics, government or NGO reports, reputable news " +
        "organisations, books, or research summaries from universities. Prefer the original source of a " +
        "statistic over articles that repeat it. Search once per claim (retry once only if a search finds nothing useful) and report 1-2 sources, only including a source if a " +
        "search result genuinely supports the claim. When you have finished searching, call report_sources " +
        "once. Copy URLs and titles exactly from the search results - never invent them. Keep explanations under 20 words.",
      tools: [
        {
          // Haiku 4.5 uses the basic web search tool (the newer variant needs Opus/Sonnet 4.6+).
          type: "web_search_20250305",
          name: "web_search",
          // One search per claim keeps cost predictable: search results are most of this step's input.
          max_uses: Math.min(claims.length + 2, 10),
          blocked_domains: ["wikipedia.org"],
        },
        REPORT_TOOL,
      ],
      messages,
    });

    recordUsage("web search", model, response.usage);
    for (const block of response.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const result of block.content) seenUrls.add(normalizeUrl(result.url));
      }
    }

    const report = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "report_sources",
    );
    if (report) {
      const parsed = ReportSchema.safeParse(report.input);
      if (!parsed.success) return [];
      return parsed.data.results.flatMap((r) =>
        r.sources
          .filter((s) => seenUrls.has(normalizeUrl(s.url)))
          .slice(0, 2)
          .map((s) => {
            const source: Source = {
              id: `web:${s.url}`,
              title: s.title,
              authors: [],
              year: s.year,
              venue: s.publisher,
              doi: null,
              url: s.url,
              abstract: null,
              citedBy: null,
              origin: "web",
            };
            return {
              claimIndex: r.claimIndex,
              strength: s.strength,
              explanation: s.explanation,
              apa: formatApa(source),
              mla: formatMla(source),
              source,
            };
          }),
      );
    }

    // A long server-side search can pause; send the turn back and the API resumes it.
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    return [];
  }
  return [];
}
