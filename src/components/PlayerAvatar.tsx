import React, { useState } from 'react';
import { ColorId } from '../types/ludo';
import { COLOR_HEX } from '../utils/ludoEngine';

interface PlayerAvatarProps {
  src: string;
  name: string;
  color: ColorId;
  size?: 'sm' | 'md' | 'lg';
  isActiveTurn?: boolean;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  src,
  name,
  color,
  size = 'md',
  isActiveTurn = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const palette = COLOR_HEX[color];

  const sizeClass =
    size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-14 h-14' : 'w-11 h-11';

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClass}`}>
      {isActiveTurn && (
        <span
          aria-hidden="true"
          className="absolute -inset-1 rounded-full animate-orbit-pulse pointer-events-none"
          style={{
            border: `2px solid ${palette.primary}`,
            boxShadow: `0 0 16px ${palette.glow}`,
          }}
        />
      )}
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-[#1E293B]"
        style={{
          border: `2px solid ${palette.primary}`,
          boxShadow: isActiveTurn ? `0 0 12px ${palette.glow}` : undefined,
        }}
      >
        {!imgError ? (
          <img
            src={src}
            alt={`${name} avatar`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="font-display font-bold text-xs text-white tracking-wider"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${palette.primary}, #0f131d)`,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
};
