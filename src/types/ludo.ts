export type ColorId = 'red' | 'green' | 'yellow' | 'blue';

export type ScreenId = 'arena' | 'tournaments' | 'leaderboard' | 'inventory' | 'social';

export type MatchMode = 'quick-4p' | 'duel-2p' | 'pass-play' | 'online';

export type OnlineRoomStatus = 'waiting' | 'playing' | 'finished';
export type OnlineTurnPhase = 'waiting-roll' | 'rolling' | 'waiting-move' | 'animating';

export interface OnlineSeatSnapshot {
  color: ColorId;
  playerId: string | null;
  name: string;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  active: boolean;
}

export interface PublicRoomSummary {
  code: string;
  hostName: string;
  maxPlayers: 2 | 3 | 4;
  playerCount: number;
  stake: number;
  difficulty: BotDifficulty;
  fillWithBots: boolean;
  createdAt: number;
}

export interface OnlineRoomSnapshot {
  code: string;
  status: OnlineRoomStatus;
  maxPlayers: 2 | 3 | 4;
  isPublic: boolean;
  stake: number;
  wagerPot: number;
  fillWithBots: boolean;
  difficulty: BotDifficulty;
  hostPlayerId: string;
  seats: Record<ColorId, OnlineSeatSnapshot>;
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
  createdAt: number;
}

export type ServerToClientEvent =
  | { type: 'wallet:balance'; coins: number }
  | { type: 'room:publicList'; rooms: PublicRoomSummary[] }
  | {
      type: 'room:chatMessage';
      message: { id: string; sender: string; color: ColorId; text: string; time: string };
    }
  | { type: 'room:state'; room: OnlineRoomSnapshot }
  | {
      type: 'game:diceRolled';
      room: OnlineRoomSnapshot;
      color: ColorId;
      roll: number;
      landCoord: { x: number; y: number };
      throwVector: DiceThrowVector | null;
      diceSpinNonce: number;
    }
  | {
      type: 'game:tokenMoved';
      room: OnlineRoomSnapshot;
      actorColor: ColorId;
      tokenId: string;
      diceValue: number;
      deployedFromBase: boolean;
      reachedHome: boolean;
      landedSafe: boolean;
      capturedVictims: { id: string; color: ColorId; progress: number }[];
      bonusTurn: boolean;
      winner: ColorId | null;
      updatedTokens: Token[];
    }
  | { type: 'room:left' }
  | { type: 'room:error'; code: string; message: string };

export type ClientToServerEvent =
  | {
      type: 'wallet:sync';
      playerId: string;
      idToken?: string;
      syncedCoins?: number;
    }
  | {
      type: 'wallet:topup';
      playerId: string;
      amount: 500 | 1000;
      isDaily?: boolean;
      idToken?: string;
    }
  | {
      type: 'room:create';
      playerId: string;
      playerName: string;
      maxPlayers: 2 | 3 | 4;
      stake: number;
      difficulty: BotDifficulty;
      isPublic?: boolean;
    }
  | {
      type: 'room:join';
      code: string;
      playerId: string;
      playerName: string;
    }
  | { type: 'room:listPublic' }
  | {
      type: 'room:quickMatch';
      playerId: string;
      playerName: string;
      stake: number;
      difficulty: BotDifficulty;
    }
  | { type: 'room:chat'; text: string }
  | { type: 'room:ready'; ready: boolean }
  | { type: 'room:setStake'; stake: number }
  | { type: 'room:toggleBots'; fillWithBots: boolean; difficulty?: BotDifficulty }
  | { type: 'room:start' }
  | { type: 'room:rematch' }
  | { type: 'room:leave' }
  | { type: 'game:roll'; throwVector?: DiceThrowVector }
  | { type: 'game:move'; tokenId: string };

export type BotDifficulty = 'standard' | 'pro';

export type DiceSkinId = 'obsidian-glass' | 'solar-amber' | 'cyber-prism';

export type TokenStyleId = 'arcade-chip' | 'carbon-ring' | 'royal-crown';

export type BoardThemeId = 'midnight-obsidian' | 'cobalt-vault' | 'emerald-circuit';

export type DiceRollPhase = 'idle' | 'rolling-to-board' | 'landed-on-board' | 'returning-to-seat';

export interface DiceThrowVector {
  startPct: { x: number; y: number };
  velocityPctPerSec: { vx: number; vy: number };
  power: number;
}

export interface Token {
  id: string;
  color: ColorId;
  index: number; // 0..3
  progress: number; // -1 = base, 0..50 = outer track, 51..55 = home stretch, 56 = finished home
}

export type SeatType = 'human' | 'bot' | 'off';

