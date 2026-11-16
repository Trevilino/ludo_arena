import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import type {
  AdminLiveRoomSummary,
  BotDifficulty,
  ClientToServerEvent,
  ColorId,
  DiceThrowVector,
  OnlineRoomSnapshot,
  OnlineSeatSnapshot,
  OnlineTurnPhase,
  PublicRoomSummary,
  ServerToClientEvent,
  Token,
} from './src/types/ludo.ts';
import {
  chooseBestBotMove,
  createInitialTokens,
  executeTokenMove,
  getMovableTokenIds,
} from './src/utils/ludoEngine.ts';

const PORT = Number(process.env.PORT) || 3000;
const TURN_ORDER: ColorId[] = ['red', 'green', 'yellow', 'blue'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INITIAL_WALLET_COINS = 2450;
const MAX_CUSTOM_STAKE = 1_000_000;

const ADMIN_BOOTSTRAP_EMAIL = 'eddylinho04@gmail.com';

async function verifyFirebaseTokenUser(
  idToken: string
): Promise<{ uid: string; email: string; emailVerified: boolean } | null> {
  if (!idToken || !firebaseConfig.apiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: { localId?: string; email?: string; emailVerified?: boolean }[];
    };
    const u = data.users?.[0];
    if (!u?.localId) return null;
    return {
      uid: u.localId,
      email: u.email || '',
      emailVerified: Boolean(u.emailVerified),
    };
  } catch {
    return null;
  }
}

async function verifyFirebaseIdToken(idToken: string): Promise<string | null> {
  const user = await verifyFirebaseTokenUser(idToken);
  return user?.uid ?? null;
}

const DEFAULT_BOT_NAMES: Record<ColorId, string> = {
  red: 'Crimson Bot',
  green: 'Lyra Bot',
  yellow: 'Darius Bot',
  blue: 'Sora Bot',
};

interface ServerSeat extends OnlineSeatSnapshot {
  socket: WebSocket | null;
}

interface ServerRoom {
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: 2 | 3 | 4;
  isPublic: boolean;
  stake: number;
  wagerPot: number;
  potAwarded: boolean;
  fillWithBots: boolean;
  difficulty: BotDifficulty;
  hostPlayerId: string;
  seats: Record<ColorId, ServerSeat>;
  tokens: Token[];
  activeColor: ColorId;
  turnPhase: OnlineTurnPhase;
  diceValue: number;
  diceSpinNonce: number;
  diceLandCoord: { x: number; y: number };
  diceThrowVector: DiceThrowVector | null;
  movableTokenIds: string[];
  consecutiveSixes: number;
  turnCount: number;
  winner: ColorId | null;
  timers: Set<ReturnType<typeof setTimeout>>;
  lastActivityAt: number;
  createdAt: number;
}

const rooms = new Map<string, ServerRoom>();
const wallets = new Map<string, number>();
const dailyClaimed = new Set<string>();
const socketSession = new WeakMap<WebSocket, { roomCode: string; playerId: string }>();

function getWallet(playerId: string): number {
  if (!wallets.has(playerId)) {
    wallets.set(playerId, INITIAL_WALLET_COINS);
  }
  return wallets.get(playerId)!;
}

function setWallet(playerId: string, balance: number): number {
  const next = Math.max(0, Math.floor(balance));
  wallets.set(playerId, next);
  return next;
}

function normalizeStake(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 250;
  return Math.max(0, Math.min(MAX_CUSTOM_STAKE, Math.floor(n)));
}

function getPresetColors(maxPlayers: 2 | 3 | 4): ColorId[] {
  if (maxPlayers === 2) return ['red', 'yellow'];
  if (maxPlayers === 3) return ['red', 'green', 'yellow'];
  return ['red', 'green', 'yellow', 'blue'];
}

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createEmptySeats(maxPlayers: 2 | 3 | 4): Record<ColorId, ServerSeat> {
  const allowed = getPresetColors(maxPlayers);
  const seats = {} as Record<ColorId, ServerSeat>;
  for (const color of TURN_ORDER) {
    seats[color] = {
      color,
      playerId: null,
      name: '',
      isBot: false,
      ready: false,
      connected: false,
      isHost: false,
      active: allowed.includes(color),
      socket: null,
    };
  }
  return seats;
}

