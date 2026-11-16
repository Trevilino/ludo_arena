import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crown, Star, Swords } from 'lucide-react';
import {
  BoardThemeId,
  ColorId,
  DiceRollPhase,
  DiceSkinId,
  DiceThrowVector,
  PlayerConfig,
  Token,
  TokenStyleId,
} from '../types/ludo';
import {
  COLOR_HEX,
  getDestinationCoord,
  getGlobalTrackIndex,
  getTokenGridCoord,
  HOME_STRETCH_COORDS,
  OUTER_TRACK_COORDS,
  SAFE_TRACK_INDICES,
  STAR_TRACK_INDICES,
  START_TRACK_INDEX,
} from '../utils/ludoEngine';
import {
  quatToMatrix3d,
  simulateDiceThrow,
  slerpQuat,
} from '../utils/dicePhysics';
import { Dice3D } from './Dice3D';

interface LudoBoardProps {
  tokens: Token[];
  players: Record<ColorId, PlayerConfig>;
  activeColor: ColorId;
  movableTokenIds: string[];
  returningTokenIds?: string[];
  diceValue: number | null;
  dicePhase: DiceRollPhase;
  diceSpinNonce: number;
  diceLandCoord: { x: number; y: number };
  diceThrowVector?: DiceThrowVector | null;
  equippedDice: DiceSkinId;
  tokenStyle: TokenStyleId;
  boardTheme: BoardThemeId;
  onSelectToken: (tokenId: string) => void;
}

const BOARD_THEME_STYLES: Record<
  BoardThemeId,
  {
    bezelBorder: string;
    boardBg: string;
    tileBg: string;
    tileBorder: string;
    starBg: string;
    starIcon: string;
    pocketInnerBg: string;
  }
> = {
  'midnight-obsidian': {
    bezelBorder: '#1e293b',
    boardBg: '#ffffff',
    tileBg: '#ffffff',
    tileBorder: '#cbd5e1',
    starBg: '#f1f5f9',
    starIcon: '#64748b',
    pocketInnerBg: '#ffffff',
  },
  'cobalt-vault': {
    bezelBorder: '#1d4ed8',
    boardBg: '#f0f7ff',
    tileBg: '#f8fbff',
    tileBorder: '#bfdbfe',
    starBg: '#e0f2fe',
    starIcon: '#0284c7',
    pocketInnerBg: '#ffffff',
  },
  'emerald-circuit': {
    bezelBorder: '#047857',
    boardBg: '#f0fdf9',
    tileBg: '#f7fefc',
    tileBorder: '#a7f3d0',
    starBg: '#d1fae5',
    starIcon: '#059669',
    pocketInnerBg: '#ffffff',
  },
};

const LUDO_POCKET_COLORS: Record<ColorId, { solid: string; dark: string }> = {
  green: { solid: '#16A34A', dark: '#15803D' },
  yellow: { solid: '#EAB308', dark: '#CA8A04' },
  blue: { solid: '#2563EB', dark: '#1D4ED8' },
  red: { solid: '#DC2626', dark: '#B91C1C' },
};

const CORNER_ORIGIN_PCT: Record<ColorId, { x: number; y: number }> = {
  green: { x: 10, y: 6 },
  yellow: { x: 90, y: 6 },
  red: { x: 10, y: 94 },
  blue: { x: 90, y: 94 },
};

