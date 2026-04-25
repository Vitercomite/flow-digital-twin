import { useEffect } from 'react';
import useStore from '../store/useStore';
import { syncPendingOps, getPendingCount } from '../services/sync';

/**
 * Listens for online/offline events and automatically syncs
 * pending operations when connectivity is restored.
 */
export default function useOfflineSync() {
  const { setOnline, setPendingCount, addNotification } = useStore();

  async function refreshCount() {
    const count = await getPendingCount();
    setPendingCount(count);
  }

  useEffect(() => {
    // Set initial state
    setOnline(navigator.onLine);
    refreshCount();

    const handleOnline = async () => {
      setOnline(true);
      addNotification('Conexão restaurada. Sincronizando...', 'info');
      try {
        const { synced, failed } = await syncPendingOps();
        if (synced > 0) addNotification(`✅ ${synced} operação(ões) sincronizada(s)`, 'success');
        if (failed > 0) addNotification(`⚠️ ${failed} operação(ões) falharam. Tente novamente.`, 'warning');
      } catch (err) {
        console.error('[OfflineSync] Sync error:', err);
      } finally {
        await refreshCount();
      }
    };

    const handleOffline = () => {
      setOnline(false);
      addNotification('Sem conexão. Dados serão salvos localmente.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic refresh of pending count
    const interval = setInterval(refreshCount, 15_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);
}
