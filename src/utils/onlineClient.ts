import type { ClientToServerEvent, ServerToClientEvent } from '../types/ludo';

const PLAYER_ID_KEY = 'ludo_arena_player_id';
const PLAYER_NAME_KEY = 'ludo_arena_player_name';
const ACTIVE_ROOM_SESSION_KEY = 'ludo_arena_active_room_session';

export interface ActiveRoomSession {
  code: string;
  playerId: string;
  playerName: string;
  savedAt: number;
}

export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return 'srv-player';
  let existing = window.localStorage.getItem(PLAYER_ID_KEY);
  if (!existing) {
    existing =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(PLAYER_ID_KEY, existing);
  }
  return existing;
}

export function getSavedPlayerName(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(PLAYER_NAME_KEY) || fallback;
}

export function savePlayerName(name: string): void {
  if (typeof window === 'undefined') return;
  const clean = name.trim().slice(0, 18);
  if (clean) {
    window.localStorage.setItem(PLAYER_NAME_KEY, clean);
  }
}

export function saveActiveSession(session: { code: string; playerId: string; playerName: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ActiveRoomSession = {
      code: session.code.trim().toUpperCase(),
      playerId: session.playerId,
      playerName: session.playerName,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(ACTIVE_ROOM_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function getActiveSession(): ActiveRoomSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_ROOM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveRoomSession;
    // Expire stored sessions older than 30 minutes
    if (!parsed?.code || Date.now() - (parsed.savedAt || 0) > 30 * 60 * 1000) {
      clearActiveSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACTIVE_ROOM_SESSION_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function buildWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export class OnlineRoomSocket {
  private ws: WebSocket | null = null;
  private pendingQueue: ClientToServerEvent[] = [];
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private closedByUser = false;
  private onEvent: (ev: ServerToClientEvent) => void;
  private onStatusChange: (connected: boolean) => void;
  private reconnectSession: { code: string; playerId: string; playerName: string } | null = null;
  private boundVisibilityHandler: (() => void) | null = null;

  constructor(
    onEvent: (ev: ServerToClientEvent) => void,
    onStatusChange: (connected: boolean) => void
  ) {
    this.onEvent = onEvent;
    this.onStatusChange = onStatusChange;

    // Restore any active room session from localStorage on startup
    const saved = getActiveSession();
    if (saved) {
      this.reconnectSession = {
        code: saved.code,
        playerId: saved.playerId,
        playerName: saved.playerName,
      };
    }

    this.attachLifecycleListeners();
  }

  private attachLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    this.boundVisibilityHandler = () => {
      // Triggered when device wakes up, screen is unlocked, tab comes back from background, or network reconnects
      if (this.closedByUser) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connect();
      } else if (this.reconnectSession) {
        // Socket was still open/half-open: send room:join to ensure server sync
        this.send({
          type: 'room:join',
          code: this.reconnectSession.code,
          playerId: this.reconnectSession.playerId,
          playerName: this.reconnectSession.playerName,
        });
      }
    };

    window.addEventListener('visibilitychange', this.boundVisibilityHandler);
    window.addEventListener('online', this.boundVisibilityHandler);
    window.addEventListener('pageshow', this.boundVisibilityHandler);
    window.addEventListener('focus', this.boundVisibilityHandler);
  }

  public setReconnectSession(
    session: { code: string; playerId: string; playerName: string } | null
  ): void {
    this.reconnectSession = session;
    if (session) {
      saveActiveSession(session);
    } else {
      clearActiveSession();
    }
  }

  public getReconnectSession(): { code: string; playerId: string; playerName: string } | null {
    return this.reconnectSession || getActiveSession();
  }

  public connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.closedByUser = false;

    // Ensure session is restored if available
    if (!this.reconnectSession) {
      const saved = getActiveSession();
      if (saved) {
        this.reconnectSession = {
          code: saved.code,
          playerId: saved.playerId,
          playerName: saved.playerName,
        };
      }
    }

    const ws = new WebSocket(buildWsUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.onStatusChange(true);

      // Start keepalive ping to prevent mobile TCP idle closure
      this.startKeepAlive();

      // ALWAYS re-join the active room first before dispatching any queued actions
      if (this.reconnectSession) {
        ws.send(
          JSON.stringify({
            type: 'room:join',
            code: this.reconnectSession.code,
            playerId: this.reconnectSession.playerId,
            playerName: this.reconnectSession.playerName,
          } satisfies ClientToServerEvent)
        );
      }

      while (this.pendingQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
        const next = this.pendingQueue.shift()!;
        ws.send(JSON.stringify(next));
      }
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as ServerToClientEvent;
        this.onEvent(parsed);
      } catch {
        // Ignore malformed server payload
      }
    };

    ws.onclose = () => {
      this.stopKeepAlive();
      this.onStatusChange(false);
      if (this.ws === ws) this.ws = null;

      // Automatically reconnect if not explicitly closed by user
      if (!this.closedByUser) {
        if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 1200);
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    if (typeof window === 'undefined') return;
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send a lightweight wallet sync or ping
        if (this.reconnectSession) {
          this.ws.send(
            JSON.stringify({
              type: 'wallet:sync',
              playerId: this.reconnectSession.playerId,
            } satisfies ClientToServerEvent)
          );
        }
      }
    }, 15000);
  }

  private stopKeepAlive(): void {
    if (this.pingInterval !== null) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public send(payload: ClientToServerEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return;
    }
    this.pendingQueue.push(payload);
    this.connect();
  }

  public leaveRoom(): void {
    this.closedByUser = true;
    this.reconnectSession = null;
    clearActiveSession();
    this.send({ type: 'room:leave' });
    this.pendingQueue = [];
    this.stopKeepAlive();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  public disconnect(): void {
    this.stopKeepAlive();

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.onStatusChange(false);
  }

  public destroy(): void {
    this.disconnect();
    if (typeof window !== 'undefined' && this.boundVisibilityHandler) {
      window.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      window.removeEventListener('online', this.boundVisibilityHandler);
      window.removeEventListener('pageshow', this.boundVisibilityHandler);
      window.removeEventListener('focus', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
  }
}
