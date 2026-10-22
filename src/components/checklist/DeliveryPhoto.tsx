"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shrinkPhoto } from "@/lib/images";
import type { ChecklistItem } from "@/types/db";

const BUCKET = "delivery-photos";

export type PhotoPatch = Partial<Pick<ChecklistItem, "photo_requested_at" | "photo_request_note" | "photo_path">>;

type Props = {
  supabase: SupabaseClient;
  sessionId: string;
  item: ChecklistItem;
  onPatch: (id: string, patch: PhotoPatch) => void;
};

// Volunteer: only shown when an organiser asked for a photo of this delivery.
export function PhotoRequest({ supabase, sessionId, item, onPatch }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item.photo_requested_at || item.status === "cancelled") return null;
  if (item.photo_path) return <p className="mt-2 text-sm font-semibold text-teal-800">📷 Photo sent</p>;

  async function take(file: File) {
    setBusy(true);
    setError(null);
    try {
      const path = `${sessionId}/${item.id}/${Date.now()}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, await shrinkPhoto(file), { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { error: rpcError } = await supabase.rpc("attach_delivery_photo", { p_delivery_id: item.id, p_path: path });
      if (rpcError) throw rpcError;
      onPatch(item.id, { photo_path: path });
    } catch (e) {
      setError(`Photo not sent: ${e instanceof Error ? e.message : String(e)}. Try again when you have signal.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
      <p className="font-semibold text-amber-950">📷 The coordinator asked for a photo</p>
      {item.photo_request_note && <p className="text-sm text-amber-950">&ldquo;{item.photo_request_note}&rdquo;</p>}
      <p className="text-xs text-amber-900">Show the meal at the door. No people, faces or unit numbers.</p>
      <label
        className={`block cursor-pointer rounded-lg bg-amber-500 px-3 py-2 text-center font-semibold text-amber-950 ${
          busy ? "opacity-50" : ""
        }`}
      >
        {busy ? "Sending..." : "Take photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void take(file);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

// Organiser: ask for a photo of one delivery, cancel the request, or view the photo.
export function PhotoControls({ supabase, item, onPatch }: Omit<Props, "sessionId">) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (item.status === "cancelled") return null;

  async function update(patch: PhotoPatch & { photo_taken_at?: null }) {
    setError(null);
    const { error: dbError } = await supabase.from("deliveries").update(patch).eq("id", item.id);
    if (dbError) setError(dbError.message);
    else onPatch(item.id, patch);
  }

  async function view() {
    if (url) return setUrl(null);
    // Private bucket: a link that works for 5 minutes.
    const { data, error: urlError } = await supabase.storage.from(BUCKET).createSignedUrl(item.photo_path!, 300);
    if (urlError) setError(urlError.message);
    else setUrl(data.signedUrl);
  }

  const request = () =>
    update({ photo_requested_at: new Date().toISOString(), photo_request_note: note.trim() || null, photo_path: null, photo_taken_at: null }).then(
      () => {
        setAsking(false);
        setNote("");
        setUrl(null);
      },
    );

  return (
    <div className="mt-2 space-y-2 text-sm">
      {item.photo_path ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={view} className="rounded-lg bg-navy px-3 py-1 font-semibold text-white">
            {url ? "Hide photo" : "📷 View photo"}
          </button>
          <button type="button" onClick={() => setAsking(true)} className="text-slate-600 underline">
            Ask again
          </button>
        </div>
      ) : item.photo_requested_at ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-900">📷 Photo requested</span>
          <button
            type="button"
            onClick={() => update({ photo_requested_at: null, photo_request_note: null })}
            className="text-slate-600 underline"
          >
            Cancel request
          </button>
        </div>
      ) : (
        !asking && (
          <button type="button" onClick={() => setAsking(true)} className="text-teal-800 underline">
            Request photo
          </button>
        )
      )}

      {asking && (
        <div className="flex flex-wrap gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="What to show (optional)"
            className="min-w-0 flex-1 rounded-lg border border-slate-400 px-2 py-1"
          />
          <button type="button" onClick={request} className="rounded-lg bg-teal-700 px-3 py-1 font-semibold text-white">
            Send
          </button>
          <button type="button" onClick={() => setAsking(false)} className="text-slate-600 underline">
            Cancel
          </button>
        </div>
      )}

      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Delivery photo for ${item.unit_no}`} className="max-h-80 w-full rounded-lg object-contain" />
      )}
      {error && (
        <p role="alert" className="font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