function toRoomSnapshot(room: ServerRoom): OnlineRoomSnapshot {
  const seatsSnapshot = {} as Record<ColorId, OnlineSeatSnapshot>;
  for (const color of TURN_ORDER) {
    const { socket: _socket, ...rest } = room.seats[color];
    seatsSnapshot[color] = rest;
  }
  return {
    code: room.code,
    status: room.status,
    maxPlayers: room.maxPlayers,
    isPublic: room.isPublic,
    stake: room.stake,
    wagerPot: room.wagerPot,
    fillWithBots: room.fillWithBots,
    difficulty: room.difficulty,
    hostPlayerId: room.hostPlayerId,
    seats: seatsSnapshot,
    tokens: room.tokens.map((t) => ({ ...t })),
    activeColor: room.activeColor,
    turnPhase: room.turnPhase,
    diceValue: room.diceValue,
    diceSpinNonce: room.diceSpinNonce,
    diceLandCoord: { ...room.diceLandCoord },
    diceThrowVector: room.diceThrowVector ? { ...room.diceThrowVector } : null,
    movableTokenIds: [...room.movableTokenIds],
    consecutiveSixes: room.consecutiveSixes,
    turnCount: room.turnCount,
    winner: room.winner,
    createdAt: room.createdAt,
  };
}

