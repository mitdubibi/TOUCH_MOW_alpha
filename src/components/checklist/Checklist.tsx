"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { groupByBlock, isDone, progress } from "@/lib/checklist";
import { PhotoControls, PhotoRequest } from "./DeliveryPhoto";
import { ProblemBadges, ReportProblem } from "./ReportProblem";
import { fetchChecklist } from "@/lib/deliveries";
import { mealLabel } from "@/lib/meals";
import { enqueueTick, queuedTicks, removeTick, type QueuedTick } from "@/lib/offline/tickQueue";
import { createClient } from "@/lib/supabase/client";
import type { ChecklistItem, DeliveryStatus } from "@/types/db";

type Props = {
  sessionId: string;
  initialItems: ChecklistItem[];
  // Organisers see units that were removed from the list; volunteers do not.
  showCancelled?: boolean;
  // Postal codes in walking order from the route optimiser. Blocks on the route get a stop number.
  routeOrder?: string[];
  // How many entries of routeOrder are on the map (the rest could not be found by OneMap).
  mappedStops?: number;
  // postal code -> photo of the block, so volunteers recognise it. Tap the thumbnail to enlarge.
  blockPhotos?: Record<string, string>;
  // Organisers can ask for a photo of a delivery; volunteers then see a Take photo button.
  canRequestPhotos?: boolean;
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: "To deliver",
  delivered: "Delivered",
  not_home: "Not home",
  skipped: "Skipped",
  cancelled: "Removed from list",
};

const isNetworkError = (error: PostgrestError) =>
  !navigator.onLine || /fetch|network/i.test(error.message);

