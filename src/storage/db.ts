// Uložení záznamů do IndexedDB se zálohou v localStorage.
// Data zůstávají jen v zařízení, nic se neodesílá na server.

import type { Casualty } from '../model/types';

const DB_NAME = 'cls-tccc';
const STORE = 'casualties';
const BACKUP_KEY = 'cls-tccc-backup';

let dbPromise: Promise<IDBDatabase> | undefined;

const openDb = (): Promise<IDBDatabase> => {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
};

const readBackup = (): Casualty[] => {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? (JSON.parse(raw) as Casualty[]) : [];
  } catch {
    return [];
  }
};

const writeBackup = (casualties: Casualty[]): void => {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(casualties));
  } catch {
    // Plné nebo zakázané úložiště – primární kopie zůstává v IndexedDB.
  }
};

export const loadCasualties = async (): Promise<Casualty[]> => {
  const backup = readBackup();
  try {
    const db = await openDb();
    const stored = await new Promise<Casualty[]>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as Casualty[]);
      request.onerror = () => reject(request.error);
    });
    // Pro každý záznam vezmi novější verzi z obou úložišť.
    const merged = new Map<string, Casualty>();
    [...stored, ...backup].forEach((casualty) => {
      const existing = merged.get(casualty.id);
      if (!existing || existing.updatedAt < casualty.updatedAt) merged.set(casualty.id, casualty);
    });
    return [...merged.values()].sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return backup;
  }
};

export const saveCasualties = async (casualties: Casualty[]): Promise<void> => {
  writeBackup(casualties);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.clear();
      casualties.forEach((casualty) => store.put(casualty));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Záloha v localStorage už je zapsaná.
  }
};

export const requestPersistentStorage = async (): Promise<void> => {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Prohlížeč trvalé úložiště nepodporuje.
  }
};
