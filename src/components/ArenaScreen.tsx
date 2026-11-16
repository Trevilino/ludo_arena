import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Bot,
  Check,
  Coins,
  Copy,
  Crown,
  Dices,
  Eye,
  EyeOff,
  Globe,
  Link2,
  Lock,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { fmt, Language, Translations } from '../i18n/translations';
import {
  BoardThemeId,
  BotDifficulty,
  ColorId,
  DiceRollPhase,
  DiceSkinId,
  DiceThrowVector,
  LocalSeatConfig,
  MatchMode,
  OnlineRoomSnapshot,
  PlayerConfig,
  PublicRoomSummary,
  ScreenId,
  SeatType,
  Token,
  TokenStyleId,
} from '../types/ludo';
import {
  getFaceQuaternion,
  mulQuat,
  quatFromAxisAngle,
  quatToMatrix3d,
} from '../utils/dicePhysics';
import { COLOR_HEX } from '../utils/ludoEngine';
import { getSavedPlayerName, savePlayerName } from '../utils/onlineClient';
import { soundFX } from '../utils/sound';
import { Dice3D } from './Dice3D';
import { LudoBoard } from './LudoBoard';
import { PlayerAvatar } from './PlayerAvatar';

interface ArenaScreenProps {
  t: Translations;
  language: Language;
  soundEnabled: boolean;
  matchActive: boolean;
  matchTitle: string;
  matchMode: MatchMode;
  stake: number;
  difficulty: BotDifficulty;
  coins: number;
  players: Record<ColorId, PlayerConfig>;
  tokens: Token[];
  activeColor: ColorId;
  diceValue: number;
  dicePhase: DiceRollPhase;
  diceSpinNonce: number;
  diceLandCoord: { x: number; y: number };
  diceThrowVector: DiceThrowVector | null;
  hasRolled: boolean;
  rolling: boolean;
  animatingMove: boolean;
  movableTokenIds: string[];
  returningTokenIds: string[];
  statusMessage: string;
  winner: ColorId | null;
  wagerPot: number;
  equippedDice: DiceSkinId;
  equippedToken: TokenStyleId;
  equippedBoard: BoardThemeId;
  playerProfile: Pick<PlayerConfig, 'name' | 'avatar'>;
  isSignedIn: boolean;
  publicRooms: PublicRoomSummary[];
  onlineChatMessages: { id: string; sender: string; color: ColorId; text: string; time: string }[];
  onlineRoom: OnlineRoomSnapshot | null;
  onlineMyColor: ColorId | null;
  onlineMyPlayerId: string;
  onlineConnected: boolean;
  onlineError: string | null;
  initialJoinCode: string | null;
  onOpenAccount: () => void;
  onCreateOnlineRoom: (
    playerName: string,
    maxPlayers: 2 | 3 | 4,
    stake: number,
    difficulty: BotDifficulty,
    isPublic: boolean
  ) => void;
  onQuickMatchOnline: (
    playerName: string,
    stake: number,
    difficulty: BotDifficulty
  ) => void;
  onRefreshPublicRooms: () => void;
  onJoinOnlineRoom: (code: string, playerName: string) => void;
  onSetOnlineStake: (stake: number) => void;
  onToggleOnlineBots: (fillWithBots: boolean) => void;
  onStartOnlineMatch: () => void;
  onLeaveOnlineRoom: () => void;
  onSendOnlineChat: (text: string) => void;
  onClearOnlineError: () => void;
  onToggleLanguage: () => void;
  onToggleSound: () => void;
  onChangeMode: (mode: MatchMode) => void;
  onChangeStake: (stake: number) => void;
  onChangeDifficulty: (diff: BotDifficulty) => void;
  onStartMatch?: () => void;
  onLaunchMode: (mode: MatchMode, localSeats?: LocalSeatConfig[]) => void;
  onOpenCoins: () => void;
  onOpenScreen: (screen: ScreenId) => void;
  onRollDice: (throwVector?: DiceThrowVector) => void;
  onSelectToken: (tokenId: string) => void;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
}

const STAKE_OPTIONS = [0, 100, 250, 500, 1000];
const ONLINE_STAKE_OPTIONS = [0, 100, 250, 500, 1000];
const LOCAL_COLOR_ORDER: ColorId[] = ['red', 'green', 'yellow', 'blue'];

function buildLocalPreset(
  count: 2 | 3 | 4,
  playerWord: string,
  firstPlayerName?: string
): LocalSeatConfig[] {
  const activeColors: ColorId[] =
    count === 2
      ? ['red', 'yellow']
      : count === 3
      ? ['red', 'green', 'yellow']
      : ['red', 'green', 'yellow', 'blue'];

  let humanNum = 1;
  return LOCAL_COLOR_ORDER.map((color, idx) => {
    const isActive = activeColors.includes(color);
    const num = humanNum++;
    const defaultName =
      idx === 0 && firstPlayerName?.trim()
        ? firstPlayerName.trim().slice(0, 16)
        : `${playerWord} ${num}`;
    return {
      color,
      name: defaultName,
      seatType: isActive ? 'human' : 'off',
    };
  });
}

