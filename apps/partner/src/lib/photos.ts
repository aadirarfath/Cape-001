import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

// Shop photos: pick from the gallery, shrink to WebP under the bucket's 5 MB limit, upload to
// shop-photos/{shop_id}/ and add a shop_photos row. Storage policies only let owners and
// managers write under their own shop's folder.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export class PhotoTooLargeError extends Error {}

// Try progressively smaller / lower-quality versions until one fits.
const ATTEMPTS = [
  { width: 1600, compress: 0.8 },
  { width: 1600, compress: 0.6 },
  { width: 1200, compress: 0.6 },
  { width: 1000, compress: 0.5 },
];

/** Picks one image from the gallery. Null if the user cancelled. */
export async function pickPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  return result.canceled ? null : (result.assets[0] ?? null);
}

/** A WebP version of the image under MAX_PHOTO_BYTES. */
export async function compressToWebp(asset: { uri: string; width: number }): Promise<File> {
  for (const attempt of ATTEMPTS) {
    const context = ImageManipulator.manipulate(asset.uri);
    if (asset.width > attempt.width) context.resize({ width: attempt.width });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.WEBP, compress: attempt.compress });
    const file = new File(saved.uri);
    if (file.size > 0 && file.size < MAX_PHOTO_BYTES) return file;
  }
  throw new PhotoTooLargeError('Photo is still over 5 MB after compression');
}

function randomName(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;
}

/** Uploads a compressed photo for the shop and records it. Returns the storage path. */
export async function uploadShopPhoto(shopId: string, file: File, sortOrder: number): Promise<string> {
  const path = `${shopId}/${randomName()}`;
  const { error: uploadError } = await supabase.storage
    .from('shop-photos')
    .upload(path, await file.arrayBuffer(), { contentType: 'image/webp', upsert: false });
  if (uploadError) throw uploadError;

  const { error: rowError } = await supabase
    .from('shop_photos')
    .insert({ shop_id: shopId, storage_path: path, sort_order: sortOrder });
  if (rowError) {
    // Don't leave an orphaned file behind.
    await supabase.storage.from('shop-photos').remove([path]);
    throw rowError;
  }
  return path;
}

export async function deleteShopPhoto(photo: { id: string; storage_path: string }): Promise<void> {
  const { error } = await supabase.from('shop_photos').delete().eq('id', photo.id);
  if (error) throw error;
  const { error: storageError } = await supabase.storage.from('shop-photos').remove([photo.storage_path]);
  if (storageError) console.warn('Removing the photo file failed', storageError.message);
}
