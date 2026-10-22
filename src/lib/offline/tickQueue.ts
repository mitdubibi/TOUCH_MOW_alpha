import { openDB, type IDBPDatabase } from "idb";
import type { DeliveryStatus } from "@/types/db";

// Ticks made without signal wait here (in IndexedDB) and are sent in order when back online.

export type QueuedTick = {
  id?: number;
  deliveryId: string;
  status: DeliveryStatus;
  at: string; // when the volunteer tapped, ISO time
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  dbPromise ??= openDB("touch-mow", 1, {
    upgrade(database) {
      database.createObjectStore("ticks", { keyPath: "id", autoIncrement: true });
    },
  });
  return dbPromise;
}

export async function enqueueTick(tick: QueuedTick) {
  await (await db()).add("ticks", tick);
}

export async function queuedTicks(): Promise<QueuedTick[]> {
  return (await db()).getAll("ticks");
}

export async function removeTick(id: number) {
  await (await db()).delete("ticks", id);
}
