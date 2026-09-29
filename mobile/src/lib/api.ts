import type { AnalysisResult, UploadFile } from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const APP_TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN;

export async function analyze(files: UploadFile[], options: { advanced: boolean }): Promise<AnalysisResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(APP_TOKEN ? { Authorization: `Bearer ${APP_TOKEN}` } : {}),
      },
      body: JSON.stringify({ files, advanced: options.advanced }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your internet connection and try again.");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 429) throw new Error("You've analysed a lot of documents recently. Please wait a while.");
    throw new Error(body?.error ?? `The server returned an error (${res.status}).`);
  }
  return body as AnalysisResult;
}
