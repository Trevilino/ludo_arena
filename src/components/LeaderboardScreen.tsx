import React, { useState } from 'react';
import { Award, Search } from 'lucide-react';
import { DEFAULT_PLAYERS, LEADERBOARD_DATA } from '../data/mockArenaData';
import { Translations } from '../i18n/translations';
import type { PublicPlayerStanding } from '../types/ludo';
import { PlayerAvatar } from './PlayerAvatar';

interface LeaderboardScreenProps {
  t: Translations;
  userWins: number;
  userEarnings: number;
  publicStandings?: PublicPlayerStanding[];
  currentUid?: string | null;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  t,
  userWins,
  userEarnings,
  publicStandings = [],
  currentUid = null,
}) => {
  const [scope, setScope] = useState<'global' | 'friends' | 'weekly'>('global');
  const [query, setQuery] = useState('');

  const firestoreEntries = publicStandings.map((p, idx) => ({
    rank: idx + 1,
    name: p.displayName,
    handle: p.uid === currentUid ? '@you' : `@${p.uid.slice(0, 8)}`,
    avatar: p.photoURL || DEFAULT_PLAYERS.red.avatar,
    color: 'red' as const,
    elo: p.elo,
    wins: p.wins,
    matches: Math.max(p.matchesPlayed, p.wins, 1),
    earnings: p.earnings,
    scope: 'global' as const,
    uid: p.uid,
  }));

  const baseEntries = LEADERBOARD_DATA.map((entry) => {
    if (entry.handle === '@kaelen.v' && !currentUid) {
      return {
        ...entry,
        wins: entry.wins + userWins,
        matches: entry.matches + userWins,
        earnings: entry.earnings + userEarnings,
        uid: null as string | null,
      };
    }
    return { ...entry, uid: null as string | null };
  });

  const combined =
    scope === 'global'
      ? [...firestoreEntries, ...baseEntries.filter((e) => !(currentUid && e.handle === '@kaelen.v'))]
      : baseEntries;

  const rows = combined
    .filter((entry) => (scope === 'global' ? true : entry.scope === scope))
    .filter(
      (entry) =>
        entry.name.toLowerCase().includes(query.toLowerCase()) ||
        entry.handle.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => b.elo - a.elo)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  const myRow = rows.find((r) => (currentUid ? r.uid === currentUid : r.handle === '@kaelen.v'));

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-display font-bold uppercase tracking-widest text-[#d0bcff]">
            {t.leaderboard.kicker}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            {t.leaderboard.title}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">{t.leaderboard.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-[#0B0F19]/80 border border-white/10 px-4 py-2.5 shrink-0">
          <Award className="w-5 h-5 text-[#4cd7f6]" />
          <div className="text-xs">
            <div className="text-[#94A3B8]">{t.leaderboard.yourStanding}</div>
            <div className="font-mono-num font-bold text-white">
              #{myRow?.rank ?? 2} · {(myRow?.elo ?? 2140).toLocaleString()} ELO
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111827]/85 border border-white/10 w-fit">
          {([
            { id: 'global', label: t.leaderboard.scopes.global },
            { id: 'friends', label: t.leaderboard.scopes.friends },
            { id: 'weekly', label: t.leaderboard.scopes.weekly },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScope(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-semibold transition-colors whitespace-nowrap ${
                scope === tab.id
                  ? 'bg-[#8B5CF6] text-white'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.leaderboard.searchPlaceholder}
            className="w-full rounded-xl bg-[#111827]/90 border border-white/12 pl-9 pr-3 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                <th className="py-3.5 px-4">{t.leaderboard.colRank}</th>
                <th className="py-3.5 px-4">{t.leaderboard.colCompetitor}</th>
                <th className="py-3.5 px-4 text-right">{t.leaderboard.colElo}</th>
                <th className="py-3.5 px-4 text-right">{t.leaderboard.colWinRate}</th>
                <th className="py-3.5 px-4 text-right">{t.leaderboard.colEarnings}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-sm">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[#94A3B8]">
                    {t.leaderboard.emptyFilter}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const winRate = Math.round((row.wins / row.matches) * 100);
                  const isYou = currentUid ? row.uid === currentUid : row.handle === '@kaelen.v';
                  return (
                    <tr
                      key={row.uid ?? row.handle}
                      className={`transition-colors hover:bg-white/[0.03] ${
                        isYou ? 'bg-[#8B5CF6]/10' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono-num font-bold text-white">
                        #{row.rank}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <PlayerAvatar
                            src={row.avatar}
                            name={row.name}
                            color={row.color}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="font-display font-semibold text-white truncate">
                              {row.name}{' '}
                              {isYou && (
                                <span className="text-xs text-[#4cd7f6]">
                                  {t.leaderboard.youTag}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#94A3B8] truncate">{row.handle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-[#d0bcff]">
                        {row.elo.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num text-[#E2E8F0]">
                        {winRate}%{' '}
                        <span className="text-xs text-[#64748B]">
                          ({row.wins}
                          {t.leaderboard.winsShort})
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-[#FBBF24]">
                        {row.earnings.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