export const ArenaScreen: React.FC<ArenaScreenProps> = ({
  t,
  language,
  soundEnabled,
  matchActive,
  matchTitle,
  matchMode,
  stake,
  difficulty,
  coins,
  players,
  tokens,
  activeColor,
  diceValue,
  dicePhase,
  diceSpinNonce,
  diceLandCoord,
  diceThrowVector,
  hasRolled,
  rolling,
  animatingMove,
  movableTokenIds,
  returningTokenIds,
  statusMessage,
  winner,
  wagerPot,
  equippedDice,
  equippedToken,
  equippedBoard,
  playerProfile,
  isSignedIn,
  publicRooms,
  onlineChatMessages,
  onlineRoom,
  onlineMyColor,
  onlineMyPlayerId,
  onlineConnected,
  onlineError,
  initialJoinCode,
  onOpenAccount,
  onCreateOnlineRoom,
  onQuickMatchOnline,
  onRefreshPublicRooms,
  onJoinOnlineRoom,
  onSetOnlineStake,
  onToggleOnlineBots,
  onStartOnlineMatch,
  onLeaveOnlineRoom,
  onSendOnlineChat,
  onClearOnlineError,
  onToggleLanguage,
  onToggleSound,
  onChangeMode,
  onChangeStake,
  onChangeDifficulty,
  onLaunchMode,
  onOpenCoins,
  onOpenScreen,
  onRollDice,
  onSelectToken,
  onPlayAgain,
  onReturnToLobby,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hudHidden, setHudHidden] = useState(true);
  const [onlineChatOpen, setOnlineChatOpen] = useState(false);
  const [onlineChatDraft, setOnlineChatDraft] = useState('');
  const [pendingSetupMode, setPendingSetupMode] = useState<
    'quick-4p' | 'duel-2p' | 'pass-play' | 'online' | null
  >(() => (initialJoinCode ? 'online' : null));
  const [onlineTab, setOnlineTab] = useState<'create' | 'public' | 'join'>(() =>
    initialJoinCode ? 'join' : 'create'
  );
  const accountNick = playerProfile.name.trim().slice(0, 18) || 'Joueur';
  const [onlineName, setOnlineName] = useState<string>(() =>
    isSignedIn ? accountNick : getSavedPlayerName(playerProfile.name.split(' ')[0])
  );
  const [onlineMaxPlayers, setOnlineMaxPlayers] = useState<2 | 3 | 4>(4);
  const [onlineStake, setOnlineStake] = useState<number>(250);
  const [onlineStakeInput, setOnlineStakeInput] = useState<string>('250');
  const [hostStakeInput, setHostStakeInput] = useState<string>('250');
  const [soloStakeInput, setSoloStakeInput] = useState<string>(() => String(stake));
  const [onlineIsPublic, setOnlineIsPublic] = useState<boolean>(false);
  const [onlineJoinCode, setOnlineJoinCode] = useState<string>(() => initialJoinCode ?? '');
  const [copiedFlag, setCopiedFlag] = useState<'code' | 'link' | null>(null);
  const [localSeats, setLocalSeats] = useState<LocalSeatConfig[]>(() =>
    buildLocalPreset(
      4,
      t.lobby.local.defaultPlayer,
      isSignedIn ? playerProfile.name.trim().slice(0, 16) : undefined
    )
  );
  const [dragDice, setDragDice] = useState<{
    color: ColorId;
    clientX: number;
    clientY: number;
    matrix3d: string;
    speedRatio: number;
  } | null>(null);

  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const hasEditedOnlineNameRef = useRef<boolean>(false);

  useEffect(() => {
    if (isSignedIn) {
      if (!hasEditedOnlineNameRef.current) {
        setOnlineName(accountNick);
      }
      setLocalSeats((prev) =>
        prev.map((seat, idx) =>
          idx === 0 &&
          (seat.name.startsWith('Joueur ') || seat.name.startsWith('Player '))
            ? { ...seat, name: playerProfile.name.trim().slice(0, 16) }
            : seat
        )
      );
    } else {
      hasEditedOnlineNameRef.current = false;
      setOnlineName(getSavedPlayerName(playerProfile.name.split(' ')[0]));
    }
  }, [isSignedIn, accountNick, playerProfile.name]);

  useEffect(() => {
    if (onlineRoom) {
      setHostStakeInput(String(onlineRoom.stake));
    }
  }, [onlineRoom?.stake, onlineRoom?.code]);

  useEffect(() => {
    setSoloStakeInput(String(stake));
  }, [stake]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  const activePlayer = players[activeColor];
  const isHumanTurn = activePlayer?.isHuman ?? false;
  const isMyOnlineTurn = matchMode === 'online' ? activeColor === onlineMyColor : isHumanTurn;
  const canRoll =
    matchActive && !winner && isMyOnlineTurn && !hasRolled && !rolling && !animatingMove;

  const startDicePointerDrag = (color: ColorId, e: React.PointerEvent<HTMLButtonElement>) => {
    if (!canRoll || color !== activeColor) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    e.preventDefault();
    dragCleanupRef.current?.();

    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let hasDragged = false;
    const samples: { x: number; y: number; t: number }[] = [
      { x: startX, y: startY, t: performance.now() },
    ];

    const computeVelocity = (now: number, x: number, y: number) => {
      samples.push({ x, y, t: now });
      while (samples.length > 2 && now - samples[0].t > 95) {
        samples.shift();
      }
      const first = samples[0];
      const dtSec = Math.max(0.012, (now - first.t) / 1000);
      return {
        vx: (x - first.x) / dtSec,
        vy: (y - first.y) / dtSec,
      };
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const now = performance.now();
      const distFromStart = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (!hasDragged && distFromStart > 7) {
        hasDragged = true;
      }

      const { vx, vy } = computeVelocity(now, ev.clientX, ev.clientY);
      if (hasDragged) {
        const tiltX = Math.max(-0.55, Math.min(0.55, -vy * 0.00045));
        const tiltY = Math.max(-0.55, Math.min(0.55, vx * 0.00045));
        const qBase = getFaceQuaternion(diceValue, 0);
        const qTilt = mulQuat(
          quatFromAxisAngle(1, 0, 0, tiltX),
          mulQuat(quatFromAxisAngle(0, 1, 0, tiltY), qBase)
        );
        const speedRatio = Math.min(1, Math.hypot(vx, vy) / 900);

        setDragDice({
          color,
          clientX: ev.clientX,
          clientY: ev.clientY,
          matrix3d: quatToMatrix3d(qTilt),
          speedRatio,
        });
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      dragCleanupRef.current = null;
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const now = performance.now();
      const { vx, vy } = computeVelocity(now, ev.clientX, ev.clientY);
      cleanup();
      setDragDice(null);

      if (!hasDragged) {
        onRollDice();
        return;
      }

      const rect = boardContainerRef.current?.getBoundingClientRect();
      const width = rect?.width || 540;
      const height = rect?.height || 540;
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;

      const startPct = {
        x: ((ev.clientX - left) / width) * 100,
        y: ((ev.clientY - top) / height) * 100,
      };
      const vxPct = (vx / width) * 100;
      const vyPct = (vy / height) * 100;
      const speedPct = Math.hypot(vxPct, vyPct);
      const power = Math.min(1.85, Math.max(0.35, speedPct / 135));

      onRollDice({
        startPct,
        velocityPctPerSec: { vx: vxPct, vy: vyPct },
        power,
      });
    };

    const onPointerCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      setDragDice(null);
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  };

  if (!matchActive) {
    const canAfford = coins >= stake;

    return (
      <div className="min-h-dvh w-full flex flex-col items-center justify-between px-4 py-4 sm:p-6 relative overflow-hidden">
        {/* Subtle ambient 4-color Ludo glow */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div className="absolute -top-32 -left-32 w-[380px] h-[380px] rounded-full bg-[#16A34A]/12 blur-[120px]" />
          <div className="absolute -top-32 -right-32 w-[380px] h-[380px] rounded-full bg-[#EAB308]/10 blur-[120px]" />
          <div className="absolute -bottom-32 -left-32 w-[380px] h-[380px] rounded-full bg-[#DC2626]/12 blur-[120px]" />
          <div className="absolute -bottom-32 -right-32 w-[380px] h-[380px] rounded-full bg-[#2563EB]/12 blur-[120px]" />
        </div>

        {/* Minimal Top Bar: Account + Coins on left, Language + Sound on right */}
        <header className="w-full max-w-[460px] flex items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onOpenAccount();
              }}
              title={t.auth.accountBtn}
              className="flex items-center gap-2 rounded-full bg-[#111827]/90 hover:bg-[#1E293B] border border-white/15 pl-1 pr-2.5 py-1 transition-colors min-w-0"
            >
              <PlayerAvatar
                src={playerProfile.avatar}
                name={playerProfile.name}
                color="red"
                size="sm"
              />
              <span className="text-[11px] font-display font-bold text-white truncate max-w-[90px]">
                {isSignedIn ? playerProfile.name.split(' ')[0] : t.auth.signInShort}
              </span>
              {isSignedIn && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </button>
            <div className="flex items-center gap-1.5 rounded-full bg-[#111827]/90 border border-[#F97316]/45 pl-2.5 pr-1 py-1 shrink-0">
              <Coins className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
              <span className="font-mono-num text-xs font-bold text-white">
                {coins.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onOpenCoins();
                }}
                aria-label={t.header.addCoins}
                className="w-5 h-5 rounded-full bg-[#F97316]/25 hover:bg-[#F97316]/45 flex items-center justify-center text-[#FBBF24] transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleLanguage}
              aria-label="Switch language"
              className="px-2.5 py-2 rounded-xl bg-[#111827]/85 hover:bg-[#1E293B] border border-white/15 text-[11px] font-display font-bold text-[#4cd7f6] inline-flex items-center gap-1 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {language.toUpperCase()}
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              aria-label={soundEnabled ? t.header.muteSound : t.header.enableSound}
              className="p-2 rounded-xl bg-[#111827]/85 hover:bg-[#1E293B] border border-white/15 text-[#E2E8F0] transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#94A3B8]" />
              )}
            </button>
          </div>
        </header>

        {/* Centered Ludo King-style Emblem + 2x2 Mode Grid */}
        <main className="w-full max-w-[420px] flex flex-col items-center justify-center gap-7 my-auto py-4 z-10">
          {/* Ludo King 4-Color Emblem + Title */}
          <div className="flex flex-col items-center text-center">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-amber-300/60 shadow-[0_12px_36px_rgba(0,0,0,0.65)] grid grid-cols-2 grid-rows-2">
              <div className="bg-[#16A34A]" />
              <div className="bg-[#EAB308]" />
              <div className="bg-[#DC2626]" />
              <div className="bg-[#2563EB]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-[#0B0F19]/90 border border-amber-300/80 flex items-center justify-center shadow-lg">
                  <Crown className="w-5 h-5 text-[#FBBF24]" />
                </div>
              </div>
            </div>

            <h1 className="mt-4 font-display text-3xl sm:text-4xl font-black tracking-wider text-white uppercase">
              LUDO <span className="text-[#FBBF24]">ARENA</span>
            </h1>
          </div>

          {/* Iconic 2x2 Mode Cards */}
          <div className="w-full grid grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onClearOnlineError();
                onRefreshPublicRooms();
                setPendingSetupMode('online');
              }}
              className="group rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#7C3AED]/30 to-[#0B0F19]/90 border border-[#A78BFA]/50 hover:border-[#A78BFA] shadow-[0_10px_28px_rgba(124,58,237,0.22)] flex flex-col items-center text-center gap-2 transition-all active:scale-95"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/25 border border-[#A78BFA]/50 flex items-center justify-center text-[#A78BFA] group-hover:scale-105 transition-transform">
                <Wifi className="w-6 h-6" />
              </div>
              <div>
                <div className="font-display text-sm sm:text-base font-extrabold text-white">
                  {t.lobby.home.online}
                </div>
                <div className="text-[11px] text-[#94A3B8] mt-0.5">
                  {t.lobby.home.onlineSub}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onChangeMode('quick-4p');
                setPendingSetupMode('quick-4p');
              }}
              className="group rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#0284C7]/25 to-[#0B0F19]/90 border border-[#38BDF8]/45 hover:border-[#38BDF8] shadow-[0_10px_28px_rgba(2,132,199,0.2)] flex flex-col items-center text-center gap-2 transition-all active:scale-95"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0284C7]/25 border border-[#38BDF8]/50 flex items-center justify-center text-[#38BDF8] group-hover:scale-105 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="font-display text-sm sm:text-base font-extrabold text-white">
                  {t.lobby.home.vsComputer}
                </div>
                <div className="text-[11px] text-[#94A3B8] mt-0.5">
                  {t.lobby.home.vsComputerSub}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onChangeMode('duel-2p');
                setPendingSetupMode('duel-2p');
              }}
              className="group rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#D97706]/25 to-[#0B0F19]/90 border border-[#FBBF24]/45 hover:border-[#FBBF24] shadow-[0_10px_28px_rgba(217,119,6,0.2)] flex flex-col items-center text-center gap-2 transition-all active:scale-95"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#D97706]/25 border border-[#FBBF24]/50 flex items-center justify-center text-[#FBBF24] group-hover:scale-105 transition-transform">
                <Swords className="w-6 h-6" />
              </div>
              <div>
                <div className="font-display text-sm sm:text-base font-extrabold text-white">
                  {t.lobby.home.duel1v1}
                </div>
                <div className="text-[11px] text-[#94A3B8] mt-0.5">
                  {t.lobby.home.duel1v1Sub}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onChangeMode('pass-play');
                setLocalSeats((prev) =>
                  prev.map((seat, idx) => {
                    const isGeneric =
                      seat.name.startsWith('Joueur ') || seat.name.startsWith('Player ');
                    if (!isGeneric) return seat;
                    if (idx === 0 && isSignedIn && seat.seatType === 'human') {
                      return { ...seat, name: playerProfile.name.trim().slice(0, 16) };
                    }
                    return {
                      ...seat,
                      name:
                        seat.seatType === 'bot'
                          ? `${t.lobby.local.botLabel} ${idx + 1}`
                          : `${t.lobby.local.defaultPlayer} ${idx + 1}`,
                    };
                  })
                );
                setPendingSetupMode('pass-play');
              }}
              className="group rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#059669]/25 to-[#0B0F19]/90 border border-[#34D399]/45 hover:border-[#34D399] shadow-[0_10px_28px_rgba(5,150,105,0.2)] flex flex-col items-center text-center gap-2 transition-all active:scale-95"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#059669]/25 border border-[#34D399]/50 flex items-center justify-center text-[#34D399] group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="font-display text-sm sm:text-base font-extrabold text-white">
                  {t.lobby.home.passPlay}
                </div>
                <div className="text-[11px] text-[#94A3B8] mt-0.5">
                  {t.lobby.home.passPlaySub}
                </div>
              </div>
            </button>
          </div>
        </main>

        {/* Minimal Bottom Dock for Tournaments / Armory / Leaderboard / Social */}
        <footer className="w-full max-w-[460px] flex flex-wrap items-center justify-center gap-2 z-10">
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              onOpenScreen('tournaments');
            }}
            className="px-3 py-2 rounded-xl bg-[#111827]/80 hover:bg-[#1E293B] border border-white/10 text-xs font-display font-semibold text-[#CBD5E1] hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <Trophy className="w-3.5 h-3.5 text-[#A78BFA]" />
            {t.nav.tournaments}
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              onOpenScreen('inventory');
            }}
            className="px-3 py-2 rounded-xl bg-[#111827]/80 hover:bg-[#1E293B] border border-white/10 text-xs font-display font-semibold text-[#CBD5E1] hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#4cd7f6]" />
            {t.nav.inventory}
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              onOpenScreen('leaderboard');
            }}
            className="px-3 py-2 rounded-xl bg-[#111827]/80 hover:bg-[#1E293B] border border-white/10 text-xs font-display font-semibold text-[#CBD5E1] hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <Award className="w-3.5 h-3.5 text-[#FBBF24]" />
            {t.nav.leaderboard}
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              onOpenScreen('social');
            }}
            className="px-3 py-2 rounded-xl bg-[#111827]/80 hover:bg-[#1E293B] border border-white/10 text-xs font-display font-semibold text-[#CBD5E1] hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-[#34D399]" />
            {t.nav.social}
          </button>
        </footer>

        {/* Compact Quick-Start Modal for Online Room, Vs Computer, 1v1 Duel & Local Pass & Play */}
        {(pendingSetupMode || (onlineRoom && onlineRoom.status === 'waiting')) && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={
              pendingSetupMode === 'online' || onlineRoom?.status === 'waiting'
                ? t.lobby.online.title
                : pendingSetupMode === 'pass-play'
                ? t.lobby.local.title
                : pendingSetupMode === 'duel-2p'
                ? t.lobby.home.duel1v1
                : t.lobby.home.vsComputer
            }
          >
            {onlineRoom && onlineRoom.status === 'waiting' ? (
              (() => {
                const isHost = onlineRoom.hostPlayerId === onlineMyPlayerId;
                const presetColors =
                  onlineRoom.maxPlayers === 2
                    ? (['red', 'yellow'] as ColorId[])
                    : onlineRoom.maxPlayers === 3
                    ? (['red', 'green', 'yellow'] as ColorId[])
                    : LOCAL_COLOR_ORDER;
                const humanCount = presetColors.filter(
                  (c) => onlineRoom.seats[c].playerId && !onlineRoom.seats[c].isBot
                ).length;
                const projectedSeats = onlineRoom.fillWithBots
                  ? onlineRoom.maxPlayers
                  : Math.max(humanCount, 2);
                const projectedPot = onlineRoom.stake * projectedSeats;
                const canStartOnline =
                  isHost && (onlineRoom.fillWithBots ? onlineRoom.maxPlayers >= 2 : humanCount >= 2);

                const copyRoomText = async (kind: 'code' | 'link') => {
                  const value =
                    kind === 'code'
                      ? onlineRoom.code
                      : `${window.location.origin}/?room=${onlineRoom.code}`;
                  try {
                    await navigator.clipboard.writeText(value);
                    setCopiedFlag(kind);
                    window.setTimeout(() => setCopiedFlag(null), 1600);
                  } catch {
                    // Clipboard fallback ignored
                  }
                };

                return (
                  <div className="glass-card rounded-2xl w-full max-w-md p-5 space-y-4 relative">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingSetupMode(null);
                        onLeaveOnlineRoom();
                      }}
                      aria-label="Close"
                      className="absolute right-3.5 top-3.5 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2">
                      <Wifi
                        className={`w-4 h-4 ${
                          onlineConnected ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      />
                      <span className="font-display text-lg font-extrabold text-white">
                        {t.lobby.online.title}
                      </span>
                    </div>

                    {/* Shareable Room Code */}
                    <div className="rounded-xl bg-[#0B0F19]/85 border border-[#A78BFA]/35 p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                          {t.lobby.online.roomCode}
                        </div>
                        <div className="font-mono-num text-2xl font-black tracking-[0.22em] text-[#FBBF24] mt-0.5">
                          {onlineRoom.code}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyRoomText('code')}
                          className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-display font-bold text-white inline-flex items-center gap-1"
                        >
                          {copiedFlag === 'code' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-[#A78BFA]" />
                          )}
                          {copiedFlag === 'code' ? t.lobby.online.copied : t.lobby.online.copyCode}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyRoomText('link')}
                          title={t.lobby.online.copyLink}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[#4cd7f6]"
                        >
                          {copiedFlag === 'link' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Seats */}
                    <div className="space-y-2">
                      {presetColors.map((color) => {
                        const seat = onlineRoom.seats[color];
                        const palette = COLOR_HEX[color];
                        const occupied = Boolean(seat.playerId);
                        const willBeBot = !occupied && onlineRoom.fillWithBots;
                        return (
                          <div
                            key={color}
                            className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${
                              occupied
                                ? 'bg-[#0B0F19]/85 border-white/15'
                                : 'bg-[#0B0F19]/45 border-white/5 opacity-75'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/30"
                                style={{ backgroundColor: palette.primary }}
                              />
                              <span className="font-display text-xs font-bold text-white truncate">
                                {occupied
                                  ? seat.name
                                  : willBeBot
                                  ? `${t.lobby.online.botBadge} (${color})`
                                  : t.lobby.online.waitingSeat}
                              </span>
                              {seat.playerId === onlineMyPlayerId && (
                                <span className="text-[10px] font-display font-bold text-[#4cd7f6]">
                                  ({t.board.youTag})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {seat.isHost && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-[#FBBF24] text-[10px] font-display font-bold">
                                  {t.lobby.online.hostBadge}
                                </span>
                              )}
                              {occupied ? (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-display font-bold ${
                                    seat.connected
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {seat.connected
                                    ? t.lobby.online.readyBadge
                                    : t.lobby.online.offlineBadge}
                                </span>
                              ) : willBeBot ? (
                                <span className="px-2 py-0.5 rounded-md bg-[#06B6D4]/20 text-[#4cd7f6] text-[10px] font-display font-bold">
                                  {t.lobby.online.botBadge}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Room Stake & Winner Pot Summary */}
                    <div className="rounded-xl bg-[#0B0F19]/75 border border-white/10 p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs font-display">
                        <div className="flex items-center gap-1.5 text-[#94A3B8]">
                          <Coins className="w-3.5 h-3.5 text-[#FBBF24]" />
                          <span className="font-semibold">{t.lobby.online.stakeLabel}</span>
                          <span className="font-mono-num font-bold text-white">
                            {onlineRoom.stake === 0
                              ? t.lobby.online.freeOption
                              : onlineRoom.stake.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#94A3B8]">
                          <Trophy className="w-3.5 h-3.5 text-[#4cd7f6]" />
                          <span className="font-semibold">{t.lobby.online.potPreview}</span>
                          <span className="font-mono-num font-bold text-[#FBBF24]">
                            {onlineRoom.stake === 0
                              ? t.lobby.online.freeOption
                              : projectedPot.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {isHost && (
                        <>
                          <div className="grid grid-cols-5 gap-1.5">
                            {ONLINE_STAKE_OPTIONS.map((amt) => {
                              const selected = onlineRoom.stake === amt;
                              const affordable = coins >= amt;
                              return (
                                <button
                                  key={amt}
                                  type="button"
                                  disabled={!affordable}
                                  onClick={() => {
                                    soundFX.playClick();
                                    setHostStakeInput(String(amt));
                                    onSetOnlineStake(amt);
                                  }}
                                  className={`py-1.5 rounded-lg font-mono-num text-[11px] font-bold border transition-all ${
                                    selected
                                      ? 'bg-[#F97316]/20 border-[#FBBF24] text-[#FBBF24]'
                                      : !affordable
                                      ? 'bg-[#0B0F19]/40 border-white/5 text-[#64748B] opacity-50 cursor-not-allowed'
                                      : 'bg-[#0B0F19]/70 border-white/10 text-[#E2E8F0] hover:border-white/25'
                                  }`}
                                >
                                  {amt === 0 ? t.lobby.online.freeOption : amt}
                                </button>
                              );
                            })}
                          </div>
                          {(() => {
                            const parsedHostStake =
                              hostStakeInput.trim() === ''
                                ? NaN
                                : Math.max(0, Math.min(1_000_000, Math.floor(Number(hostStakeInput))));
                            const isValidCustom =
                              Number.isFinite(parsedHostStake) &&
                              parsedHostStake >= 0 &&
                              parsedHostStake <= coins;
                            const canApply = isValidCustom && parsedHostStake !== onlineRoom.stake;
                            return (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!canApply) return;
                                  soundFX.playClick();
                                  onSetOnlineStake(parsedHostStake);
                                }}
                                className="flex items-center gap-1.5 pt-0.5"
                              >
                                <input
                                  type="number"
                                  min={0}
                                  max={Math.max(0, coins)}
                                  step={10}
                                  value={hostStakeInput}
                                  placeholder={t.lobby.online.customStakePlaceholder}
                                  aria-label={t.lobby.online.customStakeLabel}
                                  onChange={(e) => setHostStakeInput(e.target.value)}
                                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#0B0F19]/90 border border-white/15 font-mono-num text-xs font-bold text-white focus:outline-none focus:border-[#FBBF24]"
                                />
                                <button
                                  type="submit"
                                  disabled={!canApply}
                                  className={`px-3 py-1.5 rounded-lg font-display text-[11px] font-bold shrink-0 transition-colors ${
                                    canApply
                                      ? 'bg-[#F97316]/25 hover:bg-[#F97316]/40 border border-[#FBBF24]/60 text-[#FBBF24]'
                                      : 'bg-white/5 border border-white/10 text-[#64748B] cursor-not-allowed'
                                  }`}
                                >
                                  {t.lobby.online.applyStake}
                                </button>
                              </form>
                            );
                          })()}
                        </>
                      )}
                    </div>

                    {isHost && (
                      <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                        <span className="text-xs font-display font-semibold text-[#E2E8F0]">
                          {t.lobby.online.fillBots}
                        </span>
                        <input
                          type="checkbox"
                          checked={onlineRoom.fillWithBots}
                          onChange={(e) => onToggleOnlineBots(e.target.checked)}
                          className="accent-[#8B5CF6] w-4 h-4"
                        />
                      </label>
                    )}

                    {onlineError && (
                      <p className="text-[11px] text-rose-400 font-display text-center">
                        {onlineError}
                      </p>
                    )}

                    {!isHost && (
                      <p className="text-xs text-[#94A3B8] font-display text-center">
                        {t.lobby.online.waitingHost}
                      </p>
                    )}

                    {isHost && !canStartOnline && (
                      <p className="text-[11px] text-amber-300 font-display text-center">
                        {t.lobby.online.needPlayers}
                      </p>
                    )}

                    <div className="flex gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingSetupMode(null);
                          onLeaveOnlineRoom();
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-[#E2E8F0]"
                      >
                        {t.lobby.online.leaveRoom}
                      </button>
                      {isHost && (
                        <button
                          type="button"
                          disabled={!canStartOnline}
                          onClick={onStartOnlineMatch}
                          className={`flex-1 py-2.5 rounded-xl font-display text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                            canStartOnline
                              ? 'btn-primary-violet text-white'
                              : 'bg-white/5 border border-white/10 text-[#64748B] cursor-not-allowed'
                          }`}
                        >
                          <Dices className="w-4 h-4" />
                          {t.lobby.online.startMatch}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : pendingSetupMode === 'online' ? (
              <div className="glass-card rounded-2xl w-full max-w-md p-5 space-y-4 relative">
                <button
                  type="button"
                  onClick={() => {
                    onClearOnlineError();
                    setPendingSetupMode(null);
                  }}
                  aria-label="Close"
                  className="absolute right-3.5 top-3.5 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-[#A78BFA]" />
                  <span className="font-display text-lg font-extrabold text-white">
                    {t.lobby.online.title}
                  </span>
                </div>

                {/* Create / Public Rooms / Join Tabs */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0B0F19]/80 border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      onClearOnlineError();
                      setOnlineTab('create');
                    }}
                    className={`py-2 rounded-lg text-[11px] font-display font-bold transition-colors ${
                      onlineTab === 'create'
                        ? 'bg-[#7C3AED] text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {t.lobby.online.tabCreate}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearOnlineError();
                      onRefreshPublicRooms();
                      setOnlineTab('public');
                    }}
                    className={`py-2 rounded-lg text-[11px] font-display font-bold transition-colors ${
                      onlineTab === 'public'
                        ? 'bg-[#7C3AED] text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {t.lobby.online.tabPublic}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearOnlineError();
                      setOnlineTab('join');
                    }}
                    className={`py-2 rounded-lg text-[11px] font-display font-bold transition-colors ${
                      onlineTab === 'join'
                        ? 'bg-[#7C3AED] text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {t.lobby.online.tabJoin}
                  </button>
                </div>

                {/* Nickname */}
                <div>
                  <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t.lobby.online.yourName}
                  </label>
                  <input
                    type="text"
                    value={onlineName}
                    maxLength={18}
                    placeholder={accountNick}
                    onChange={(e) => {
                      hasEditedOnlineNameRef.current = true;
                      setOnlineName(e.target.value);
                      savePlayerName(e.target.value);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F19]/85 border border-white/15 text-xs font-display font-semibold text-white focus:outline-none focus:border-[#A78BFA]"
                  />
                </div>

                {onlineTab === 'create' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        {t.lobby.online.roomSize}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {([2, 3, 4] as const).map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setOnlineMaxPlayers(cnt)}
                            className={`py-2 rounded-xl font-display text-xs font-bold border transition-all ${
                              onlineMaxPlayers === cnt
                                ? 'bg-[#7C3AED]/25 border-[#A78BFA] text-white'
                                : 'bg-[#0B0F19]/70 border-white/10 text-[#E2E8F0] hover:border-white/25'
                            }`}
                          >
                            {cnt} {t.lobby.local.playersShort}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                          {t.lobby.online.stakeLabel}
                        </label>
                        <span className="text-[11px] font-display font-semibold text-[#FBBF24]">
                          {t.lobby.online.potPreview}:{' '}
                          <span className="font-mono-num">
                            {onlineStake === 0
                              ? t.lobby.online.freeOption
                              : (onlineStake * onlineMaxPlayers).toLocaleString()}
                          </span>
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {ONLINE_STAKE_OPTIONS.map((amt) => {
                          const selected = onlineStake === amt;
                          const affordable = coins >= amt;
                          return (
                            <button
                              key={amt}
                              type="button"
                              disabled={!affordable}
                              onClick={() => {
                                soundFX.playClick();
                                setOnlineStake(amt);
                                setOnlineStakeInput(String(amt));
                              }}
                              className={`py-2 rounded-xl font-mono-num text-[11px] font-bold border transition-all ${
                                selected
                                  ? 'bg-[#F97316]/20 border-[#FBBF24] text-[#FBBF24]'
                                  : !affordable
                                  ? 'bg-[#0B0F19]/40 border-white/5 text-[#64748B] opacity-50 cursor-not-allowed'
                                  : 'bg-[#0B0F19]/70 border-white/10 text-[#E2E8F0] hover:border-white/25'
                              }`}
                            >
                              {amt === 0 ? t.lobby.online.freeOption : amt}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#0B0F19]/85 border border-white/15 px-3 py-1.5">
                        <Coins className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                        <input
                          type="number"
                          min={0}
                          max={Math.max(0, coins)}
                          step={10}
                          value={onlineStakeInput}
                          placeholder={t.lobby.online.customStakePlaceholder}
                          aria-label={t.lobby.online.customStakeLabel}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setOnlineStakeInput(raw);
                            if (raw.trim() === '') {
                              setOnlineStake(0);
                              return;
                            }
                            const n = Math.floor(Number(raw));
                            if (Number.isFinite(n) && n >= 0) {
                              setOnlineStake(Math.min(1_000_000, n));
                            }
                          }}
                          className="flex-1 min-w-0 bg-transparent font-mono-num text-xs font-bold text-white focus:outline-none"
                        />
                        <span className="text-[10px] font-display font-semibold text-[#94A3B8] shrink-0">
                          {t.tournaments.coinsUnit}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        {t.lobby.online.visibilityLabel}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setOnlineIsPublic(false)}
                          className={`py-2 px-3 rounded-xl font-display text-xs font-bold border inline-flex items-center justify-center gap-1.5 transition-all ${
                            !onlineIsPublic
                              ? 'bg-[#7C3AED]/25 border-[#A78BFA] text-white'
                              : 'bg-[#0B0F19]/70 border-white/10 text-[#E2E8F0] hover:border-white/25'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          {t.lobby.online.privateRoom}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOnlineIsPublic(true)}
                          className={`py-2 px-3 rounded-xl font-display text-xs font-bold border inline-flex items-center justify-center gap-1.5 transition-all ${
                            onlineIsPublic
                              ? 'bg-[#06B6D4]/20 border-[#4cd7f6] text-[#4cd7f6]'
                              : 'bg-[#0B0F19]/70 border-white/10 text-[#E2E8F0] hover:border-white/25'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          {t.lobby.online.publicRoom}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : onlineTab === 'public' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-xl bg-[#0B0F19]/85 border border-white/15 px-2.5 py-2 w-28 shrink-0">
                        <Coins className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                        <input
                          type="number"
                          min={0}
                          max={Math.max(0, coins)}
                          step={10}
                          value={onlineStakeInput}
                          aria-label={t.lobby.online.customStakeLabel}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setOnlineStakeInput(raw);
                            if (raw.trim() === '') {
                              setOnlineStake(0);
                              return;
                            }
                            const n = Math.floor(Number(raw));
                            if (Number.isFinite(n) && n >= 0) {
                              setOnlineStake(Math.min(1_000_000, n));
                            }
                          }}
                          className="w-full min-w-0 bg-transparent font-mono-num text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={coins < onlineStake}
                        onClick={() => {
                          const cleanName = onlineName.trim() || accountNick;
                          savePlayerName(cleanName);
                          onQuickMatchOnline(cleanName, onlineStake, difficulty);
                        }}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-display text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                          coins >= onlineStake
                            ? 'btn-secondary-cyan'
                            : 'bg-white/5 border border-white/10 text-[#64748B] cursor-not-allowed'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        {t.lobby.online.quickMatchBtn} ·{' '}
                        {onlineStake === 0 ? t.lobby.online.freeOption : onlineStake}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          onRefreshPublicRooms();
                        }}
                        title={t.lobby.online.refreshList}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#E2E8F0]"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 pr-0.5">
                      {publicRooms.length === 0 ? (
                        <p className="text-xs text-[#94A3B8] text-center py-6 px-3 rounded-xl bg-[#0B0F19]/60 border border-white/5">
                          {t.lobby.online.noPublicRooms}
                        </p>
                      ) : (
                        publicRooms.map((room) => {
                          const canJoinRoom = coins >= room.stake;
                          return (
                            <div
                              key={room.code}
                              className="rounded-xl bg-[#0B0F19]/80 border border-white/10 px-3 py-2.5 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono-num text-xs font-extrabold text-[#FBBF24]">
                                    {room.code}
                                  </span>
                                  <span className="text-xs font-display font-bold text-white truncate">
                                    · {room.hostName}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#94A3B8] font-mono-num mt-0.5">
                                  {fmt(t.lobby.online.playersRatio, {
                                    count: room.playerCount,
                                    max: room.maxPlayers,
                                  })}{' '}
                                  ·{' '}
                                  {room.stake === 0
                                    ? t.lobby.online.freeOption
                                    : `${room.stake} ${t.tournaments.coinsUnit}`}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={!canJoinRoom}
                                onClick={() => {
                                  const cleanName = onlineName.trim() || accountNick;
                                  savePlayerName(cleanName);
                                  onJoinOnlineRoom(room.code, cleanName);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-display font-bold shrink-0 ${
                                  canJoinRoom
                                    ? 'btn-primary-violet text-white'
                                    : 'bg-white/5 text-[#64748B] cursor-not-allowed'
                                }`}
                              >
                                {t.lobby.online.joinShort}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      {t.lobby.online.codeLabel}
                    </label>
                    <input
                      type="text"
                      value={onlineJoinCode}
                      maxLength={6}
                      placeholder={t.lobby.online.codePlaceholder}
                      onChange={(e) => setOnlineJoinCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F19]/85 border border-white/15 font-mono-num text-sm font-bold tracking-[0.22em] text-[#FBBF24] uppercase focus:outline-none focus:border-[#A78BFA]"
                    />
                  </div>
                )}

                {onlineError && (
                  <p className="text-[11px] text-rose-400 font-display text-center">
                    {onlineError}
                  </p>
                )}

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClearOnlineError();
                      setPendingSetupMode(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-[#E2E8F0]"
                  >
                    {t.lobby.home.cancel}
                  </button>
                  {onlineTab === 'create' ? (
                    <button
                      type="button"
                      disabled={coins < onlineStake}
                      onClick={() => {
                        const cleanName = onlineName.trim() || accountNick;
                        savePlayerName(cleanName);
                        onCreateOnlineRoom(
                          cleanName,
                          onlineMaxPlayers,
                          onlineStake,
                          difficulty,
                          onlineIsPublic
                        );
                      }}
                      className={`flex-1 py-2.5 rounded-xl font-display text-xs font-bold ${
                        coins >= onlineStake
                          ? 'btn-primary-violet text-white'
                          : 'bg-white/5 border border-white/10 text-[#64748B] cursor-not-allowed'
                      }`}
                    >
                      {coins >= onlineStake
                        ? t.lobby.online.createBtn
                        : t.tournaments.insufficientCoins}
                    </button>
                  ) : onlineTab === 'join' ? (
                    <button
                      type="button"
                      disabled={onlineJoinCode.trim().length < 4}
                      onClick={() => {
                        const cleanName = onlineName.trim() || accountNick;
                        savePlayerName(cleanName);
                        onJoinOnlineRoom(onlineJoinCode.trim().toUpperCase(), cleanName);
                      }}
                      className={`flex-1 py-2.5 rounded-xl font-display text-xs font-bold ${
                        onlineJoinCode.trim().length >= 4
                          ? 'btn-primary-violet text-white'
                          : 'bg-white/5 border border-white/10 text-[#64748B] cursor-not-allowed'
                      }`}
                    >
                      {t.lobby.online.joinBtn}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : pendingSetupMode === 'pass-play' ? (
              (() => {
                const activeCount = localSeats.filter((s) => s.seatType !== 'off').length;
                const humanCount = localSeats.filter((s) => s.seatType === 'human').length;
                const hasBots = localSeats.some((s) => s.seatType === 'bot');
                const isLocalValid = activeCount >= 2 && humanCount >= 1;

                const updateSeat = (color: ColorId, patch: Partial<LocalSeatConfig>) => {
                  setLocalSeats((prev) =>
                    prev.map((seat, idx) => {
                      if (seat.color !== color) return seat;
                      const nextType = patch.seatType ?? seat.seatType;
                      let nextName = patch.name ?? seat.name;
                      if (patch.seatType && !patch.name) {
                        const isGeneric =
                          seat.name.startsWith('Joueur ') ||
                          seat.name.startsWith('Player ') ||
                          seat.name.startsWith('Bot ');
                        if (isGeneric) {
                          nextName =
                            nextType === 'bot'
                              ? `${t.lobby.local.botLabel} ${idx + 1}`
                              : `${t.lobby.local.defaultPlayer} ${idx + 1}`;
                        }
                      }
                      return { ...seat, ...patch, name: nextName };
                    })
                  );
                };

                return (
                  <div className="glass-card rounded-2xl w-full max-w-md p-5 space-y-4 relative">
                    <button
                      type="button"
                      onClick={() => setPendingSetupMode(null)}
                      aria-label="Close"
                      className="absolute right-3.5 top-3.5 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="font-display text-lg font-extrabold text-white">
                      {t.lobby.local.title}
                    </div>

                    {/* Quick 2 / 3 / 4 Player Count Presets */}
                    <div>
                      <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
                        {t.lobby.local.playerCount}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {([2, 3, 4] as const).map((cnt) => {
                          const isSelected = activeCount === cnt && humanCount === cnt;
                          return (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => {
                                soundFX.playClick();
                                setLocalSeats(
                                  buildLocalPreset(
                                    cnt,
                                    t.lobby.local.defaultPlayer,
                                    isSignedIn ? playerProfile.name.trim().slice(0, 16) : undefined
                                  )
                                );
                              }}
                              className={`py-2 rounded-xl font-display text-xs font-bold border transition-all ${
                                isSelected
                                  ? 'bg-[#10B981]/15 border-[#34D399] text-[#34D399]'
                                  : 'bg-[#0B0F19]/70 border-white/10 text-[#E2E8F0] hover:border-white/25'
                              }`}
                            >
                              {cnt} {t.lobby.local.playersShort}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Per-Color Seat Customization (Name + Human / AI / Off) */}
                    <div className="space-y-2">
                      {localSeats.map((seat) => {
                        const palette = COLOR_HEX[seat.color];
                        const isOff = seat.seatType === 'off';
                        return (
                          <div
                            key={seat.color}
                            className={`flex items-center gap-2 p-2 rounded-xl border transition-opacity ${
                              isOff
                                ? 'bg-[#0B0F19]/40 border-white/5 opacity-60'
                                : 'bg-[#0B0F19]/80 border-white/10'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/30"
                              style={{ backgroundColor: palette.primary }}
                            />
                            <input
                              type="text"
                              value={seat.name}
                              disabled={isOff}
                              maxLength={16}
                              placeholder={t.lobby.local.playerPlaceholder}
                              onChange={(e) => updateSeat(seat.color, { name: e.target.value })}
                              className="flex-1 min-w-0 bg-transparent text-xs font-display font-semibold text-white placeholder:text-[#64748B] focus:outline-none disabled:text-[#64748B]"
                            />
                            <div className="flex items-center gap-1 shrink-0 bg-white/5 p-0.5 rounded-lg">
                              {(
                                [
                                  { id: 'human', label: t.lobby.local.seatHuman },
                                  { id: 'bot', label: t.lobby.local.seatBot },
                                  { id: 'off', label: t.lobby.local.seatOff },
                                ] as { id: SeatType; label: string }[]
                              ).map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    soundFX.playClick();
                                    updateSeat(seat.color, { seatType: opt.id });
                                  }}
                                  className={`px-2 py-1 rounded-md text-[10px] font-display font-bold transition-colors ${
                                    seat.seatType === opt.id
                                      ? opt.id === 'human'
                                        ? 'bg-[#10B981]/25 text-[#34D399]'
                                        : opt.id === 'bot'
                                        ? 'bg-[#06B6D4]/25 text-[#4cd7f6]'
                                        : 'bg-white/15 text-[#CBD5E1]'
                                      : 'text-[#64748B] hover:text-[#CBD5E1]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {hasBots && (
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { id: 'standard', label: t.lobby.diffStandard },
                          { id: 'pro', label: t.lobby.diffPro },
                        ] as const).map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => onChangeDifficulty(d.id)}
                            className={`py-1.5 px-3 rounded-xl font-display text-[11px] font-bold border transition-all ${
                              difficulty === d.id
                                ? 'bg-[#06B6D4]/15 border-[#06B6D4] text-[#4cd7f6]'
                                : 'bg-[#0B0F19]/70 border-white/10 text-[#E2E8F0] hover:border-white/25'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {!isLocalValid && (
                      <p className="text-[11px] text-rose-400 font-display text-center">
                        {t.lobby.local.validationError}
                      </p>
                    )}

                    <div className="flex gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setPendingSetupMode(null)}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-[#E2E8F0]"
                      >
                        {t.lobby.home.cancel}
                      </button>
                      <button
                        type="button"
                        disabled={!isLocalValid}
                        onClick={() => {
                          setPendingSetupMode(null);
                          onLaunchMode('pass-play', localSeats);
                        }}
                        className={`flex-1 py-2.5 rounded-xl font-display text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                          isLocalValid
                            ? 'btn-primary-violet text-white'
                            : 'bg-white/5 border border-white/10 text-[#64748B] cursor-not-allowed'
                        }`}
                      >
                        <Dices className="w-4 h-4" />
                        {t.lobby.home.playNow}
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="glass-card rounded-2xl w-full max-w-sm p-5 space-y-4 relative">
                <button
                  type="button"
                  onClick={() => setPendingSetupMode(null)}
                  aria-label="Close"
                  className="absolute right-3.5 top-3.5 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="font-display text-lg font-extrabold text-white">
                  {pendingSetupMode === 'duel-2p'
                    ? t.lobby.home.duel1v1
                    : t.lobby.home.vsComputer}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                      {t.lobby.stepBuyIn}
                    </label>
                    <span className="text-[11px] font-display font-semibold text-[#FBBF24]">
                      {t.lobby.projectedPot}:{' '}
                      <span className="font-mono-num">
                        {stake === 0
                          ? t.lobby.online.freeOption
                          : (stake * (pendingSetupMode === 'duel-2p' ? 2 : 4)).toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {STAKE_OPTIONS.map((amt) => {
                      const affordable = coins >= amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          disabled={!affordable}
                          onClick={() => {
                            soundFX.playClick();
                            setSoloStakeInput(String(amt));
                            onChangeStake(amt);
                          }}
                          className={`py-2 rounded-xl font-mono-num text-[11px] font-bold border transition-all ${
                            stake === amt
                              ? 'bg-[#F97316]/15 border-[#F97316] text-[#FBBF24]'
                              : !affordable
                              ? 'bg-[#0B0F19]/40 border-white/5 text-[#64748B] opacity-50 cursor-not-allowed'
                              : 'bg-[#0B0F19]/70 border-white/10 text-[#E2E8F0] hover:border-white/25'
                          }`}
                        >
                          {amt === 0 ? t.lobby.online.freeOption : amt}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#0B0F19]/85 border border-white/15 px-3 py-1.5">
                    <Coins className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, coins)}
                      step={10}
                      value={soloStakeInput}
                      placeholder={t.lobby.online.customStakePlaceholder}
                      aria-label={t.lobby.online.customStakeLabel}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setSoloStakeInput(raw);
                        if (raw.trim() === '') {
                          onChangeStake(0);
                          return;
                        }
                        const n = Math.floor(Number(raw));
                        if (Number.isFinite(n) && n >= 0) {
                          onChangeStake(n);
                        }
                      }}
                      className="flex-1 min-w-0 bg-transparent font-mono-num text-xs font-bold text-white focus:outline-none"
                    />
                    <span className="text-[10px] font-display font-semibold text-[#94A3B8] shrink-0">
                      {t.tournaments.coinsUnit}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
                    {t.lobby.stepDifficulty}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'standard', label: t.lobby.diffStandard },
                      { id: 'pro', label: t.lobby.diffPro },
                    ] as const).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => onChangeDifficulty(d.id)}
                        className={`py-2 px-3 rounded-xl font-display text-xs font-bold border transition-all ${
                          difficulty === d.id
                            ? 'bg-[#06B6D4]/15 border-[#06B6D4] text-[#4cd7f6]'
                            : 'bg-[#0B0F19]/70 border-white/10 text-[#E2E8F0] hover:border-white/25'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPendingSetupMode(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-[#E2E8F0]"
                  >
                    {t.lobby.home.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => {
                      const mode = pendingSetupMode;
                      setPendingSetupMode(null);
                      if (mode) onLaunchMode(mode);
                    }}
                    className={`flex-1 py-2.5 rounded-xl font-display text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                      canAfford
                        ? 'btn-primary-violet text-white'
                        : 'bg-white/5 border border-white/10 text-[#64748B] cursor-not-allowed'
                    }`}
                  >
                    <Dices className="w-4 h-4" />
                    {canAfford ? t.lobby.home.playNow : t.lobby.insufficientCoins}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Focused Full-Screen Ludo Board Mode (No sidebars, no chat, no extra sections)
  const renderCornerPod = (color: ColorId, align: 'left' | 'right') => {
    const player = players[color];
    const palette = COLOR_HEX[color];
    const isTurn = activeColor === color && !winner;
    const isSeatActive = player.active;
    const homeCount = tokens.filter((t) => t.color === color && t.progress === 56).length;
    const podCanRoll = isTurn && canRoll;

    if (!isSeatActive) {
      return (
        <div
          className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border border-white/5 bg-[#111827]/40 opacity-35 ${
            align === 'right' ? 'flex-row-reverse text-right' : ''
          }`}
        >
          <div className="w-10 h-10 rounded-xl border border-white/10 bg-[#0B0F19]/60 flex items-center justify-center text-[10px] text-[#64748B] font-display">
            {t.board.emptySeat}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-2 rounded-2xl border transition-all duration-200 ${
          align === 'right' ? 'flex-row-reverse text-right' : ''
        }`}
        style={{
          backgroundColor: isTurn ? palette.soft : 'rgba(17, 24, 39, 0.78)',
          borderColor: isTurn ? palette.primary : 'rgba(148, 163, 184, 0.16)',
          boxShadow: isTurn ? `0 0 22px ${palette.soft}` : undefined,
        }}
      >
        <PlayerAvatar
          src={player.avatar}
          name={player.name}
          color={color}
          size="sm"
          isActiveTurn={isTurn}
        />

        <div className="min-w-0 max-w-[92px] sm:max-w-[118px]">
          <div className="font-display text-xs font-bold text-white truncate flex items-center gap-1">
            {matchMode === 'online' && onlineRoom && (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  onlineRoom.seats[color]?.connected ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
            )}
            <span className="truncate">
              {matchMode === 'pass-play' || matchMode === 'online'
                ? player.name
                : player.name.split(' ')[0]}
            </span>
          </div>
          <div className="font-mono-num text-[10px] text-[#94A3B8]">
            {homeCount}/4 {t.board.homeProgress}
            {matchMode === 'online' && color === onlineMyColor ? ` · ${t.board.youTag}` : ''}
          </div>
        </div>

        <div className="shrink-0 w-[42px] h-[42px] flex items-center justify-center">
          {isTurn && dicePhase === 'idle' && !dragDice ? (
            <Dice3D
              value={diceValue}
              rolling={false}
              canRoll={podCanRoll}
              skin={equippedDice}
              activeColor={color}
              compact
              onPointerDown={podCanRoll ? (e) => startDicePointerDrag(color, e) : undefined}
              onRoll={() => {
                if (podCanRoll) onRollDice();
              }}
            />
          ) : (
            <div
              className="w-[38px] h-[38px] rounded-xl border border-dashed transition-colors"
              style={{
                borderColor: isTurn ? `${palette.primary}88` : 'rgba(148, 163, 184, 0.16)',
                backgroundColor: isTurn ? `${palette.primary}12` : 'rgba(11, 15, 25, 0.45)',
              }}
            />
          )}
        </div>
      </div>
    );
  };

  const activeHex = COLOR_HEX[activeColor].primary;

  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-between px-3 py-3 sm:p-5 relative overflow-hidden">
      {/* Ambient Color Glow behind the Board */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] rounded-full blur-[140px] pointer-events-none opacity-25 transition-colors duration-700"
        style={{ backgroundColor: activeHex }}
      />

      {/* Floating Controls when Menu & Turn rows are hidden */}
      {hudHidden && (
        <div className="fixed top-3 right-3 z-30 flex items-center gap-1.5">
          {matchMode === 'online' && (
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setOnlineChatOpen((v) => !v);
              }}
              title={t.lobby.online.tableChat}
              aria-label={t.lobby.online.tableChat}
              className="relative p-2.5 rounded-xl bg-[#111827]/75 hover:bg-[#1E293B] border border-white/15 text-[#E2E8F0] backdrop-blur-md shadow-lg transition-all active:scale-95"
            >
              <MessageSquare className="w-4 h-4 text-[#A78BFA]" />
              {onlineChatMessages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#7C3AED] text-[9px] font-mono-num font-bold text-white flex items-center justify-center">
                  {onlineChatMessages.length > 9 ? '9+' : onlineChatMessages.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setHudHidden(false);
            }}
            title={t.board.showHud}
            aria-label={t.board.showHud}
            className="p-2.5 rounded-xl bg-[#111827]/75 hover:bg-[#1E293B] border border-white/15 text-[#E2E8F0] backdrop-blur-md shadow-lg transition-all active:scale-95"
          >
            <Eye className="w-4 h-4 text-[#4cd7f6]" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setMenuOpen(true);
            }}
            title={t.board.pauseTitle}
            aria-label={t.board.pauseTitle}
            className="p-2.5 rounded-xl bg-[#111827]/75 hover:bg-[#1E293B] border border-white/15 text-[#E2E8F0] backdrop-blur-md shadow-lg transition-all active:scale-95"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Collapsible Live Online Table Chat Drawer */}
      {matchMode === 'online' && onlineChatOpen && (
        <div className="fixed bottom-4 right-4 z-40 w-[300px] max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-3.5 space-y-2.5 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-extrabold text-white inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#A78BFA]" />
              {t.lobby.online.tableChat}
            </span>
            <button
              type="button"
              onClick={() => setOnlineChatOpen(false)}
              className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pr-1">
            {onlineChatMessages.length === 0 ? (
              <p className="text-[11px] text-[#64748B] text-center py-3">
                {t.telemetry.emptyLog}
              </p>
            ) : (
              onlineChatMessages.map((msg) => (
                <div key={msg.id} className="rounded-lg bg-[#0B0F19]/80 px-2.5 py-1.5">
                  <span
                    className="font-display font-bold mr-1.5"
                    style={{ color: COLOR_HEX[msg.color].primary }}
                  >
                    {msg.sender}:
                  </span>
                  <span className="text-[#E2E8F0]">{msg.text}</span>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {t.telemetry.quickPhrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => onSendOnlineChat(phrase)}
                className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-display text-[#CBD5E1]"
              >
                {phrase}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!onlineChatDraft.trim()) return;
              onSendOnlineChat(onlineChatDraft.trim());
              setOnlineChatDraft('');
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={onlineChatDraft}
              maxLength={140}
              onChange={(e) => setOnlineChatDraft(e.target.value)}
              placeholder={t.lobby.online.chatPlaceholder}
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0B0F19]/90 border border-white/15 text-xs text-white focus:outline-none focus:border-[#A78BFA]"
            />
            <button
              type="submit"
              className="p-2 rounded-lg btn-primary-violet text-white shrink-0"
              aria-label="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Top Action Bar */}
      {!hudHidden && (
        <header className="w-full max-w-[540px] flex items-center justify-between gap-2 z-10">
          <button
            type="button"
            onClick={onReturnToLobby}
            className="px-3 py-2 rounded-xl bg-[#111827]/85 hover:bg-[#1E293B] border border-white/15 text-xs font-display font-bold text-[#E2E8F0] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.board.menuBtn}
          </button>

          <div className="text-center min-w-0">
            <div className="font-display text-sm sm:text-base font-extrabold tracking-wider text-white uppercase truncate">
              {matchTitle}
            </div>
            <div className="text-[11px] text-[#94A3B8] font-mono-num">
              {wagerPot > 0
                ? `${t.board.pot}: ${wagerPot.toLocaleString()}`
                : t.board.practiceTable}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleLanguage}
              aria-label="Switch language"
              className="px-2.5 py-2 rounded-xl bg-[#111827]/85 hover:bg-[#1E293B] border border-white/15 text-[11px] font-display font-bold text-[#4cd7f6] inline-flex items-center gap-1 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {language.toUpperCase()}
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              aria-label={soundEnabled ? t.header.muteSound : t.header.enableSound}
              className="p-2 rounded-xl bg-[#111827]/85 hover:bg-[#1E293B] border border-white/15 text-[#E2E8F0] transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#94A3B8]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setHudHidden(true);
              }}
              title={t.board.hideHud}
              aria-label={t.board.hideHud}
              className="p-2 rounded-xl bg-[#111827]/85 hover:bg-[#1E293B] border border-white/15 text-[#E2E8F0] transition-colors"
            >
              <EyeOff className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t.board.pauseTitle}
              className="p-2 rounded-xl bg-[#111827]/85 hover:bg-[#1E293B] border border-white/15 text-[#E2E8F0] transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* Main Board Arena Staging */}
      <main className="w-full max-w-[540px] flex flex-col items-center justify-center gap-3 my-auto py-2 z-10">
        {/* Live Turn Announcement Banner */}
        {!hudHidden && (
          <div
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border backdrop-blur-md transition-all duration-300"
            style={{
              backgroundColor: `${activeHex}20`,
              borderColor: `${activeHex}70`,
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeHex, boxShadow: `0 0 10px ${activeHex}` }}
              />
              <div className="min-w-0">
                <div className="text-xs font-display font-bold text-white truncate">
                  {t.board.turnLabel} :{' '}
                  <span style={{ color: activeHex }}>{activePlayer.name}</span>
                </div>
                <div className="text-[11px] text-[#E2E8F0]/80 truncate">{statusMessage}</div>
              </div>
            </div>

            <span
              className="px-2.5 py-1 rounded-lg text-[10px] font-display font-bold uppercase border shrink-0"
              style={{
                backgroundColor: `${activeHex}28`,
                color: activeHex,
                borderColor: `${activeHex}88`,
              }}
            >
              {activePlayer.isHuman ? t.board.humanBadge : t.board.aiBadge}
            </span>
          </div>
        )}

        {/* Top Dices Row: Player 2 (Green TL) & Player 3 (Yellow TR) */}
        <div className="w-full flex items-center justify-between gap-2">
          {renderCornerPod('green', 'left')}
          {renderCornerPod('yellow', 'right')}
        </div>

        {/* 15x15 Classic Ludo King Board */}
        <div ref={boardContainerRef} className="w-full">
          <LudoBoard
            tokens={tokens}
            players={players}
            activeColor={activeColor}
            movableTokenIds={isHumanTurn && hasRolled && !animatingMove ? movableTokenIds : []}
            returningTokenIds={returningTokenIds}
            diceValue={hasRolled && !animatingMove ? diceValue : dicePhase !== 'idle' ? diceValue : null}
            dicePhase={dicePhase}
            diceSpinNonce={diceSpinNonce}
            diceLandCoord={diceLandCoord}
            diceThrowVector={diceThrowVector}
            equippedDice={equippedDice}
            tokenStyle={equippedToken}
            boardTheme={equippedBoard}
            onSelectToken={onSelectToken}
          />
        </div>

        {/* Bottom Dices Row: Player 1 (Red BL) & Player 4 (Blue BR) */}
        <div className="w-full flex items-center justify-between gap-2">
          {renderCornerPod('red', 'left')}
          {renderCornerPod('blue', 'right')}
        </div>
      </main>

      {/* Quiet Footer Tip */}
      <footer className="text-center text-[11px] text-[#64748B] z-10">
        {t.board.footerTip}
      </footer>

      {/* Dragged 3D Die Following Finger or Mouse Before Release */}
      {dragDice && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-50"
        >
          <div
            style={{
              left: `${dragDice.clientX}px`,
              top: `${dragDice.clientY}px`,
              transform: `translate(-50%, -50%) scale(${1.12 + dragDice.speedRatio * 0.14})`,
            }}
            className="fixed flex items-center justify-center will-change-transform"
          >
            <div
              className="absolute w-14 h-5 rounded-full blur-[10px]"
              style={{
                backgroundColor: 'rgba(2, 6, 23, 0.52)',
                transform: 'translateY(26px) scale(1.1)',
              }}
            />
            <Dice3D
              value={diceValue}
              rolling={false}
              canRoll={false}
              skin={equippedDice}
              activeColor={dragDice.color}
              sizePx={56}
              overrideMatrix3d={dragDice.matrix3d}
            />
          </div>
        </div>
      )}

      {/* Pause / Menu Modal */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t.board.pauseTitle}
        >
          <div className="glass-card rounded-2xl w-full max-w-sm p-6 space-y-4 relative">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="font-display text-xl font-bold text-white">{t.board.pauseTitle}</h2>
            <p className="text-xs text-[#94A3B8]">{t.board.pauseDesc}</p>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="btn-primary-violet w-full py-2.5 px-4 rounded-xl text-xs font-display font-bold text-white"
              >
                {t.board.resume}
              </button>
              {(matchMode !== 'online' || onlineRoom?.hostPlayerId === onlineMyPlayerId) && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onPlayAgain();
                  }}
                  className="btn-secondary-cyan w-full py-2.5 px-4 rounded-xl text-xs font-display font-bold"
                >
                  {t.board.restart}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReturnToLobby();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-[#E2E8F0]"
              >
                {t.board.exitLobby}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      {winner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t.board.matchComplete}
        >
          <div className="glass-card rounded-2xl w-full max-w-md p-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl mx-auto bg-[#F97316]/15 border border-[#FBBF24]/50 flex items-center justify-center shadow-[0_0_28px_rgba(251,191,36,0.35)]">
              <Crown className="w-8 h-8 text-[#FBBF24]" />
            </div>

            <div>
              <p className="text-xs font-display font-bold uppercase tracking-widest text-[#4cd7f6]">
                {t.board.matchComplete}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {fmt(
                  language === 'fr' ? '{name} {wins}' : '{name} {wins}',
                  { name: players[winner].name, wins: t.board.winsTitle }
                )}
              </h2>
              <p className="text-sm text-[#94A3B8] mt-1">
                {wagerPot > 0
                  ? `${wagerPot.toLocaleString()} ${t.board.winPotDesc}`
                  : t.board.winPracticeDesc}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {(matchMode !== 'online' || onlineRoom?.hostPlayerId === onlineMyPlayerId) && (
                <button
                  type="button"
                  onClick={onPlayAgain}
                  className="btn-primary-violet flex-1 py-3 px-4 rounded-xl text-xs font-display font-bold text-white inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t.board.playAgain}
                </button>
              )}
              <button
                type="button"
                onClick={onReturnToLobby}
                className="btn-secondary-cyan flex-1 py-3 px-4 rounded-xl text-xs font-display font-bold"
              >
                {t.board.returnLobby}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
