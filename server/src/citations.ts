// APA 7 and MLA 9 references built from source metadata in code. Cheaper than asking the
// model to write them (no output tokens), and they can't contain invented details.
import type { Source } from "./sources.js";

/** Split "Jane A. Smith" into surname and given names. Single-word names are kept whole. */
function splitName(name: string): { last: string; given: string[] } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { last: parts[0], given: [] };
  return { last: parts[parts.length - 1], given: parts.slice(0, -1) };
}

const initials = (given: string[]) =>
  given
    .flatMap((g) => g.split("-"))
    .map((g) => `${g.charAt(0).toUpperCase()}.`)
    .join(" ");

const link = (s: Source) => (s.doi ? `https://doi.org/${s.doi}` : (s.url ?? ""));
const endWithFullStop = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);

function apaAuthors(authors: string[]): string {
  const names = authors.map((a) => {
    const { last, given } = splitName(a);
    return given.length ? `${last}, ${initials(given)}` : last;
  });
  if (names.length === 1) return names[0];
  if (names.length <= 20) return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  return `${names.slice(0, 19).join(", ")}, . . . ${names[names.length - 1]}`;
}

export function formatApa(s: Source): string {
  const year = s.year ? `(${s.year})` : "(n.d.)";
  const url = link(s);
  if (s.origin === "web") {
    // Organisation as author for web pages: Organisation. (Year). Title. URL
    const author = s.authors.length ? apaAuthors(s.authors) : (s.venue ?? "");
    const site = s.venue && s.venue !== author ? ` ${endWithFullStop(s.venue)}` : "";
    return [author ? `${endWithFullStop(author)} ${year}.` : `${endWithFullStop(s.title)} ${year}.`, author ? ` ${endWithFullStop(s.title)}` : "", site, url ? ` ${url}` : ""].join("");
  }
  const author = s.authors.length ? `${endWithFullStop(apaAuthors(s.authors))} ` : "";
  const venue = s.venue ? ` ${endWithFullStop(s.venue)}` : "";
  return `${author}${year}. ${endWithFullStop(s.title)}${venue}${url ? ` ${url}` : ""}`;
}

function mlaAuthors(authors: string[]): string {
  const first = splitName(authors[0]);
  const firstName = first.given.length ? `${first.last}, ${first.given.join(" ")}` : first.last;
  if (authors.length === 1) return firstName;
  if (authors.length === 2) return `${firstName}, and ${authors[1]}`;
  return `${firstName}, et al`;
}

export function formatMla(s: Source): string {
  const url = link(s).replace(/^https?:\/\//, "");
  const title = s.origin === "web" ? `“${endWithFullStop(s.title)}”` : `“${endWithFullStop(s.title)}”`;
  const author = s.authors.length ? `${endWithFullStop(mlaAuthors(s.authors))} ` : "";
  const container = [s.venue, s.year ? String(s.year) : null, url || null].filter(Boolean).join(", ");
  return `${author}${title}${container ? ` ${container}.` : ""}`;
}
