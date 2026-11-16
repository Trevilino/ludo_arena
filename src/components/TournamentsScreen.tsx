import React, { useState } from 'react';
import { Calendar, Coins, Trophy, Users } from 'lucide-react';
import { TOURNAMENTS } from '../data/mockArenaData';
import { Translations } from '../i18n/translations';
import { TournamentItem } from '../types/ludo';

interface TournamentsScreenProps {
  t: Translations;
  coins: number;
  joinedIds: string[];
  onJoinTournament: (tournament: TournamentItem) => void;
}

export const TournamentsScreen: React.FC<TournamentsScreenProps> = ({
  t,
  coins,
  joinedIds,
  onJoinTournament,
}) => {
  const [filter, setFilter] = useState<'all' | 'Live Now' | 'Registering' | 'Upcoming'>('all');

  const visibleTournaments = TOURNAMENTS.filter((item) =>
    filter === 'all' ? true : item.status === filter
  );

  const statusLabel = (s: TournamentItem['status']) => {
    if (s === 'Live Now') return t.tournaments.statuses.live;
    if (s === 'Registering') return t.tournaments.statuses.registering;
    return t.tournaments.statuses.upcoming;
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-display font-bold uppercase tracking-widest text-[#4cd7f6]">
            {t.tournaments.kicker}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            {t.tournaments.title}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1 max-w-xl">{t.tournaments.subtitle}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0 rounded-xl bg-[#0B0F19]/80 border border-[#F97316]/35 px-4 py-3">
          <Trophy className="w-6 h-6 text-[#FBBF24]" />
          <div>
            <div className="text-[11px] font-display uppercase tracking-wider text-[#94A3B8]">
              {t.tournaments.weeklyJackpot}
            </div>
            <div className="font-mono-num text-xl font-bold text-white">25,000</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          { id: 'all', label: t.tournaments.allCups },
          { id: 'Live Now', label: t.tournaments.statuses.live },
          { id: 'Registering', label: t.tournaments.statuses.registering },
          { id: 'Upcoming', label: t.tournaments.statuses.upcoming },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-display font-semibold transition-colors whitespace-nowrap ${
              filter === tab.id
                ? 'bg-[#8B5CF6] text-white shadow-[0_0_16px_rgba(139,92,246,0.4)]'
                : 'bg-[#111827]/80 text-[#94A3B8] border border-white/10 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleTournaments.map((item) => {
          const isJoined = joinedIds.includes(item.id);
          const canAfford = coins >= item.entryFee;
          const fillPct = Math.round((item.playersJoined / item.maxPlayers) * 100);
          const localized = t.tournaments.items[item.id] ?? {
            title: item.title,
            subtitle: item.subtitle,
            startsIn: item.startsIn,
          };

          return (
            <div
              key={item.id}
              className="glass-panel rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#8B5CF6]/45 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-[#94A3B8]">
                  <span
                    className={`font-display font-bold uppercase tracking-wider ${
                      item.status === 'Live Now'
                        ? 'text-[#10B981]'
                        : item.status === 'Registering'
                        ? 'text-[#4cd7f6]'
                        : 'text-[#FBBF24]'
                    }`}
                  >
                    {statusLabel(item.status)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono-num">
                    <Calendar className="w-3.5 h-3.5" />
                    {localized.startsIn}
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold text-white mt-2">
                  {localized.title}
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1">{localized.subtitle}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#0B0F19]/75 border border-white/10 p-3">
                <div>
                  <div className="text-[10px] font-display uppercase tracking-wider text-[#94A3B8]">
                    {t.tournaments.entryFee}
                  </div>
                  <div className="font-mono-num text-sm font-bold text-white mt-0.5 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-[#F97316]" />
                    {item.entryFee}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-display uppercase tracking-wider text-[#94A3B8]">
                    {t.tournaments.prizePool}
                  </div>
                  <div className="font-mono-num text-sm font-bold text-[#FBBF24] mt-0.5">
                    {item.prizePool.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-display uppercase tracking-wider text-[#94A3B8]">
                    {t.tournaments.seats}
                  </div>
                  <div className="font-mono-num text-sm font-bold text-[#E2E8F0] mt-0.5 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[#4cd7f6]" />
                    {item.playersJoined}/{item.maxPlayers}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4]"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>

                <button
                  type="button"
                  disabled={!canAfford && !isJoined}
                  onClick={() => onJoinTournament(item)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-display font-bold tracking-wide whitespace-nowrap ${
                    isJoined
                      ? 'btn-secondary-cyan'
                      : canAfford
                      ? 'btn-primary-violet text-white'
                      : 'bg-white/5 border border-white/10 text-[#64748B] cursor-not-allowed'
                  }`}
                >
                  {isJoined
                    ? t.tournaments.launchCup
                    : canAfford
                    ? `${t.tournaments.enterCup} (${item.entryFee} ${t.tournaments.coinsUnit})`
                    : t.tournaments.insufficientCoins}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
