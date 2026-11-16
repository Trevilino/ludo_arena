import type { BotDifficulty, ColorId, Token } from '../types/ludo.ts';

export interface GridCoord {
  row: number; // 0..14
  col: number; // 0..14
}

export const COLOR_HEX: Record<ColorId, { primary: string; soft: string; glow: string; label: string }> = {
  red: {
    primary: '#EF4444',
    soft: 'rgba(239, 68, 68, 0.16)',
    glow: 'rgba(239, 68, 68, 0.45)',
    label: 'Crimson',
  },
  green: {
    primary: '#10B981',
    soft: 'rgba(16, 185, 129, 0.16)',
    glow: 'rgba(16, 185, 129, 0.45)',
    label: 'Emerald',
  },
  yellow: {
    primary: '#F59E0B',
    soft: 'rgba(245, 158, 11, 0.16)',
    glow: 'rgba(245, 158, 11, 0.45)',
    label: 'Solar',
  },
  blue: {
    primary: '#3B82F6',
    soft: 'rgba(59, 130, 246, 0.16)',
    glow: 'rgba(59, 130, 246, 0.45)',
    label: 'Cobalt',
  },
};

// 52-cell clockwise outer track on a 15x15 Ludo grid
export const OUTER_TRACK_COORDS: GridCoord[] = [
  { row: 6, col: 1 },  // 0  - Red Start (Safe)
  { row: 6, col: 2 },  // 1
  { row: 6, col: 3 },  // 2
  { row: 6, col: 4 },  // 3
  { row: 6, col: 5 },  // 4
  { row: 5, col: 6 },  // 5
  { row: 4, col: 6 },  // 6
  { row: 3, col: 6 },  // 7
  { row: 2, col: 6 },  // 8  - Star Safe
  { row: 1, col: 6 },  // 9
  { row: 0, col: 6 },  // 10
  { row: 0, col: 7 },  // 11
  { row: 0, col: 8 },  // 12
  { row: 1, col: 8 },  // 13 - Green Start (Safe)
  { row: 2, col: 8 },  // 14
  { row: 3, col: 8 },  // 15
  { row: 4, col: 8 },  // 16
  { row: 5, col: 8 },  // 17
  { row: 6, col: 9 },  // 18
  { row: 6, col: 10 }, // 19
  { row: 6, col: 11 }, // 20
  { row: 6, col: 12 }, // 21 - Star Safe
  { row: 6, col: 13 }, // 22
  { row: 6, col: 14 }, // 23
  { row: 7, col: 14 }, // 24
  { row: 8, col: 14 }, // 25
  { row: 8, col: 13 }, // 26 - Yellow Start (Safe)
  { row: 8, col: 12 }, // 27
  { row: 8, col: 11 }, // 28
  { row: 8, col: 10 }, // 29
  { row: 8, col: 9 },  // 30
  { row: 9, col: 8 },  // 31
  { row: 10, col: 8 }, // 32
  { row: 11, col: 8 }, // 33
  { row: 12, col: 8 }, // 34 - Star Safe
  { row: 13, col: 8 }, // 35
  { row: 14, col: 8 }, // 36
  { row: 14, col: 7 }, // 37
  { row: 14, col: 6 }, // 38
  { row: 13, col: 6 }, // 39 - Blue Start (Safe)
  { row: 12, col: 6 }, // 40
  { row: 11, col: 6 }, // 41
  { row: 10, col: 6 }, // 42
  { row: 9, col: 6 },  // 43
  { row: 8, col: 5 },  // 44
  { row: 8, col: 4 },  // 45
  { row: 8, col: 3 },  // 46
  { row: 8, col: 2 },  // 47 - Star Safe
  { row: 8, col: 1 },  // 48
  { row: 8, col: 0 },  // 49
  { row: 7, col: 0 },  // 50
  { row: 6, col: 0 },  // 51
];

export const START_TRACK_INDEX: Record<ColorId, number> = {
  green: 0,   // Top-Left Pocket -> starts at (6, 1) moving right
  yellow: 13, // Top-Right Pocket -> starts at (1, 8) moving down
  blue: 26,   // Bottom-Right Pocket -> starts at (8, 13) moving left
  red: 39,    // Bottom-Left Pocket -> starts at (13, 6) moving up
};

