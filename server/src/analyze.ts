import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { findCandidateSources, type Source } from "./sources.js";
import { formatApa, formatMla } from "./citations.js";
import { recordUsage } from "./cost.js";
import { findWebSources } from "./websearch.js";

const client = new Anthropic();
// Reading the essay (including photos and handwriting) uses the most capable model; judging
// candidate sources and web searching use Haiku, which is ~4x cheaper per token.
const MODEL = "claude-opus-5-5";
const SOURCE_MODEL = "claude-haiku-4-5";
const MAX_CLAIMS = 15;
const SEARCH_CONCURRENCY = 3;

// Server-side refusal fallbacks: if a safety classifier declines, the API retries on a
// suitable model automatically instead of failing the request.
const FALLBACK_OPTIONS: Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks"> = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

export type DocumentInput =
  | { kind: "images"; images: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string }[] }
  | { kind: "pdf"; data: string }
  | { kind: "text"; text: string };

const ClaimsSchema = z.object({
  title: z.string().describe("A short title for the essay (use its own title if it has one)"),
  claims: z.array(
    z.object({
      quote: z.string().describe("The exact sentence or phrase from the essay that needs a citation"),
      reason: z.string().describe("One sentence on why a reader would expect a source here"),
      category: z.enum(["statistic", "fact", "quotation", "research_finding", "historical", "paraphrased_idea"]),
      searchQuery: z
        .string()
        .describe("A concise keyword query (3-8 words) for finding a scholarly source for this claim"),
    }),
  ),
});

const MatchSchema = z.object({
  matches: z.array(
    z.object({
      claimIndex: z.number().int(),
      suggestions: z.array(
        z.object({
          sourceId: z.string().describe("The id of a candidate source, copied exactly"),
          strength: z.enum(["strong", "possible"]),
          explanation: z.string().describe("Under 20 words: how this source supports the claim"),
        }),
      ),
    }),
  ),
});

export interface Suggestion {
  source: Source;
  strength: "strong" | "possible";
  explanation: string;
  apa: string;
  mla: string;
}

export interface AnalyzedClaim {
  quote: string;
  reason: string;
  category: z.infer<typeof ClaimsSchema>["claims"][number]["category"];
  searchQuery: string;
  suggestions: Suggestion[];
}

export class AnalysisError extends Error {}

function documentBlocks(input: DocumentInput): Anthropic.Beta.BetaContentBlockParam[] {
  switch (input.kind) {
    case "images":
      return input.images.map((img) => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      }));
    case "pdf":
      return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.data } }];
    case "text":
      return [{ type: "text", text: `<essay>\n${input.text}\n</essay>` }];
  }
}

async function extractClaims(input: DocumentInput) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK_OPTIONS,
    output_config: { effort: "medium", format: betaZodOutputFormat(ClaimsSchema) },
    system:
      "You help students cite their essays properly. You read an essay (which may be a photo or scan of " +
      "printed or handwritten pages) and find the statements that need a citation: statistics, specific " +
      "facts that aren't common knowledge, direct or paraphrased quotations, research findings, historical " +
      "specifics, and ideas attributable to a particular thinker. Skip common knowledge, the author's own " +
      "arguments and opinions, and sentences that already carry a citation. Quote the essay exactly. " +
      `Return at most ${MAX_CLAIMS} claims, prioritising the ones most in need of a source. ` +
      "If the document is not an essay or contains no such statements, return an empty claims list.",
    messages: [
      {
        role: "user",
        content: [...documentBlocks(input), { type: "text", text: "Find the statements in this essay that need citations." }],
      },
    ],
  });

  recordUsage("find sentences", MODEL, response.usage);
  if (response.stop_reason === "refusal") throw new AnalysisError("This document couldn't be analysed.");
  if (!response.parsed_output) throw new AnalysisError("The document could not be read. Try a clearer scan.");
  return response.parsed_output;
}

