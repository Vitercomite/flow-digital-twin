import * as api from './api.js';
import {
  getPendingOps,
  removePendingOp,
  saveElementLocal,
  deleteElementLocal,
  getPendingCount,
} from './indexeddb.js';

/**
 * Replay all pending operations against the server.
 * Uses "last write wins" strategy (server always gets the latest local data).
 *
 * @returns {{ synced: number, failed: number }}
 */
export async function syncPendingOps() {
  let synced = 0;
  let failed = 0;

  const ops = await getPendingOps();
  if (!ops.length) return { synced, failed };

  console.log(`[SYNC] Replaying ${ops.length} pending operation(s)...`);

  for (const op of ops) {
    try {
      await replayOp(op);
      await removePendingOp(op.id);
      synced++;
    } catch (err) {
      console.error(`[SYNC] Failed to replay op ${op.id}:`, err.message);
      failed++;
    }
  }

  console.log(`[SYNC] Done. Synced: ${synced}, Failed: ${failed}`);
  return { synced, failed };
}

async function replayOp(op) {
  const { type, entity, payload } = op;

  if (entity === 'elements') {
    if (type === 'create') {
      const result = await api.createElement(payload);
      await saveElementLocal(result);
    } else if (type === 'update') {
      const result = await api.updateElement(payload.id, payload);
      await saveElementLocal(result);
    } else if (type === 'delete') {
      await api.deleteElement(payload.id);
      await deleteElementLocal(payload.id);
    }
  } else if (entity === 'fluxograms') {
    if (type === 'create') {
      await api.createFluxogram(payload);
    } else if (type === 'update') {
      await api.updateFluxogram(payload.id, payload);
    } else if (type === 'delete') {
      await api.deleteFluxogram(payload.id);
    }
  }
}

export { getPendingCount };
