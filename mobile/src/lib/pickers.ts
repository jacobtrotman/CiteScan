import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { UploadFile } from './types';

// Pages are downscaled before upload: 1400px wide keeps handwriting legible and costs
// ~3,400 tokens per page to read (1600px costs ~4,500).
const PAGE_WIDTH = 1400;
/** Most photo pages in one check (the server rejects more). */
export const MAX_PAGES = 6;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface Page extends UploadFile {
  uri: string;
}

async function toPage(asset: ImagePicker.ImagePickerAsset, index: number): Promise<Page> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > PAGE_WIDTH) context.resize({ width: PAGE_WIDTH, height: null });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return {
    uri: saved.uri,
    name: asset.fileName ?? `page-${index + 1}.jpg`,
    mimeType: 'image/jpeg',
    data: saved.base64!,
  };
}

/** Opens the camera to capture one page. Returns null if cancelled. */
export async function scanPage(pageNumber: number): Promise<Page | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is needed to scan pages. You can enable it in Settings.');
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (result.canceled) return null;
  return toPage(result.assets[0], pageNumber - 1);
}

/** Lets the user pick photos of pages from their library. */
export async function pickPagePhotos(existingCount: number): Promise<Page[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    orderedSelection: true,
    selectionLimit: Math.max(1, MAX_PAGES - existingCount),
    quality: 0.9,
  });
  if (result.canceled) return [];
  return Promise.all(result.assets.map((a, i) => toPage(a, existingCount + i)));
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
};

/** Lets the user pick a PDF, Word document or text file. Returns null if cancelled. */
export async function pickDocument(): Promise<UploadFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: Object.values(MIME_BY_EXTENSION),
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = MIME_BY_EXTENSION[extension] ?? asset.mimeType;
  if (!mimeType || !Object.values(MIME_BY_EXTENSION).includes(mimeType)) {
    throw new Error('Please choose a PDF, Word (.docx) or text file.');
  }
  if (asset.size && asset.size > MAX_FILE_BYTES) {
    throw new Error('That file is too large. Please choose a file under 20 MB.');
  }

  const data = await new File(asset.uri).base64();
  return { name: asset.name, mimeType, data };
}