const BoardRollingDiceOverlay: React.FC<{
  activeColor: ColorId;
  diceValue: number;
  dicePhase: DiceRollPhase;
  spinNonce: number;
  landCoord: { x: number; y: number };
  throwVector?: DiceThrowVector | null;
  skin: DiceSkinId;
}> = ({ activeColor, diceValue, dicePhase, spinNonce, landCoord, throwVector, skin }) => {
  const origin = CORNER_ORIGIN_PCT[activeColor];
  const colorMeta = COLOR_HEX[activeColor];

  // Run one fresh 3-axis rigid-body physics throw per spinNonce
  const simulation = useMemo(
    () =>
      simulateDiceThrow({
        origin,
        landCoord,
        diceValue,
        throwVector,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spinNonce, activeColor, diceValue, origin.x, origin.y, landCoord.x, landCoord.y, throwVector]
  );

  const [frame, setFrame] = useState(() => {
    const s0 = simulation.sampleAt(0);
    return {
      x: s0.x,
      y: s0.y,
      scale: 0.78 + s0.z * 0.52,
      liftYPx: s0.z * 18,
      shadowOffsetPx: 4 + s0.z * 26,
      shadowScale: 0.92 + s0.z * 0.75,
      shadowOpacity: Math.max(0.18, 0.74 - s0.z * 0.65),
      shadowBlurPx: 4 + s0.z * 14,
      matrix3d: s0.matrix3d,
    };
  });

  // Phase 1: Real-time 60fps playback of 180Hz rigid-body physics throw & bounces
  useEffect(() => {
    if (dicePhase !== 'rolling-to-board') return;

    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const sample = simulation.sampleAt(elapsed);
      const travelMix = Math.min(1, elapsed / (simulation.durationMs * 0.55));
      const baseScale = 0.78 + 0.3 * travelMix;

      setFrame({
        x: sample.x,
        y: sample.y,
        scale: baseScale + sample.z * 0.52,
        liftYPx: sample.z * 18,
        shadowOffsetPx: 4 + sample.z * 26,
        shadowScale: 0.92 + sample.z * 0.75,
        shadowOpacity: Math.max(0.18, 0.74 - sample.z * 0.65),
        shadowBlurPx: 4 + sample.z * 14,
        matrix3d: sample.matrix3d,
      });

      if (elapsed < simulation.durationMs) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    tick(startTime);
    return () => window.cancelAnimationFrame(rafId);
  }, [dicePhase, simulation]);

  // Phase 2: Ensure resting frame sits cleanly at final physics state
  useEffect(() => {
    if (dicePhase !== 'landed-on-board') return;
    setFrame({
      x: simulation.finalCoord.x,
      y: simulation.finalCoord.y,
      scale: 1.08,
      liftYPx: 0,
      shadowOffsetPx: 4,
      shadowScale: 0.96,
      shadowOpacity: 0.76,
      shadowBlurPx: 4,
      matrix3d: quatToMatrix3d(simulation.landedQuat),
    });
  }, [dicePhase, simulation]);

  // Phase 3: Smooth glide back to active player's corner seat while untwisting Z cleanly
  useEffect(() => {
    if (dicePhase !== 'returning-to-seat') return;

    const startX = simulation.finalCoord.x;
    const startY = simulation.finalCoord.y;
    const dx = origin.x - startX;
    const dy = origin.y - startY;
    const durationMs = 420;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const hopArc = Math.sin(t * Math.PI) * 0.14;
      const q = slerpQuat(simulation.landedQuat, simulation.uprightQuat, ease);

      setFrame({
        x: startX + dx * ease,
        y: startY + dy * ease,
        scale: 1.08 - 0.34 * ease + hopArc * 0.25,
        liftYPx: hopArc * 16,
        shadowOffsetPx: 4 + hopArc * 18,
        shadowScale: 0.96 - 0.24 * ease + hopArc * 0.3,
        shadowOpacity: Math.max(0.25, 0.76 - 0.35 * ease - hopArc * 0.3),
        shadowBlurPx: 4 + hopArc * 8,
        matrix3d: quatToMatrix3d(q),
      });

      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [dicePhase, origin.x, origin.y, simulation]);

  if (dicePhase === 'idle') return null;

  const landed = dicePhase === 'landed-on-board';

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none z-40 overflow-hidden"
    >
      {/* Dynamic surface shadow separating from cube based on bounce height z */}
      <div
        style={{
          left: `${frame.x}%`,
          top: `${frame.y}%`,
          transform: `translate(-50%, calc(-50% + ${frame.shadowOffsetPx}px)) scale(${frame.shadowScale})`,
          opacity: frame.shadowOpacity,
          filter: `blur(${frame.shadowBlurPx}px)`,
          backgroundColor: 'rgba(2, 6, 23, 0.72)',
        }}
        className="absolute w-14 h-5 rounded-full will-change-transform"
      />

      <div
        style={{
          left: `${frame.x}%`,
          top: `${frame.y}%`,
          transform: `translate(-50%, calc(-50% - ${frame.liftYPx}px)) scale(${frame.scale})`,
        }}
        className="absolute flex items-center justify-center will-change-transform"
      >
        {landed && (
          <div
            className="absolute -inset-2.5 rounded-2xl animate-pulse"
            style={{
              border: `2px solid ${colorMeta.primary}`,
              boxShadow: `0 0 22px ${colorMeta.glow}`,
            }}
          />
        )}

        <Dice3D
          value={diceValue}
          rolling={dicePhase === 'rolling-to-board'}
          canRoll={false}
          skin={skin}
          activeColor={activeColor}
          sizePx={58}
          overrideMatrix3d={frame.matrix3d}
        />
      </div>
    </div>
  );
};

export const LudoBoard: React.FC<LudoBoardProps> = ({
  tokens,
  players,
  activeColor,
  movableTokenIds,
  returningTokenIds = [],
  diceValue,
  dicePhase,
  diceSpinNonce,
  diceLandCoord,
  diceThrowVector = null,
  equippedDice,
  tokenStyle,
  boardTheme,
  onSelectToken,
}) => {
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  const theme = BOARD_THEME_STYLES[boardTheme];

  const cellMetadata = useMemo(() => {
    const trackMap = new Map<string, number>();
    OUTER_TRACK_COORDS.forEach((coord, idx) => {
      trackMap.set(`${coord.row}-${coord.col}`, idx);
    });

    const homeStretchMap = new Map<string, ColorId>();
    (['red', 'green', 'yellow', 'blue'] as ColorId[]).forEach((c) => {
      HOME_STRETCH_COORDS[c].forEach((coord) => {
        homeStretchMap.set(`${coord.row}-${coord.col}`, c);
      });
    });

    const startSquareMap = new Map<string, ColorId>();
    (['red', 'green', 'yellow', 'blue'] as ColorId[]).forEach((c) => {
      const coord = OUTER_TRACK_COORDS[START_TRACK_INDEX[c]];
      startSquareMap.set(`${coord.row}-${coord.col}`, c);
    });

    return { trackMap, homeStretchMap, startSquareMap };
  }, []);

  const positionedTokens = useMemo(() => {
    const groups = new Map<string, Token[]>();
    tokens.forEach((token) => {
      const coord = getTokenGridCoord(token);
      const key = `${coord.row.toFixed(2)}-${coord.col.toFixed(2)}`;
      const list = groups.get(key) ?? [];
      list.push(token);
      groups.set(key, list);
    });

    return tokens.map((token) => {
      const coord = getTokenGridCoord(token);
      const key = `${coord.row.toFixed(2)}-${coord.col.toFixed(2)}`;
      const siblings = groups.get(key) ?? [token];
      const idxInGroup = siblings.findIndex((t) => t.id === token.id);
      const count = siblings.length;

      let offsetX = 0;
      let offsetY = 0;
      if (count === 2) {
        offsetX = idxInGroup === 0 ? -0.17 : 0.17;
      } else if (count === 3) {
        const offsets = [
          { x: 0, y: -0.17 },
          { x: -0.17, y: 0.14 },
          { x: 0.17, y: 0.14 },
        ];
        offsetX = offsets[idxInGroup].x;
        offsetY = offsets[idxInGroup].y;
      } else if (count >= 4) {
        const angle = (idxInGroup / count) * Math.PI * 2;
        offsetX = Math.cos(angle) * 0.19;
        offsetY = Math.sin(angle) * 0.19;
      }

      return {
        token,
        leftPct: ((coord.col + 0.5 + offsetX) / 15) * 100,
        topPct: ((coord.row + 0.5 + offsetY) / 15) * 100,
        stackedCount: count,
      };
    });
  }, [tokens]);

  useEffect(() => {
    setHoveredTokenId(null);
  }, [dicePhase, movableTokenIds]);

  const showAllDestinations =
    dicePhase === 'idle' && diceValue !== null && movableTokenIds.length > 1;

  const { destinationGroups, destinationLinks } = useMemo(() => {
    if (dicePhase !== 'idle' || diceValue === null || movableTokenIds.length === 0) {
      return { destinationGroups: [], destinationLinks: [] };
    }

    const groupsMap = new Map<
      string,
      {
        key: string;
        leftPct: number;
        topPct: number;
        color: string;
        tokenIds: string[];
        tokenNumbers: number[];
        primaryTokenId: string;
        isCapture: boolean;
        isHomeGoal: boolean;
        isDeploy: boolean;
      }
    >();

    const links: {
      tokenId: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      color: string;
      showByDefault: boolean;
    }[] = [];

    positionedTokens.forEach(({ token, leftPct: fromX, topPct: fromY }) => {
      if (!movableTokenIds.includes(token.id)) return;
      if (!showAllDestinations && hoveredTokenId !== token.id) return;

      const dest = getDestinationCoord(token, diceValue);
      if (!dest) return;

      const toX = ((dest.col + 0.5) / 15) * 100;
      const toY = ((dest.row + 0.5) / 15) * 100;
      const nextProgress = token.progress === -1 ? 0 : token.progress + diceValue;
      const nextGlobalIdx = getGlobalTrackIndex(token.color, nextProgress);
      const isCapture =
        nextGlobalIdx !== null &&
        !SAFE_TRACK_INDICES.has(nextGlobalIdx) &&
        tokens.some(
          (other) =>
            other.color !== token.color &&
            other.progress >= 0 &&
            other.progress <= 50 &&
            getGlobalTrackIndex(other.color, other.progress) === nextGlobalIdx
        );
      const isHomeGoal = nextProgress === 56;
      const isDeploy = token.progress === -1;
      const baseColor = LUDO_POCKET_COLORS[token.color].solid;
      const accentColor = isCapture ? '#F43F5E' : isHomeGoal ? '#F59E0B' : baseColor;

      links.push({
        tokenId: token.id,
        fromX,
        fromY,
        toX,
        toY,
        color: accentColor,
        showByDefault: showAllDestinations && !isDeploy,
      });

      const key = `${dest.row.toFixed(2)}-${dest.col.toFixed(2)}`;
      const existing = groupsMap.get(key);
      if (existing) {
        existing.tokenIds.push(token.id);
        existing.tokenNumbers.push(token.index + 1);
        existing.isCapture = existing.isCapture || isCapture;
        existing.isHomeGoal = existing.isHomeGoal || isHomeGoal;
        existing.isDeploy = existing.isDeploy && isDeploy;
      } else {
        groupsMap.set(key, {
          key,
          leftPct: toX,
          topPct: toY,
          color: baseColor,
          tokenIds: [token.id],
          tokenNumbers: [token.index + 1],
          primaryTokenId: token.id,
          isCapture,
          isHomeGoal,
          isDeploy,
        });
      }
    });

    return {
      destinationGroups: Array.from(groupsMap.values()),
      destinationLinks: links,
    };
  }, [
    dicePhase,
    diceValue,
    movableTokenIds,
    positionedTokens,
    showAllDestinations,
    hoveredTokenId,
    tokens,
  ]);

  const renderPocket = (color: ColorId, gridArea: string) => {
    const pocketPalette = LUDO_POCKET_COLORS[color];
    const player = players[color];
    const isTurn = activeColor === color;
    const isInactive = !player.active;

    return (
      <div
        key={`pocket-${color}`}
        style={{
          gridArea,
          backgroundColor: isInactive ? '#334155' : pocketPalette.solid,
          border: `1px solid ${pocketPalette.dark}`,
          boxShadow: isTurn ? `inset 0 0 0 3px rgba(255,255,255,0.65)` : undefined,
        }}
        className={`relative p-[13%] flex items-center justify-center transition-all duration-200 ${
          isInactive ? 'opacity-45 grayscale' : ''
        }`}
      >
        <div
          className="w-full h-full rounded-xl sm:rounded-2xl grid grid-cols-2 grid-rows-2 place-items-center p-[12%] gap-[12%] shadow-inner"
          style={{
            backgroundColor: theme.pocketInnerBg,
            border: '2px solid rgba(15, 23, 42, 0.14)',
          }}
        >
          {[0, 1, 2, 3].map((slotIdx) => (
            <div
              key={slotIdx}
              className="w-[74%] h-[74%] rounded-full"
              style={{
                backgroundColor: isInactive ? '#cbd5e1' : `${pocketPalette.solid}22`,
                border: `2px solid ${isInactive ? '#94a3b8' : pocketPalette.solid}`,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.12)',
              }}
            />
          ))}
        </div>

        {player.active && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/55 text-[9px] sm:text-[10px] font-display font-bold text-white tracking-wide whitespace-nowrap pointer-events-none">
            {player.name.split(' ')[0]}
          </span>
        )}
      </div>
    );
  };

  const trackTiles: React.ReactNode[] = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const inGreenPocket = r < 6 && c < 6;
      const inYellowPocket = r < 6 && c > 8;
      const inRedPocket = r > 8 && c < 6;
      const inBluePocket = r > 8 && c > 8;
      const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;

      if (inGreenPocket || inYellowPocket || inRedPocket || inBluePocket || inCenter) {
        continue;
      }

      const key = `${r}-${c}`;
      const trackIdx = cellMetadata.trackMap.get(key);
      const homeColor = cellMetadata.homeStretchMap.get(key);
      const startColor = cellMetadata.startSquareMap.get(key);
      const isStarSafe = trackIdx !== undefined && STAR_TRACK_INDICES.has(trackIdx);

      let bg = theme.tileBg;
      let borderColor = theme.tileBorder;

      if (startColor) {
        bg = LUDO_POCKET_COLORS[startColor].solid;
        borderColor = LUDO_POCKET_COLORS[startColor].dark;
      } else if (homeColor) {
        bg = LUDO_POCKET_COLORS[homeColor].solid;
        borderColor = LUDO_POCKET_COLORS[homeColor].dark;
      } else if (isStarSafe) {
        bg = theme.starBg;
      }

      const isGreenEntry = r === 7 && c === 0;
      const isYellowEntry = r === 0 && c === 7;
      const isBlueEntry = r === 7 && c === 14;
      const isRedEntry = r === 14 && c === 7;

      trackTiles.push(
        <div
          key={key}
          style={{
            gridRow: r + 1,
            gridColumn: c + 1,
            backgroundColor: bg,
            borderRight: `1px solid ${borderColor}`,
            borderBottom: `1px solid ${borderColor}`,
          }}
          className="flex items-center justify-center relative select-none"
        >
          {startColor && <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-white/30" />}
          {isStarSafe && (
            <Star
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              style={{ color: theme.starIcon }}
            />
          )}
          {isGreenEntry && <ArrowRight className="w-3.5 h-3.5 text-[#16A34A] stroke-[2.6]" />}
          {isYellowEntry && <ArrowDown className="w-3.5 h-3.5 text-[#CA8A04] stroke-[2.6]" />}
          {isBlueEntry && <ArrowLeft className="w-3.5 h-3.5 text-[#2563EB] stroke-[2.6]" />}
          {isRedEntry && <ArrowUp className="w-3.5 h-3.5 text-[#DC2626] stroke-[2.6]" />}
        </div>
      );
    }
  }

  return (
    <div
      className="w-full max-w-[540px] aspect-square mx-auto rounded-none shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-4 overflow-hidden ring-4 ring-white/10 relative select-none"
      style={{
        backgroundColor: theme.boardBg,
        borderColor: theme.bezelBorder,
      }}
    >
      <div
        className="relative w-full h-full grid"
        style={{
          gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(15, minmax(0, 1fr))',
        }}
      >
        {renderPocket('green', '1 / 1 / 7 / 7')}
        {renderPocket('yellow', '1 / 10 / 7 / 16')}
        {renderPocket('red', '10 / 1 / 16 / 7')}
        {renderPocket('blue', '10 / 10 / 16 / 16')}

        {/* Center 3x3 FourTriangle Home Goal */}
        <div
          style={{ gridArea: '7 / 7 / 10 / 10' }}
          className="relative overflow-hidden border border-slate-300 bg-white flex items-center justify-center"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <polygon points="0,0 50,50 0,100" fill="#16A34A" stroke="#ffffff" strokeWidth="2" />
            <polygon points="0,0 100,0 50,50" fill="#EAB308" stroke="#ffffff" strokeWidth="2" />
            <polygon points="100,0 100,100 50,50" fill="#2563EB" stroke="#ffffff" strokeWidth="2" />
            <polygon points="0,100 100,100 50,50" fill="#DC2626" stroke="#ffffff" strokeWidth="2" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-950/90 border border-amber-300 flex items-center justify-center shadow-lg">
              <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </div>
          </div>
        </div>

        {trackTiles}

        {destinationLinks.length > 0 && (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
          >
            {destinationLinks.map((link) => {
              const isFocused = hoveredTokenId === link.tokenId;
              if (!link.showByDefault && !isFocused) return null;
              return (
                <line
                  key={`link-${link.tokenId}`}
                  x1={link.fromX}
                  y1={link.fromY}
                  x2={link.toX}
                  y2={link.toY}
                  stroke={link.color}
                  strokeWidth={isFocused ? 0.95 : 0.6}
                  strokeDasharray="1.5 1.1"
                  strokeLinecap="round"
                  opacity={isFocused ? 0.95 : 0.55}
                />
              );
            })}
          </svg>
        )}

        {destinationGroups.map((group) => {
          const isFocused =
            hoveredTokenId !== null && group.tokenIds.includes(hoveredTokenId);
          const ringColor = group.isCapture
            ? '#F43F5E'
            : group.isHomeGoal
            ? '#F59E0B'
            : group.color;
          const badgeBg = group.isCapture
            ? '#E11D48'
            : group.isHomeGoal
            ? '#D97706'
            : '#0F172A';

          return (
            <button
              key={`dest-${group.key}`}
              type="button"
              onClick={() => onSelectToken(group.primaryTokenId)}
              onMouseEnter={() => setHoveredTokenId(group.primaryTokenId)}
              onMouseLeave={() => setHoveredTokenId(null)}
              aria-label={`Destination +${diceValue}`}
              style={{
                left: `${group.leftPct}%`,
                top: `${group.topPct}%`,
                borderColor: ringColor,
                backgroundColor: `${ringColor}28`,
                boxShadow: isFocused
                  ? `0 0 16px ${ringColor}, inset 0 0 8px ${ringColor}66`
                  : `0 0 10px ${ringColor}88`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-[6.1%] h-[6.1%] min-w-[22px] min-h-[22px] rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-transform duration-150 z-[25] ${
                isFocused ? 'scale-[1.15]' : 'animate-pulse'
              }`}
            >
              <span
                style={{
                  backgroundColor: badgeBg,
                  borderColor: ringColor,
                }}
                className="px-1 py-px rounded-full border text-[9px] sm:text-[10px] font-mono-num font-extrabold text-white leading-tight shadow-md inline-flex items-center gap-0.5 pointer-events-none"
              >
                {group.isCapture && <Swords className="w-2.5 h-2.5 text-rose-200" />}
                {group.isHomeGoal ? (
                  <Crown className="w-2.5 h-2.5 text-amber-300" />
                ) : group.isDeploy ? (
                  <span>6</span>
                ) : (
                  <span>+{diceValue}</span>
                )}
              </span>

              {showAllDestinations && !group.isDeploy && (
                <span
                  style={{ backgroundColor: ringColor }}
                  className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-mono-num font-black text-white flex items-center justify-center border border-white shadow pointer-events-none"
                >
                  {group.tokenNumbers.join('·')}
                </span>
              )}
            </button>
          );
        })}

        {positionedTokens.map(({ token, leftPct, topPct, stackedCount }) => {
          const isMovable = movableTokenIds.includes(token.id);
          const isReturning = returningTokenIds.includes(token.id);
          const isHoveredTarget = hoveredTokenId === token.id;
          const palette = COLOR_HEX[token.color];
          const pocketColor = LUDO_POCKET_COLORS[token.color];
          const isFinished = token.progress === 56;
          const scaleFactor = stackedCount > 1 ? 0.84 : 1;

          return (
            <button
              key={token.id}
              type="button"
              disabled={!isMovable}
              onClick={() => isMovable && onSelectToken(token.id)}
              onMouseEnter={() => isMovable && setHoveredTokenId(token.id)}
              onMouseLeave={() => setHoveredTokenId(null)}
              aria-label={`${palette.label} token ${token.index + 1}${isMovable ? ', movable' : ''}`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: `translate(-50%, -50%) scale(${
                  isHoveredTarget ? 1.24 : isMovable ? 1.15 : isReturning ? 1.08 : scaleFactor
                })`,
                zIndex: isReturning ? 35 : isHoveredTarget ? 33 : isMovable ? 30 : isFinished ? 15 : 22,
              }}
              className={`absolute w-[5.5%] h-[5.5%] min-w-[20px] min-h-[20px] rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                isReturning ? 'duration-75 ease-linear' : 'duration-150 ease-out'
              } ${isMovable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {isMovable && (
                <span
                  aria-hidden="true"
                  className="absolute -inset-1.5 rounded-full animate-ping opacity-75 pointer-events-none"
                  style={{ backgroundColor: pocketColor.solid }}
                />
              )}

              {isReturning && (
                <span
                  aria-hidden="true"
                  className="absolute -inset-1.5 rounded-full border-2 border-rose-400 animate-pulse pointer-events-none"
                  style={{ boxShadow: '0 0 12px rgba(244, 63, 94, 0.85)' }}
                />
              )}

              <span
                className="relative flex items-center justify-center w-full h-full rounded-full"
                style={{
                  background:
                    tokenStyle === 'carbon-ring'
                      ? `radial-gradient(circle, #0f172a 42%, ${pocketColor.solid} 46%, #0f172a 100%)`
                      : `radial-gradient(circle at 30% 28%, #ffffff 0%, ${pocketColor.solid} 40%, ${pocketColor.dark} 100%)`,
                  border: `2px solid ${isMovable ? '#0f172a' : isReturning ? '#fecdd3' : '#ffffff'}`,
                  boxShadow: isMovable
                    ? `0 0 0 2px #ffffff, 0 4px 12px rgba(0,0,0,0.45)`
                    : isReturning
                    ? '0 0 0 2px rgba(244, 63, 94, 0.7), 0 4px 10px rgba(0,0,0,0.5)'
                    : '0 3px 6px rgba(0,0,0,0.42)',
                }}
              >
                {tokenStyle === 'arcade-chip' && (
                  <span
                    className="w-[48%] h-[48%] rounded-full border border-white/80"
                    style={{ backgroundColor: pocketColor.solid }}
                  />
                )}
                {tokenStyle === 'carbon-ring' && (
                  <span
                    className="w-[38%] h-[38%] rounded-full"
                    style={{ backgroundColor: pocketColor.solid }}
                  />
                )}
                {tokenStyle === 'royal-crown' && (
                  <Crown className="w-[56%] h-[56%] text-white drop-shadow" />
                )}
              </span>

              {showAllDestinations && isMovable && token.progress >= 0 && (
                <span
                  style={{ backgroundColor: '#0F172A', borderColor: '#ffffff' }}
                  className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-mono-num font-black text-white flex items-center justify-center border shadow pointer-events-none"
                >
                  {token.index + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Real 3D Die Rolling & Landing Overlay onto the Board */}
      {dicePhase !== 'idle' && (
        <BoardRollingDiceOverlay
          activeColor={activeColor}
          diceValue={diceValue ?? 6}
          dicePhase={dicePhase}
          spinNonce={diceSpinNonce}
          landCoord={diceLandCoord}
          throwVector={diceThrowVector}
          skin={equippedDice}
        />
      )}
    </div>
  );
};
