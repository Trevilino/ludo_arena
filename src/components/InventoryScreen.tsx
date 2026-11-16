import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Coins,
  Crown,
  Dices,
  Grid,
  Lock,
  LogIn,
  ShoppingBag,
} from 'lucide-react';
import { LOADOUT_ITEMS } from '../data/mockArenaData';
import { fmt, Translations } from '../i18n/translations';
import {
  BoardThemeId,
  DiceSkinId,
  LoadoutItem,
  PlatformSettings,
  ShopOrderRecord,
  TokenStyleId,
} from '../types/ludo';
import { formatFiatFromCents } from '../utils/firestoreService';

interface InventoryScreenProps {
  t: Translations;
  coins: number;
  isSignedIn: boolean;
  platformSettings: PlatformSettings;
  shopOrders: ShopOrderRecord[];
  unlockedIds: string[];
  equippedDice: DiceSkinId;
  equippedToken: TokenStyleId;
  equippedBoard: BoardThemeId;
  onUnlock: (item: LoadoutItem) => void;
  onEquip: (item: LoadoutItem) => void;
  onBuyCoins: (order: {
    coinsAmount: number;
    fiatCents: number;
    paymentMethod: string;
  }) => Promise<void>;
  onSellCoins: (order: {
    coinsAmount: number;
    fiatCents: number;
    paymentMethod: string;
    payoutDetails: string;
  }) => Promise<void>;
  onSignInGoogle: () => void;
}

