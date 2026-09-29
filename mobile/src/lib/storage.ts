// Saved analyses live on the device as one JSON file each.
import { Directory, File, Paths } from 'expo-file-system';
import type { SavedAnalysis } from './types';

const dir = new Directory(Paths.document, 'analyses');

function ensureDir() {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

function fileFor(id: string) {
  return new File(dir, `${id}.json`);
}

export function saveAnalysis(analysis: SavedAnalysis) {
  ensureDir();
  const file = fileFor(analysis.id);
  if (!file.exists) file.create();
  file.write(JSON.stringify(analysis));
}

export async function getAnalysis(id: string): Promise<SavedAnalysis | null> {
  const file = fileFor(id);
  if (!file.exists) return null;
  return JSON.parse(await file.text()) as SavedAnalysis;
}

export async function listAnalyses(): Promise<SavedAnalysis[]> {
  ensureDir();
  const files = dir.list().filter((f): f is File => f instanceof File && f.name.endsWith('.json'));
  const all = await Promise.all(
    files.map(async (f) => {
      try {
        return JSON.parse(await f.text()) as SavedAnalysis;
      } catch {
        return null; // skip a corrupt file rather than hiding the whole history
      }
    }),
  );
  return all
    .filter((a): a is SavedAnalysis => a !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteAnalysis(id: string) {
  const file = fileFor(id);
  if (file.exists) file.delete();
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function renameAnalysis(id: string, title: string) {
  const analysis = await getAnalysis(id);
  if (analysis) saveAnalysis({ ...analysis, title });
}
