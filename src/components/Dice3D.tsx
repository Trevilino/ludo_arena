import React from 'react';
import { ColorId, DiceSkinId } from '../types/ludo';
import { COLOR_HEX } from '../utils/ludoEngine';

interface Dice3DProps {
  value: number;
  rolling: boolean;
  canRoll: boolean;
  skin: DiceSkinId;
  activeColor: ColorId;
  compact?: boolean;
  sizePx?: number;
  spinNonce?: number;
  overrideMatrix3d?: string;
  onRoll?: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

const PIP_LAYOUTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Target X/Y rotations so each face (1..6) faces directly toward the viewer (+Z)
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};

export const Dice3D: React.FC<Dice3DProps> = ({
  value,
  rolling,
  canRoll,
  skin,
  activeColor,
  compact = false,
  sizePx,
  spinNonce = 0,
  overrideMatrix3d,
  onRoll,
  onPointerDown,
}) => {
  const cubeSize = sizePx ?? (compact ? 42 : 58);
  const half = cubeSize / 2;
  const colorMeta = COLOR_HEX[activeColor];

  const skinStyles: Record<
    DiceSkinId,
    { bg: string; faceShade: string; border: string; pip: string; pipGlow: string }
  > = {
    'obsidian-glass': {
      bg: 'linear-gradient(145deg, #2a3142 0%, #111622 100%)',
      faceShade: 'rgba(139, 92, 246, 0.25)',
      border: canRoll ? '#a078ff' : 'rgba(148, 163, 184, 0.4)',
      pip: '#FFFFFF',
      pipGlow: '0 0 6px rgba(208, 188, 255, 0.8)',
    },
    'solar-amber': {
      bg: 'linear-gradient(145deg, #632b04 0%, #241206 100%)',
      faceShade: 'rgba(245, 158, 11, 0.35)',
      border: '#F59E0B',
      pip: '#FEF08A',
      pipGlow: '0 0 7px rgba(245, 158, 11, 0.9)',
    },
    'cyber-prism': {
      bg: 'linear-gradient(145deg, #064e5c 0%, #091824 100%)',
      faceShade: 'rgba(6, 182, 212, 0.35)',
      border: '#22D3EE',
      pip: '#A5F3FC',
      pipGlow: '0 0 7px rgba(34, 211, 238, 0.9)',
    },
  };

  const activeSkin = skinStyles[skin];
  const target = FACE_ROTATIONS[value] ?? FACE_ROTATIONS[1];

  const totalX = spinNonce * 720 + target.x;
  const totalY = spinNonce * 720 + target.y;

  const faces: { num: number; transform: string }[] = [
    { num: 1, transform: `rotateY(0deg) translateZ(${half}px)` },
    { num: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { num: 3, transform: `rotateY(90deg) translateZ(${half}px)` },
    { num: 4, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { num: 2, transform: `rotateX(90deg) translateZ(${half}px)` },
    { num: 5, transform: `rotateX(-90deg) translateZ(${half}px)` },
  ];

  const pipSize = cubeSize >= 56 ? 'w-2.5 h-2.5' : cubeSize >= 46 ? 'w-2 h-2' : 'w-1.5 h-1.5';

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={(e) => {
        if (onPointerDown && e.detail !== 0) return;
        onRoll?.();
      }}
      disabled={!canRoll || rolling}
      aria-label={canRoll ? 'Roll 3D dice' : `Dice shows ${value}`}
      style={{
        width: `${cubeSize}px`,
        height: `${cubeSize}px`,
        perspective: '520px',
      }}
      className={`relative shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4cd7f6] rounded-xl transition-transform duration-150 ${
        canRoll && !rolling
          ? 'cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 touch-none select-none'
          : 'cursor-default'
      }`}
    >
      {/* Active glow halo behind cube */}
      {canRoll && !rolling && (
        <span
          aria-hidden="true"
          className="absolute -inset-1.5 rounded-2xl animate-pulse pointer-events-none"
          style={{
            boxShadow: `0 0 18px ${colorMeta.glow}`,
            border: `1px solid ${colorMeta.primary}88`,
          }}
        />
      )}

      {/* 3D Cube Container */}
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: overrideMatrix3d
            ? `translateZ(-${half}px) ${overrideMatrix3d}`
            : `translateZ(-${half}px) rotateX(${totalX}deg) rotateY(${totalY}deg)`,
          transition: overrideMatrix3d
            ? 'none'
            : 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Internal orthogonal core planes prevent corner gaps during fast 3-axis tumbling */}
        <div
          aria-hidden="true"
          className="absolute inset-[2px] rounded-[5px] bg-[#0b0f19] pointer-events-none"
          style={{ transform: 'rotateX(0deg)' }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-[2px] rounded-[5px] bg-[#0b0f19] pointer-events-none"
          style={{ transform: 'rotateX(90deg)' }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-[2px] rounded-[5px] bg-[#0b0f19] pointer-events-none"
          style={{ transform: 'rotateY(90deg)' }}
        />

        {faces.map(({ num, transform }) => {
          const pips = PIP_LAYOUTS[num];
          return (
            <div
              key={num}
              style={{
                transform,
                background: activeSkin.bg,
                border: `1.5px solid ${activeSkin.border}`,
                boxShadow: `inset 0 0 10px ${activeSkin.faceShade}, inset 0 1px 2px rgba(255,255,255,0.22)`,
                backfaceVisibility: 'hidden',
              }}
              className="absolute inset-0 rounded-[9px] p-1.5 grid grid-cols-3 grid-rows-3 place-items-center"
            >
              {Array.from({ length: 9 }).map((_, idx) => {
                const active = pips.includes(idx);
                return (
                  <span
                    key={idx}
                    className={`${pipSize} rounded-full ${
                      active ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: num === 6 ? '#FBBF24' : activeSkin.pip,
                            boxShadow:
                              num === 6
                                ? '0 0 8px rgba(251, 191, 36, 0.95)'
                                : activeSkin.pipGlow,
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </button>
  );
};
