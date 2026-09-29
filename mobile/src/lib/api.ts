import type { Claim, DraftClaim, UploadFile } from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const APP_TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN;

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(APP_TOKEN ? { Authorization: `Bearer ${APP_TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your internet connection and try again.");
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 429) throw new Error("You've checked a lot of essays recently. Please wait a while.");
    throw new Error(json?.error ?? `The server returned an error (${res.status}).`);
  }
  return json as T;
}

/** Stage 1: read the essay and list the sentences that may need a citation. */
export function findClaims(files: UploadFile[]) {
  return post<{ title: string; claims: DraftClaim[]; cost: number }>('/claims', { files });
}

/** Stage 2: find sources for the sentences the user kept. `advanced` (Pro) adds web sources. */
export function findSources(claims: DraftClaim[], options: { advanced: boolean }) {
  return post<{ claims: Claim[]; advanced: boolean; cost: number }>('/sources', { claims, advanced: options.advanced });
}
