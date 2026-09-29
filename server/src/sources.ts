// Searches free scholarly indexes (OpenAlex + Crossref) for works that could back up a claim.

export interface Source {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  citedBy: number | null;
  origin: "openalex" | "crossref" | "web";
}

const CONTACT_EMAIL = process.env.CONTACT_EMAIL;
const OPENALEX_API_KEY = process.env.OPENALEX_API_KEY;
// Top results per index: more candidates mean more text for Claude to read (the main cost).
const PER_SOURCE = 3;
const ABSTRACT_CHARS = 500;
const TIMEOUT_MS = 10_000;

function normalizeDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
}

// OpenAlex stores abstracts as { word: [positions] }; rebuild the text.
function rebuildAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const p of positions) words[p] = word;
  }
  const text = words.filter(Boolean).join(" ");
  return text.length > ABSTRACT_CHARS ? text.slice(0, ABSTRACT_CHARS) + "…" : text;
}

const RETRIES = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The free indexes often answer 429 (rate limited) or 503 (busy); a short wait usually fixes it.
async function getJson(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: CONTACT_EMAIL ? { "User-Agent": `CiteScan (mailto:${CONTACT_EMAIL})` } : undefined,
    });
    if (res.ok) return res.json();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRIES) throw new Error(`${new URL(url).host} returned ${res.status}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    // Don't wait out long server-requested pauses; the web-search fallback covers those claims.
    if (retryAfter > 5) throw new Error(`${new URL(url).host} returned ${res.status} (retry in ${retryAfter}s)`);
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1));
  }
}

async function searchOpenAlex(query: string): Promise<Source[]> {
  const params = new URLSearchParams({
    search: query,
    "per-page": String(PER_SOURCE),
    select:
      "id,doi,title,publication_year,authorships,primary_location,cited_by_count,abstract_inverted_index",
  });
  if (OPENALEX_API_KEY) params.set("api_key", OPENALEX_API_KEY);
  if (CONTACT_EMAIL) params.set("mailto", CONTACT_EMAIL);

  const data = await getJson(`https://api.openalex.org/works?${params}`);
  return (data.results ?? [])
    .filter((w: any) => w.title)
    .map((w: any): Source => {
      const doi = normalizeDoi(w.doi);
      return {
        id: `oa:${String(w.id).split("/").pop()}`,
        title: w.title,
        authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
        year: w.publication_year ?? null,
        venue: w.primary_location?.source?.display_name ?? null,
        doi,
        url: doi ? `https://doi.org/${doi}` : (w.primary_location?.landing_page_url ?? w.id),
        abstract: rebuildAbstract(w.abstract_inverted_index),
        citedBy: w.cited_by_count ?? null,
        origin: "openalex",
      };
    });
}

async function searchCrossref(query: string): Promise<Source[]> {
  const params = new URLSearchParams({
    "query.bibliographic": query,
    rows: String(PER_SOURCE),
    select: "DOI,title,author,issued,container-title,URL,abstract,is-referenced-by-count",
  });
  if (CONTACT_EMAIL) params.set("mailto", CONTACT_EMAIL);

  const data = await getJson(`https://api.crossref.org/works?${params}`);
  return (data.message?.items ?? [])
    .filter((w: any) => w.title?.[0])
    .map((w: any): Source => {
      const doi = normalizeDoi(w.DOI);
      const abstract = w.abstract ? String(w.abstract).replace(/<[^>]+>/g, "").trim() : null;
      return {
        id: `cr:${doi}`,
        title: w.title[0],
        authors: (w.author ?? [])
          .map((a: any) => [a.given, a.family].filter(Boolean).join(" ") || a.name)
          .filter(Boolean),
        year: w.issued?.["date-parts"]?.[0]?.[0] ?? null,
        venue: w["container-title"]?.[0] ?? null,
        doi,
        url: doi ? `https://doi.org/${doi}` : (w.URL ?? null),
        abstract: abstract && abstract.length > ABSTRACT_CHARS ? abstract.slice(0, ABSTRACT_CHARS) + "…" : abstract,
        citedBy: w["is-referenced-by-count"] ?? null,
        origin: "crossref",
      };
    });
}

/** Query both indexes in parallel and merge, de-duplicating by DOI. One index failing is tolerated. */
export async function findCandidateSources(query: string): Promise<Source[]> {
  const settled = await Promise.allSettled([searchOpenAlex(query), searchCrossref(query)]);
  const merged: Source[] = [];
  const seen = new Set<string>();
  for (const result of settled) {
    if (result.status === "rejected") {
      console.warn(`source search failed for "${query}":`, result.reason);
      continue;
    }
    for (const s of result.value) {
      const key = s.doi ?? s.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
  }
  return merged;
}
