import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Crown,
  Dices,
  History,
  LogIn,
  LogOut,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { Translations } from '../i18n/translations';
import type {
  FirestoreUserProfile,
  RoomParticipationRecord,
  TokenPurchaseRecord,
  WalletTransactionRecord,
} from '../types/ludo';
import { PlayerAvatar } from './PlayerAvatar';

interface AccountHistoryModalProps {
  t: Translations;
  isOpen: boolean;
  authLoading: boolean;
  authError: string | null;
  isSignedIn: boolean;
  profile: FirestoreUserProfile | null;
  fallbackAvatar: string;
  fallbackName: string;
  coins: number;
  purchases: TokenPurchaseRecord[];
  roomHistory: RoomParticipationRecord[];
  walletTxs: WalletTransactionRecord[];
  onClose: () => void;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
}

function formatDateTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString([], {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const AccountHistoryModal: React.FC<AccountHistoryModalProps> = ({
  t,
  isOpen,
  authLoading,
  authError,
  isSignedIn,
  profile,
  fallbackAvatar,
  fallbackName,
  coins,
  purchases,
  roomHistory,
  walletTxs,
  onClose,
  onSignInGoogle,
  onSignOut,
  isAdmin,
  onOpenAdmin,
}) => {
  const [tab, setTab] = useState<'wallet' | 'purchases' | 'rooms'>('wallet');

  if (!isOpen) return null;

  const displayName = profile?.displayName || fallbackName;
  const avatarSrc = profile?.photoURL || fallbackAvatar;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.auth.accountTitle}
    >
      <div className="glass-card rounded-2xl w-full max-w-lg max-h-[88dvh] flex flex-col overflow-hidden relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="p-5 pb-4 border-b border-white/10 space-y-4">
          <div className="flex items-center gap-3 pr-9">
            <PlayerAvatar src={avatarSrc} name={displayName} color="red" size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-lg font-extrabold text-white truncate">
                  {displayName}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-display font-bold ${
                    isSignedIn
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/10 text-[#94A3B8] border border-white/10'
                  }`}
                >
                  {isSignedIn && <ShieldCheck className="w-3 h-3" />}
                  {isSignedIn ? t.auth.connectedBadge : t.auth.guestBadge}
                </span>
              </div>
              {profile?.email ? (
                <p className="text-xs text-[#94A3B8] truncate mt-0.5">{profile.email}</p>
              ) : (
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{t.auth.guestDesc}</p>
              )}
            </div>
          </div>

          {!isSignedIn ? (
            <div className="space-y-2">
              <button
                type="button"
                disabled={authLoading}
                onClick={onSignInGoogle}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-display text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-60"
              >
                <LogIn className="w-4 h-4 text-[#7C3AED]" />
                {t.auth.signInGoogle}
              </button>
              {authError && (
                <p className="text-[11px] text-rose-400 font-display text-center">{authError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Stats Strip */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-xl bg-[#0B0F19]/80 border border-white/10 p-2.5 text-center">
                  <div className="text-[10px] font-display uppercase text-[#94A3B8]">
                    {t.auth.statsElo}
                  </div>
                  <div className="font-mono-num text-sm font-bold text-[#d0bcff] mt-0.5">
                    {(profile?.elo ?? 2140).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl bg-[#0B0F19]/80 border border-white/10 p-2.5 text-center">
                  <div className="text-[10px] font-display uppercase text-[#94A3B8]">
                    {t.auth.statsWins}
                  </div>
                  <div className="font-mono-num text-sm font-bold text-emerald-400 mt-0.5">
                    {profile?.wins ?? 0}
                  </div>
                </div>
                <div className="rounded-xl bg-[#0B0F19]/80 border border-white/10 p-2.5 text-center">
                  <div className="text-[10px] font-display uppercase text-[#94A3B8]">
                    {t.auth.statsMatches}
                  </div>
                  <div className="font-mono-num text-sm font-bold text-white mt-0.5">
                    {profile?.matchesPlayed ?? 0}
                  </div>
                </div>
                <div className="rounded-xl bg-[#0B0F19]/80 border border-white/10 p-2.5 text-center">
                  <div className="text-[10px] font-display uppercase text-[#94A3B8]">
                    {t.auth.statsEarnings}
                  </div>
                  <div className="font-mono-num text-sm font-bold text-[#FBBF24] mt-0.5">
                    {(profile?.earnings ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] border border-[#F97316]/35 px-3 py-1.5">
                  <Coins className="w-3.5 h-3.5 text-[#FBBF24]" />
                  <span className="font-mono-num text-xs font-bold text-white">
                    {coins.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && onOpenAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdmin();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/35 border border-[#A78BFA]/45 text-xs font-display font-bold text-[#d0bcff] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Admin
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/40 text-xs font-display font-semibold text-[#E2E8F0] hover:text-rose-300 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {t.auth.signOut}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History Tabs */}
        {isSignedIn && (
          <>
            <div className="px-5 pt-3">
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0B0F19]/80 border border-white/10">
                <button
                  type="button"
                  onClick={() => setTab('wallet')}
                  className={`py-2 rounded-lg text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    tab === 'wallet'
                      ? 'bg-[#7C3AED] text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  {t.auth.tabWallet}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('purchases')}
                  className={`py-2 rounded-lg text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    tab === 'purchases'
                      ? 'bg-[#7C3AED] text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {t.auth.tabPurchases}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('rooms')}
                  className={`py-2 rounded-lg text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    tab === 'rooms'
                      ? 'bg-[#7C3AED] text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  {t.auth.tabRooms}
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
              {tab === 'wallet' &&
                (walletTxs.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] text-center py-8">{t.auth.emptyWallet}</p>
                ) : (
                  walletTxs.map((tx) => {
                    const positive = tx.amount >= 0;
                    return (
                      <div
                        key={tx.id}
                        className="rounded-xl bg-[#0B0F19]/75 border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              positive
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {positive ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-display font-bold text-white truncate">
                              {tx.label}
                            </div>
                            <div className="text-[10px] text-[#94A3B8] font-mono-num">
                              {formatDateTime(tx.createdAtMs)}
                              {tx.referenceCode ? ` · ${tx.referenceCode}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`font-mono-num text-xs font-bold ${
                              positive ? 'text-emerald-400' : 'text-rose-300'
                            }`}
                          >
                            {positive ? '+' : ''}
                            {tx.amount.toLocaleString()}
                          </div>
                          <div className="text-[10px] font-mono-num text-[#64748B]">
                            {tx.balanceAfter.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ))}

              {tab === 'purchases' &&
                (purchases.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] text-center py-8">
                    {t.auth.emptyPurchases}
                  </p>
                ) : (
                  purchases.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl bg-[#0B0F19]/75 border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#A78BFA]/30 flex items-center justify-center text-[#A78BFA] shrink-0">
                          {p.category === 'dice' ? (
                            <Dices className="w-4 h-4" />
                          ) : p.category === 'token' ? (
                            <Crown className="w-4 h-4" />
                          ) : (
                            <Coins className="w-4 h-4 text-[#FBBF24]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-display font-bold text-white truncate">
                            {p.itemName}
                          </div>
                          <div className="text-[10px] text-[#94A3B8] uppercase font-display">
                            {p.category} · {formatDateTime(p.createdAtMs)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono-num text-xs font-bold text-[#FBBF24]">
                          {p.price > 0 ? `${p.price.toLocaleString()}` : t.lobby.online.freeOption}
                        </div>
                        <div className="text-[10px] font-mono-num text-[#64748B]">
                          {p.balanceAfter.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                ))}

              {tab === 'rooms' &&
                (roomHistory.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] text-center py-8">{t.auth.emptyRooms}</p>
                ) : (
                  roomHistory.map((r) => {
                    const isWin = r.outcome === 'win';
                    const isLoss = r.outcome === 'loss';
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl bg-[#0B0F19]/75 border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isWin
                                ? 'bg-amber-500/20 text-[#FBBF24]'
                                : isLoss
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'bg-[#06B6D4]/15 text-[#4cd7f6]'
                            }`}
                          >
                            {isWin ? <Trophy className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono-num text-xs font-extrabold text-white">
                                {r.roomCode}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-display font-bold uppercase text-[#CBD5E1]">
                                {t.auth.roles[r.role]} · {r.playerCount}P
                              </span>
                            </div>
                            <div className="text-[10px] text-[#94A3B8] truncate mt-0.5">
                              {formatDateTime(r.createdAtMs)}
                              {r.opponents.length > 0 ? ` · vs ${r.opponents.join(', ')}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-display font-bold ${
                              isWin
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isLoss
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-cyan-500/20 text-cyan-300'
                            }`}
                          >
                            {t.auth.outcomes[r.outcome]}
                          </span>
                          <div
                            className={`font-mono-num text-[11px] font-bold mt-0.5 ${
                              r.netChange > 0
                                ? 'text-emerald-400'
                                : r.netChange < 0
                                ? 'text-rose-300'
                                : 'text-[#94A3B8]'
                            }`}
                          >
                            {r.netChange > 0 ? `+${r.netChange.toLocaleString()}` : r.netChange.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