async function matchSources(
  claims: Claim[],
  candidates: Source[][],
): Promise<z.infer<typeof MatchSchema>["matches"]> {
  const payload = claims.map((c, i) => ({
    claimIndex: i,
    claim: c.quote,
    // Only what's needed to judge relevance; citations are built in code from the full metadata.
    candidates: candidates[i].map((s) => ({
      id: s.id,
      title: s.title,
      year: s.year,
      venue: s.venue,
      abstract: s.abstract,
    })),
  }));

  const response = await client.beta.messages.parse({
    model: SOURCE_MODEL,
    max_tokens: 8000,
    output_config: { format: betaZodOutputFormat(MatchSchema) },
    system:
      "For each essay claim you are given candidate sources from scholarly search engines. Pick up to 3 " +
      "candidates that genuinely support the claim, judging from the title and abstract. Mark a source " +
      '"strong" only if it directly supports the claim; otherwise "possible". Omit candidates that are ' +
      "off-topic - an empty suggestion list is better than a misleading one. Only use ids from the " +
      "candidate list. Keep each explanation under 20 words.",
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  recordUsage("match sources", SOURCE_MODEL, response.usage);
  if (response.stop_reason === "refusal" || !response.parsed_output) return [];
  return response.parsed_output.matches;
}

export type Claim = z.infer<typeof ClaimsSchema>["claims"][number];

/** Stage 1: read the essay and list the statements that need a citation (no source search yet). */
export async function findClaims(input: DocumentInput): Promise<{ title: string; claims: Claim[] }> {
  const { title, claims } = await extractClaims(input);
  return { title, claims: claims.slice(0, MAX_CLAIMS) };
}

/** Claims sent back by the app for stage 2 (the ones the user kept ticked). Validated: it's user input. */
export const ClaimsInputSchema = z
  .array(
    z.object({
      quote: z.string().min(1).max(1500),
      reason: z.string().max(1000),
      category: ClaimsSchema.shape.claims.element.shape.category,
      searchQuery: z.string().min(1).max(200),
    }),
  )
  .min(1)
  .max(MAX_CLAIMS);

export interface SourceOptions {
  /** Pro "advanced search": also search the web for claims without a strong scholarly match. */
  advanced: boolean;
}

/**
 * Stage 2: find and match sources for the claims the user chose. This is the expensive part,
 * so it only runs for claims the user actually wants cited.
 */
export async function findSourcesForClaims(claims: Claim[], { advanced }: SourceOptions): Promise<AnalyzedClaim[]> {
  // A few searches at a time: firing every claim at once trips the indexes' rate limits.
  const candidates: Source[][] = [];
  for (let i = 0; i < claims.length; i += SEARCH_CONCURRENCY) {
    const batch = claims.slice(i, i + SEARCH_CONCURRENCY);
    candidates.push(...(await Promise.all(batch.map((c) => findCandidateSources(c.searchQuery)))));
  }
  const matches = await matchSources(claims, candidates);

  const analyzed: AnalyzedClaim[] = claims.map((claim, i) => {
    const byId = new Map(candidates[i].map((s) => [s.id, s]));
    const match = matches.find((m) => m.claimIndex === i);
    const suggestions: Suggestion[] = (match?.suggestions ?? []).flatMap((s) => {
      const source = byId.get(s.sourceId);
      return source
        ? [{ source, strength: s.strength, explanation: s.explanation, apa: formatApa(source), mla: formatMla(source) }]
        : [];
    });
    return { ...claim, suggestions };
  });

  if (!advanced) return analyzed;

  // Claims without a strong scholarly match (often statistics from reports or news) also get a web search.
  const unmatched = analyzed.flatMap((c, i) =>
    c.suggestions.some((s) => s.strength === "strong") ? [] : [{ claimIndex: i, quote: c.quote }],
  );
  const webMatches = await findWebSources(client, SOURCE_MODEL, unmatched).catch((err) => {
    console.warn("web search fallback failed:", err);
    return [];
  });
  for (const m of webMatches) {
    const { claimIndex, ...suggestion } = m;
    analyzed[claimIndex]?.suggestions.push(suggestion);
  }
  return analyzed;
}
