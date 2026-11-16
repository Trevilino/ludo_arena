import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AdminUserRecord,
  BoardThemeId,
  ColorId,
  DiceSkinId,
  FirestoreUserProfile,
  MatchMode,
  PlatformCurrency,
  PlatformSettings,
  PublicPlayerStanding,
  RoomParticipationRecord,
  ShopOrderRecord,
  TokenPurchaseRecord,
  TokenStyleId,
  WalletTransactionRecord,
} from '../types/ludo';

export const ADMIN_BOOTSTRAP_EMAIL = 'eddylinho04@gmail.com';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  shopBuyEnabled: true,
  shopSellEnabled: true,
  instantBuyCredit: true,
  buyRatePer1000Cents: 100,
  sellRatePer1000Cents: 80,
  currency: 'EUR',
  minSellCoins: 500,
  dailyBonusCoins: 1000,
  maxStake: 1000000,
  announcement: '',
};

export function formatFiatFromCents(cents: number, currency: PlatformCurrency): string {
  const safeCents = Math.max(0, Math.round(cents));
  if (currency === 'XOF') {
    return `${Math.round(safeCents).toLocaleString()} FCFA`;
  }
  const unit = currency === 'USD' ? '$' : '€';
  return `${(safeCents / 100).toFixed(2)} ${unit}`;
}

const DEFAULT_UNLOCKED = ['obsidian-glass', 'arcade-chip', 'midnight-obsidian'];
const VALID_DICE = new Set<DiceSkinId>(['obsidian-glass', 'solar-amber', 'cyber-prism']);
const VALID_TOKENS = new Set<TokenStyleId>(['arcade-chip', 'carbon-ring', 'royal-crown']);
const VALID_BOARDS = new Set<BoardThemeId>(['midnight-obsidian', 'cobalt-vault', 'emerald-circuit']);

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : fallback;
  return s.slice(0, maxLen);
}

function clampInt(val: unknown, min: number, max: number, fallback = 0): number {
  const n = Math.trunc(Number(val));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as Timestamp).toMillis === 'function') {
    return (ts as Timestamp).toMillis();
  }
  return Date.now();
}

