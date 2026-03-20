import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(userId: string): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  s.emit('join:user', userId);
}

export function disconnectSocket(): void {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}

export function onWakeUpdate(handler: (data: any) => void): () => void {
  const s = getSocket();
  s.on('wake:update', handler);
  return () => s.off('wake:update', handler);
}

export function onWakeComplete(handler: (data: any) => void): () => void {
  const s = getSocket();
  s.on('wake:complete', handler);
  return () => s.off('wake:complete', handler);
}

export function onAlertNew(handler: (data: any) => void): () => void {
  const s = getSocket();
  s.on('alert:new', handler);
  return () => s.off('alert:new', handler);
}

export default getSocket;