const BUY_PACKS = [1000, 5000, 15000, 50000];
const SELL_PRESETS = [500, 1000, 2500, 5000];
const PAYMENT_METHODS = ['Mobile Money', 'Carte Bancaire', 'PayPal'];
const PAYOUT_METHODS = ['Mobile Money', 'Virement IBAN', 'PayPal'];

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  t,
  coins,
  isSignedIn,
  platformSettings,
  shopOrders,
  unlockedIds,
  equippedDice,
  equippedToken,
  equippedBoard,
  onUnlock,
  onEquip,
  onBuyCoins,
  onSellCoins,
  onSignInGoogle,
}) => {
  const [category, setCategory] = useState<'coins' | 'all' | 'dice' | 'token' | 'board'>('coins');

  // Buy Coins State
  const [buyAmountStr, setBuyAmountStr] = useState<string>('5000');
  const [buyMethod, setBuyMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [buyBusy, setBuyBusy] = useState<boolean>(false);

  // Sell Coins State
  const [sellAmountStr, setSellAmountStr] = useState<string>('1000');
  const [sellMethod, setSellMethod] = useState<string>(PAYOUT_METHODS[0]);
  const [payoutDetails, setPayoutDetails] = useState<string>('');
  const [sellBusy, setSellBusy] = useState<boolean>(false);

  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const items = LOADOUT_ITEMS.filter((item) =>
    category === 'all' ? true : item.category === category
  );

  const isEquipped = (item: LoadoutItem) => {
    if (item.category === 'dice') return equippedDice === item.id;
    if (item.category === 'token') return equippedToken === item.id;
    return equippedBoard === item.id;
  };

  const buyCoinsAmount = Math.max(0, Math.floor(Number(buyAmountStr) || 0));
  const buyFiatCents = Math.max(
    1,
    Math.round((buyCoinsAmount / 1000) * platformSettings.buyRatePer1000Cents)
  );

  const sellCoinsAmount = Math.max(0, Math.floor(Number(sellAmountStr) || 0));
  const sellFiatCents = Math.max(
    1,
    Math.round((sellCoinsAmount / 1000) * platformSettings.sellRatePer1000Cents)
  );

  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!isSignedIn) {
      onSignInGoogle();
      return;
    }
    if (!platformSettings.shopBuyEnabled || buyCoinsAmount < 100) return;

    setBuyBusy(true);
    try {
      await onBuyCoins({
        coinsAmount: buyCoinsAmount,
        fiatCents: buyFiatCents,
        paymentMethod: buyMethod,
      });
      setFeedback({
        kind: 'ok',
        text: platformSettings.instantBuyCredit
          ? fmt(t.inventory.coinShop.buySuccessInstant, {
              coins: buyCoinsAmount.toLocaleString(),
            })
          : fmt(t.inventory.coinShop.buySuccessPending, {
              coins: buyCoinsAmount.toLocaleString(),
            }),
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Error',
      });
    } finally {
      setBuyBusy(false);
    }
  };

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!isSignedIn) {
      onSignInGoogle();
      return;
    }
    if (!platformSettings.shopSellEnabled) return;
    if (sellCoinsAmount < platformSettings.minSellCoins || sellCoinsAmount > coins) {
      setFeedback({ kind: 'err', text: t.inventory.coinShop.insufficientCoins });
      return;
    }
    if (!payoutDetails.trim()) {
      setFeedback({ kind: 'err', text: t.inventory.coinShop.missingDestination });
      return;
    }

    setSellBusy(true);
    try {
      await onSellCoins({
        coinsAmount: sellCoinsAmount,
        fiatCents: sellFiatCents,
        paymentMethod: sellMethod,
        payoutDetails: payoutDetails.trim(),
      });
      setPayoutDetails('');
      setFeedback({
        kind: 'ok',
        text: fmt(t.inventory.coinShop.sellSuccessPending, {
          coins: sellCoinsAmount.toLocaleString(),
        }),
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Error',
      });
    } finally {
      setSellBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-display font-bold uppercase tracking-widest text-[#FBBF24]">
            {t.inventory.kicker}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            {t.inventory.title}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">{t.inventory.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-[#0B0F19]/80 border border-[#F97316]/35 px-4 py-2.5 shrink-0">
          <Coins className="w-5 h-5 text-[#FBBF24]" />
          <div className="font-mono-num text-lg font-bold text-white">
            {coins.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Category Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { id: 'coins', label: t.inventory.tabs.coins },
          { id: 'all', label: t.inventory.tabs.all },
          { id: 'dice', label: t.inventory.tabs.dice },
          { id: 'token', label: t.inventory.tabs.token },
          { id: 'board', label: t.inventory.tabs.board },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategory(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-display font-semibold transition-colors whitespace-nowrap ${
              category === tab.id
                ? 'bg-[#8B5CF6] text-white'
                : 'bg-[#111827]/80 text-[#94A3B8] border border-white/10 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {category === 'coins' ? (
        <div className="space-y-6">
          {!isSignedIn && (
            <div className="glass-panel rounded-2xl p-4 border-[#FBBF24]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs font-display font-semibold text-[#FDE68A]">
                <ShoppingBag className="w-4 h-4 text-[#FBBF24] shrink-0" />
                <span>{t.inventory.coinShop.signInRequired}</span>
              </div>
              <button
                type="button"
                onClick={onSignInGoogle}
                className="btn-primary-violet px-4 py-2 rounded-xl text-xs font-display font-bold text-white inline-flex items-center justify-center gap-1.5 shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                {t.auth.signInGoogle}
              </button>
            </div>
          )}

          {feedback && (
            <div
              className={`rounded-xl px-4 py-3 text-xs font-display font-semibold border ${
                feedback.kind === 'ok'
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* BUY COINS CARD */}
            <form
              onSubmit={handleBuySubmit}
              className="glass-panel rounded-2xl p-5 space-y-4 border border-[#06B6D4]/25"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4]/45 flex items-center justify-center text-[#4cd7f6]">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-white">
                      {t.inventory.coinShop.buyTitle}
                    </h2>
                    <p className="text-xs text-[#94A3B8]">
                      {fmt(t.inventory.coinShop.buySubtitle, {
                        rate: formatFiatFromCents(
                          platformSettings.buyRatePer1000Cents,
                          platformSettings.currency
                        ),
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {!platformSettings.shopBuyEnabled ? (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/25 rounded-xl p-3">
                  {t.inventory.coinShop.disabledMsg}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {BUY_PACKS.map((pack) => {
                      const packCents = Math.round(
                        (pack / 1000) * platformSettings.buyRatePer1000Cents
                      );
                      const selected = buyCoinsAmount === pack;
                      return (
                        <button
                          key={pack}
                          type="button"
                          onClick={() => setBuyAmountStr(String(pack))}
                          className={`rounded-xl p-2.5 border text-left transition-all ${
                            selected
                              ? 'bg-[#06B6D4]/18 border-[#4cd7f6]'
                              : 'bg-[#0B0F19]/80 border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="font-mono-num text-xs font-extrabold text-white">
                            +{pack.toLocaleString()}
                          </div>
                          <div className="font-mono-num text-[11px] font-bold text-[#4cd7f6] mt-0.5">
                            {formatFiatFromCents(packCents, platformSettings.currency)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      {t.inventory.coinShop.customAmount}
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={10000000}
                      step={100}
                      value={buyAmountStr}
                      onChange={(e) => setBuyAmountStr(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F19]/85 border border-white/15 font-mono-num text-sm font-bold text-white focus:outline-none focus:border-[#4cd7f6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      {t.inventory.coinShop.paymentMethod}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setBuyMethod(m)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-display font-bold border transition-colors ${
                            buyMethod === m
                              ? 'bg-[#8B5CF6]/25 border-[#A78BFA] text-white'
                              : 'bg-[#0B0F19]/70 border-white/10 text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-[#94A3B8]">
                    {platformSettings.instantBuyCredit
                      ? t.inventory.coinShop.instantNote
                      : t.inventory.coinShop.manualNote}
                  </p>

                  <button
                    type="submit"
                    disabled={buyBusy || buyCoinsAmount < 100}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-display font-bold transition-all ${
                      buyBusy || buyCoinsAmount < 100
                        ? 'bg-white/5 text-[#64748B] cursor-not-allowed'
                        : 'btn-secondary-cyan'
                    }`}
                  >
                    {fmt(t.inventory.coinShop.buyBtn, {
                      coins: buyCoinsAmount.toLocaleString(),
                      price: formatFiatFromCents(buyFiatCents, platformSettings.currency),
                    })}
                  </button>
                </>
              )}
            </form>

            {/* SELL COINS CARD */}
            <form
              onSubmit={handleSellSubmit}
              className="glass-panel rounded-2xl p-5 space-y-4 border border-[#F97316]/25"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#F97316]/15 border border-[#FBBF24]/45 flex items-center justify-center text-[#FBBF24]">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-white">
                      {t.inventory.coinShop.sellTitle}
                    </h2>
                    <p className="text-xs text-[#94A3B8]">
                      {fmt(t.inventory.coinShop.sellSubtitle, {
                        rate: formatFiatFromCents(
                          platformSettings.sellRatePer1000Cents,
                          platformSettings.currency
                        ),
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {!platformSettings.shopSellEnabled ? (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/25 rounded-xl p-3">
                  {t.inventory.coinShop.disabledMsg}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-1.5">
                    {SELL_PRESETS.map((amt) => {
                      const selected = sellCoinsAmount === amt;
                      const affordable = coins >= amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          disabled={!affordable}
                          onClick={() => setSellAmountStr(String(amt))}
                          className={`py-2 rounded-xl font-mono-num text-[11px] font-bold border transition-all ${
                            selected
                              ? 'bg-[#F97316]/20 border-[#FBBF24] text-[#FBBF24]'
                              : !affordable
                              ? 'bg-[#0B0F19]/40 border-white/5 text-[#64748B] opacity-50 cursor-not-allowed'
                              : 'bg-[#0B0F19]/75 border-white/10 text-[#E2E8F0] hover:border-white/25'
                          }`}
                        >
                          {amt}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={coins < platformSettings.minSellCoins}
                      onClick={() => setSellAmountStr(String(coins))}
                      className={`py-2 rounded-xl font-display text-[11px] font-bold border transition-all ${
                        sellCoinsAmount === coins && coins > 0
                          ? 'bg-[#F97316]/20 border-[#FBBF24] text-[#FBBF24]'
                          : coins < platformSettings.minSellCoins
                          ? 'bg-[#0B0F19]/40 border-white/5 text-[#64748B] opacity-50 cursor-not-allowed'
                          : 'bg-[#0B0F19]/75 border-white/10 text-[#E2E8F0] hover:border-white/25'
                      }`}
                    >
                      MAX
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                        {t.inventory.coinShop.customAmount}
                      </label>
                      <span className="text-[10px] font-display text-[#94A3B8]">
                        {fmt(t.inventory.coinShop.minSellHint, {
                          min: platformSettings.minSellCoins.toLocaleString(),
                        })}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={platformSettings.minSellCoins}
                      max={Math.max(platformSettings.minSellCoins, coins)}
                      step={50}
                      value={sellAmountStr}
                      onChange={(e) => setSellAmountStr(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F19]/85 border border-white/15 font-mono-num text-sm font-bold text-white focus:outline-none focus:border-[#FBBF24]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      {t.inventory.coinShop.payoutMethod}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PAYOUT_METHODS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSellMethod(m)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-display font-bold border transition-colors ${
                            sellMethod === m
                              ? 'bg-[#F97316]/25 border-[#FBBF24] text-[#FBBF24]'
                              : 'bg-[#0B0F19]/70 border-white/10 text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      {t.inventory.coinShop.payoutDestination}
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={payoutDetails}
                      placeholder={t.inventory.coinShop.payoutPlaceholder}
                      onChange={(e) => setPayoutDetails(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#0B0F19]/85 border border-white/15 text-xs font-display font-semibold text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#FBBF24]"
                    />
                  </div>

                  <p className="text-[11px] text-[#94A3B8]">{t.inventory.coinShop.sellNote}</p>

                  <button
                    type="submit"
                    disabled={
                      sellBusy ||
                      (isSignedIn &&
                        (sellCoinsAmount < platformSettings.minSellCoins ||
                          sellCoinsAmount > coins))
                    }
                    className={`w-full py-3 px-4 rounded-xl text-xs font-display font-bold transition-all ${
                      sellBusy ||
                      (isSignedIn &&
                        (sellCoinsAmount < platformSettings.minSellCoins ||
                          sellCoinsAmount > coins))
                        ? 'bg-white/5 text-[#64748B] cursor-not-allowed'
                        : 'btn-primary-violet text-white'
                    }`}
                  >
                    {fmt(t.inventory.coinShop.sellBtn, {
                      coins: sellCoinsAmount.toLocaleString(),
                      price: formatFiatFromCents(sellFiatCents, platformSettings.currency),
                    })}
                  </button>
                </>
              )}
            </form>
          </div>

          {/* Orders History */}
          {isSignedIn && (
            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-[#94A3B8]">
                {t.inventory.coinShop.ordersTitle}
              </h3>

              {shopOrders.length === 0 ? (
                <p className="text-xs text-[#64748B] py-4">{t.inventory.coinShop.emptyOrders}</p>
              ) : (
                <div className="space-y-2">
                  {shopOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl bg-[#0B0F19]/80 border border-white/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-display font-bold ${
                              order.orderType === 'buy'
                                ? 'bg-[#06B6D4]/20 text-[#4cd7f6]'
                                : 'bg-[#F97316]/20 text-[#FBBF24]'
                            }`}
                          >
                            {order.orderType === 'buy'
                              ? t.inventory.coinShop.orderBuyLabel
                              : t.inventory.coinShop.orderSellLabel}
                          </span>
                          <span className="font-mono-num text-xs font-extrabold text-white">
                            {order.coinsAmount.toLocaleString()} {t.tournaments.coinsUnit}
                          </span>
                          <span className="font-mono-num text-xs font-bold text-[#94A3B8]">
                            · {formatFiatFromCents(order.fiatCents, order.currency)}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5 truncate">
                          {order.paymentMethod}
                          {order.payoutDetails ? ` · ${order.payoutDetails}` : ''}
                          {order.adminNote ? ` · Note: ${order.adminNote}` : ''}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-display font-bold shrink-0 ${
                          order.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : order.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {order.status === 'completed'
                          ? t.inventory.coinShop.statusCompleted
                          : order.status === 'rejected'
                          ? t.inventory.coinShop.statusRejected
                          : t.inventory.coinShop.statusPending}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const unlocked = unlockedIds.includes(item.id);
            const equipped = isEquipped(item);
            const canAfford = coins >= item.price;
            const localized = t.inventory.items[item.id] ?? {
              name: item.name,
              description: item.description,
            };

            return (
              <div
                key={item.id}
                className="glass-panel rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all"
                style={{
                  borderColor: equipped ? item.previewAccent : undefined,
                  boxShadow: equipped ? `0 0 22px ${item.previewAccent}33` : undefined,
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center border"
                      style={{
                        backgroundColor: `${item.previewAccent}1F`,
                        borderColor: `${item.previewAccent}66`,
                      }}
                    >
                      {item.category === 'dice' && (
                        <Dices className="w-6 h-6" style={{ color: item.previewAccent }} />
                      )}
                      {item.category === 'token' && (
                        <Crown className="w-6 h-6" style={{ color: item.previewAccent }} />
                      )}
                      {item.category === 'board' && (
                        <Grid className="w-6 h-6" style={{ color: item.previewAccent }} />
                      )}
                    </div>

                    <span className="text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                      {t.inventory.rarities[item.rarity]} · {t.inventory.categories[item.category]}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-white">{localized.name}</h3>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    {localized.description}
                  </p>
                </div>

                <div>
                  {equipped ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4] text-[#4cd7f6] text-xs font-display font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      {t.inventory.equipped}
                    </button>
                  ) : unlocked ? (
                    <button
                      type="button"
                      onClick={() => onEquip(item)}
                      className="btn-secondary-cyan w-full py-2.5 px-4 rounded-xl text-xs font-display font-bold"
                    >
                      {t.inventory.equip}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onUnlock(item)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 ${
                        canAfford
                          ? 'btn-primary-violet text-white'
                          : 'bg-white/5 border border-white/10 text-[#64748B] cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      {t.inventory.unlock} · {item.price.toLocaleString()}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