export async function ensureUserProfile(
  user: User,
  localFallback?: {
    coins: number;
    equippedDice: DiceSkinId;
    equippedToken: TokenStyleId;
    equippedBoard: BoardThemeId;
    unlockedIds: string[];
  }
): Promise<FirestoreUserProfile> {
  const uid = user.uid;
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  const publicRef = doc(db, 'leaderboardPublic', uid);

  const safeName = clampStr(user.displayName || user.email?.split('@')[0], 50, 'Player') || 'Player';
  const safeEmail = clampStr(user.email, 120, '');
  const safePhoto = clampStr(user.photoURL, 500, '');
  const today = todayIsoDate();

  try {
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const initialCoins = clampInt(localFallback?.coins ?? 2450, 0, 10000000, 2450);
      const equippedDice = VALID_DICE.has(localFallback?.equippedDice as DiceSkinId)
        ? (localFallback!.equippedDice as DiceSkinId)
        : 'obsidian-glass';
      const equippedToken = VALID_TOKENS.has(localFallback?.equippedToken as TokenStyleId)
        ? (localFallback!.equippedToken as TokenStyleId)
        : 'arcade-chip';
      const equippedBoard = VALID_BOARDS.has(localFallback?.equippedBoard as BoardThemeId)
        ? (localFallback!.equippedBoard as BoardThemeId)
        : 'midnight-obsidian';
      const unlocked = Array.from(
        new Set([...DEFAULT_UNLOCKED, ...(localFallback?.unlockedIds ?? [])])
      )
        .map((id) => clampStr(id, 64))
        .filter(Boolean)
        .slice(0, 30);

      const newDoc = {
        uid,
        displayName: safeName,
        email: safeEmail,
        photoURL: safePhoto,
        coins: initialCoins,
        bonusClaimed: false,
        lastBonusDate: '',
        elo: 2140,
        wins: 0,
        matchesPlayed: 0,
        earnings: 0,
        equippedDice,
        equippedToken,
        equippedBoard,
        unlockedIds: unlocked,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(userRef, newDoc);

      await setDoc(publicRef, {
        uid,
        displayName: safeName,
        photoURL: safePhoto,
        elo: 2140,
        wins: 0,
        matchesPlayed: 0,
        earnings: 0,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'users', uid, 'walletTransactions'), {
        uid,
        txType: 'initial_grant',
        amount: initialCoins,
        balanceAfter: initialCoins,
        label: 'Solde initial Ludo Arena',
        referenceCode: 'INIT',
        createdAt: serverTimestamp(),
      });

      return {
        uid,
        displayName: safeName,
        email: safeEmail,
        photoURL: safePhoto,
        coins: initialCoins,
        bonusClaimed: false,
        lastBonusDate: '',
        elo: 2140,
        wins: 0,
        matchesPlayed: 0,
        earnings: 0,
        equippedDice,
        equippedToken,
        equippedBoard,
        unlockedIds: unlocked,
      };
    }

    const raw = snap.data();
    const lastBonusDate = clampStr(raw.lastBonusDate, 20, '');
    const bonusStillClaimedToday = Boolean(raw.bonusClaimed) && lastBonusDate === today;

    if (raw.displayName !== safeName || raw.photoURL !== safePhoto) {
      await updateDoc(userRef, {
        displayName: safeName,
        photoURL: safePhoto,
        updatedAt: serverTimestamp(),
      });
      await setDoc(
        publicRef,
        {
          uid,
          displayName: safeName,
          photoURL: safePhoto,
          elo: clampInt(raw.elo, 0, 100000, 2140),
          wins: clampInt(raw.wins, 0, 1000000, 0),
          matchesPlayed: clampInt(raw.matchesPlayed, 0, 1000000, 0),
          earnings: clampInt(raw.earnings, 0, 100000000, 0),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    const unlockedIds = Array.isArray(raw.unlockedIds)
      ? raw.unlockedIds.map((x) => clampStr(x, 64)).filter(Boolean).slice(0, 30)
      : [...DEFAULT_UNLOCKED];
    if (unlockedIds.length === 0) unlockedIds.push(...DEFAULT_UNLOCKED);

    return {
      uid,
      displayName: safeName,
      email: clampStr(raw.email, 120, safeEmail),
      photoURL: safePhoto,
      coins: clampInt(raw.coins, 0, 10000000, 2450),
      bonusClaimed: bonusStillClaimedToday,
      lastBonusDate,
      elo: clampInt(raw.elo, 0, 100000, 2140),
      wins: clampInt(raw.wins, 0, 1000000, 0),
      matchesPlayed: clampInt(raw.matchesPlayed, 0, 1000000, 0),
      earnings: clampInt(raw.earnings, 0, 100000000, 0),
      equippedDice: VALID_DICE.has(raw.equippedDice) ? raw.equippedDice : 'obsidian-glass',
      equippedToken: VALID_TOKENS.has(raw.equippedToken) ? raw.equippedToken : 'arcade-chip',
      equippedBoard: VALID_BOARDS.has(raw.equippedBoard) ? raw.equippedBoard : 'midnight-obsidian',
      unlockedIds,
      isSuspended: Boolean(raw.isSuspended),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function syncWalletAndStats(
  uid: string,
  payload: {
    displayName: string;
    photoURL: string;
    coins: number;
    bonusClaimed: boolean;
    lastBonusDate: string;
    elo: number;
    wins: number;
    matchesPlayed: number;
    earnings: number;
  }
): Promise<void> {
  const userPath = `users/${uid}`;
  const cleanCoins = clampInt(payload.coins, 0, 10000000, 0);
  const cleanElo = clampInt(payload.elo, 0, 100000, 2140);
  const cleanWins = clampInt(payload.wins, 0, 1000000, 0);
  const cleanMatches = clampInt(payload.matchesPlayed, 0, 1000000, 0);
  const cleanEarnings = clampInt(payload.earnings, 0, 100000000, 0);

  try {
    await updateDoc(doc(db, 'users', uid), {
      coins: cleanCoins,
      bonusClaimed: Boolean(payload.bonusClaimed),
      lastBonusDate: clampStr(payload.lastBonusDate, 20, ''),
      elo: cleanElo,
      wins: cleanWins,
      matchesPlayed: cleanMatches,
      earnings: cleanEarnings,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'leaderboardPublic', uid), {
      uid,
      displayName: clampStr(payload.displayName, 50, 'Player') || 'Player',
      photoURL: clampStr(payload.photoURL, 500, ''),
      elo: cleanElo,
      wins: cleanWins,
      matchesPlayed: cleanMatches,
      earnings: cleanEarnings,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function syncArmoryLoadout(
  uid: string,
  payload: {
    coins: number;
    unlockedIds: string[];
    equippedDice: DiceSkinId;
    equippedToken: TokenStyleId;
    equippedBoard: BoardThemeId;
  }
): Promise<void> {
  const userPath = `users/${uid}`;
  const cleanUnlocked = Array.from(new Set([...DEFAULT_UNLOCKED, ...payload.unlockedIds]))
    .map((id) => clampStr(id, 64))
    .filter(Boolean)
    .slice(0, 30);

  try {
    await updateDoc(doc(db, 'users', uid), {
      coins: clampInt(payload.coins, 0, 10000000, 0),
      unlockedIds: cleanUnlocked,
      equippedDice: VALID_DICE.has(payload.equippedDice) ? payload.equippedDice : 'obsidian-glass',
      equippedToken: VALID_TOKENS.has(payload.equippedToken) ? payload.equippedToken : 'arcade-chip',
      equippedBoard: VALID_BOARDS.has(payload.equippedBoard) ? payload.equippedBoard : 'midnight-obsidian',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function recordTokenPurchase(
  uid: string,
  entry: {
    itemId: string;
    itemName: string;
    category: 'token' | 'dice' | 'board' | 'coins-pack';
    price: number;
    balanceAfter: number;
  }
): Promise<void> {
  const colPath = `users/${uid}/tokenPurchases`;
  try {
    await addDoc(collection(db, 'users', uid, 'tokenPurchases'), {
      uid,
      itemId: clampStr(entry.itemId, 64, 'item') || 'item',
      itemName: clampStr(entry.itemName, 80, 'Item') || 'Item',
      category: entry.category,
      price: clampInt(entry.price, 0, 1000000, 0),
      balanceAfter: clampInt(entry.balanceAfter, 0, 10000000, 0),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colPath);
  }
}

export async function recordWalletTransaction(
  uid: string,
  entry: {
    txType: WalletTransactionRecord['txType'];
    amount: number;
    balanceAfter: number;
    label: string;
    referenceCode?: string;
  }
): Promise<void> {
  const colPath = `users/${uid}/walletTransactions`;
  try {
    await addDoc(collection(db, 'users', uid, 'walletTransactions'), {
      uid,
      txType: entry.txType,
      amount: clampInt(entry.amount, -10000000, 10000000, 0),
      balanceAfter: clampInt(entry.balanceAfter, 0, 10000000, 0),
      label: clampStr(entry.label, 120, 'Transaction') || 'Transaction',
      referenceCode: clampStr(entry.referenceCode ?? '', 32, ''),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colPath);
  }
}

export async function createRoomHistoryEntry(
  uid: string,
  entry: {
    roomCode: string;
    mode: MatchMode;
    role: 'host' | 'guest' | 'solo';
    myColor: ColorId;
    stake: number;
    wagerPot: number;
    netChange: number;
    playerCount: number;
    opponents: string[];
  }
): Promise<string> {
  const colPath = `users/${uid}/roomHistory`;
  try {
    const cleanOpponents = entry.opponents
      .map((name) => clampStr(name, 50))
      .filter(Boolean)
      .slice(0, 4);

    const ref = await addDoc(collection(db, 'users', uid, 'roomHistory'), {
      uid,
      roomCode: clampStr(entry.roomCode, 20, 'LOCAL') || 'LOCAL',
      mode: entry.mode,
      role: entry.role,
      myColor: entry.myColor,
      stake: clampInt(entry.stake, 0, 1000000, 0),
      wagerPot: clampInt(entry.wagerPot, 0, 4000000, 0),
      outcome: 'joined',
      netChange: clampInt(entry.netChange, -1000000, 4000000, 0),
      winnerName: '',
      playerCount: clampInt(entry.playerCount, 2, 4, 2),
      opponents: cleanOpponents,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colPath);
  }
}

export async function finalizeRoomHistoryEntry(
  uid: string,
  historyId: string,
  patch: {
    outcome: 'win' | 'loss' | 'abandoned';
    wagerPot: number;
    netChange: number;
    winnerName: string;
    playerCount: number;
    opponents: string[];
  }
): Promise<void> {
  const docPath = `users/${uid}/roomHistory/${historyId}`;
  try {
    const cleanOpponents = patch.opponents
      .map((name) => clampStr(name, 50))
      .filter(Boolean)
      .slice(0, 4);

    await updateDoc(doc(db, 'users', uid, 'roomHistory', historyId), {
      outcome: patch.outcome,
      wagerPot: clampInt(patch.wagerPot, 0, 4000000, 0),
      netChange: clampInt(patch.netChange, -1000000, 4000000, 0),
      winnerName: clampStr(patch.winnerName, 50, ''),
      playerCount: clampInt(patch.playerCount, 2, 4, 2),
      opponents: cleanOpponents,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export function subscribeUserData(
  uid: string,
  callbacks: {
    onProfile: (profile: FirestoreUserProfile) => void;
    onPurchases: (items: TokenPurchaseRecord[]) => void;
    onRoomHistory: (items: RoomParticipationRecord[]) => void;
    onWalletTxs: (items: WalletTransactionRecord[]) => void;
    onLeaderboard: (items: PublicPlayerStanding[]) => void;
  }
): Unsubscribe {
  const today = todayIsoDate();

  const unsubProfile = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) return;
      const raw = snap.data();
      const lastBonusDate = clampStr(raw.lastBonusDate, 20, '');
      const unlockedIds = Array.isArray(raw.unlockedIds)
        ? raw.unlockedIds.map((x) => clampStr(x, 64)).filter(Boolean).slice(0, 30)
        : [...DEFAULT_UNLOCKED];
      if (unlockedIds.length === 0) unlockedIds.push(...DEFAULT_UNLOCKED);

      callbacks.onProfile({
        uid,
        displayName: clampStr(raw.displayName, 50, 'Player') || 'Player',
        email: clampStr(raw.email, 120, ''),
        photoURL: clampStr(raw.photoURL, 500, ''),
        coins: clampInt(raw.coins, 0, 10000000, 2450),
        bonusClaimed: Boolean(raw.bonusClaimed) && lastBonusDate === today,
        lastBonusDate,
        elo: clampInt(raw.elo, 0, 100000, 2140),
        wins: clampInt(raw.wins, 0, 1000000, 0),
        matchesPlayed: clampInt(raw.matchesPlayed, 0, 1000000, 0),
        earnings: clampInt(raw.earnings, 0, 100000000, 0),
        equippedDice: VALID_DICE.has(raw.equippedDice) ? raw.equippedDice : 'obsidian-glass',
        equippedToken: VALID_TOKENS.has(raw.equippedToken) ? raw.equippedToken : 'arcade-chip',
        equippedBoard: VALID_BOARDS.has(raw.equippedBoard) ? raw.equippedBoard : 'midnight-obsidian',
        unlockedIds,
        isSuspended: Boolean(raw.isSuspended),
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
  );

  const purchasesPath = `users/${uid}/tokenPurchases`;
  const unsubPurchases = onSnapshot(
    query(collection(db, 'users', uid, 'tokenPurchases'), where('uid', '==', uid), limit(50)),
    (snap) => {
      const list: TokenPurchaseRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid || uid),
            itemId: String(data.itemId || ''),
            itemName: String(data.itemName || ''),
            category: data.category as TokenPurchaseRecord['category'],
            price: Number(data.price || 0),
            balanceAfter: Number(data.balanceAfter || 0),
            createdAtMs: toMillis(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      callbacks.onPurchases(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, purchasesPath)
  );

  const roomsPath = `users/${uid}/roomHistory`;
  const unsubRooms = onSnapshot(
    query(collection(db, 'users', uid, 'roomHistory'), where('uid', '==', uid), limit(50)),
    (snap) => {
      const list: RoomParticipationRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid || uid),
            roomCode: String(data.roomCode || ''),
            mode: data.mode as MatchMode,
            role: data.role as RoomParticipationRecord['role'],
            myColor: data.myColor as ColorId,
            stake: Number(data.stake || 0),
            wagerPot: Number(data.wagerPot || 0),
            outcome: data.outcome as RoomParticipationRecord['outcome'],
            netChange: Number(data.netChange || 0),
            winnerName: String(data.winnerName || ''),
            playerCount: Number(data.playerCount || 2),
            opponents: Array.isArray(data.opponents) ? data.opponents.map(String) : [],
            createdAtMs: toMillis(data.createdAt),
            updatedAtMs: toMillis(data.updatedAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      callbacks.onRoomHistory(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, roomsPath)
  );

  const txPath = `users/${uid}/walletTransactions`;
  const unsubTxs = onSnapshot(
    query(collection(db, 'users', uid, 'walletTransactions'), where('uid', '==', uid), limit(60)),
    (snap) => {
      const list: WalletTransactionRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid || uid),
            txType: data.txType as WalletTransactionRecord['txType'],
            amount: Number(data.amount || 0),
            balanceAfter: Number(data.balanceAfter || 0),
            label: String(data.label || ''),
            referenceCode: String(data.referenceCode || ''),
            createdAtMs: toMillis(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      callbacks.onWalletTxs(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, txPath)
  );

  const leaderboardPath = 'leaderboardPublic';
  const unsubLeaderboard = onSnapshot(
    query(
      collection(db, 'leaderboardPublic'),
      where('elo', '>=', 0),
      orderBy('elo', 'desc'),
      limit(25)
    ),
    (snap) => {
      const list: PublicPlayerStanding[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'Player'),
          photoURL: String(data.photoURL || ''),
          elo: Number(data.elo || 2140),
          wins: Number(data.wins || 0),
          matchesPlayed: Number(data.matchesPlayed || 0),
          earnings: Number(data.earnings || 0),
        };
      });
      callbacks.onLeaderboard(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, leaderboardPath)
  );

  return () => {
    unsubProfile();
    unsubPurchases();
    unsubRooms();
    unsubTxs();
    unsubLeaderboard();
  };
}

function parsePlatformSettings(raw: Record<string, unknown> | undefined): PlatformSettings {
  if (!raw) return DEFAULT_PLATFORM_SETTINGS;
  const currency: PlatformCurrency =
    raw.currency === 'USD' || raw.currency === 'XOF' ? raw.currency : 'EUR';
  return {
    maintenanceMode: Boolean(raw.maintenanceMode),
    shopBuyEnabled: raw.shopBuyEnabled === undefined ? true : Boolean(raw.shopBuyEnabled),
    shopSellEnabled: raw.shopSellEnabled === undefined ? true : Boolean(raw.shopSellEnabled),
    instantBuyCredit: raw.instantBuyCredit === undefined ? true : Boolean(raw.instantBuyCredit),
    buyRatePer1000Cents: clampInt(raw.buyRatePer1000Cents, 1, 10000000, 100),
    sellRatePer1000Cents: clampInt(raw.sellRatePer1000Cents, 1, 10000000, 80),
    currency,
    minSellCoins: clampInt(raw.minSellCoins, 1, 1000000, 500),
    dailyBonusCoins: clampInt(raw.dailyBonusCoins, 0, 100000, 1000),
    maxStake: clampInt(raw.maxStake, 0, 10000000, 1000000),
    announcement: clampStr(raw.announcement, 200, ''),
  };
}

export function subscribePlatformSettings(
  onSettings: (settings: PlatformSettings) => void
): Unsubscribe {
  const settingsPath = 'platformConfig/settings';
  return onSnapshot(
    doc(db, 'platformConfig', 'settings'),
    (snap) => {
      if (!snap.exists()) {
        onSettings(DEFAULT_PLATFORM_SETTINGS);
        return;
      }
      onSettings(parsePlatformSettings(snap.data()));
    },
    (error) => handleFirestoreError(error, OperationType.GET, settingsPath)
  );
}

export async function createShopOrder(
  uid: string,
  entry: {
    displayName: string;
    orderType: 'buy' | 'sell';
    coinsAmount: number;
    fiatCents: number;
    currency: PlatformCurrency;
    paymentMethod: string;
    payoutDetails: string;
    status: 'pending' | 'completed';
  }
): Promise<string> {
  const colPath = 'shopOrders';
  try {
    const ref = await addDoc(collection(db, 'shopOrders'), {
      uid,
      displayName: clampStr(entry.displayName, 50, 'Player') || 'Player',
      orderType: entry.orderType,
      coinsAmount: clampInt(entry.coinsAmount, 1, 10000000, 1000),
      fiatCents: clampInt(entry.fiatCents, 0, 100000000, 0),
      currency: entry.currency,
      paymentMethod: clampStr(entry.paymentMethod, 40, 'Carte') || 'Carte',
      payoutDetails: clampStr(entry.payoutDetails, 120, ''),
      status: entry.status === 'completed' && entry.orderType === 'buy' ? 'completed' : 'pending',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colPath);
  }
}

export function subscribeUserShopOrders(
  uid: string,
  onOrders: (orders: ShopOrderRecord[]) => void
): Unsubscribe {
  const path = 'shopOrders';
  return onSnapshot(
    query(collection(db, 'shopOrders'), where('uid', '==', uid), limit(40)),
    (snap) => {
      const list: ShopOrderRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid || uid),
            displayName: String(data.displayName || 'Player'),
            orderType: (data.orderType === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell',
            coinsAmount: Number(data.coinsAmount || 0),
            fiatCents: Number(data.fiatCents || 0),
            currency: (data.currency === 'USD' || data.currency === 'XOF'
              ? data.currency
              : 'EUR') as PlatformCurrency,
            paymentMethod: String(data.paymentMethod || ''),
            payoutDetails: String(data.payoutDetails || ''),
            status: (data.status === 'completed' || data.status === 'rejected'
              ? data.status
              : 'pending') as ShopOrderRecord['status'],
            adminNote: String(data.adminNote || ''),
            createdAtMs: toMillis(data.createdAt),
            updatedAtMs: toMillis(data.updatedAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onOrders(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function checkIsAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === ADMIN_BOOTSTRAP_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export function subscribeAdminDashboard(callbacks: {
  onUsers: (users: FirestoreUserProfile[]) => void;
  onOrders: (orders: ShopOrderRecord[]) => void;
  onAdmins: (admins: AdminUserRecord[]) => void;
}): Unsubscribe {
  const unsubUsers = onSnapshot(
    query(collection(db, 'users'), where('uid', '>=', ''), limit(150)),
    (snap) => {
      const list: FirestoreUserProfile[] = snap.docs
        .map((d) => {
          const raw = d.data();
          const unlockedIds = Array.isArray(raw.unlockedIds)
            ? raw.unlockedIds.map((x) => clampStr(x, 64)).filter(Boolean).slice(0, 30)
            : [...DEFAULT_UNLOCKED];
          return {
            uid: String(raw.uid || d.id),
            displayName: String(raw.displayName || 'Player'),
            email: String(raw.email || ''),
            photoURL: String(raw.photoURL || ''),
            coins: Number(raw.coins || 0),
            bonusClaimed: Boolean(raw.bonusClaimed),
            lastBonusDate: String(raw.lastBonusDate || ''),
            elo: Number(raw.elo || 2140),
            wins: Number(raw.wins || 0),
            matchesPlayed: Number(raw.matchesPlayed || 0),
            earnings: Number(raw.earnings || 0),
            equippedDice: VALID_DICE.has(raw.equippedDice) ? raw.equippedDice : 'obsidian-glass',
            equippedToken: VALID_TOKENS.has(raw.equippedToken) ? raw.equippedToken : 'arcade-chip',
            equippedBoard: VALID_BOARDS.has(raw.equippedBoard) ? raw.equippedBoard : 'midnight-obsidian',
            unlockedIds,
            isSuspended: Boolean(raw.isSuspended),
          };
        })
        .sort((a, b) => b.coins - a.coins);
      callbacks.onUsers(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'users')
  );

  const unsubOrders = onSnapshot(
    query(collection(db, 'shopOrders'), limit(150)),
    (snap) => {
      const list: ShopOrderRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid || ''),
            displayName: String(data.displayName || 'Player'),
            orderType: (data.orderType === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell',
            coinsAmount: Number(data.coinsAmount || 0),
            fiatCents: Number(data.fiatCents || 0),
            currency: (data.currency === 'USD' || data.currency === 'XOF'
              ? data.currency
              : 'EUR') as PlatformCurrency,
            paymentMethod: String(data.paymentMethod || ''),
            payoutDetails: String(data.payoutDetails || ''),
            status: (data.status === 'completed' || data.status === 'rejected'
              ? data.status
              : 'pending') as ShopOrderRecord['status'],
            adminNote: String(data.adminNote || ''),
            createdAtMs: toMillis(data.createdAt),
            updatedAtMs: toMillis(data.updatedAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      callbacks.onOrders(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'shopOrders')
  );

  const unsubAdmins = onSnapshot(
    query(collection(db, 'admins'), where('uid', '>=', ''), limit(50)),
    (snap) => {
      const list: AdminUserRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          email: String(data.email || ''),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      callbacks.onAdmins(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'admins')
  );

  return () => {
    unsubUsers();
    unsubOrders();
    unsubAdmins();
  };
}

export async function adminSavePlatformSettings(settings: PlatformSettings): Promise<void> {
  const path = 'platformConfig/settings';
  try {
    await setDoc(doc(db, 'platformConfig', 'settings'), {
      maintenanceMode: Boolean(settings.maintenanceMode),
      shopBuyEnabled: Boolean(settings.shopBuyEnabled),
      shopSellEnabled: Boolean(settings.shopSellEnabled),
      instantBuyCredit: Boolean(settings.instantBuyCredit),
      buyRatePer1000Cents: clampInt(settings.buyRatePer1000Cents, 1, 10000000, 100),
      sellRatePer1000Cents: clampInt(settings.sellRatePer1000Cents, 1, 10000000, 80),
      currency: settings.currency,
      minSellCoins: clampInt(settings.minSellCoins, 1, 1000000, 500),
      dailyBonusCoins: clampInt(settings.dailyBonusCoins, 0, 100000, 1000),
      maxStake: clampInt(settings.maxStake, 0, 10000000, 1000000),
      announcement: clampStr(settings.announcement, 200, ''),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminUpdateUserAccount(
  targetUser: FirestoreUserProfile,
  patch: {
    coins: number;
    elo: number;
    isSuspended: boolean;
    reasonLabel?: string;
  }
): Promise<void> {
  const path = `users/${targetUser.uid}`;
  const cleanCoins = clampInt(patch.coins, 0, 10000000, targetUser.coins);
  const cleanElo = clampInt(patch.elo, 0, 100000, targetUser.elo);
  const delta = cleanCoins - targetUser.coins;

  try {
    await updateDoc(doc(db, 'users', targetUser.uid), {
      coins: cleanCoins,
      elo: cleanElo,
      isSuspended: Boolean(patch.isSuspended),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'leaderboardPublic', targetUser.uid), {
      uid: targetUser.uid,
      displayName: clampStr(targetUser.displayName, 50, 'Player') || 'Player',
      photoURL: clampStr(targetUser.photoURL, 500, ''),
      elo: cleanElo,
      wins: clampInt(targetUser.wins, 0, 1000000, 0),
      matchesPlayed: clampInt(targetUser.matchesPlayed, 0, 1000000, 0),
      earnings: clampInt(targetUser.earnings, 0, 100000000, 0),
      updatedAt: serverTimestamp(),
    });

    if (delta !== 0) {
      await recordWalletTransaction(targetUser.uid, {
        txType: 'admin_adjust',
        amount: delta,
        balanceAfter: cleanCoins,
        label: clampStr(patch.reasonLabel || 'Ajustement administrateur', 120),
        referenceCode: 'ADMIN',
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminProcessShopOrder(
  order: ShopOrderRecord,
  decision: 'completed' | 'rejected',
  adminNote: string
): Promise<number | null> {
  const orderPath = `shopOrders/${order.id}`;
  try {
    await updateDoc(doc(db, 'shopOrders', order.id), {
      status: decision,
      adminNote: clampStr(adminNote, 160, ''),
      updatedAt: serverTimestamp(),
    });

    const needsCredit =
      (order.orderType === 'buy' && decision === 'completed') ||
      (order.orderType === 'sell' && decision === 'rejected');

    if (!needsCredit) return null;

    const userRef = doc(db, 'users', order.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;

    const currentCoins = clampInt(userSnap.data().coins, 0, 10000000, 0);
    const nextCoins = clampInt(currentCoins + order.coinsAmount, 0, 10000000, currentCoins);

    await updateDoc(userRef, {
      coins: nextCoins,
      updatedAt: serverTimestamp(),
    });

    await recordWalletTransaction(order.uid, {
      txType: order.orderType === 'buy' ? 'coin_buy' : 'coin_refund',
      amount: order.coinsAmount,
      balanceAfter: nextCoins,
      label:
        order.orderType === 'buy'
          ? `Achat validé (${order.coinsAmount.toLocaleString()} pièces)`
          : `Remboursement vente refusée (${order.coinsAmount.toLocaleString()} pièces)`,
      referenceCode: order.id.slice(0, 12).toUpperCase(),
    });

    return nextCoins;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, orderPath);
  }
}

export async function adminGrantAdminRole(targetUid: string, email: string): Promise<void> {
  const path = `admins/${targetUid}`;
  try {
    await setDoc(doc(db, 'admins', targetUid), {
      uid: clampStr(targetUid, 128),
      email: clampStr(email, 120),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminRevokeAdminRole(targetUid: string): Promise<void> {
  const path = `admins/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'admins', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