export function Checklist({
  sessionId,
  initialItems,
  showCancelled = false,
  routeOrder,
  mappedStops = 0,
  blockPhotos,
  canRequestPhotos = false,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const flushing = useRef(false);

  const refetch = useCallback(async () => {
    try {
      setItems(await fetchChecklist(supabase, sessionId));
    } catch {
      // Offline; keep what we have.
    }
  }, [supabase, sessionId]);

  const sendTick = useCallback(
    async (tick: QueuedTick) =>
      (
        await supabase.rpc("set_delivery_status", {
          p_delivery_id: tick.deliveryId,
          p_status: tick.status,
          p_at: tick.at,
        })
      ).error,
    [supabase],
  );

  // Send queued ticks oldest first. Stop at the first network failure and try again later.
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let sent = false;
    try {
      for (const tick of await queuedTicks()) {
        const err = await sendTick(tick);
        if (err && isNetworkError(err)) break;
        await removeTick(tick.id!);
        sent = true;
        if (err) setError(`A tick saved offline could not be sent: ${err.message}`);
      }
    } finally {
      flushing.current = false;
      setWaiting((await queuedTicks()).length);
    }
    if (sent) await refetch();
  }, [sendTick, refetch]);

  useEffect(() => {
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  // Live updates from other phones in the same session.
  useEffect(() => {
    const channel = supabase
      .channel(`deliveries:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType !== "UPDATE") {
            void refetch();
            return;
          }
          const row = payload.new as Pick<
            ChecklistItem,
            "id" | "status" | "meal_type" | "remarks" | "done_at" | "photo_requested_at" | "photo_request_note" | "photo_path"
          >;
          setItems((prev) =>
            prev.map((i) =>
              i.id === row.id
                ? {
                    ...i,
                    status: row.status,
                    meal_type: row.meal_type,
                    remarks: row.remarks,
                    done_at: row.done_at,
                    photo_requested_at: row.photo_requested_at,
                    photo_request_note: row.photo_request_note,
                    photo_path: row.photo_path,
                  }
                : i,
            ),
          );
        },
      )
      // Problems reported on another phone show up as badges.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "problem_reports", filter: `session_id=eq.${sessionId}` },
        () => void refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, sessionId, refetch]);

  async function setStatus(item: ChecklistItem, status: DeliveryStatus) {
    setError(null);
    const tick: QueuedTick = { deliveryId: item.id, status, at: new Date().toISOString() };
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status, done_at: status === "pending" ? null : tick.at } : i)),
    );

    // Keep ticks in order: if anything is already waiting, this one waits behind it.
    const backlog = (await queuedTicks()).length;
    if (backlog || !navigator.onLine) {
      await enqueueTick(tick);
      setWaiting(backlog + 1);
      if (navigator.onLine) void flush();
      return;
    }

    const err = await sendTick(tick);
    if (!err) return;
    if (isNetworkError(err)) {
      await enqueueTick(tick);
      setWaiting(1);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    setError(`Could not update ${item.unit_no}: ${err.message}`);
  }

  const visible = showCancelled ? items : items.filter((i) => i.status !== "cancelled");
  const groups = groupByBlock(visible, routeOrder);
  const stopNo = (postalCode: string) => {
    const i = routeOrder?.indexOf(postalCode) ?? -1;
    return i >= 0 && i < mappedStops ? i + 1 : null;
  };
  const overall = progress(items.map((i) => i.status));
  const photosWanted = items.filter((i) => i.photo_requested_at && !i.photo_path && i.status !== "cancelled").length;
  const patchItem = (id: string, patch: Partial<ChecklistItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold">
            {overall.done} of {overall.total} done
          </span>
          {waiting > 0 && (
            <span className="rounded bg-amber-100 px-2 py-1 text-sm font-medium text-amber-900">
              {waiting} waiting for signal
            </span>
          )}
          {!canRequestPhotos && photosWanted > 0 && (
            <span className="rounded bg-amber-100 px-2 py-1 text-sm font-medium text-amber-900">
              📷 {photosWanted} photo{photosWanted === 1 ? "" : "s"} requested
            </span>
          )}
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden>
          <div
            className="h-full bg-teal-600 transition-all"
            style={{ width: `${overall.total ? (overall.done / overall.total) * 100 : 0}%` }}
          />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>

      {groups.length === 0 && <p className="text-slate-600">No units on this list yet.</p>}

      {groups.map((group) => {
        const p = progress(group.items.map((i) => i.status));
        const stop = stopNo(group.postalCode);
        const photo = blockPhotos?.[group.postalCode];
        const photoOpen = openPhoto === group.postalCode;
        return (
          <section key={group.postalCode} className="rounded-xl border border-slate-200">
            <header className="flex items-center justify-between rounded-t-xl bg-slate-100 px-4 py-2">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                {stop && (
                  <span
                    aria-label={`Stop ${stop}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-base text-sun"
                  >
                    {stop}
                  </span>
                )}
                Blk {group.blockNo}
              </h2>
              <span className="flex items-center gap-3 text-sm text-slate-700">
                {p.done}/{p.total} · S{group.postalCode}
                {photo && (
                  <button
                    type="button"
                    aria-expanded={photoOpen}
                    aria-label={photoOpen ? `Hide photo of Blk ${group.blockNo}` : `Show photo of Blk ${group.blockNo}`}
                    onClick={() => setOpenPhoto(photoOpen ? null : group.postalCode)}
                    className="shrink-0 overflow-hidden rounded-lg border-2 border-white shadow"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="" className="h-11 w-11 object-cover" />
                  </button>
                )}
              </span>
            </header>
            {photo && photoOpen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={`Blk ${group.blockNo}`} className="max-h-72 w-full object-cover" />
            )}
            <ul className="divide-y divide-slate-200">
              {group.items.map((item) => (
                <ChecklistRow key={item.id} item={item} onSetStatus={setStatus}>
                  {canRequestPhotos ? (
                    <>
                      <ProblemBadges item={item} />
                      <PhotoControls supabase={supabase} item={item} onPatch={patchItem} />
                    </>
                  ) : (
                    <>
                      <PhotoRequest supabase={supabase} sessionId={sessionId} item={item} onPatch={patchItem} />
                      <ReportProblem supabase={supabase} item={item} onPatch={patchItem} />
                    </>
                  )}
                </ChecklistRow>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ChecklistRow({
  item,
  onSetStatus,
  children,
}: {
  item: ChecklistItem;
  onSetStatus: (item: ChecklistItem, status: DeliveryStatus) => void;
  // Photo request (volunteer) or photo controls (organiser).
  children?: React.ReactNode;
}) {
  const done = isDone(item.status);
  const cancelled = item.status === "cancelled";

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${done || cancelled ? "bg-slate-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-xl font-semibold ${cancelled ? "text-slate-400 line-through" : ""}`}>{item.unit_no}</p>
        <p className="text-sm text-slate-700">
          <span className="font-medium">{mealLabel(item.meal_type)}</span>
          {item.status !== "pending" && <span> · {STATUS_LABEL[item.status]}</span>}
        </p>
        {item.remarks && <p className="mt-1 text-sm text-slate-600">{item.remarks}</p>}
        {children}
        {!done && !cancelled && (
          <button
            type="button"
            onClick={() => onSetStatus(item, "not_home")}
            className="mt-2 rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 active:bg-slate-100"
          >
            Not home
          </button>
        )}
      </div>
      {!cancelled && (
        <button
          type="button"
          aria-pressed={done}
          aria-label={done ? `Undo ${item.unit_no}` : `Mark ${item.unit_no} delivered`}
          onClick={() => onSetStatus(item, done ? "pending" : "delivered")}
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 text-3xl font-bold ${
            done ? "border-teal-700 bg-teal-600 text-white" : "border-slate-400 bg-white text-slate-300"
          }`}
        >
          ✓
        </button>
      )}
    </li>
  );
}
