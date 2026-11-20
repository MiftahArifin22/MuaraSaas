"use client";

import { useSyncExternalStore } from "react";
import { seed, type DemoData } from "./mock-data";

const storageKey = "muara-demo-v2";
type Snapshot = { data: DemoData; storageAvailable: boolean; ready: boolean };
// `ready: false` hanya dipakai saat render server/hidrasi, sebelum data browser terbaca.
const serverSnapshot: Snapshot = { data: seed, storageAvailable: true, ready: false };
const initialSnapshot: Snapshot = { data: seed, storageAvailable: true, ready: true };
let snapshot = initialSnapshot;
let cachedRaw: string | null | undefined;
let useMemory = false;
const listeners = new Set<() => void>();

function getSnapshot() {
  if (useMemory) return snapshot;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    snapshot = { data: snapshot.data, storageAvailable: false, ready: true };
    useMemory = true;
    return snapshot;
  }
  if (raw === cachedRaw) return snapshot;
  cachedRaw = raw;
  if (raw === null) return (snapshot = initialSnapshot);
  try {
    const data: DemoData = JSON.parse(raw);
    const valid = data?.version === 2 && data.mill && data.suppliers?.length && data.lots?.length
      && [data.suppliers, data.plots, data.lots, data.cooperatives, data.tasks, data.activity].every(Array.isArray);
    snapshot = valid ? { data, storageAvailable: true, ready: true } : initialSnapshot;
  } catch {
    snapshot = initialSnapshot;
  }
  return snapshot;
}

function publish() {
  listeners.forEach((listener) => listener());
}

function handleStorage(event: StorageEvent) {
  if (event.key === storageKey || event.key === null) publish();
}

function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener("storage", handleStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", handleStorage);
  };
}

function getServerSnapshot() {
  return serverSnapshot;
}

export function useDemo() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function updateDemo(update: (data: DemoData) => DemoData) {
  const data = update(getSnapshot().data);
  try {
    const raw = JSON.stringify(data);
    window.localStorage.setItem(storageKey, raw);
    cachedRaw = raw;
    useMemory = false;
  } catch {
    useMemory = true;
  }
  snapshot = { data, storageAvailable: !useMemory, ready: true };
  publish();
}

export function resetDemo() {
  try {
    window.localStorage.removeItem(storageKey);
    cachedRaw = null;
    useMemory = false;
  } catch {
    useMemory = true;
  }
  snapshot = { data: seed, storageAvailable: !useMemory, ready: true };
  publish();
}
