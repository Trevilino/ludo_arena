import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Coins,
  Crown,
  Dices,
  Globe,
  Megaphone,
  Plus,
  ShoppingBag,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AccountHistoryModal } from './components/AccountHistoryModal';
import { AdminScreen } from './components/AdminScreen';
import { ArenaScreen } from './components/ArenaScreen';
import { CoinTopUpModal } from './components/CoinTopUpModal';
import { InventoryScreen } from './components/InventoryScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { PlayerAvatar } from './components/PlayerAvatar';
import { RightTelemetryPanel } from './components/RightTelemetryPanel';
import { SocialScreen } from './components/SocialScreen';
import { TournamentsScreen } from './components/TournamentsScreen';
import { DEFAULT_PLAYERS } from './data/mockArenaData';
import { auth, signInWithGoogle, signOutFirebase } from './firebase';
import { fmt, Language, TRANSLATIONS } from './i18n/translations';
import {
  BoardThemeId,
  BotDifficulty,
  ChatMessage,
  ColorId,
  DiceRollPhase,
  DiceSkinId,
  DiceThrowVector,
  FirestoreUserProfile,
  FriendEntry,
  LoadoutItem,
  LocalSeatConfig,
  MatchEvent,
  MatchMode,
  OnlineRoomSnapshot,
  PlatformSettings,
  PlayerConfig,
  PublicPlayerStanding,
  PublicRoomSummary,
  RoomParticipationRecord,
  ScreenId,
  ServerToClientEvent,
  ShopOrderRecord,
  Token,
  TokenPurchaseRecord,
  TokenStyleId,
  TournamentItem,
  WalletTransactionRecord,
} from './types/ludo';
import {
  checkIsAdmin,
  createRoomHistoryEntry,
  createShopOrder,
  DEFAULT_PLATFORM_SETTINGS,
  ensureUserProfile,
  finalizeRoomHistoryEntry,
  recordTokenPurchase,
  recordWalletTransaction,
  subscribePlatformSettings,
  subscribeUserData,
  subscribeUserShopOrders,
  syncArmoryLoadout,
  syncWalletAndStats,
} from './utils/firestoreService';
import {
  chooseBestBotMove,
  createInitialTokens,
  executeTokenMove,
  getMovableTokenIds,
} from './utils/ludoEngine';
import {
  clearActiveSession,
  getActiveSession,
  getOrCreatePlayerId,
  OnlineRoomSocket,
  saveActiveSession,
} from './utils/onlineClient';
import { soundFX } from './utils/sound';

const TURN_ORDER: ColorId[] = ['red', 'green', 'yellow', 'blue'];

function nowStamp(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildPlayersForMode(
  mode: MatchMode,
  customOpponent?: FriendEntry,
  customSeats?: LocalSeatConfig[],
  accountProfile?: { name: string; avatar: string }
): Record<ColorId, PlayerConfig> {
  const redBase = {
    ...DEFAULT_PLAYERS.red,
    name: accountProfile?.name?.trim() || DEFAULT_PLAYERS.red.name,
    avatar: accountProfile?.avatar || DEFAULT_PLAYERS.red.avatar,
  };

  if (mode === 'pass-play' && customSeats && customSeats.length > 0) {
    const map = {} as Record<ColorId, PlayerConfig>;
    for (const color of TURN_ORDER) {
      const seat = customSeats.find((s) => s.color === color);
      const base = color === 'red' ? redBase : DEFAULT_PLAYERS[color];
      if (!seat) {
        map[color] = { ...base, isHuman: true, active: true };
      } else {
        const cleanName = seat.name.trim() || base.name;
        map[color] = {
          ...base,
          name: cleanName,
          isHuman: seat.seatType === 'human',
          active: seat.seatType !== 'off',
        };
      }
    }
    return map;
  }

  return {
    red: { ...redBase, isHuman: true, active: true },
    green: {
      ...DEFAULT_PLAYERS.green,
      isHuman: mode === 'pass-play',
      active: mode !== 'duel-2p',
    },
    yellow: {
      ...(customOpponent
        ? {
            color: 'yellow',
            name: customOpponent.name,
            handle: customOpponent.handle,
            rank: 40,
            elo: customOpponent.elo,
            avatar: customOpponent.avatar,
          }
        : DEFAULT_PLAYERS.yellow),
      isHuman: mode === 'pass-play',
      active: true,
    },
    blue: {
      ...DEFAULT_PLAYERS.blue,
      isHuman: mode === 'pass-play',
      active: mode !== 'duel-2p',
    },
  };
}

function getInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem('ludo_arena_lang');
    if (saved === 'fr' || saved === 'en') return saved;
    if (window.navigator.language?.toLowerCase().startsWith('fr')) return 'fr';
  }
  return 'fr';
}

