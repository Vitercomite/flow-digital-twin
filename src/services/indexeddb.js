import { openDB } from 'idb';

const DB_NAME = 'flow-twin-db';
const DB_VERSION = 1;

let _db = null;

async function getDB() {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Fluxograms store
      if (!db.objectStoreNames.contains('fluxograms')) {
        const store = db.createObjectStore('fluxograms', { keyPath: 'id' });
        store.createIndex('updated_at', 'updated_at');
      }

      // Elements store
      if (!db.objectStoreNames.contains('elements')) {
        const store = db.createObjectStore('elements', { keyPath: 'id' });
        store.createIndex('fluxogram_id', 'fluxogram_id');
        store.createIndex('updated_at', 'updated_at');
      }

      // Pending operations queue
      if (!db.objectStoreNames.contains('pending_ops')) {
        const store = db.createObjectStore('pending_ops', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });

  return _db;
}

// ── Fluxograms ────────────────────────────────────────────────────────────────
export async function saveFluxogramLocal(fluxogram) {
  const db = await getDB();
  await db.put('fluxograms', { ...fluxogram, _local: true });
}

export async function getFluxogramsLocal() {
  const db = await getDB();
  return db.getAll('fluxograms');
}

export async function deleteFluxogramLocal(id) {
  const db = await getDB();
  await db.delete('fluxograms', id);
}

// ── Elements ──────────────────────────────────────────────────────────────────
export async function saveElementLocal(element) {
  const db = await getDB();
  await db.put('elements', { ...element, _local: true });
}

export async function getElementsLocal(fluxogramId) {
  const db = await getDB();
  const all = await db.getAllFromIndex('elements', 'fluxogram_id', fluxogramId);
  return all;
}

export async function deleteElementLocal(id) {
  const db = await getDB();
  await db.delete('elements', id);
}

// ── Pending Operations Queue ──────────────────────────────────────────────────
/**
 * Enqueue an operation to be synced when back online.
 * @param {'create'|'update'|'delete'} type
 * @param {'elements'|'fluxograms'} entity
 * @param {object} payload
 */
export async function enqueuePendingOp(type, entity, payload) {
  const db = await getDB();
  await db.add('pending_ops', {
    type,
    entity,
    payload,
    timestamp: Date.now(),
    retries: 0,
  });
}

export async function getPendingOps() {
  const db = await getDB();
  return db.getAll('pending_ops');
}

export async function removePendingOp(id) {
  const db = await getDB();
  await db.delete('pending_ops', id);
}

export async function clearPendingOps() {
  const db = await getDB();
  await db.clear('pending_ops');
}

export async function getPendingCount() {
  const db = await getDB();
  return db.count('pending_ops');
}