// Safe track indices (4 start squares + 4 star squares)
export const SAFE_TRACK_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);
export const STAR_TRACK_INDICES = new Set<number>([8, 21, 34, 47]);

export const HOME_STRETCH_COORDS: Record<ColorId, GridCoord[]> = {
  green: [
    { row: 7, col: 1 },
    { row: 7, col: 2 },
    { row: 7, col: 3 },
    { row: 7, col: 4 },
    { row: 7, col: 5 },
  ],
  yellow: [
    { row: 1, col: 7 },
    { row: 2, col: 7 },
    { row: 3, col: 7 },
    { row: 4, col: 7 },
    { row: 5, col: 7 },
  ],
  blue: [
    { row: 7, col: 13 },
    { row: 7, col: 12 },
    { row: 7, col: 11 },
    { row: 7, col: 10 },
    { row: 7, col: 9 },
  ],
  red: [
    { row: 13, col: 7 },
    { row: 12, col: 7 },
    { row: 11, col: 7 },
    { row: 10, col: 7 },
    { row: 9, col: 7 },
  ],
};

// Base pad token positions (centered inside each 6x6 Pocket's white 2x2 dock)
export const BASE_TOKEN_COORDS: Record<ColorId, GridCoord[]> = {
  green: [
    { row: 1.78, col: 1.78 },
    { row: 1.78, col: 3.22 },
    { row: 3.22, col: 1.78 },
    { row: 3.22, col: 3.22 },
  ],
  yellow: [
    { row: 1.78, col: 10.78 },
    { row: 1.78, col: 12.22 },
    { row: 3.22, col: 10.78 },
    { row: 3.22, col: 12.22 },
  ],
  blue: [
    { row: 10.78, col: 10.78 },
    { row: 10.78, col: 12.22 },
    { row: 12.22, col: 10.78 },
    { row: 12.22, col: 12.22 },
  ],
  red: [
    { row: 10.78, col: 1.78 },
    { row: 10.78, col: 3.22 },
    { row: 12.22, col: 1.78 },
    { row: 12.22, col: 3.22 },
  ],
};

export const HOME_GOAL_COORDS: Record<ColorId, GridCoord> = {
  green: { row: 7, col: 6.12 },
  yellow: { row: 6.12, col: 7 },
  blue: { row: 7, col: 7.88 },
  red: { row: 7.88, col: 7 },
};

export function createInitialTokens(activeColors: ColorId[]): Token[] {
  const tokens: Token[] = [];
  for (const color of activeColors) {
    for (let i = 0; i < 4; i++) {
      tokens.push({
        id: `${color}-${i}`,
        color,
        index: i,
        progress: -1,
      });
    }
  }
  return tokens;
}

export function getGlobalTrackIndex(color: ColorId, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  return (START_TRACK_INDEX[color] + progress) % 52;
}

export function getTokenGridCoord(token: Token): GridCoord {
  if (token.progress === -1) {
    return BASE_TOKEN_COORDS[token.color][token.index];
  }
  if (token.progress <= 50) {
    const idx = getGlobalTrackIndex(token.color, token.progress)!;
    return OUTER_TRACK_COORDS[idx];
  }
  if (token.progress <= 55) {
    return HOME_STRETCH_COORDS[token.color][token.progress - 51];
  }
  return HOME_GOAL_COORDS[token.color];
}

export function getDestinationCoord(token: Token, diceValue: number): GridCoord | null {
  if (!canTokenMove(token, diceValue)) return null;
  const nextProgress = token.progress === -1 ? 0 : token.progress + diceValue;
  return getTokenGridCoord({ ...token, progress: nextProgress });
}

export function canTokenMove(token: Token, diceValue: number): boolean {
  if (token.progress === 56) return false;
  if (token.progress === -1) return diceValue === 6;
  return token.progress + diceValue <= 56;
}

export function getMovableTokenIds(tokens: Token[], color: ColorId, diceValue: number): string[] {
  return tokens
    .filter((t) => t.color === color && canTokenMove(t, diceValue))
    .map((t) => t.id);
}