export default function App() {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const t = TRANSLATIONS[language];

  const toggleLanguage = useCallback(() => {
    soundFX.playClick();
    setLanguage((prev) => {
      const next: Language = prev === 'fr' ? 'en' : 'fr';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('ludo_arena_lang', next);
      }
      return next;
    });
  }, []);

  // Navigation & UI Preferences
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [activeScreen, setActiveScreen] = useState<ScreenId>('arena');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [coinModalOpen, setCoinModalOpen] = useState(false);

  const navigateTo = useCallback((nextPath: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setPathname(nextPath);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  // Firebase Auth & Firestore Persistence State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [firestoreProfile, setFirestoreProfile] = useState<FirestoreUserProfile | null>(null);
  const [tokenPurchases, setTokenPurchases] = useState<TokenPurchaseRecord[]>([]);
  const [roomHistory, setRoomHistory] = useState<RoomParticipationRecord[]>([]);
  const [walletTxs, setWalletTxs] = useState<WalletTransactionRecord[]>([]);
  const [publicStandings, setPublicStandings] = useState<PublicPlayerStanding[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(
    DEFAULT_PLATFORM_SETTINGS
  );
  const [shopOrders, setShopOrders] = useState<ShopOrderRecord[]>([]);

  const accountName = useMemo(
    () =>
      (firestoreProfile?.displayName || firebaseUser?.displayName || DEFAULT_PLAYERS.red.name).trim(),
    [firestoreProfile?.displayName, firebaseUser?.displayName]
  );
  const accountAvatar = useMemo(
    () => firestoreProfile?.photoURL || firebaseUser?.photoURL || DEFAULT_PLAYERS.red.avatar,
    [firestoreProfile?.photoURL, firebaseUser?.photoURL]
  );

  // Player Economy & Loadout
  const [coins, setCoins] = useState(2450);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [userWins, setUserWins] = useState(0);
  const [userEarnings, setUserEarnings] = useState(0);
  const [userElo, setUserElo] = useState(2140);
  const [userMatchesPlayed, setUserMatchesPlayed] = useState(0);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([
    'obsidian-glass',
    'arcade-chip',
    'midnight-obsidian',
  ]);
  const [equippedDice, setEquippedDice] = useState<DiceSkinId>('obsidian-glass');
  const [equippedToken, setEquippedToken] = useState<TokenStyleId>('arcade-chip');
  const [equippedBoard, setEquippedBoard] = useState<BoardThemeId>('midnight-obsidian');
  const [joinedTournamentIds, setJoinedTournamentIds] = useState<string[]>([]);

  // Match Config State
  const [matchMode, setMatchMode] = useState<MatchMode>('quick-4p');
  const [stake, setStake] = useState<number>(250);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('pro');
  const [matchActive, setMatchActive] = useState<boolean>(false);
  const [matchTitle, setMatchTitle] = useState<string>(() => TRANSLATIONS[getInitialLanguage()].board.titles.quick4p);
  const [wagerPot, setWagerPot] = useState<number>(1000);
  const [lastLocalSeats, setLastLocalSeats] = useState<LocalSeatConfig[] | undefined>(undefined);

  // Online Private & Public Room State
  const [guestPlayerId] = useState<string>(() => getOrCreatePlayerId());
  const onlineMyPlayerId = firebaseUser?.uid ?? guestPlayerId;
  const [initialJoinCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const param = new URLSearchParams(window.location.search).get('room');
    const clean = param?.trim().toUpperCase();
    return clean && clean.length >= 4 && clean.length <= 8 ? clean : null;
  });
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [onlineChatMessages, setOnlineChatMessages] = useState<
    { id: string; sender: string; color: ColorId; text: string; time: string }[]
  >([]);
  const [onlineConnected, setOnlineConnected] = useState<boolean>(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  // Live Ludo Board State
  const [players, setPlayers] = useState<Record<ColorId, PlayerConfig>>(() =>
    buildPlayersForMode('quick-4p')
  );
  const [tokens, setTokens] = useState<Token[]>(() =>
    createInitialTokens(['red', 'green', 'yellow', 'blue'])
  );
  const [activeColor, setActiveColor] = useState<ColorId>('red');
  const [diceValue, setDiceValue] = useState<number>(6);
  const [dicePhase, setDicePhase] = useState<DiceRollPhase>('idle');
  const [diceSpinNonce, setDiceSpinNonce] = useState<number>(0);
  const [diceLandCoord, setDiceLandCoord] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [diceThrowVector, setDiceThrowVector] = useState<DiceThrowVector | null>(null);
  const [hasRolled, setHasRolled] = useState<boolean>(false);
  const [rolling, setRolling] = useState<boolean>(false);
  const [animatingMove, setAnimatingMove] = useState<boolean>(false);
  const [turnAdvancing, setTurnAdvancing] = useState<boolean>(false);
  const [returningTokenIds, setReturningTokenIds] = useState<string[]>([]);
  const [consecutiveSixes, setConsecutiveSixes] = useState<number>(0);
  const [turnCount, setTurnCount] = useState<number>(1);
  const [winner, setWinner] = useState<ColorId | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(
    () => TRANSLATIONS[getInitialLanguage()].board.status.yourTurn
  );

  // Feed & Chat
  const [events, setEvents] = useState<MatchEvent[]>(() => [
    {
      id: 'ev-init',
      timestamp: nowStamp(),
      color: 'system',
      message: TRANSLATIONS[getInitialLanguage()].board.events.tableSeated,
      type: 'system',
    },
  ]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'c-1',
      sender: 'Lyra Chen',
      color: 'green',
      text: 'Gl everyone!',
      time: nowStamp(),
    },
    {
      id: 'c-2',
      sender: 'Darius Thorne',
      color: 'yellow',
      text: 'May the 6s fall kindly!',
      time: nowStamp(),
    },
  ]);

  const timersRef = useRef<number[]>([]);
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const onlineMyColor = useMemo<ColorId | null>(() => {
    if (!onlineRoom) return null;
    for (const c of TURN_ORDER) {
      if (onlineRoom.seats[c]?.playerId === onlineMyPlayerId) return c;
    }
    return null;
  }, [onlineRoom, onlineMyPlayerId]);

  const tokensRef = useRef<Token[]>(tokens);
  tokensRef.current = tokens;
  const matchActiveRef = useRef<boolean>(matchActive);
  matchActiveRef.current = matchActive;
  const onlineMyColorRef = useRef<ColorId | null>(onlineMyColor);
  onlineMyColorRef.current = onlineMyColor;
  const coinsRef = useRef<number>(coins);
  coinsRef.current = coins;
  const activeRoomHistoryIdRef = useRef<string | null>(null);
  const recordedOnlineStartKeyRef = useRef<string | null>(null);
  const recordedOnlineFinishKeyRef = useRef<string | null>(null);

  const mapOnlineSeatsToPlayers = useCallback(
    (room: OnlineRoomSnapshot): Record<ColorId, PlayerConfig> => {
      const mapped = {} as Record<ColorId, PlayerConfig>;
      for (const c of TURN_ORDER) {
        const seat = room.seats[c];
        const base = DEFAULT_PLAYERS[c];
        mapped[c] = {
          ...base,
          name: seat.name || base.name,
          isHuman: !seat.isBot,
          active: seat.active,
        };
      }
      return mapped;
    },
    []
  );

  const onlineSocketRef = useRef<OnlineRoomSocket | null>(null);
  const handleServerEventRef = useRef<(ev: ServerToClientEvent) => void>(() => {});

  handleServerEventRef.current = (ev: ServerToClientEvent) => {
    if (ev.type === 'wallet:balance') {
      setCoins(ev.coins);
      return;
    }

    if (ev.type === 'room:publicList') {
      setPublicRooms(ev.rooms);
      return;
    }

    if (ev.type === 'room:chatMessage') {
      setOnlineChatMessages((prev) => [...prev.slice(-39), ev.message]);
      return;
    }

    if (ev.type === 'room:error') {
      setOnlineError(ev.message);
      if (ev.code === 'ROOM_NOT_FOUND' || ev.code === 'MATCH_ALREADY_FINISHED') {
        clearActiveSession();
        onlineSocketRef.current?.setReconnectSession(null);
      }
      return;
    }

    if (ev.type === 'room:left') {
      clearAllTimers();
      setOnlineRoom(null);
      clearActiveSession();
      onlineSocketRef.current?.setReconnectSession(null);
      setOnlineChatMessages([]);
      setMatchActive(false);
      setWinner(null);
      setRolling(false);
      setAnimatingMove(false);
      setDicePhase('idle');
      return;
    }

    if (ev.type === 'room:state') {
      const room = ev.room;
      setOnlineError(null);
      setOnlineRoom(room);

      const mySeat = TURN_ORDER.map((c) => room.seats[c]).find(
        (s) => s.playerId === onlineMyPlayerId
      );
      if (mySeat) {
        saveActiveSession({
          code: room.code,
          playerId: onlineMyPlayerId,
          playerName: mySeat.name,
        });
        onlineSocketRef.current?.setReconnectSession({
          code: room.code,
          playerId: onlineMyPlayerId,
          playerName: mySeat.name,
        });
      }

      if (room.status === 'waiting') {
        setActiveScreen('arena');
      }

      if (room.status === 'playing' || room.status === 'finished') {
        const mappedPlayers = mapOnlineSeatsToPlayers(room);
        const wasActive = matchActiveRef.current;
        if (!wasActive || (room.turnCount === 1 && room.turnPhase === 'waiting-roll' && room.status === 'playing' && winner !== null)) {
          soundFX.playGameStart();
        }
        const myColor =
          TURN_ORDER.find((c) => room.seats[c].playerId === onlineMyPlayerId) ?? null;
        const justFinished = !winner && room.winner !== null;

        setPlayers(mappedPlayers);
        setTokens(room.tokens);
        setMatchMode('online');
        setDifficulty(room.difficulty);
        setMatchTitle(fmt(t.board.titles.onlineRoom, { code: room.code }));
        setWagerPot(room.wagerPot);
        setActiveColor(room.activeColor);
        setConsecutiveSixes(room.consecutiveSixes);
        setTurnCount(room.turnCount);
        setWinner(room.winner);
        setMatchActive(true);
        setActiveScreen('arena');

        // Persist online room participation & wallet transactions to Firestore for signed-in user
        const startKey = `${room.code}:${room.createdAt}:${room.turnCount === 1 ? 't1' : 'run'}`;
        if (
          firebaseUser &&
          room.status === 'playing' &&
          room.turnCount === 1 &&
          room.turnPhase === 'waiting-roll' &&
          recordedOnlineStartKeyRef.current !== startKey &&
          myColor
        ) {
          recordedOnlineStartKeyRef.current = startKey;
          recordedOnlineFinishKeyRef.current = null;
          const activeSeats = TURN_ORDER.filter((c) => room.seats[c].active);
          const opponents = activeSeats
            .filter((c) => c !== myColor)
            .map((c) => room.seats[c].name || c);
          const nextBalAfterStake = Math.max(0, coinsRef.current - room.stake);

          void createRoomHistoryEntry(firebaseUser.uid, {
            roomCode: room.code,
            mode: 'online',
            role: room.hostPlayerId === firebaseUser.uid ? 'host' : 'guest',
            myColor,
            stake: room.stake,
            wagerPot: room.wagerPot,
            netChange: -room.stake,
            playerCount: activeSeats.length,
            opponents,
          })
            .then((id) => {
              activeRoomHistoryIdRef.current = id;
            })
            .catch(() => {});

          if (room.stake > 0) {
            void recordWalletTransaction(firebaseUser.uid, {
              txType: 'stake_debit',
              amount: -room.stake,
              balanceAfter: nextBalAfterStake,
              label: `Mise salon ${room.code}`,
              referenceCode: room.code,
            }).catch(() => {});

            void syncWalletAndStats(firebaseUser.uid, {
              displayName: firebaseUser.displayName || mySeat?.name || 'Player',
              photoURL: firebaseUser.photoURL || '',
              coins: nextBalAfterStake,
              bonusClaimed,
              lastBonusDate: firestoreProfile?.lastBonusDate ?? '',
              elo: userElo,
              wins: userWins,
              matchesPlayed: userMatchesPlayed,
              earnings: userEarnings,
            }).catch(() => {});
          }
        }

        const finishKey = `${room.code}:${room.createdAt}:${room.winner}`;
        if (justFinished && room.winner) {
          const didWin = room.winner === myColor;
          const payout = didWin ? room.wagerPot : 0;
          const nextWins = didWin ? userWins + 1 : userWins;
          const nextMatches = userMatchesPlayed + 1;
          const nextEarnings = didWin ? userEarnings + room.wagerPot : userEarnings;
          const nextElo = didWin ? userElo + 25 : Math.max(1000, userElo - 10);

          if (didWin) {
            setUserWins(nextWins);
            if (room.wagerPot > 0) setUserEarnings(nextEarnings);
          }
          setUserMatchesPlayed(nextMatches);
          setUserElo(nextElo);

          if (firebaseUser && recordedOnlineFinishKeyRef.current !== finishKey) {
            recordedOnlineFinishKeyRef.current = finishKey;
            const activeSeats = TURN_ORDER.filter((c) => room.seats[c].active);
            const opponents = activeSeats
              .filter((c) => c !== myColor)
              .map((c) => room.seats[c].name || c);
            const winnerName = room.seats[room.winner]?.name || room.winner;
            const nextCoinsAfterWin = coinsRef.current + payout;

            if (activeRoomHistoryIdRef.current) {
              const histId = activeRoomHistoryIdRef.current;
              activeRoomHistoryIdRef.current = null;
              void finalizeRoomHistoryEntry(firebaseUser.uid, histId, {
                outcome: didWin ? 'win' : 'loss',
                wagerPot: room.wagerPot,
                netChange: payout - room.stake,
                winnerName,
                playerCount: activeSeats.length,
                opponents,
              }).catch(() => {});
            }

            if (didWin && room.wagerPot > 0) {
              void recordWalletTransaction(firebaseUser.uid, {
                txType: 'pot_win',
                amount: room.wagerPot,
                balanceAfter: nextCoinsAfterWin,
                label: `Cagnotte gagnée · Salon ${room.code}`,
                referenceCode: room.code,
              }).catch(() => {});
            }

            void syncWalletAndStats(firebaseUser.uid, {
              displayName: firebaseUser.displayName || mySeat?.name || 'Player',
              photoURL: firebaseUser.photoURL || '',
              coins: nextCoinsAfterWin,
              bonusClaimed,
              lastBonusDate: firestoreProfile?.lastBonusDate ?? '',
              elo: nextElo,
              wins: nextWins,
              matchesPlayed: nextMatches,
              earnings: nextEarnings,
            }).catch(() => {});
          }
        }

        if (room.turnPhase === 'waiting-roll' || room.turnPhase === 'waiting-move' || room.status === 'finished') {
          setTokens(room.tokens);
          setDiceValue(room.diceValue);
          setDiceLandCoord(room.diceLandCoord);
          setDiceThrowVector(room.diceThrowVector);
          setDicePhase('idle');
          setRolling(false);
          setAnimatingMove(false);
          setReturningTokenIds([]);
          setHasRolled(room.turnPhase === 'waiting-move');
        }

        const activeSeat = room.seats[room.activeColor];
        const activeName = activeSeat?.name || DEFAULT_PLAYERS[room.activeColor].name;

        if (room.winner) {
          setStatusMessage(
            fmt(t.board.status.claimedCrown, {
              name: room.seats[room.winner]?.name || room.winner,
            })
          );
        } else if (room.turnPhase === 'waiting-move') {
          if (room.activeColor === myColor) {
            setStatusMessage(
              room.movableTokenIds.length === 1
                ? fmt(t.board.status.selectOneToken, { roll: room.diceValue })
                : fmt(t.board.status.selectManyTokens, {
                    roll: room.diceValue,
                    count: room.movableTokenIds.length,
                  })
            );
          } else {
            setStatusMessage(
              fmt(t.board.status.aiChoseRoll, { name: activeName, roll: room.diceValue })
            );
          }
        } else if (room.turnPhase === 'waiting-roll') {
          if (room.activeColor === myColor) {
            setStatusMessage(t.board.status.yourTurn);
          } else if (!activeSeat?.isBot) {
            setStatusMessage(fmt(t.board.status.playerTurn, { name: activeName }));
          } else {
            setStatusMessage(fmt(t.board.status.aiThinking, { name: activeName }));
          }
        }
      }
      return;
    }

    if (ev.type === 'game:diceRolled') {
      setOnlineRoom(ev.room);
      setActiveColor(ev.color);
      soundFX.playDiceRoll();
      setDiceValue(ev.roll);
      setDiceLandCoord(ev.landCoord);
      setDiceThrowVector(ev.throwVector);
      setDiceSpinNonce(ev.diceSpinNonce);
      setDicePhase('rolling-to-board');
      setRolling(true);
      setHasRolled(false);
      setStatusMessage(t.board.status.rolling);

      scheduleTimer(() => {
        setDicePhase('landed-on-board');
      }, 1260);
      scheduleTimer(() => {
        setDicePhase('returning-to-seat');
      }, 1720);
      scheduleTimer(() => {
        setDicePhase('idle');
        setRolling(false);
        if (ev.roll === 6) {
          soundFX.playSixRoll();
        }
      }, 2140);
      return;
    }

    if (ev.type === 'game:tokenMoved') {
      setOnlineRoom(ev.room);
      const currentTokens = tokensRef.current;
      const targetToken = currentTokens.find((tok) => tok.id === ev.tokenId);
      const startProgress = targetToken ? targetToken.progress : -1;
      const isDeploying = ev.deployedFromBase || startProgress === -1;
      const totalSteps = isDeploying ? 1 : ev.diceValue;
      const stepDelayMs = 160;
      const actorName = ev.room.seats[ev.actorColor]?.name || ev.actorColor;

      setAnimatingMove(true);

      const finishOnlineMove = () => {
        if (ev.capturedVictims.length > 0) {
          const victimIds = ev.capturedVictims.map((v) => v.id);
          const victimColor = ev.capturedVictims[0].color;
          const victimName = ev.room.seats[victimColor]?.name || victimColor;
          const movedFinal = ev.updatedTokens.find((t2) => t2.id === ev.tokenId);

          setTokens((prev) =>
            prev.map((tok) =>
              tok.id === ev.tokenId && movedFinal
                ? { ...tok, progress: movedFinal.progress }
                : tok
            )
          );
          setReturningTokenIds(victimIds);
          soundFX.playCapture();
          setStatusMessage(fmt(t.board.status.captureReturning, { victim: victimName }));

          const maxReturnSteps = Math.max(
            ...ev.capturedVictims.map((v) => v.progress + 1)
          );
          const returnStepMs = Math.max(
            60,
            Math.min(95, Math.floor(2100 / Math.max(1, maxReturnSteps)))
          );
          const impactPauseMs = 260;

          for (let r = 1; r <= maxReturnSteps; r++) {
            scheduleTimer(() => {
              const anyEnteredDoor = ev.capturedVictims.some((v) => v.progress - r === -1);
              const anyStillOnTrack = ev.capturedVictims.some((v) => v.progress - r >= 0);

              setTokens((prev) =>
                prev.map((tok) => {
                  const victim = ev.capturedVictims.find((v) => v.id === tok.id);
                  if (!victim) return tok;
                  return { ...tok, progress: Math.max(-1, victim.progress - r) };
                })
              );

              if (anyEnteredDoor) {
                soundFX.playTokenReturnDoor();
              } else if (anyStillOnTrack) {
                soundFX.playTokenReturnStep(r / maxReturnSteps);
              }
            }, impactPauseMs + (r - 1) * returnStepMs);
          }

          scheduleTimer(() => {
            setTokens(ev.updatedTokens);
            setReturningTokenIds([]);
            setAnimatingMove(false);
            setHasRolled(false);
          }, impactPauseMs + maxReturnSteps * returnStepMs + 140);
          return;
        }

        setTokens(ev.updatedTokens);
        setAnimatingMove(false);
        setHasRolled(false);

        if (ev.reachedHome) {
          soundFX.playHomeGoal();
        } else if (ev.landedSafe) {
          soundFX.playSafeZone();
        } else if (ev.deployedFromBase) {
          soundFX.playDeploy();
        } else {
          soundFX.playTokenHop();
        }

        if (ev.winner) {
          soundFX.playVictory();
          setWinner(ev.winner);
          setStatusMessage(
            fmt(t.board.status.claimedCrown, {
              name: ev.room.seats[ev.winner]?.name || ev.winner,
            })
          );
        } else if (ev.bonusTurn) {
          const reason = ev.reachedHome ? t.board.status.bonusHome : t.board.status.bonusSix;
          setStatusMessage(
            `${reason} ${fmt(t.board.status.rollsAgain, { name: actorName })}`
          );
        }
      };

      if (isDeploying) {
        finishOnlineMove();
      } else {
        for (let step = 1; step <= totalSteps; step++) {
          scheduleTimer(() => {
            if (step < totalSteps) {
              const nextProgress = startProgress + step;
              soundFX.playTokenHop();
              setTokens((prev) =>
                prev.map((tok) =>
                  tok.id === ev.tokenId ? { ...tok, progress: nextProgress } : tok
                )
              );
            } else {
              finishOnlineMove();
            }
          }, (step - 1) * stepDelayMs);
        }
      }
    }
  };

  useEffect(() => {
    const sock = new OnlineRoomSocket(
      (ev) => handleServerEventRef.current(ev),
      (connected) => setOnlineConnected(connected)
    );
    onlineSocketRef.current = sock;
    sock.send({ type: 'wallet:sync', playerId: onlineMyPlayerId });
    sock.send({ type: 'room:listPublic' });

    // Auto-reconnect if returning to app with an active saved room session
    const saved = getActiveSession();
    if (saved?.code) {
      sock.setReconnectSession(saved);
      sock.send({
        type: 'room:join',
        code: saved.code,
        playerId: onlineMyPlayerId,
        playerName: saved.playerName,
      });
    }

    return () => {
      sock.destroy();
      onlineSocketRef.current = null;
    };
  }, [onlineMyPlayerId]);

  useEffect(() => {
    let unsubData: (() => void) | null = null;
    let unsubSettings: (() => void) | null = null;
    let unsubShopOrders: (() => void) | null = null;

    const cleanupSubs = () => {
      if (unsubData) {
        unsubData();
        unsubData = null;
      }
      if (unsubSettings) {
        unsubSettings();
        unsubSettings = null;
      }
      if (unsubShopOrders) {
        unsubShopOrders();
        unsubShopOrders = null;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      cleanupSubs();
      setFirebaseUser(user);

      if (!user) {
        setIsAdmin(false);
        setFirestoreProfile(null);
        setTokenPurchases([]);
        setRoomHistory([]);
        setWalletTxs([]);
        setShopOrders([]);
        setPlatformSettings(DEFAULT_PLATFORM_SETTINGS);
        return;
      }

      void checkIsAdmin(user).then(setIsAdmin);
      unsubSettings = subscribePlatformSettings(setPlatformSettings);
      unsubShopOrders = subscribeUserShopOrders(user.uid, setShopOrders);

      try {
        const prof = await ensureUserProfile(user, {
          coins: coinsRef.current,
          equippedDice,
          equippedToken,
          equippedBoard,
          unlockedIds,
        });
        setFirestoreProfile(prof);
        setCoins(prof.coins);
        setBonusClaimed(prof.bonusClaimed);
        setUserWins(prof.wins);
        setUserEarnings(prof.earnings);
        setUserElo(prof.elo);
        setUserMatchesPlayed(prof.matchesPlayed);
        setUnlockedIds(prof.unlockedIds);
        setEquippedDice(prof.equippedDice);
        setEquippedToken(prof.equippedToken);
        setEquippedBoard(prof.equippedBoard);

        const idToken = await user.getIdToken();
        onlineSocketRef.current?.send({
          type: 'wallet:sync',
          playerId: user.uid,
          idToken,
          syncedCoins: prof.coins,
        });

        unsubData = subscribeUserData(user.uid, {
          onProfile: (updated) => {
            setFirestoreProfile(updated);
            setCoins(updated.coins);
            setBonusClaimed(updated.bonusClaimed);
            setUserWins(updated.wins);
            setUserEarnings(updated.earnings);
            setUserElo(updated.elo);
            setUserMatchesPlayed(updated.matchesPlayed);
            setUnlockedIds(updated.unlockedIds);
            setEquippedDice(updated.equippedDice);
            setEquippedToken(updated.equippedToken);
            setEquippedBoard(updated.equippedBoard);
          },
          onPurchases: setTokenPurchases,
          onRoomHistory: setRoomHistory,
          onWalletTxs: setWalletTxs,
          onLeaderboard: setPublicStandings,
        });
      } catch (err) {
        console.error('Auth/Firestore sync error:', err);
      }
    });

    return () => {
      unsubAuth();
      cleanupSubs();
    };
  }, []);

  useEffect(() => {
    soundFX.enabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (matchActive || matchMode === 'online') return;
    setPlayers((prev) => ({
      ...prev,
      red: {
        ...prev.red,
        name: accountName,
        avatar: accountAvatar,
      },
    }));
  }, [accountName, accountAvatar, matchActive, matchMode]);

  // Keep status prompt cleanly updated if user switches language while waiting at turn start
  useEffect(() => {
    if (matchMode === 'online') return;
    if (!hasRolled && !rolling && !winner) {
      const p = players[activeColor];
      const displayName = matchMode === 'pass-play' ? p.name : p.name.split(' ')[0];
      if (activeColor === 'red' && p.isHuman && matchMode !== 'pass-play') {
        setStatusMessage(t.board.status.yourTurn);
      } else if (p.isHuman) {
        setStatusMessage(fmt(t.board.status.playerTurn, { name: displayName }));
      } else {
        setStatusMessage(fmt(t.board.status.aiThinking, { name: displayName }));
      }
    }
  }, [language, activeColor, hasRolled, rolling, winner, players, matchMode, t]);

  const pushEvent = useCallback(
    (color: ColorId | 'system', message: string, type: MatchEvent['type']) => {
      setEvents((prev) => [
        {
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowStamp(),
          color,
          message,
          type,
        },
        ...prev.slice(0, 39),
      ]);
    },
    []
  );

  const getNextActiveColor = useCallback(
    (current: ColorId, playerMap: Record<ColorId, PlayerConfig>): ColorId => {
      const startIdx = TURN_ORDER.indexOf(current);
      for (let offset = 1; offset <= 4; offset++) {
        const candidate = TURN_ORDER[(startIdx + offset) % 4];
        if (playerMap[candidate]?.active) {
          return candidate;
        }
      }
      return current;
    },
    []
  );

  const launchMatch = useCallback(
    (opts: {
      mode: MatchMode;
      buyIn: number;
      title: string;
      diff: BotDifficulty;
      customOpponent?: FriendEntry;
      customSeats?: LocalSeatConfig[];
    }) => {
      clearAllTimers();
      const nextPlayers = buildPlayersForMode(opts.mode, opts.customOpponent, opts.customSeats, {
        name: accountName,
        avatar: accountAvatar,
      });
      const activeColors = TURN_ORDER.filter((c) => nextPlayers[c].active);
      const firstColor = activeColors[0] ?? 'red';
      const seatCount = activeColors.length;
      const actualBuyIn = opts.mode === 'pass-play' ? 0 : opts.buyIn;
      const nextCoinsAfterBuyIn =
        actualBuyIn > 0 ? Math.max(0, coinsRef.current - actualBuyIn) : coinsRef.current;

      if (actualBuyIn > 0) {
        setCoins(nextCoinsAfterBuyIn);
      }

      if (firebaseUser) {
        const localCode =
          opts.mode === 'duel-2p'
            ? 'DUEL-1V1'
            : opts.mode === 'pass-play'
            ? 'LOCAL-PP'
            : 'ARENA-4P';
        const opponents = activeColors
          .filter((c) => c !== 'red')
          .map((c) => nextPlayers[c].name);
        void createRoomHistoryEntry(firebaseUser.uid, {
          roomCode: localCode,
          mode: opts.mode,
          role: 'solo',
          myColor: 'red',
          stake: actualBuyIn,
          wagerPot: actualBuyIn * seatCount,
          netChange: -actualBuyIn,
          playerCount: seatCount,
          opponents,
        })
          .then((id) => {
            activeRoomHistoryIdRef.current = id;
          })
          .catch(() => {});

        if (actualBuyIn > 0) {
          void recordWalletTransaction(firebaseUser.uid, {
            txType: 'stake_debit',
            amount: -actualBuyIn,
            balanceAfter: nextCoinsAfterBuyIn,
            label: `${opts.title}`,
            referenceCode: localCode,
          }).catch(() => {});
          void syncWalletAndStats(firebaseUser.uid, {
            displayName: firebaseUser.displayName || 'Player',
            photoURL: firebaseUser.photoURL || '',
            coins: nextCoinsAfterBuyIn,
            bonusClaimed,
            lastBonusDate: firestoreProfile?.lastBonusDate ?? '',
            elo: userElo,
            wins: userWins,
            matchesPlayed: userMatchesPlayed,
            earnings: userEarnings,
          }).catch(() => {});
        }
      }

      setLastLocalSeats(opts.mode === 'pass-play' ? opts.customSeats : undefined);
      setMatchMode(opts.mode);
      setDifficulty(opts.diff);
      setMatchTitle(opts.title);
      setWagerPot(actualBuyIn * seatCount);
      setPlayers(nextPlayers);
      setTokens(createInitialTokens(activeColors));
      setActiveColor(firstColor);
      setDiceValue(6);
      setDicePhase('idle');
      setDiceThrowVector(null);
      setHasRolled(false);
      setRolling(false);
      setAnimatingMove(false);
      setTurnAdvancing(false);
      setReturningTokenIds([]);
      setConsecutiveSixes(0);
      setTurnCount(1);
      setWinner(null);
      setMatchActive(true);
      setActiveScreen('arena');
      soundFX.playGameStart();
      const firstPlayer = nextPlayers[firstColor];
      const firstName = opts.mode === 'pass-play' ? firstPlayer.name : firstPlayer.name.split(' ')[0];
      setStatusMessage(
        firstPlayer.isHuman
          ? opts.mode !== 'pass-play' && firstColor === 'red'
            ? t.board.status.yourTurn
            : fmt(t.board.status.playerTurn, { name: firstName })
          : fmt(t.board.status.aiThinking, { name: firstName })
      );
      setEvents([
        {
          id: `ev-start-${Date.now()}`,
          timestamp: nowStamp(),
          color: 'system',
          message: fmt(t.board.events.matchStarted, {
            title: opts.title,
            count: activeColors.length,
          }),
          type: 'system',
        },
      ]);
    },
    [clearAllTimers, t, accountName, accountAvatar, firebaseUser, bonusClaimed, firestoreProfile?.lastBonusDate, userElo, userWins, userMatchesPlayed, userEarnings]
  );

  const advanceTurn = useCallback(
    (current: ColorId, currentPlayers: Record<ColorId, PlayerConfig>) => {
      const next = getNextActiveColor(current, currentPlayers);
      setActiveColor(next);
      setHasRolled(false);
      setTurnAdvancing(false);
      setConsecutiveSixes(0);
      setTurnCount((c) => c + 1);
      const nextPlayer = currentPlayers[next];
      const nextName =
        matchMode === 'pass-play' ? nextPlayer.name : nextPlayer.name.split(' ')[0];
      setStatusMessage(
        nextPlayer.isHuman
          ? next === 'red' && matchMode !== 'pass-play'
            ? t.board.status.yourTurn
            : fmt(t.board.status.playerTurn, { name: nextName })
          : fmt(t.board.status.aiThinking, { name: nextName })
      );
    },
    [getNextActiveColor, matchMode, t]
  );

  const handleSelectToken = useCallback(
    (tokenId: string) => {
      if (!matchActive || winner || !hasRolled || rolling || animatingMove) return;

      if (matchMode === 'online') {
        if (!onlineRoom || onlineRoom.turnPhase !== 'waiting-move') return;
        if (onlineRoom.activeColor !== onlineMyColor) return;
        if (!onlineRoom.movableTokenIds.includes(tokenId)) return;
        onlineSocketRef.current?.send({ type: 'game:move', tokenId });
        return;
      }

      const movable = getMovableTokenIds(tokens, activeColor, diceValue);
      if (!movable.includes(tokenId)) return;

      const targetToken = tokens.find((tok) => tok.id === tokenId);
      if (!targetToken) return;

      const snapshotTokens = tokens;
      const actorName = players[activeColor].name.split(' ')[0];
      const isDeploying = targetToken.progress === -1;
      const totalSteps = isDeploying ? 1 : diceValue;
      const stepDelayMs = 160;

      setAnimatingMove(true);

      const finalizeMove = () => {
        const result = executeTokenMove(snapshotTokens, tokenId, diceValue);

        if (result.capturedTokens.length > 0) {
          const victims = result.capturedTokens;
          const victimIds = victims.map((v) => v.id);
          const victimName = players[victims[0].color].name.split(' ')[0];

          // Land attacking token on capture square while victims hold briefly for impact
          setTokens((prev) =>
            prev.map((tok) =>
              tok.id === tokenId ? { ...tok, progress: result.movedToken.progress } : tok
            )
          );
          setReturningTokenIds(victimIds);
          soundFX.playCapture();
          setStatusMessage(
            fmt(t.board.status.captureReturning, { victim: victimName })
          );
          pushEvent(
            activeColor,
            fmt(t.board.events.captured, {
              actor: actorName,
              victim: victimName,
            }),
            'capture'
          );

          // Step captured tokens back square-by-square down to 0 (door) then -1 (yard)
          const maxReturnSteps = Math.max(...victims.map((v) => v.progress + 1));
          const returnStepMs = Math.max(
            60,
            Math.min(95, Math.floor(2100 / Math.max(1, maxReturnSteps)))
          );
          const impactPauseMs = 260;

          for (let r = 1; r <= maxReturnSteps; r++) {
            scheduleTimer(() => {
              const anyEnteredDoor = victims.some((v) => v.progress - r === -1);
              const anyStillOnTrack = victims.some((v) => v.progress - r >= 0);

              setTokens((prev) =>
                prev.map((tok) => {
                  const victim = victims.find((v) => v.id === tok.id);
                  if (!victim) return tok;
                  return { ...tok, progress: Math.max(-1, victim.progress - r) };
                })
              );

              if (anyEnteredDoor) {
                soundFX.playTokenReturnDoor();
              } else if (anyStillOnTrack) {
                soundFX.playTokenReturnStep(r / maxReturnSteps);
              }
            }, impactPauseMs + (r - 1) * returnStepMs);
          }

          scheduleTimer(() => {
            setTokens(result.updatedTokens);
            setReturningTokenIds([]);
            setAnimatingMove(false);
            setHasRolled(false);
            setStatusMessage(
              `${t.board.status.bonusCapture} ${fmt(t.board.status.rollsAgain, { name: actorName })}`
            );
          }, impactPauseMs + maxReturnSteps * returnStepMs + 140);
          return;
        }

        setTokens(result.updatedTokens);
        setAnimatingMove(false);

        if (result.reachedHome) {
          soundFX.playHomeGoal();
          pushEvent(activeColor, fmt(t.board.events.reachedHome, { actor: actorName }), 'home');
        } else if (result.landedSafe) {
          soundFX.playSafeZone();
          pushEvent(activeColor, fmt(t.board.events.landedSafe, { actor: actorName }), 'move');
        } else {
          if (result.deployedFromBase) {
            soundFX.playDeploy();
          } else {
            soundFX.playTokenHop();
          }
          pushEvent(
            activeColor,
            result.deployedFromBase
              ? fmt(t.board.events.deployed, { actor: actorName })
              : fmt(t.board.events.advanced, { actor: actorName, roll: diceValue }),
            'move'
          );
        }

        if (result.winner) {
          soundFX.playVictory();
          setWinner(result.winner);
          setHasRolled(false);
          setStatusMessage(
            fmt(t.board.status.claimedCrown, { name: players[result.winner].name })
          );
          pushEvent(
            result.winner,
            fmt(t.board.events.wonMatch, { name: players[result.winner].name }),
            'win'
          );

          const didWin = result.winner === 'red';
          const payout = didWin && wagerPot > 0 ? wagerPot : 0;
          const nextBalance = coinsRef.current + payout;
          const nextWins = didWin ? userWins + 1 : userWins;
          const nextMatches = userMatchesPlayed + 1;
          const nextEarnings = didWin ? userEarnings + payout : userEarnings;
          const nextElo = didWin ? userElo + 20 : Math.max(1000, userElo - 8);

          if (payout > 0) {
            setCoins(nextBalance);
            setUserEarnings(nextEarnings);
          }
          if (didWin) {
            setUserWins(nextWins);
          }
          setUserMatchesPlayed(nextMatches);
          setUserElo(nextElo);

          if (firebaseUser) {
            const activeColors = TURN_ORDER.filter((c) => players[c].active);
            const opponents = activeColors
              .filter((c) => c !== 'red')
              .map((c) => players[c].name);
            if (activeRoomHistoryIdRef.current) {
              const histId = activeRoomHistoryIdRef.current;
              activeRoomHistoryIdRef.current = null;
              void finalizeRoomHistoryEntry(firebaseUser.uid, histId, {
                outcome: didWin ? 'win' : 'loss',
                wagerPot,
                netChange: payout - (matchMode === 'pass-play' ? 0 : stake),
                winnerName: players[result.winner].name,
                playerCount: activeColors.length,
                opponents,
              }).catch(() => {});
            }
            if (payout > 0) {
              void recordWalletTransaction(firebaseUser.uid, {
                txType: 'pot_win',
                amount: payout,
                balanceAfter: nextBalance,
                label: `Victoire · ${matchTitle}`,
                referenceCode: matchMode.toUpperCase(),
              }).catch(() => {});
            }
            void syncWalletAndStats(firebaseUser.uid, {
              displayName: firebaseUser.displayName || 'Player',
              photoURL: firebaseUser.photoURL || '',
              coins: nextBalance,
              bonusClaimed,
              lastBonusDate: firestoreProfile?.lastBonusDate ?? '',
              elo: nextElo,
              wins: nextWins,
              matchesPlayed: nextMatches,
              earnings: nextEarnings,
            }).catch(() => {});
          }
          return;
        }

        if (result.bonusTurn) {
          setHasRolled(false);
          const reason =
            result.capturedTokens.length > 0
              ? t.board.status.bonusCapture
              : result.reachedHome
              ? t.board.status.bonusHome
              : t.board.status.bonusSix;
          setStatusMessage(
            `${reason} ${fmt(t.board.status.rollsAgain, { name: actorName })}`
          );
        } else {
          advanceTurn(activeColor, players);
        }
      };

      if (isDeploying) {
        // Single step from base onto start tile
        finalizeMove();
        return;
      }

      // Advance square-by-square with hop sound on every step
      for (let step = 1; step <= totalSteps; step++) {
        scheduleTimer(() => {
          if (step < totalSteps) {
            const nextProgress = targetToken.progress + step;
            soundFX.playTokenHop();
            setTokens((prev) =>
              prev.map((tok) =>
                tok.id === tokenId ? { ...tok, progress: nextProgress } : tok
              )
            );
          } else {
            finalizeMove();
          }
        }, (step - 1) * stepDelayMs);
      }
    },
    [
      matchActive,
      winner,
      hasRolled,
      rolling,
      animatingMove,
      tokens,
      activeColor,
      diceValue,
      players,
      pushEvent,
      wagerPot,
      advanceTurn,
      scheduleTimer,
      matchMode,
      onlineRoom,
      onlineMyColor,
      t,
    ]
  );

  const handleRollDice = useCallback((throwVector?: DiceThrowVector) => {
    if (!matchActive || winner || hasRolled || rolling || animatingMove) return;

    if (matchMode === 'online') {
      if (!onlineRoom || onlineRoom.turnPhase !== 'waiting-roll') return;
      if (onlineRoom.activeColor !== onlineMyColor) return;
      onlineSocketRef.current?.send({ type: 'game:roll', throwVector });
      return;
    }

    const roll = Math.floor(Math.random() * 6) + 1;
    const landX = 43 + Math.random() * 14;
    const landY = 43 + Math.random() * 14;

    soundFX.playDiceRoll();
    setDiceValue(roll);
    setDiceLandCoord({ x: landX, y: landY });
    setDiceThrowVector(throwVector ?? null);
    setDiceSpinNonce((n) => n + 1);
    setDicePhase('rolling-to-board');
    setRolling(true);
    setStatusMessage(t.board.status.rolling);

    // Phase 1 -> Stop on the rolled number right on the board after bounces settle
    scheduleTimer(() => {
      setDicePhase('landed-on-board');
    }, 1260);

    // Phase 2 -> Glide back to the active player's corner
    scheduleTimer(() => {
      setDicePhase('returning-to-seat');
    }, 1720);

    // Phase 3 -> Docked at corner pod, apply game state
    scheduleTimer(() => {
      setDicePhase('idle');
      setRolling(false);
      setHasRolled(true);

      const actorName = players[activeColor].name.split(' ')[0];

      if (roll === 6 && consecutiveSixes >= 2) {
        pushEvent(
          activeColor,
          fmt(t.board.events.threeSixesLog, { actor: actorName }),
          'roll'
        );
        setTurnAdvancing(true);
        setStatusMessage(t.board.status.threeSixes);
        scheduleTimer(() => {
          advanceTurn(activeColor, players);
        }, 700);
        return;
      }

      if (roll === 6) {
        setConsecutiveSixes((c) => c + 1);
        soundFX.playSixRoll();
      } else {
        setConsecutiveSixes(0);
      }

      const movable = getMovableTokenIds(tokens, activeColor, roll);
      pushEvent(activeColor, fmt(t.board.events.rolled, { actor: actorName, roll }), 'roll');

      if (movable.length === 0) {
        setTurnAdvancing(true);
        setStatusMessage(fmt(t.board.status.noMoves, { roll }));
        scheduleTimer(() => {
          advanceTurn(activeColor, players);
        }, 700);
      } else if (players[activeColor].isHuman) {
        setStatusMessage(
          movable.length === 1
            ? fmt(t.board.status.selectOneToken, { roll })
            : fmt(t.board.status.selectManyTokens, { roll, count: movable.length })
        );
      } else {
        setStatusMessage(
          fmt(t.board.status.aiChoseRoll, { name: actorName, roll })
        );
      }
    }, 2140);
  }, [
    matchActive,
    winner,
    hasRolled,
    rolling,
    animatingMove,
    scheduleTimer,
    players,
    activeColor,
    consecutiveSixes,
    pushEvent,
    tokens,
    advanceTurn,
    matchMode,
    onlineRoom,
    onlineMyColor,
    t,
  ]);

  const movableTokenIds = useMemo(() => {
    if (!matchActive || winner || turnAdvancing || animatingMove) return [];
    if (matchMode === 'online') {
      if (!onlineRoom || onlineRoom.turnPhase !== 'waiting-move') return [];
      if (onlineRoom.activeColor !== onlineMyColor) return [];
      return onlineRoom.movableTokenIds;
    }
    if (!hasRolled) return [];
    return getMovableTokenIds(tokens, activeColor, diceValue);
  }, [
    matchActive,
    hasRolled,
    winner,
    turnAdvancing,
    animatingMove,
    matchMode,
    onlineRoom,
    onlineMyColor,
    tokens,
    activeColor,
    diceValue,
  ]);

  // Automated Human Single-Choice Move (offline/local; online single-move is driven by server)
  useEffect(() => {
    if (matchMode === 'online') return;
    if (!matchActive || winner || rolling || animatingMove || turnAdvancing || !hasRolled) return;
    const currentPlayer = players[activeColor];
    if (!currentPlayer || !currentPlayer.isHuman) return;
    if (movableTokenIds.length !== 1) return;

    const onlyTokenId = movableTokenIds[0];
    const timer = window.setTimeout(() => {
      handleSelectToken(onlyTokenId);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    matchMode,
    matchActive,
    winner,
    rolling,
    animatingMove,
    turnAdvancing,
    hasRolled,
    players,
    activeColor,
    movableTokenIds,
    handleSelectToken,
  ]);

  // Automated Bot Turn Loop (offline/local; online bots are driven by server)
  useEffect(() => {
    if (matchMode === 'online') return;
    if (!matchActive || winner || rolling || animatingMove || turnAdvancing) return;
    const currentPlayer = players[activeColor];
    if (!currentPlayer || currentPlayer.isHuman) return;

    if (!hasRolled) {
      const timer = window.setTimeout(() => {
        handleRollDice();
      }, 650);
      return () => window.clearTimeout(timer);
    } else if (movableTokenIds.length > 0) {
      const timer = window.setTimeout(() => {
        const chosenId = chooseBestBotMove(tokens, activeColor, diceValue, difficulty);
        if (chosenId) {
          handleSelectToken(chosenId);
        }
      }, 680);
      return () => window.clearTimeout(timer);
    }
  }, [
    matchMode,
    matchActive,
    winner,
    rolling,
    animatingMove,
    turnAdvancing,
    players,
    activeColor,
    hasRolled,
    movableTokenIds,
    tokens,
    diceValue,
    difficulty,
    handleRollDice,
    handleSelectToken,
  ]);

  // Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeScreen !== 'arena' || !matchActive || winner || animatingMove) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const isMyTurn =
        matchMode === 'online'
          ? activeColor === onlineMyColor
          : Boolean(players[activeColor]?.isHuman);
      if (!isMyTurn) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!hasRolled && !rolling) {
          handleRollDice();
        } else if (hasRolled && movableTokenIds.length === 1) {
          handleSelectToken(movableTokenIds[0]);
        }
      } else if (hasRolled && ['1', '2', '3', '4'].includes(e.key)) {
        const tokenIndex = Number(e.key) - 1;
        const matchToken = tokens.find(
          (tok) =>
            tok.color === activeColor &&
            tok.index === tokenIndex &&
            movableTokenIds.includes(tok.id)
        );
        if (matchToken) {
          handleSelectToken(matchToken.id);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeScreen,
    matchActive,
    winner,
    animatingMove,
    matchMode,
    onlineMyColor,
    players,
    activeColor,
    hasRolled,
    rolling,
    movableTokenIds,
    tokens,
    handleRollDice,
    handleSelectToken,
  ]);

  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}`,
      sender: accountName,
      color: 'red',
      text,
      time: nowStamp(),
    };
    setChatMessages((prev) => [...prev, newMsg]);

    if (matchMode !== 'pass-play') {
      const replies = t.telemetry.botReplies;
      const responderColor: ColorId = matchMode === 'duel-2p' ? 'yellow' : 'green';
      const responder = players[responderColor];
      scheduleTimer(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `chat-bot-${Date.now()}`,
            sender: responder.name,
            color: responderColor,
            text: replies[Math.floor(Math.random() * replies.length)],
            time: nowStamp(),
          },
        ]);
      }, 900);
    }
  };

  const handleJoinTournament = (tournament: TournamentItem) => {
    soundFX.playClick();
    if (!joinedTournamentIds.includes(tournament.id)) {
      if (coins < tournament.entryFee) return;
      setJoinedTournamentIds((prev) => [...prev, tournament.id]);
    }
    const localizedTitle = t.tournaments.items[tournament.id]?.title ?? tournament.title;
    launchMatch({
      mode: tournament.mode,
      buyIn: tournament.entryFee,
      title: localizedTitle,
      diff: tournament.difficulty,
    });
  };

  const handleUnlockItem = (item: LoadoutItem) => {
    if (coins < item.price || unlockedIds.includes(item.id)) return;
    soundFX.playSafeZone();
    const nextCoins = coins - item.price;
    const nextUnlocked = [...unlockedIds, item.id];
    const nextDice = item.category === 'dice' ? (item.id as DiceSkinId) : equippedDice;
    const nextToken = item.category === 'token' ? (item.id as TokenStyleId) : equippedToken;
    const nextBoard = item.category === 'board' ? (item.id as BoardThemeId) : equippedBoard;

    setCoins(nextCoins);
    setUnlockedIds(nextUnlocked);
    if (item.category === 'dice') setEquippedDice(nextDice);
    if (item.category === 'token') setEquippedToken(nextToken);
    if (item.category === 'board') setEquippedBoard(nextBoard);

    if (firebaseUser) {
      const itemLabel = t.inventory.items[item.id]?.name ?? item.name;
      void syncArmoryLoadout(firebaseUser.uid, {
        coins: nextCoins,
        unlockedIds: nextUnlocked,
        equippedDice: nextDice,
        equippedToken: nextToken,
        equippedBoard: nextBoard,
      }).catch(() => {});
      void recordTokenPurchase(firebaseUser.uid, {
        itemId: item.id,
        itemName: itemLabel,
        category: item.category,
        price: item.price,
        balanceAfter: nextCoins,
      }).catch(() => {});
      void recordWalletTransaction(firebaseUser.uid, {
        txType: 'shop_purchase',
        amount: -item.price,
        balanceAfter: nextCoins,
        label: itemLabel,
        referenceCode: item.id,
      }).catch(() => {});
      void firebaseUser.getIdToken().then((idToken) => {
        onlineSocketRef.current?.send({
          type: 'wallet:sync',
          playerId: firebaseUser.uid,
          idToken,
          syncedCoins: nextCoins,
        });
      });
    }
  };

  const handleEquipItem = (item: LoadoutItem) => {
    soundFX.playClick();
    const nextDice = item.category === 'dice' ? (item.id as DiceSkinId) : equippedDice;
    const nextToken = item.category === 'token' ? (item.id as TokenStyleId) : equippedToken;
    const nextBoard = item.category === 'board' ? (item.id as BoardThemeId) : equippedBoard;

    if (item.category === 'dice') setEquippedDice(nextDice);
    if (item.category === 'token') setEquippedToken(nextToken);
    if (item.category === 'board') setEquippedBoard(nextBoard);

    if (firebaseUser) {
      void syncArmoryLoadout(firebaseUser.uid, {
        coins,
        unlockedIds,
        equippedDice: nextDice,
        equippedToken: nextToken,
        equippedBoard: nextBoard,
      }).catch(() => {});
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error('Google Sign-In Error:', err);
      const firebaseErr = err as { code?: string; message?: string };
      const code = firebaseErr?.code;
      if (code === 'auth/popup-blocked') {
        setAuthError('Le popup de connexion a été bloqué par votre navigateur. Autorisez les popups pour ce site.');
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(`Domaine non autorisé dans Firebase (${window.location.hostname}). Utilisez http://localhost:3001.`);
      } else if (code === 'auth/operation-not-allowed') {
        setAuthError("La méthode d'authentification Google n'est pas activée dans Firebase Console.");
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthError('Fenêtre de connexion fermée avant la fin. Réessayez.');
      } else {
        setAuthError(firebaseErr?.code ? `${t.auth.authError} (${firebaseErr.code})` : t.auth.authError);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutFirebase();
    setAccountModalOpen(false);
  };

  const handleTopUpCoins = (amt: number, isDaily?: boolean) => {
    soundFX.playSafeZone();
    const nextCoins = coins + amt;
    const today = new Date().toISOString().slice(0, 10);
    if (isDaily) setBonusClaimed(true);

    if (amt === 500 || amt === 1000) {
      onlineSocketRef.current?.send({
        type: 'wallet:topup',
        playerId: onlineMyPlayerId,
        amount: amt,
        isDaily,
      });
    } else {
      setCoins(nextCoins);
    }

    if (firebaseUser) {
      void syncWalletAndStats(firebaseUser.uid, {
        displayName: firebaseUser.displayName || 'Player',
        photoURL: firebaseUser.photoURL || '',
        coins: nextCoins,
        bonusClaimed: isDaily ? true : bonusClaimed,
        lastBonusDate: isDaily ? today : (firestoreProfile?.lastBonusDate ?? ''),
        elo: userElo,
        wins: userWins,
        matchesPlayed: userMatchesPlayed,
        earnings: userEarnings,
      }).catch(() => {});
      void recordWalletTransaction(firebaseUser.uid, {
        txType: isDaily ? 'daily_bonus' : 'topup',
        amount: amt,
        balanceAfter: nextCoins,
        label: isDaily ? t.vault.dailyTitle : t.vault.refillTitle,
        referenceCode: isDaily ? 'DAILY' : 'REFILL',
      }).catch(() => {});
      void recordTokenPurchase(firebaseUser.uid, {
        itemId: isDaily ? 'coins-daily-1000' : 'coins-pack-500',
        itemName: isDaily ? t.vault.dailyTitle : t.vault.refillTitle,
        category: 'coins-pack',
        price: 0,
        balanceAfter: nextCoins,
      }).catch(() => {});
    }
  };

  const handleBuyCoins = async (order: {
    coinsAmount: number;
    fiatCents: number;
    paymentMethod: string;
  }) => {
    if (!firebaseUser) return;
    soundFX.playSafeZone();
    const isInstant = platformSettings.instantBuyCredit;
    const orderId = await createShopOrder(firebaseUser.uid, {
      displayName: accountName,
      orderType: 'buy',
      coinsAmount: order.coinsAmount,
      fiatCents: order.fiatCents,
      currency: platformSettings.currency,
      paymentMethod: order.paymentMethod,
      payoutDetails: '',
      status: isInstant ? 'completed' : 'pending',
    });

    if (isInstant) {
      const nextCoins = Math.min(10_000_000, coinsRef.current + order.coinsAmount);
      setCoins(nextCoins);
      await syncWalletAndStats(firebaseUser.uid, {
        displayName: accountName,
        photoURL: accountAvatar,
        coins: nextCoins,
        bonusClaimed,
        lastBonusDate: firestoreProfile?.lastBonusDate ?? '',
        elo: userElo,
        wins: userWins,
        matchesPlayed: userMatchesPlayed,
        earnings: userEarnings,
      });
      await recordWalletTransaction(firebaseUser.uid, {
        txType: 'coin_buy',
        amount: order.coinsAmount,
        balanceAfter: nextCoins,
        label: `Achat Boutique (${order.coinsAmount.toLocaleString()} pièces)`,
        referenceCode: orderId.slice(0, 12).toUpperCase(),
      });
      await recordTokenPurchase(firebaseUser.uid, {
        itemId: `buy-${order.coinsAmount}`,
        itemName: `+${order.coinsAmount.toLocaleString()} pièces (${order.paymentMethod})`,
        category: 'coins-pack',
        price: order.coinsAmount,
        balanceAfter: nextCoins,
      });
      const idToken = await firebaseUser.getIdToken();
      onlineSocketRef.current?.send({
        type: 'wallet:sync',
        playerId: firebaseUser.uid,
        idToken,
        syncedCoins: nextCoins,
      });
    }
  };

  const handleSellCoins = async (order: {
    coinsAmount: number;
    fiatCents: number;
    paymentMethod: string;
    payoutDetails: string;
  }) => {
    if (!firebaseUser) return;
    if (coinsRef.current < order.coinsAmount) {
      throw new Error(t.inventory.coinShop.insufficientCoins);
    }
    soundFX.playClick();
    const nextCoins = Math.max(0, coinsRef.current - order.coinsAmount);
    const orderId = await createShopOrder(firebaseUser.uid, {
      displayName: accountName,
      orderType: 'sell',
      coinsAmount: order.coinsAmount,
      fiatCents: order.fiatCents,
      currency: platformSettings.currency,
      paymentMethod: order.paymentMethod,
      payoutDetails: order.payoutDetails,
      status: 'pending',
    });

    setCoins(nextCoins);
    await syncWalletAndStats(firebaseUser.uid, {
      displayName: accountName,
      photoURL: accountAvatar,
      coins: nextCoins,
      bonusClaimed,
      lastBonusDate: firestoreProfile?.lastBonusDate ?? '',
      elo: userElo,
      wins: userWins,
      matchesPlayed: userMatchesPlayed,
      earnings: userEarnings,
    });
    await recordWalletTransaction(firebaseUser.uid, {
      txType: 'coin_sell',
      amount: -order.coinsAmount,
      balanceAfter: nextCoins,
      label: `Vente Boutique (${order.paymentMethod})`,
      referenceCode: orderId.slice(0, 12).toUpperCase(),
    });
    const idToken = await firebaseUser.getIdToken();
    onlineSocketRef.current?.send({
      type: 'wallet:sync',
      playerId: firebaseUser.uid,
      idToken,
      syncedCoins: nextCoins,
    });
  };

  const handleChallengeFriend = (friend: FriendEntry) => {
    soundFX.playClick();
    launchMatch({
      mode: 'duel-2p',
      buyIn: 250,
      title: fmt(t.board.titles.duelVs, { name: friend.name }),
      diff: friend.difficulty,
      customOpponent: friend,
    });
  };

  const navItems: {
    id: ScreenId;
    label: string;
    mobileLabel: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'arena', label: t.nav.arena, mobileLabel: t.nav.arena, icon: Dices },
    {
      id: 'tournaments',
      label: t.nav.tournaments,
      mobileLabel: t.nav.tournamentsShort,
      icon: Trophy,
    },
    {
      id: 'leaderboard',
      label: t.nav.leaderboard,
      mobileLabel: t.nav.leaderboardShort,
      icon: Award,
    },
    { id: 'inventory', label: t.nav.inventory, mobileLabel: t.nav.inventory, icon: ShoppingBag },
    { id: 'social', label: t.nav.social, mobileLabel: t.nav.social, icon: Users },
  ];

  // Dedicated Admin Console Route (/admin)
  if (isAdminRoute) {
    return (
      <AdminScreen
        firebaseUser={firebaseUser}
        authLoading={authLoading}
        authError={authError}
        isAdmin={isAdmin}
        platformSettings={platformSettings}
        onSignInGoogle={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onBackToArena={() => navigateTo('/')}
      />
    );
  }

  const platformNoticeBar =
    platformSettings.maintenanceMode ||
    firestoreProfile?.isSuspended ||
    platformSettings.announcement.trim() ? (
      <div className="w-full bg-[#111827]/95 border-b border-white/10 px-4 py-2 text-center text-xs font-display font-semibold flex items-center justify-center gap-2 z-40 relative">
        {firestoreProfile?.isSuspended ? (
          <span className="text-rose-300 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Compte suspendu par l'administration. Contactez le support.
          </span>
        ) : platformSettings.maintenanceMode ? (
          <span className="text-amber-300 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Maintenance en cours sur la plateforme.
          </span>
        ) : (
          <span className="text-[#4cd7f6] inline-flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5 shrink-0" />
            {platformSettings.announcement}
          </span>
        )}
      </div>
    ) : null;

  // Render dedicated full-viewport Ludo King Home Screen (!matchActive) or Focused Board (matchActive)
  if (activeScreen === 'arena') {
    return (
      <div className="min-h-dvh bg-[#0B0F19] text-[#E2E8F0] relative overflow-x-hidden">
        {!matchActive && platformNoticeBar}
        {!matchActive && onlineRoom && onlineRoom.status === 'playing' && (
          <div className="w-full bg-linear-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-center text-xs font-display font-bold text-white flex items-center justify-center gap-3 z-50 sticky top-0 shadow-lg">
            <span>⚡ Partie en ligne en cours dans le salon {onlineRoom.code} !</span>
            <button
              type="button"
              onClick={() => setMatchActive(true)}
              className="bg-white text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors shadow cursor-pointer"
            >
              Reprendre la partie
            </button>
          </div>
        )}
        <ArenaScreen
          t={t}
          language={language}
          soundEnabled={soundEnabled}
          matchActive={matchActive}
          matchTitle={matchTitle}
          matchMode={matchMode}
          stake={stake}
          difficulty={difficulty}
          coins={coins}
          players={players}
          tokens={tokens}
          activeColor={activeColor}
          diceValue={diceValue}
          dicePhase={dicePhase}
          diceSpinNonce={diceSpinNonce}
          diceLandCoord={diceLandCoord}
          diceThrowVector={diceThrowVector}
          hasRolled={hasRolled}
          rolling={rolling}
          animatingMove={animatingMove}
          movableTokenIds={movableTokenIds}
          returningTokenIds={returningTokenIds}
          statusMessage={statusMessage}
          winner={winner}
          wagerPot={wagerPot}
          equippedDice={equippedDice}
          equippedToken={equippedToken}
          equippedBoard={equippedBoard}
          playerProfile={{
            name: accountName,
            avatar: accountAvatar,
          }}
          isSignedIn={Boolean(firebaseUser)}
          publicRooms={publicRooms}
          onlineChatMessages={onlineChatMessages}
          onlineRoom={onlineRoom}
          onlineMyColor={onlineMyColor}
          onlineMyPlayerId={onlineMyPlayerId}
          onlineConnected={onlineConnected}
          onlineError={onlineError}
          initialJoinCode={initialJoinCode}
          onOpenAccount={() => setAccountModalOpen(true)}
          onCreateOnlineRoom={(playerName, maxPlayers, roomStake, diff, isPublic) => {
            setOnlineError(null);
            onlineSocketRef.current?.send({
              type: 'room:create',
              playerId: onlineMyPlayerId,
              playerName,
              maxPlayers,
              stake: roomStake,
              difficulty: diff,
              isPublic,
            });
          }}
          onQuickMatchOnline={(playerName, roomStake, diff) => {
            setOnlineError(null);
            onlineSocketRef.current?.send({
              type: 'room:quickMatch',
              playerId: onlineMyPlayerId,
              playerName,
              stake: roomStake,
              difficulty: diff,
            });
          }}
          onRefreshPublicRooms={() => {
            onlineSocketRef.current?.send({ type: 'room:listPublic' });
          }}
          onJoinOnlineRoom={(code, playerName) => {
            setOnlineError(null);
            onlineSocketRef.current?.send({
              type: 'room:join',
              code,
              playerId: onlineMyPlayerId,
              playerName,
            });
          }}
          onSetOnlineStake={(nextStake) => {
            setOnlineError(null);
            onlineSocketRef.current?.send({
              type: 'room:setStake',
              stake: nextStake,
            });
          }}
          onToggleOnlineBots={(fillWithBots) => {
            onlineSocketRef.current?.send({
              type: 'room:toggleBots',
              fillWithBots,
              difficulty,
            });
          }}
          onStartOnlineMatch={() => {
            onlineSocketRef.current?.send({ type: 'room:start' });
          }}
          onLeaveOnlineRoom={() => {
            clearActiveSession();
            onlineSocketRef.current?.leaveRoom();
            setOnlineRoom(null);
            setOnlineChatMessages([]);
            setOnlineError(null);
            setMatchActive(false);
          }}
          onSendOnlineChat={(text) => {
            onlineSocketRef.current?.send({ type: 'room:chat', text });
          }}
          onClearOnlineError={() => setOnlineError(null)}
          onToggleLanguage={toggleLanguage}
          onToggleSound={() => setSoundEnabled((s) => !s)}
          onChangeMode={setMatchMode}
          onChangeStake={(nextStake) =>
            setStake(
              Number.isFinite(nextStake)
                ? Math.max(0, Math.min(platformSettings.maxStake, Math.floor(nextStake)))
                : 0
            )
          }
          onChangeDifficulty={setDifficulty}
          onLaunchMode={(selectedMode, localSeats) =>
            launchMatch({
              mode: selectedMode,
              buyIn: stake,
              title:
                selectedMode === 'duel-2p'
                  ? t.board.titles.duel2p
                  : selectedMode === 'pass-play'
                  ? t.board.titles.passPlay
                  : t.board.titles.quick4p,
              diff: difficulty,
              customSeats: localSeats,
            })
          }
          onOpenCoins={() => setCoinModalOpen(true)}
          onOpenScreen={(screen) => setActiveScreen(screen)}
          onRollDice={handleRollDice}
          onSelectToken={handleSelectToken}
          onPlayAgain={() => {
            if (matchMode === 'online') {
              onlineSocketRef.current?.send({ type: 'room:rematch' });
              return;
            }
            launchMatch({
              mode: matchMode,
              buyIn: stake,
              title: matchTitle,
              diff: difficulty,
              customSeats: lastLocalSeats,
            });
          }}
          onReturnToLobby={() => {
            clearAllTimers();
            if (matchMode === 'online') {
              onlineSocketRef.current?.setReconnectSession(null);
              onlineSocketRef.current?.send({ type: 'room:leave' });
              setOnlineRoom(null);
              setOnlineChatMessages([]);
            }
            setDicePhase('idle');
            setDiceThrowVector(null);
            setRolling(false);
            setAnimatingMove(false);
            setReturningTokenIds([]);
            setMatchActive(false);
            setWinner(null);
          }}
        />

        <CoinTopUpModal
          t={t}
          isOpen={coinModalOpen}
          coins={coins}
          bonusClaimed={bonusClaimed}
          onClose={() => setCoinModalOpen(false)}
          onAddCoins={handleTopUpCoins}
        />

        <AccountHistoryModal
          t={t}
          isOpen={accountModalOpen}
          authLoading={authLoading}
          authError={authError}
          isSignedIn={Boolean(firebaseUser)}
          profile={firestoreProfile}
          fallbackAvatar={accountAvatar}
          fallbackName={accountName}
          coins={coins}
          purchases={tokenPurchases}
          roomHistory={roomHistory}
          walletTxs={walletTxs}
          isAdmin={isAdmin}
          onOpenAdmin={() => navigateTo('/admin')}
          onClose={() => setAccountModalOpen(false)}
          onSignInGoogle={handleGoogleSignIn}
          onSignOut={handleSignOut}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0B0F19] text-[#E2E8F0] relative overflow-x-hidden">
      {platformNoticeBar}
      {/* Subtle Ambient Corner Gradient Mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-40 -left-40 w-[460px] h-[460px] rounded-full bg-[#8B5CF6]/12 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[460px] h-[460px] rounded-full bg-[#06B6D4]/10 blur-[120px]" />
      </div>

      {/* Mobile Slim Top Header */}
      <header className="lg:hidden sticky top-0 z-40 glass-panel border-x-0 border-t-0 px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayerAvatar
            src={accountAvatar}
            name={accountName}
            color="red"
            size="sm"
          />
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-white truncate">
              {firebaseUser ? accountName : 'Ludo Arena'}
            </div>
            <div className="text-[11px] font-mono-num text-[#94A3B8]">
              {t.header.level} {DEFAULT_PLAYERS.red.rank} · {userElo.toLocaleString()} ELO
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label="Switch language"
            className="px-2 py-1.5 rounded-lg bg-[#1E293B]/70 border border-white/10 text-[11px] font-display font-bold text-[#4cd7f6]"
          >
            {language.toUpperCase()}
          </button>

          <div className="flex items-center gap-1.5 rounded-full bg-[#111827] border border-[#F97316]/45 pl-2.5 pr-1 py-1">
            <Coins className="w-3.5 h-3.5 text-[#FBBF24]" />
            <span className="font-mono-num text-xs font-bold text-white">
              {coins.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => setCoinModalOpen(true)}
              aria-label={t.header.addCoins}
              className="w-5 h-5 rounded-full bg-[#F97316]/25 hover:bg-[#F97316]/45 flex items-center justify-center text-[#FBBF24]"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            aria-label={soundEnabled ? t.header.muteSound : t.header.enableSound}
            className="w-8 h-8 rounded-lg bg-[#1E293B]/70 border border-white/10 flex items-center justify-center text-[#E2E8F0]"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#94A3B8]" />
            )}
          </button>
        </div>
      </header>

      {/* Main 12-Column Responsive Chassis */}
      <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 2-Col Desktop Navigation Deck */}
          <aside className="hidden lg:flex lg:col-span-2 flex-col gap-4 sticky top-6">
            <div className="glass-panel rounded-2xl p-4 space-y-5">
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.45)]">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-display text-base font-extrabold text-white tracking-tight leading-none">
                    Ludo Arena
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-1">{t.brandSubtitle}</div>
                </div>
              </div>

              <nav aria-label="Primary Navigation" className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        soundFX.playClick();
                        setActiveScreen(item.id);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-display font-semibold transition-all whitespace-nowrap ${
                        active
                          ? 'bg-[#8B5CF6]/18 text-white border border-[#8B5CF6]/50 shadow-[0_0_16px_rgba(139,92,246,0.2)]'
                          : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#4cd7f6]' : ''}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center gap-2.5">
                  <PlayerAvatar
                    src={accountAvatar}
                    name={accountName}
                    color="red"
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="font-display text-xs font-bold text-white truncate">
                      {accountName}
                    </div>
                    <div className="text-[11px] font-mono-num text-[#94A3B8]">
                      {t.header.rank} #{DEFAULT_PLAYERS.red.rank}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-full bg-[#0B0F19]/85 border border-[#F97316]/45 pl-3 pr-1.5 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Coins className="w-4 h-4 text-[#FBBF24] shrink-0" />
                    <span className="font-mono-num text-xs font-bold text-white truncate">
                      {coins.toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoinModalOpen(true)}
                    aria-label={t.header.addCoins}
                    className="w-6 h-6 rounded-full bg-[#F97316]/25 hover:bg-[#F97316]/45 flex items-center justify-center text-[#FBBF24] transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Language & Audio Switchers */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="py-2 px-2 rounded-xl bg-[#1E293B]/60 hover:bg-[#1E293B] border border-white/10 text-xs font-display font-bold text-[#4cd7f6] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {language.toUpperCase()}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSoundEnabled((s) => !s)}
                    aria-label={soundEnabled ? t.header.muteSound : t.header.enableSound}
                    className="py-2 px-2 rounded-xl bg-[#1E293B]/60 hover:bg-[#1E293B] border border-white/10 text-xs font-display font-semibold text-[#E2E8F0] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-[#4cd7f6]" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-[#94A3B8]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* Central 7-Col Main Viewport */}
          <main className="lg:col-span-7 min-w-0">
            {activeScreen === 'tournaments' && (
              <TournamentsScreen
                t={t}
                coins={coins}
                joinedIds={joinedTournamentIds}
                onJoinTournament={handleJoinTournament}
              />
            )}

            {activeScreen === 'leaderboard' && (
              <LeaderboardScreen
                t={t}
                userWins={userWins}
                userEarnings={userEarnings}
                publicStandings={publicStandings}
                currentUid={firebaseUser?.uid ?? null}
              />
            )}

            {activeScreen === 'inventory' && (
              <InventoryScreen
                t={t}
                coins={coins}
                isSignedIn={Boolean(firebaseUser)}
                platformSettings={platformSettings}
                shopOrders={shopOrders}
                unlockedIds={unlockedIds}
                equippedDice={equippedDice}
                equippedToken={equippedToken}
                equippedBoard={equippedBoard}
                onUnlock={handleUnlockItem}
                onEquip={handleEquipItem}
                onBuyCoins={handleBuyCoins}
                onSellCoins={handleSellCoins}
                onSignInGoogle={handleGoogleSignIn}
              />
            )}

            {activeScreen === 'social' && (
              <SocialScreen t={t} onChallengeFriend={handleChallengeFriend} />
            )}
          </main>

          {/* Right 3-Col Live Telemetry & Chat */}
          <div className="lg:col-span-3">
            <RightTelemetryPanel
              t={t}
              matchActive={matchActive}
              wagerPot={wagerPot}
              turnCount={turnCount}
              activeColor={activeColor}
              players={players}
              events={events}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>
      </div>

      {/* Fixed Mobile Bottom Navigation Deck */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-panel border-x-0 border-b-0 px-2 py-1.5 grid grid-cols-5 gap-1"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundFX.playClick();
                setActiveScreen(item.id);
              }}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors ${
                active ? 'text-[#4cd7f6]' : 'text-[#94A3B8]'
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 w-7 h-0.5 rounded-full bg-[#06B6D4] shadow-[0_0_8px_#06B6D4]"
                />
              )}
              <Icon className="w-5 h-5" />
              <span className="font-display text-[10px] font-semibold mt-0.5">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Coin Top-Up Modal */}
      <CoinTopUpModal
        t={t}
        isOpen={coinModalOpen}
        coins={coins}
        bonusClaimed={bonusClaimed}
        onClose={() => setCoinModalOpen(false)}
        onAddCoins={handleTopUpCoins}
      />

      <AccountHistoryModal
        t={t}
        isOpen={accountModalOpen}
        authLoading={authLoading}
        authError={authError}
        isSignedIn={Boolean(firebaseUser)}
        profile={firestoreProfile}
        fallbackAvatar={accountAvatar}
        fallbackName={accountName}
        coins={coins}
        purchases={tokenPurchases}
        roomHistory={roomHistory}
        walletTxs={walletTxs}
        isAdmin={isAdmin}
        onOpenAdmin={() => navigateTo('/admin')}
        onClose={() => setAccountModalOpen(false)}
        onSignInGoogle={handleGoogleSignIn}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
