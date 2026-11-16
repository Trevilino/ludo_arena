import React from 'react';
import { Coins, Sparkles, X } from 'lucide-react';
import { Translations } from '../i18n/translations';

interface CoinTopUpModalProps {
  t: Translations;
  isOpen: boolean;
  coins: number;
  bonusClaimed: boolean;
  onClose: () => void;
  onAddCoins: (amount: number, isDailyBonus?: boolean) => void;
}

export const CoinTopUpModal: React.FC<CoinTopUpModalProps> = ({
  t,
  isOpen,
  coins,
  bonusClaimed,
  onClose,
  onAddCoins,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.vault.title}
    >
      <div className="glass-card rounded-2xl w-full max-w-md p-6 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[#F97316]/15 border border-[#F97316]/40 flex items-center justify-center">
            <Coins className="w-6 h-6 text-[#FBBF24]" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white">{t.vault.title}</h2>
            <p className="text-xs text-[#94A3B8]">
              {t.vault.balance}{' '}
              <span className="font-mono-num text-[#FBBF24] font-bold">
                {coins.toLocaleString()}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-3 mt-5">
          <div className="rounded-xl bg-[#0B0F19]/80 border border-white/10 p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#4cd7f6]" />
                {t.vault.dailyTitle}
              </div>
              <div className="text-xs text-[#94A3B8] mt-0.5">{t.vault.dailyDesc}</div>
            </div>
            <button
              type="button"
              disabled={bonusClaimed}
              onClick={() => onAddCoins(1000, true)}
              className={`px-3.5 py-2 rounded-lg text-xs font-display font-bold whitespace-nowrap ${
                bonusClaimed
                  ? 'bg-white/5 text-[#64748B] border border-white/10 cursor-not-allowed'
                  : 'btn-primary-violet text-white'
              }`}
            >
              {bonusClaimed ? t.vault.claimed : t.vault.claimBtn}
            </button>
          </div>

          <div className="rounded-xl bg-[#0B0F19]/80 border border-white/10 p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-sm font-bold text-white">
                {t.vault.refillTitle}
              </div>
              <div className="text-xs text-[#94A3B8] mt-0.5">{t.vault.refillDesc}</div>
            </div>
            <button
              type="button"
              onClick={() => onAddCoins(500)}
              className="btn-secondary-cyan px-3.5 py-2 rounded-lg text-xs font-display font-bold whitespace-nowrap"
            >
              {t.vault.addBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
