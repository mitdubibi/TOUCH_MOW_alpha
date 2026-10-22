import type { SupabaseClient } from "@supabase/supabase-js";

export const BLOCK_PHOTO_BUCKET = "block-photos";

// Public URL of a photo in the block-photos bucket (the bucket is public, see 0004_block_photos.sql).
export function blockPhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BLOCK_PHOTO_BUCKET}/${path}`;
}

// postal code -> photo URL, for the blocks that have one.
export async function fetchBlockPhotos(supabase: SupabaseClient, postals: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(postals)];
  if (!unique.length) return {};
  const { data } = await supabase
    .from("blocks")
    .select("postal_code, photo_path")
    .in("postal_code", unique)
    .not("photo_path", "is", null)
    .returns<{ postal_code: string; photo_path: string }[]>();
  return Object.fromEntries((data ?? []).map((b) => [b.postal_code, blockPhotoUrl(b.photo_path)]));
}