function getPublicRoomsSnapshot(): PublicRoomSummary[] {
  const list: PublicRoomSummary[] = [];
  for (const room of rooms.values()) {
    if (!room.isPublic || room.status !== 'waiting') continue;
    const presetColors = getPresetColors(room.maxPlayers);
    const occupied = presetColors.filter((c) => Boolean(room.seats[c].playerId)).length;
    if (occupied >= room.maxPlayers) continue;
    const hostSeat = TURN_ORDER.map((c) => room.seats[c]).find(
      (s) => s.playerId === room.hostPlayerId
    );
    list.push({
      code: room.code,
      hostName: hostSeat?.name || 'Hôte',
      maxPlayers: room.maxPlayers,
      playerCount: occupied,
      stake: room.stake,
      difficulty: room.difficulty,
      fillWithBots: room.fillWithBots,
      createdAt: room.createdAt,
    });
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

function clearRoomTimers(room: ServerRoom): void {
  for (const timer of room.timers) {
    clearTimeout(timer);
  }
  room.timers.clear();
}

function scheduleRoomTimer(room: ServerRoom, fn: () => void, ms: number): void {
  const timer = setTimeout(() => {
    room.timers.delete(timer);
    fn();
  }, ms);
  room.timers.add(timer);
}

function sendToSocket(ws: WebSocket | null, payload: ServerToClientEvent): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function broadcastRoom(room: ServerRoom, payload: ServerToClientEvent): void {
  const encoded = JSON.stringify(payload);
  for (const color of TURN_ORDER) {
    const ws = room.seats[color].socket;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(encoded);
    }
  }
}

function findSeatByPlayerId(room: ServerRoom, playerId: string): ServerSeat | null {
  for (const color of TURN_ORDER) {
    if (room.seats[color].playerId === playerId) {
      return room.seats[color];
    }
  }
  return null;
}

function getNextActiveColor(room: ServerRoom, current: ColorId): ColorId {
  const startIdx = TURN_ORDER.indexOf(current);
  for (let offset = 1; offset <= 4; offset++) {
    const candidate = TURN_ORDER[(startIdx + offset) % 4];
    if (room.seats[candidate].active) return candidate;
  }
  return current;
}

function maybeTriggerBotTurn(room: ServerRoom): void {
  if (room.status !== 'playing' || room.winner) return;
  const seat = room.seats[room.activeColor];
  if (!seat || !seat.active || !seat.isBot) return;

  if (room.turnPhase === 'waiting-roll') {
    scheduleRoomTimer(room, () => {
      performServerRoll(room);
    }, 650);
  }
}

function scheduleTurnTimeout(room: ServerRoom): void {
  if (room.status !== 'playing' || room.winner) return;
  const seat = room.seats[room.activeColor];
  if (!seat || !seat.active) return;

  if (seat.isBot) {
    maybeTriggerBotTurn(room);
    return;
  }

  // Auto-play timeout for disconnected or AFK human player so match never freezes
  const timeoutMs = seat.connected ? 25000 : 10000;
  const turnSnapshot = room.turnCount;
  const phaseSnapshot = room.turnPhase;
  const colorSnapshot = room.activeColor;

  scheduleRoomTimer(room, () => {
    if (
      room.status !== 'playing' ||
      room.winner ||
      room.turnCount !== turnSnapshot ||
      room.activeColor !== colorSnapshot ||
      room.turnPhase !== phaseSnapshot
    ) {
      return;
    }

    if (room.turnPhase === 'waiting-roll') {
      performServerRoll(room);
    } else if (room.turnPhase === 'waiting-move') {
      const chosenId = chooseBestBotMove(
        room.tokens,
        room.activeColor,
        room.diceValue,
        room.difficulty
      );
      if (chosenId) {
        performServerMove(room, chosenId);
      } else if (room.movableTokenIds.length > 0) {
        performServerMove(room, room.movableTokenIds[0]);
      } else {
        advanceServerTurn(room);
      }
    }
  }, timeoutMs);
}

function advanceServerTurn(room: ServerRoom): void {
  if (room.status !== 'playing' || room.winner) return;
  room.activeColor = getNextActiveColor(room, room.activeColor);
  room.turnPhase = 'waiting-roll';
  room.movableTokenIds = [];
  room.consecutiveSixes = 0;
  room.turnCount += 1;
  room.lastActivityAt = Date.now();
  broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
  scheduleTurnTimeout(room);
}

function performServerMove(room: ServerRoom, tokenId: string): void {
  if (room.status !== 'playing' || room.winner || room.turnPhase !== 'waiting-move') return;
  if (!room.movableTokenIds.includes(tokenId)) return;

  const target = room.tokens.find((t) => t.id === tokenId);
  if (!target) return;

  const actorColor = room.activeColor;
  const isDeploying = target.progress === -1;
  const result = executeTokenMove(room.tokens, tokenId, room.diceValue);

  const forwardMs = isDeploying ? 160 : room.diceValue * 160;
  let captureMs = 0;
  if (result.capturedTokens.length > 0) {
    const maxReturnSteps = Math.max(...result.capturedTokens.map((v) => v.progress + 1));
    const returnStepMs = Math.max(
      60,
      Math.min(95, Math.floor(2100 / Math.max(1, maxReturnSteps)))
    );
    captureMs = 260 + maxReturnSteps * returnStepMs + 160;
  }
  const totalAnimMs = forwardMs + captureMs;

  room.tokens = result.updatedTokens;
  room.turnPhase = 'animating';
  room.movableTokenIds = [];
  room.lastActivityAt = Date.now();

  broadcastRoom(room, {
    type: 'game:tokenMoved',
    room: toRoomSnapshot(room),
    actorColor,
    tokenId,
    diceValue: room.diceValue,
    deployedFromBase: result.deployedFromBase,
    reachedHome: result.reachedHome,
    landedSafe: result.landedSafe,
    capturedVictims: result.capturedTokens.map((v) => ({
      id: v.id,
      color: v.color,
      progress: v.progress,
    })),
    bonusTurn: result.bonusTurn,
    winner: result.winner,
    updatedTokens: result.updatedTokens,
  });

  scheduleRoomTimer(room, () => {
    if (result.winner) {
      room.winner = result.winner;
      room.status = 'finished';
      room.turnPhase = 'waiting-roll';

      if (!room.potAwarded && room.wagerPot > 0) {
        room.potAwarded = true;
        const winnerSeat = room.seats[result.winner];
        if (winnerSeat?.playerId && !winnerSeat.isBot) {
          const newCoins = setWallet(
            winnerSeat.playerId,
            getWallet(winnerSeat.playerId) + room.wagerPot
          );
          sendToSocket(winnerSeat.socket, { type: 'wallet:balance', coins: newCoins });
        }
      }

      broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
      return;
    }

    if (result.bonusTurn) {
      room.turnPhase = 'waiting-roll';
      broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
      scheduleTurnTimeout(room);
      return;
    }

    advanceServerTurn(room);
  }, totalAnimMs);
}

function performServerRoll(room: ServerRoom, throwVector?: DiceThrowVector): void {
  if (room.status !== 'playing' || room.winner || room.turnPhase !== 'waiting-roll') return;

  const roll = Math.floor(Math.random() * 6) + 1;
  const landCoord = {
    x: 43 + Math.random() * 14,
    y: 43 + Math.random() * 14,
  };

  room.diceValue = roll;
  room.diceLandCoord = landCoord;
  room.diceThrowVector = throwVector ?? null;
  room.diceSpinNonce += 1;
  room.turnPhase = 'rolling';
  room.movableTokenIds = [];
  room.lastActivityAt = Date.now();

  const rollingColor = room.activeColor;

  broadcastRoom(room, {
    type: 'game:diceRolled',
    room: toRoomSnapshot(room),
    color: rollingColor,
    roll,
    landCoord,
    throwVector: room.diceThrowVector,
    diceSpinNonce: room.diceSpinNonce,
  });

  scheduleRoomTimer(room, () => {
    if (room.status !== 'playing' || room.winner) return;

    if (roll === 6 && room.consecutiveSixes >= 2) {
      room.consecutiveSixes = 0;
      room.movableTokenIds = [];
      broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
      scheduleRoomTimer(room, () => {
        advanceServerTurn(room);
      }, 700);
      return;
    }

    room.consecutiveSixes = roll === 6 ? room.consecutiveSixes + 1 : 0;
    const movable = getMovableTokenIds(room.tokens, rollingColor, roll);

    if (movable.length === 0) {
      room.movableTokenIds = [];
      broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
      scheduleRoomTimer(room, () => {
        advanceServerTurn(room);
      }, 700);
      return;
    }

    room.turnPhase = 'waiting-move';
    room.movableTokenIds = movable;
    broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });

    const seat = room.seats[rollingColor];
    if (seat.isBot) {
      scheduleRoomTimer(room, () => {
        const chosenId = chooseBestBotMove(room.tokens, rollingColor, roll, room.difficulty);
        if (chosenId) performServerMove(room, chosenId);
      }, 650);
    } else if (movable.length === 1) {
      scheduleRoomTimer(room, () => {
        performServerMove(room, movable[0]);
      }, 320);
    } else {
      scheduleTurnTimeout(room);
    }
  }, 2140);
}

