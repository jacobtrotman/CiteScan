// Per-request cost tracking, so each stage's spend shows up in the server log.
import type Anthropic from "@anthropic-ai/sdk";
import { AsyncLocalStorage } from "node:async_hooks";

// USD per million tokens / per search (Anthropic list prices).
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};
const WEB_SEARCH_PER_REQUEST = 10 / 1000;

interface Tally {
  label: string;
  total: number;
  lines: string[];
}

const current = new AsyncLocalStorage<Tally>();

/**
 * Run `fn`, then log the total cost of every Claude call made inside it. The cost is returned
 * too, so the app can count it against a Pro user's monthly allowance.
 */
export async function withCostTracking<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; cost: number }> {
  const tally: Tally = { label, total: 0, lines: [] };
  try {
    const result = await current.run(tally, fn);
    // Rounded up, so allowances are never undercounted.
    return { result, cost: Math.ceil(tally.total * 10000) / 10000 };
  } finally {
    console.log(`[cost] ${label}: $${tally.total.toFixed(4)}\n${tally.lines.map((l) => `  ${l}`).join("\n")}`);
  }
}

/** Record one response's usage against the current request. */
export function recordUsage(step: string, model: string, usage: Anthropic.Beta.BetaUsage) {
  const price = PRICES[model] ?? PRICES["claude-opus-5-5"];
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  const cost =
    (usage.input_tokens * price.input +
      usage.output_tokens * price.output +
      (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite) /
      1_000_000 +
    searches * WEB_SEARCH_PER_REQUEST;
  const tally = current.getStore();
  if (!tally) return;
  tally.total += cost;
  tally.lines.push(
    `${step} (${model}): in ${usage.input_tokens} · out ${usage.output_tokens}` +
      (searches ? ` · ${searches} searches` : "") +
      ` → $${cost.toFixed(4)}`,
  );
}
