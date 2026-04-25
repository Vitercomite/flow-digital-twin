import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useStore from '../store/useStore';

const WS_URL = import.meta.env.VITE_WS_URL || '';

let socketInstance = null;

function getSocket() {
  if (!socketInstance) {
    socketInstance = io(WS_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });
  }
  return socketInstance;
}

/**
 * Hook that manages a Socket.io connection and listens for real-time events
 * for the currently open fluxogram.
 */
export default function useSocket() {
  const { currentFluxogram, addElement, updateElement, removeElement, addNotification } =
    useStore();
  const joinedRoom = useRef(null);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      console.log('[WS] Connected:', socket.id);
      // Re-join room after reconnect
      if (currentFluxogram) {
        socket.emit('join-fluxogram', currentFluxogram.id);
        joinedRoom.current = currentFluxogram.id;
      }
    };

    const onDisconnect = () => {
      console.log('[WS] Disconnected');
    };

    const onElementCreated = (el) => {
      addElement(el);
      addNotification(`Elemento "${el.tag}" criado por outro usuário`, 'info');
    };

    const onElementUpdated = (el) => {
      updateElement(el);
    };

    const onElementDeleted = ({ id, fluxogramId }) => {
      removeElement(id);
      addNotification(`Elemento removido por outro usuário`, 'warning');
    };

    const onUserJoined = () => {
      addNotification('Outro usuário entrou neste fluxograma', 'info');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('element-created', onElementCreated);
    socket.on('element-updated', onElementUpdated);
    socket.on('element-deleted', onElementDeleted);
    socket.on('user-joined', onUserJoined);

    if (socket.connected && currentFluxogram && joinedRoom.current !== currentFluxogram.id) {
      if (joinedRoom.current) socket.emit('leave-fluxogram', joinedRoom.current);
      socket.emit('join-fluxogram', currentFluxogram.id);
      joinedRoom.current = currentFluxogram.id;
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('element-created', onElementCreated);
      socket.off('element-updated', onElementUpdated);
      socket.off('element-deleted', onElementDeleted);
      socket.off('user-joined', onUserJoined);
    };
  }, [currentFluxogram?.id]);

  // Join new room when fluxogram changes
  useEffect(() => {
    if (!currentFluxogram) return;
    const socket = getSocket();
    if (!socket.connected) return;
    if (joinedRoom.current === currentFluxogram.id) return;

    if (joinedRoom.current) socket.emit('leave-fluxogram', joinedRoom.current);
    socket.emit('join-fluxogram', currentFluxogram.id);
    joinedRoom.current = currentFluxogram.id;
  }, [currentFluxogram?.id]);
}