function startRoomMatch(room: ServerRoom): { ok: true } | { ok: false; message: string } {
  const presetColors = getPresetColors(room.maxPlayers);

  // Check active colors and verify every human player has enough coins for room.stake before mutating
  const candidateActiveColors: ColorId[] = [];
  for (const color of TURN_ORDER) {
    if (!presetColors.includes(color)) continue;
    const seat = room.seats[color];
    if (seat.playerId) {
      candidateActiveColors.push(color);
      if (room.stake > 0 && getWallet(seat.playerId) < room.stake) {
        return {
          ok: false,
          message: `${seat.name} n'a pas assez de pièces pour la mise (${room.stake}).`,
        };
      }
    } else if (room.fillWithBots) {
      candidateActiveColors.push(color);
    }
  }

  if (candidateActiveColors.length < 2) {
    return {
      ok: false,
      message: 'Au moins 2 joueurs (ou activez les bots) pour lancer.',
    };
  }

  clearRoomTimers(room);

  for (const color of TURN_ORDER) {
    const seat = room.seats[color];
    if (!presetColors.includes(color)) {
      seat.active = false;
      seat.isBot = false;
      seat.playerId = null;
      seat.name = '';
      continue;
    }
    if (seat.playerId) {
      seat.active = true;
      seat.isBot = false;
      if (room.stake > 0) {
        const nextBalance = setWallet(seat.playerId, getWallet(seat.playerId) - room.stake);
        sendToSocket(seat.socket, { type: 'wallet:balance', coins: nextBalance });
      }
    } else if (room.fillWithBots) {
      seat.active = true;
      seat.isBot = true;
      seat.name = DEFAULT_BOT_NAMES[color];
      seat.ready = true;
      seat.connected = true;
    } else {
      seat.active = false;
      seat.isBot = false;
    }
  }

  const activeColors = TURN_ORDER.filter((c) => room.seats[c].active);
  room.status = 'playing';
  room.wagerPot = room.stake * activeColors.length;
  room.potAwarded = false;
  room.tokens = createInitialTokens(activeColors);
  room.activeColor = activeColors[0];
  room.turnPhase = 'waiting-roll';
  room.diceValue = 6;
  room.diceLandCoord = { x: 50, y: 50 };
  room.diceThrowVector = null;
  room.movableTokenIds = [];
  room.consecutiveSixes = 0;
  room.turnCount = 1;
  room.winner = null;
  room.lastActivityAt = Date.now();

  broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
  scheduleTurnTimeout(room);
  return { ok: true };
}

function detachSocketFromRoom(ws: WebSocket, explicitLeave: boolean): void {
  const session = socketSession.get(ws);
  if (!session) return;
  socketSession.delete(ws);

  const room = rooms.get(session.roomCode);
  if (!room) return;

  const seat = findSeatByPlayerId(room, session.playerId);
  if (!seat) return;

  if (explicitLeave && room.status === 'waiting') {
    seat.playerId = null;
    seat.name = '';
    seat.ready = false;
    seat.connected = false;
    seat.isHost = false;
    seat.socket = null;

    const remainingHumans = TURN_ORDER.map((c) => room.seats[c]).filter(
      (s) => s.playerId && !s.isBot
    );
    if (remainingHumans.length === 0) {
      clearRoomTimers(room);
      rooms.delete(room.code);
      return;
    }
    if (room.hostPlayerId === session.playerId) {
      room.hostPlayerId = remainingHumans[0].playerId!;
      remainingHumans[0].isHost = true;
      remainingHumans[0].ready = true;
    }
    broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
    return;
  }

  if (seat.socket === ws) {
    seat.socket = null;
    seat.connected = false;
  }

  if (explicitLeave && room.status === 'playing') {
    // Convert departed human seat to Bot so remaining players can finish cleanly
    seat.playerId = null;
    seat.isHost = false;
    seat.isBot = true;
    seat.name = `${seat.name || seat.color.toUpperCase()} (Bot)`;
    broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
    scheduleTurnTimeout(room);
    return;
  }

  broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });

  // If this was an implicit disconnect (e.g. device sleep) and it is this player's turn,
  // trigger scheduleTurnTimeout so the 10s fallback prevents the match from stalling.
  if (!explicitLeave && room.status === 'playing' && room.activeColor === seat.color) {
    scheduleTurnTimeout(room);
  }
}

