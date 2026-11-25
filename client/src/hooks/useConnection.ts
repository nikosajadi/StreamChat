// ===========================================================================
// useConnection: what state the socket is in, for the status pill and for
// disabling the composer.
// ---------------------------------------------------------------------------
//   connecting    first attempt, nothing has worked yet
//   connected     socket is up
//   reconnecting  we were connected, lost it, Socket.IO is retrying
//   offline       the browser says there's no network, or retries gave up
//
// Socket.IO events used: socket "connect"/"disconnect", and on the manager
// (socket.io) "reconnect_attempt" / "reconnect_failed".
// ===========================================================================
import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export function useConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(() =>
    socket.connected ? 'connected' : navigator.onLine === false ? 'offline' : 'connecting',
  );

  useEffect(() => {
    const onConnect = () => setState('connected');
    // "io client disconnect" means we closed it on purpose; anything else
    // (server restart, network drop) means Socket.IO will try again.
    const onDisconnect = (reason: string) =>
      setState(reason === 'io client disconnect' ? 'offline' : 'reconnecting');
    const onAttempt = () => setState(navigator.onLine === false ? 'offline' : 'reconnecting');
    const onFailed = () => setState('offline');
    const onBrowserOffline = () => setState('offline');
    const onBrowserOnline = () => {
      if (!socket.connected) setState('reconnecting');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onAttempt);
    socket.io.on('reconnect_failed', onFailed);
    window.addEventListener('offline', onBrowserOffline);
    window.addEventListener('online', onBrowserOnline);

    // The socket may have connected between the first render and this
    // effect, in which case we missed the "connect" event. Catch up.
    if (socket.connected) setState('connected');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onAttempt);
      socket.io.off('reconnect_failed', onFailed);
      window.removeEventListener('offline', onBrowserOffline);
      window.removeEventListener('online', onBrowserOnline);
    };
  }, []);

  return state;
}