export interface LocalSeatConfig {
  color: ColorId;
  name: string;
  seatType: SeatType;
}

export interface PlayerConfig {
  color: ColorId;
  name: string;
  handle: string;
  rank: number;
  elo: number;
  isHuman: boolean;
  avatar: string;
  active: boolean;
}

export interface MatchEvent {
  id: string;
  timestamp: string;
  color: ColorId | 'system';
  message: string;
  type: 'roll' | 'move' | 'capture' | 'home' | 'system' | 'win';
}

export interface ChatMessage {
  id: string;
  sender: string;
  color: ColorId | 'system';
  text: string;
  time: string;
}

export interface TournamentItem {
  id: string;
  title: string;
  subtitle: string;
  entryFee: number;
  prizePool: number;
  playersJoined: number;
  maxPlayers: number;
  mode: MatchMode;
  status: 'Registering' | 'Live Now' | 'Upcoming';
  startsIn: string;
  difficulty: BotDifficulty;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  handle: string;
  avatar: string;
  color: ColorId;
  elo: number;
  wins: number;
  matches: number;
  earnings: number;
  scope: 'global' | 'friends' | 'weekly';
}

export interface LoadoutItem {
  id: string;
  category: 'dice' | 'token' | 'board';
  name: string;
  description: string;
  price: number;
  rarity: 'Standard' | 'Rare' | 'Mythic';
  previewAccent: string;
}

export interface FriendEntry {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  color: ColorId;
  elo: number;
  status: 'Online' | 'In Match' | 'Away';
  record: string;
  difficulty: BotDifficulty;
}

export interface FirestoreUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  coins: number;
  bonusClaimed: boolean;
  lastBonusDate: string;
  elo: number;
  wins: number;
  matchesPlayed: number;
  earnings: number;
  equippedDice: DiceSkinId;
  equippedToken: TokenStyleId;
  equippedBoard: BoardThemeId;
  unlockedIds: string[];
  isSuspended?: boolean;
}

export interface TokenPurchaseRecord {
  id: string;
  uid: string;
  itemId: string;
  itemName: string;
  category: 'token' | 'dice' | 'board' | 'coins-pack';
  price: number;
  balanceAfter: number;
  createdAtMs: number;
}

export interface RoomParticipationRecord {
  id: string;
  uid: string;
  roomCode: string;
  mode: MatchMode;
  role: 'host' | 'guest' | 'solo';
  myColor: ColorId;
  stake: number;
  wagerPot: number;
  outcome: 'win' | 'loss' | 'joined' | 'abandoned';
  netChange: number;
  winnerName: string;
  playerCount: number;
  opponents: string[];
  createdAtMs: number;
  updatedAtMs: number;
}

export interface WalletTransactionRecord {
  id: string;
  uid: string;
  txType:
    | 'stake_debit'
    | 'pot_win'
    | 'shop_purchase'
    | 'topup'
    | 'daily_bonus'
    | 'initial_grant'
    | 'coin_buy'
    | 'coin_sell'
    | 'coin_refund'
    | 'admin_adjust';
  amount: number;
  balanceAfter: number;
  label: string;
  referenceCode: string;
  createdAtMs: number;
}

export interface PublicPlayerStanding {
  uid: string;
  displayName: string;
  photoURL: string;
  elo: number;
  wins: number;
  matchesPlayed: number;
  earnings: number;
}

export type PlatformCurrency = 'EUR' | 'USD' | 'XOF';

export interface PlatformSettings {
  maintenanceMode: boolean;
  shopBuyEnabled: boolean;
  shopSellEnabled: boolean;
  instantBuyCredit: boolean;
  buyRatePer1000Cents: number;
  sellRatePer1000Cents: number;
  currency: PlatformCurrency;
  minSellCoins: number;
  dailyBonusCoins: number;
  maxStake: number;
  announcement: string;
}

export interface ShopOrderRecord {
  id: string;
  uid: string;
  displayName: string;
  orderType: 'buy' | 'sell';
  coinsAmount: number;
  fiatCents: number;
  currency: PlatformCurrency;
  paymentMethod: string;
  payoutDetails: string;
  status: 'pending' | 'completed' | 'rejected';
  adminNote: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AdminUserRecord {
  uid: string;
  email: string;
  createdAtMs: number;
}

export interface AdminLiveRoomSummary {
  code: string;
  status: OnlineRoomStatus;
  isPublic: boolean;
  maxPlayers: 2 | 3 | 4;
  stake: number;
  wagerPot: number;
  difficulty: BotDifficulty;
  hostPlayerId: string;
  hostName: string;
  humanCount: number;
  connectedCount: number;
  createdAt: number;
  lastActivityAt: number;
}