// Periodically prune stale inactive rooms (15 minutes without any activity)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const anyConnected = TURN_ORDER.some(
      (c) => room.seats[c].playerId && !room.seats[c].isBot && room.seats[c].connected
    );
    if (!anyConnected && now - room.lastActivityAt > 15 * 60 * 1000) {
      clearRoomTimers(room);
      rooms.delete(code);
    }
  }
}, 60_000);

async function bootstrap() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ ok: false, error: 'ROOM_NOT_FOUND' });
      return;
    }
    res.json({ ok: true, room: toRoomSnapshot(room) });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const broadcastPublicRooms = () => {
    const payload = JSON.stringify({
      type: 'room:publicList',
      rooms: getPublicRoomsSnapshot(),
    } satisfies ServerToClientEvent);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  const requireAdmin = async (
    req: express.Request,
    res: express.Response
  ): Promise<{ uid: string; email: string } | null> => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
      return null;
    }
    const verified = await verifyFirebaseTokenUser(token);
    if (!verified || !verified.emailVerified || verified.email !== ADMIN_BOOTSTRAP_EMAIL) {
      res.status(403).json({ ok: false, error: 'FORBIDDEN' });
      return null;
    }
    return { uid: verified.uid, email: verified.email };
  };

  app.get('/api/admin/live', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const liveRooms: AdminLiveRoomSummary[] = Array.from(rooms.values())
      .map((room) => {
        const seats = TURN_ORDER.map((c) => room.seats[c]);
        const hostSeat = seats.find((s) => s.playerId === room.hostPlayerId);
        return {
          code: room.code,
          status: room.status,
          isPublic: room.isPublic,
          maxPlayers: room.maxPlayers,
          stake: room.stake,
          wagerPot: room.wagerPot,
          difficulty: room.difficulty,
          hostPlayerId: room.hostPlayerId,
          hostName: hostSeat?.name || 'Hôte',
          humanCount: seats.filter((s) => Boolean(s.playerId) && !s.isBot).length,
          connectedCount: seats.filter((s) => Boolean(s.playerId) && !s.isBot && s.connected).length,
          createdAt: room.createdAt,
          lastActivityAt: room.lastActivityAt,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({
      ok: true,
      connectedSockets: wss.clients.size,
      activeWallets: wallets.size,
      rooms: liveRooms,
    });
  });

  app.post('/api/admin/rooms/:code/close', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ ok: false, error: 'ROOM_NOT_FOUND' });
      return;
    }

    clearRoomTimers(room);

    // Refund stakes if match was still active and pot had not been awarded
    if (room.status === 'playing' && !room.potAwarded && room.stake > 0) {
      for (const color of TURN_ORDER) {
        const seat = room.seats[color];
        if (seat.playerId && !seat.isBot) {
          const refunded = setWallet(seat.playerId, getWallet(seat.playerId) + room.stake);
          sendToSocket(seat.socket, { type: 'wallet:balance', coins: refunded });
        }
      }
    }

    for (const color of TURN_ORDER) {
      const seat = room.seats[color];
      if (seat.socket) {
        sendToSocket(seat.socket, {
          type: 'room:error',
          code: 'ADMIN_CLOSED',
          message: 'Cette salle a été fermée par un administrateur.',
        });
        sendToSocket(seat.socket, { type: 'room:left' });
        socketSession.delete(seat.socket);
        seat.socket = null;
      }
    }

    rooms.delete(code);
    broadcastPublicRooms();
    res.json({ ok: true, closedCode: code });
  });

  app.post('/api/admin/rooms/:code/message', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ ok: false, error: 'ROOM_NOT_FOUND' });
      return;
    }
    const text = String(req.body?.text || '').trim().slice(0, 140);
    if (!text) {
      res.status(400).json({ ok: false, error: 'EMPTY_MESSAGE' });
      return;
    }
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    broadcastRoom(room, {
      type: 'room:chatMessage',
      message: {
        id: `admin-msg-${Date.now()}`,
        sender: 'ADMIN',
        color: 'yellow',
        text,
        time,
      },
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/wallet/set', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const playerId = String(req.body?.playerId || '').trim();
    const coins = Number(req.body?.coins);
    if (!playerId || !Number.isFinite(coins) || coins < 0) {
      res.status(400).json({ ok: false, error: 'INVALID_PARAMS' });
      return;
    }
    const updated = setWallet(playerId, coins);
    for (const room of rooms.values()) {
      const seat = findSeatByPlayerId(room, playerId);
      if (seat?.socket) {
        sendToSocket(seat.socket, { type: 'wallet:balance', coins: updated });
      }
    }
    res.json({ ok: true, playerId, coins: updated });
  });

  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      let msg: ClientToServerEvent;
      try {
        msg = JSON.parse(String(raw)) as ClientToServerEvent;
      } catch {
        sendToSocket(ws, {
          type: 'room:error',
          code: 'BAD_PAYLOAD',
          message: 'Invalid message payload.',
        });
        return;
      }

      if (msg.type === 'wallet:sync') {
        if (msg.idToken && typeof msg.syncedCoins === 'number') {
          const verifiedUid = await verifyFirebaseIdToken(msg.idToken);
          if (verifiedUid && verifiedUid === msg.playerId) {
            const inActiveMatch = Array.from(rooms.values()).some(
              (r) => r.status === 'playing' && Boolean(findSeatByPlayerId(r, verifiedUid))
            );
            if (!inActiveMatch) {
              setWallet(verifiedUid, msg.syncedCoins);
            }
          }
        }
        sendToSocket(ws, { type: 'wallet:balance', coins: getWallet(msg.playerId) });
        return;
      }

      if (msg.type === 'wallet:topup') {
        let next = getWallet(msg.playerId);
        if (msg.isDaily && msg.amount === 1000 && !dailyClaimed.has(msg.playerId)) {
          dailyClaimed.add(msg.playerId);
          next = setWallet(msg.playerId, next + 1000);
        } else if (!msg.isDaily && msg.amount === 500) {
          next = setWallet(msg.playerId, next + 500);
        }
        sendToSocket(ws, { type: 'wallet:balance', coins: next });
        return;
      }

      if (msg.type === 'room:listPublic') {
        sendToSocket(ws, { type: 'room:publicList', rooms: getPublicRoomsSnapshot() });
        return;
      }

      if (msg.type === 'room:quickMatch') {
        const stake = normalizeStake(msg.stake);
        const balance = getWallet(msg.playerId);
        if (balance < stake) {
          sendToSocket(ws, {
            type: 'room:error',
            code: 'INSUFFICIENT_COINS',
            message: `Solde insuffisant pour miser ${stake} pièces.`,
          });
          return;
        }

        const cleanName = (msg.playerName || 'Joueur').trim().slice(0, 18) || 'Joueur';
        // Look for an open public room matching desired stake (or lower affordable stake)
        const candidate = Array.from(rooms.values()).find((room) => {
          if (!room.isPublic || room.status !== 'waiting') return false;
          if (room.stake !== stake) return false;
          if (findSeatByPlayerId(room, msg.playerId)) return false;
          const presetColors = getPresetColors(room.maxPlayers);
          return presetColors.some((c) => !room.seats[c].playerId);
        });

        if (candidate) {
          const presetColors = getPresetColors(candidate.maxPlayers);
          const openColor = presetColors.find((c) => !candidate.seats[c].playerId)!;
          detachSocketFromRoom(ws, true);
          candidate.seats[openColor] = {
            color: openColor,
            playerId: msg.playerId,
            name: cleanName,
            isBot: false,
            ready: true,
            connected: true,
            isHost: false,
            active: true,
            socket: ws,
          };
          candidate.lastActivityAt = Date.now();
          socketSession.set(ws, { roomCode: candidate.code, playerId: msg.playerId });
          sendToSocket(ws, { type: 'wallet:balance', coins: balance });
          broadcastRoom(candidate, { type: 'room:state', room: toRoomSnapshot(candidate) });
          broadcastPublicRooms();
          return;
        }

        // Otherwise create a new public 4-player table ready to start with bots or incoming players
        detachSocketFromRoom(ws, true);
        const code = generateRoomCode();
        const seats = createEmptySeats(4);
        seats.red = {
          color: 'red',
          playerId: msg.playerId,
          name: cleanName,
          isBot: false,
          ready: true,
          connected: true,
          isHost: true,
          active: true,
          socket: ws,
        };
        const now = Date.now();
        const room: ServerRoom = {
          code,
          status: 'waiting',
          maxPlayers: 4,
          isPublic: true,
          stake,
          wagerPot: 0,
          potAwarded: false,
          fillWithBots: true,
          difficulty: msg.difficulty === 'standard' ? 'standard' : 'pro',
          hostPlayerId: msg.playerId,
          seats,
          tokens: [],
          activeColor: 'red',
          turnPhase: 'waiting-roll',
          diceValue: 6,
          diceSpinNonce: 0,
          diceLandCoord: { x: 50, y: 50 },
          diceThrowVector: null,
          movableTokenIds: [],
          consecutiveSixes: 0,
          turnCount: 1,
          winner: null,
          timers: new Set(),
          lastActivityAt: now,
          createdAt: now,
        };
        rooms.set(code, room);
        socketSession.set(ws, { roomCode: code, playerId: msg.playerId });
        sendToSocket(ws, { type: 'wallet:balance', coins: balance });
        sendToSocket(ws, { type: 'room:state', room: toRoomSnapshot(room) });
        broadcastPublicRooms();
        return;
      }

      if (msg.type === 'room:create') {
        const stake = normalizeStake(msg.stake);
        const hostBalance = getWallet(msg.playerId);
        if (hostBalance < stake) {
          sendToSocket(ws, {
            type: 'room:error',
            code: 'INSUFFICIENT_COINS',
            message: `Solde insuffisant pour miser ${stake} pièces.`,
          });
          return;
        }

        detachSocketFromRoom(ws, true);
        const code = generateRoomCode();
        const maxPlayers: 2 | 3 | 4 =
          msg.maxPlayers === 2 || msg.maxPlayers === 3 ? msg.maxPlayers : 4;
        const cleanName = (msg.playerName || 'Host').trim().slice(0, 18) || 'Host';
        const seats = createEmptySeats(maxPlayers);

        seats.red = {
          color: 'red',
          playerId: msg.playerId,
          name: cleanName,
          isBot: false,
          ready: true,
          connected: true,
          isHost: true,
          active: true,
          socket: ws,
        };

        const now = Date.now();
        const room: ServerRoom = {
          code,
          status: 'waiting',
          maxPlayers,
          isPublic: Boolean(msg.isPublic),
          stake,
          wagerPot: 0,
          potAwarded: false,
          fillWithBots: false,
          difficulty: msg.difficulty === 'standard' ? 'standard' : 'pro',
          hostPlayerId: msg.playerId,
          seats,
          tokens: [],
          activeColor: 'red',
          turnPhase: 'waiting-roll',
          diceValue: 6,
          diceSpinNonce: 0,
          diceLandCoord: { x: 50, y: 50 },
          diceThrowVector: null,
          movableTokenIds: [],
          consecutiveSixes: 0,
          turnCount: 1,
          winner: null,
          timers: new Set(),
          lastActivityAt: now,
          createdAt: now,
        };

        rooms.set(code, room);
        socketSession.set(ws, { roomCode: code, playerId: msg.playerId });
        sendToSocket(ws, { type: 'wallet:balance', coins: hostBalance });
        sendToSocket(ws, { type: 'room:state', room: toRoomSnapshot(room) });
        if (room.isPublic) broadcastPublicRooms();
        return;
      }

      if (msg.type === 'room:join') {
        const code = String(msg.code || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendToSocket(ws, {
            type: 'room:error',
            code: 'ROOM_NOT_FOUND',
            message: 'Salle introuvable. Vérifiez le code.',
          });
          return;
        }

        const existingSeat = findSeatByPlayerId(room, msg.playerId);
        if (existingSeat) {
          detachSocketFromRoom(ws, false);
          existingSeat.socket = ws;
          existingSeat.connected = true;
          existingSeat.isBot = false;
          if (msg.playerName?.trim()) {
            existingSeat.name = msg.playerName.trim().slice(0, 18);
          }
          room.lastActivityAt = Date.now();
          socketSession.set(ws, { roomCode: code, playerId: msg.playerId });
          sendToSocket(ws, { type: 'wallet:balance', coins: getWallet(msg.playerId) });
          broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
          return;
        }

        if (room.status !== 'waiting') {
          sendToSocket(ws, {
            type: 'room:error',
            code: 'MATCH_ALREADY_STARTED',
            message: 'Cette partie a déjà commencé.',
          });
          return;
        }

        const joinerBalance = getWallet(msg.playerId);
        if (joinerBalance < room.stake) {
          sendToSocket(ws, {
            type: 'room:error',
            code: 'INSUFFICIENT_COINS',
            message: `Solde insuffisant : cette table exige ${room.stake} pièces.`,
          });
          return;
        }

        const presetColors = getPresetColors(room.maxPlayers);
        const openColor = presetColors.find((c) => !room.seats[c].playerId);
        if (!openColor) {
          sendToSocket(ws, {
            type: 'room:error',
            code: 'ROOM_FULL',
            message: 'La salle est complète.',
          });
          return;
        }

        detachSocketFromRoom(ws, true);
        const cleanName = (msg.playerName || 'Joueur').trim().slice(0, 18) || 'Joueur';
        room.seats[openColor] = {
          color: openColor,
          playerId: msg.playerId,
          name: cleanName,
          isBot: false,
          ready: true,
          connected: true,
          isHost: false,
          active: true,
          socket: ws,
        };
        room.lastActivityAt = Date.now();
        socketSession.set(ws, { roomCode: code, playerId: msg.playerId });
        sendToSocket(ws, { type: 'wallet:balance', coins: joinerBalance });
        broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
        if (room.isPublic) broadcastPublicRooms();
        return;
      }

      const session = socketSession.get(ws);
      if (!session) return;
      const room = rooms.get(session.roomCode);
      if (!room) return;
      const seat = findSeatByPlayerId(room, session.playerId);
      if (!seat) return;

      if (msg.type === 'room:leave') {
        const wasPublic = room.isPublic;
        detachSocketFromRoom(ws, true);
        sendToSocket(ws, { type: 'room:left' });
        if (wasPublic) broadcastPublicRooms();
        return;
      }

      if (msg.type === 'room:chat') {
        const cleanText = String(msg.text || '').trim().slice(0, 140);
        if (!cleanText) return;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        broadcastRoom(room, {
          type: 'room:chatMessage',
          message: {
            id: `ochat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender: seat.name || seat.color,
            color: seat.color,
            text: cleanText,
            time,
          },
        });
        return;
      }

      if (msg.type === 'room:ready' && room.status === 'waiting') {
        seat.ready = Boolean(msg.ready);
        room.lastActivityAt = Date.now();
        broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
        return;
      }

      if (
        msg.type === 'room:setStake' &&
        room.status === 'waiting' &&
        room.hostPlayerId === session.playerId
      ) {
        const nextStake = normalizeStake(msg.stake);
        if (getWallet(session.playerId) < nextStake) {
          sendToSocket(ws, {
            type: 'room:error',
            code: 'INSUFFICIENT_COINS',
            message: `Solde insuffisant pour miser ${nextStake} pièces.`,
          });
          return;
        }
        room.stake = nextStake;
        room.lastActivityAt = Date.now();
        broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
        if (room.isPublic) broadcastPublicRooms();
        return;
      }

      if (
        msg.type === 'room:toggleBots' &&
        room.status === 'waiting' &&
        room.hostPlayerId === session.playerId
      ) {
        room.fillWithBots = Boolean(msg.fillWithBots);
        if (msg.difficulty === 'standard' || msg.difficulty === 'pro') {
          room.difficulty = msg.difficulty;
        }
        room.lastActivityAt = Date.now();
        broadcastRoom(room, { type: 'room:state', room: toRoomSnapshot(room) });
        if (room.isPublic) broadcastPublicRooms();
        return;
      }

      if (msg.type === 'room:start' && room.status === 'waiting') {
        if (room.hostPlayerId !== session.playerId) return;
        const startRes = startRoomMatch(room);
        if (!startRes.ok) {
          sendToSocket(ws, {
            type: 'room:error',
            code: 'START_BLOCKED',
            message: startRes.message,
          });
        } else if (room.isPublic) {
          broadcastPublicRooms();
        }
        return;
      }

      if (msg.type === 'room:rematch' && room.status === 'finished') {
        if (room.hostPlayerId !== session.playerId) return;
        const rematchRes = startRoomMatch(room);
        if (!rematchRes.ok) {
          sendToSocket(ws, {
            type: 'room:error',
            code: 'START_BLOCKED',
            message: rematchRes.message,
          });
        }
        return;
      }

      if (msg.type === 'game:roll') {
        if (seat.color !== room.activeColor) return;
        performServerRoll(room, msg.throwVector);
        return;
      }

      if (msg.type === 'game:move') {
        if (seat.color !== room.activeColor) return;
        performServerMove(room, msg.tokenId);
      }
    });

    ws.on('close', () => {
      detachSocketFromRoom(ws, false);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Ludo Arena server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