export interface MoveResult {
  updatedTokens: Token[];
  movedToken: Token;
  capturedTokens: Token[];
  reachedHome: boolean;
  deployedFromBase: boolean;
  landedSafe: boolean;
  bonusTurn: boolean;
  winner: ColorId | null;
}

export function executeTokenMove(
  tokens: Token[],
  tokenId: string,
  diceValue: number
): MoveResult {
  const target = tokens.find((t) => t.id === tokenId);
  if (!target || !canTokenMove(target, diceValue)) {
    throw new Error(`Invalid move for token ${tokenId}`);
  }

  const deployedFromBase = target.progress === -1;
  const nextProgress = deployedFromBase ? 0 : target.progress + diceValue;
  const reachedHome = nextProgress === 56;
  const nextGlobalIdx = getGlobalTrackIndex(target.color, nextProgress);
  const landedSafe = nextGlobalIdx !== null && SAFE_TRACK_INDICES.has(nextGlobalIdx);

  const capturedTokens: Token[] = [];

  const updatedTokens = tokens.map((t) => {
    if (t.id === tokenId) {
      return { ...t, progress: nextProgress };
    }
    // Check capture on outer track if not a safe tile
    if (
      nextGlobalIdx !== null &&
      !landedSafe &&
      t.color !== target.color &&
      t.progress >= 0 &&
      t.progress <= 50
    ) {
      const otherGlobal = getGlobalTrackIndex(t.color, t.progress);
      if (otherGlobal === nextGlobalIdx) {
        capturedTokens.push(t);
        return { ...t, progress: -1 };
      }
    }
    return t;
  });

  const movedToken = updatedTokens.find((t) => t.id === tokenId)!;
  const allHome = updatedTokens
    .filter((t) => t.color === target.color)
    .every((t) => t.progress === 56);

  const bonusTurn =
    !allHome && (diceValue === 6 || capturedTokens.length > 0 || reachedHome);

  return {
    updatedTokens,
    movedToken,
    capturedTokens,
    reachedHome,
    deployedFromBase,
    landedSafe,
    bonusTurn,
    winner: allHome ? target.color : null,
  };
}

export function chooseBestBotMove(
  tokens: Token[],
  color: ColorId,
  diceValue: number,
  difficulty: BotDifficulty
): string | null {
  const movable = tokens.filter((t) => t.color === color && canTokenMove(t, diceValue));
  if (movable.length === 0) return null;
  if (movable.length === 1) return movable[0].id;

  let bestId = movable[0].id;
  let bestScore = -Infinity;

  for (const token of movable) {
    let score = 0;
    const nextProgress = token.progress === -1 ? 0 : token.progress + diceValue;
    const nextGlobal = getGlobalTrackIndex(color, nextProgress);

    // 1. Reaching home goal is highest priority
    if (nextProgress === 56) {
      score += 120;
    }

    // 2. Capturing an opponent
    if (nextGlobal !== null && !SAFE_TRACK_INDICES.has(nextGlobal)) {
      const hasVictim = tokens.some(
        (other) =>
          other.color !== color &&
          other.progress >= 0 &&
          other.progress <= 50 &&
          getGlobalTrackIndex(other.color, other.progress) === nextGlobal
      );
      if (hasVictim) {
        score += difficulty === 'pro' ? 110 : 75;
      }
    }

    // 3. Deploying from base
    if (token.progress === -1) {
      score += 65;
    }

    // 4. Entering safe home stretch or safe tile
    if (nextProgress >= 51 && token.progress < 51) {
      score += 60;
    } else if (nextGlobal !== null && SAFE_TRACK_INDICES.has(nextGlobal)) {
      score += 42;
    }

    // 5. Leaving a safe tile incurs slight risk in pro mode
    const currGlobal = getGlobalTrackIndex(color, token.progress);
    if (difficulty === 'pro' && currGlobal !== null && SAFE_TRACK_INDICES.has(currGlobal)) {
      score -= 12;
    }

    // 6. Prefer advancing further tokens
    score += nextProgress * 0.45;

    // Slight randomness on standard difficulty
    if (difficulty === 'standard') {
      score += Math.random() * 14;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = token.id;
    }
  }

  return bestId;
}
