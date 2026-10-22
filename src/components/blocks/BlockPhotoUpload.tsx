"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BLOCK_PHOTO_BUCKET } from "@/lib/blocks";
import { shrinkPhoto } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

type Props = { postalCode: string; blockNo: string; photoPath: string | null };

export function BlockPhotoUpload({ postalCode, blockNo, photoPath }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(file: File) {
    setBusy(true);
    setError(null);
    try {
      // A new file name each time, so phones never show an old cached photo.
      const path = `${postalCode}/${Date.now()}.jpg`;
      const up = await supabase.storage
        .from(BLOCK_PHOTO_BUCKET)
        .upload(path, await shrinkPhoto(file), { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { error: dbError } = await supabase.from("blocks").update({ photo_path: path }).eq("postal_code", postalCode);
      if (dbError) throw dbError;
      if (photoPath) await supabase.storage.from(BLOCK_PHOTO_BUCKET).remove([photoPath]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!photoPath || !confirm(`Remove the photo of Blk ${blockNo}?`)) return;
    setBusy(true);
    setError(null);
    const { error: dbError } = await supabase.from("blocks").update({ photo_path: null }).eq("postal_code", postalCode);
    if (dbError) setError(dbError.message);
    else {
      await supabase.storage.from(BLOCK_PHOTO_BUCKET).remove([photoPath]);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className={`cursor-pointer rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white ${busy ? "opacity-50" : ""}`}
      >
        {busy ? "Saving..." : photoPath ? "Replace photo" : "Add photo"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void save(file);
          }}
        />
      </label>
      {photoPath && !busy && (
        <button type="button" onClick={remove} className="text-sm text-red-700 underline">
          Remove
        </button>
      )}
      {error && (
        <p role="alert" className="w-full text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
