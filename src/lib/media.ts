import { sb } from './supabase';

const MAX_BYTES = 12 * 1024 * 1024;

/** Downscale photos to 1600px JPEG so 1 GB of free storage lasts. */
async function compressImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function videoSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration || 0); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    v.src = url;
  });
}

/** Returns an error message, or null when the file is acceptable proof. */
export async function checkProof(file: File, maxClipSeconds: number): Promise<string | null> {
  if (file.type.startsWith('video/')) {
    if (!maxClipSeconds) return 'This proof needs a photo or document, not a clip.';
    const s = await videoSeconds(file);
    if (s > maxClipSeconds + 1) return `Clips can be up to ${maxClipSeconds} s.`;
    if (file.size > MAX_BYTES) return 'That clip is over 12 MB. Trim it and try again.';
    return null;
  }
  if (file.type.startsWith('image/') || file.type === 'application/pdf') return null;
  return 'Use a photo, a short clip or a PDF.';
}

export async function uploadProof(uid: string, date: string, taskKey: string, file: File): Promise<string> {
  const body = file.type.startsWith('image/') ? await compressImage(file) : file;
  if (body.size > MAX_BYTES) throw new Error('That file is over 12 MB.');
  const ext = body.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
  const path = `${uid}/${date}/${taskKey}-${Date.now()}.${ext}`;
  const { error } = await sb().storage.from('proofs').upload(path, body, {
    contentType: body.type || file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}
