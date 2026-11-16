import React, { useState } from 'react';
import { Coins, Flame, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { Translations } from '../i18n/translations';
import { ChatMessage, ColorId, MatchEvent, PlayerConfig } from '../types/ludo';
import { COLOR_HEX } from '../utils/ludoEngine';

interface RightTelemetryPanelProps {
  t: Translations;
  matchActive: boolean;
  wagerPot: number;
  turnCount: number;
  activeColor: ColorId;
  players: Record<ColorId, PlayerConfig>;
  events: MatchEvent[];
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export const RightTelemetryPanel: React.FC<RightTelemetryPanelProps> = ({
  t,
  matchActive,
  wagerPot,
  turnCount,
  activeColor,
  players,
  events,
  chatMessages,
  onSendMessage,
}) => {
  const [draft, setDraft] = useState('');
  const [activeTab, setActiveTab] = useState<'feed' | 'chat'>('feed');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setDraft('');
  };

  const activePlayer = players[activeColor];
  const activeHex = COLOR_HEX[activeColor].primary;

  return (
    <aside className="flex flex-col gap-4 h-full">
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-display text-sm font-bold text-white tracking-tight">
            {matchActive ? t.telemetry.activeTable : t.telemetry.arenaSummary}
          </h2>
          <span className="font-mono-num text-xs text-[#94A3B8]">
            {matchActive ? `${t.telemetry.turn} ${turnCount}` : t.telemetry.ready}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#0B0F19]/75 border border-white/10 p-3">
            <div className="text-[11px] font-display uppercase tracking-wider text-[#94A3B8]">
              {t.telemetry.prizePool}
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono-num text-lg font-bold text-[#FBBF24]">
              <Coins className="w-4 h-4 text-[#F97316] shrink-0" />
              <span>{wagerPot.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#0B0F19]/75 border border-white/10 p-3">
            <div className="text-[11px] font-display uppercase tracking-wider text-[#94A3B8]">
              {t.telemetry.activeSeat}
            </div>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeHex, boxShadow: `0 0 8px ${activeHex}` }}
              />
              <span className="font-display text-sm font-semibold text-white truncate">
                {matchActive ? activePlayer.name.split(' ')[0] : t.telemetry.lobby}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#06B6D4]" />
            {t.telemetry.safeRunes}
          </span>
          <span className="inline-flex items-center gap-1 text-[#FBBF24]">
            <Flame className="w-3.5 h-3.5" />
            {t.telemetry.forfeitRule}
          </span>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 flex-1 flex flex-col min-h-[380px] max-h-[540px]">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0F19]/80 border border-white/10 mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-display font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'feed'
                ? 'bg-[#1E293B] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            {t.telemetry.matchLog}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-display font-semibold transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-[#1E293B] text-white shadow-sm'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {t.telemetry.tableChat}
          </button>
        </div>

        {activeTab === 'feed' ? (
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {events.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-xs text-[#94A3B8] px-4">
                {t.telemetry.emptyLog}
              </div>
            ) : (
              events.map((ev) => {
                const badgeColor =
                  ev.color === 'system' ? '#8B5CF6' : COLOR_HEX[ev.color].primary;
                return (
                  <div
                    key={ev.id}
                    className="rounded-xl bg-[#0B0F19]/60 border border-white/[0.06] px-3 py-2 text-xs leading-relaxed"
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span
                        className="font-display font-bold uppercase tracking-wider text-[10px]"
                        style={{ color: badgeColor }}
                      >
                        {ev.color === 'system'
                          ? t.telemetry.arenaSource
                          : players[ev.color]?.name.split(' ')[0]}
                      </span>
                      <span className="font-mono-num text-[10px] text-[#64748B]">
                        {ev.timestamp}
                      </span>
                    </div>
                    <p className="text-[#E2E8F0]">{ev.message}</p>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 mb-3">
              {chatMessages.map((msg) => {
                const senderColor =
                  msg.color === 'system' ? '#4cd7f6' : COLOR_HEX[msg.color].primary;
                return (
                  <div key={msg.id} className="text-xs leading-relaxed">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display font-semibold" style={{ color: senderColor }}>
                        {msg.sender}
                      </span>
                      <span className="font-mono-num text-[10px] text-[#64748B]">
                        {msg.time}
                      </span>
                    </div>
                    <p className="text-[#E2E8F0] mt-0.5">{msg.text}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {t.telemetry.quickPhrases.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => onSendMessage(phrase)}
                  className="px-2.5 py-1 rounded-lg bg-[#1E293B]/80 hover:bg-[#8B5CF6]/25 border border-white/10 hover:border-[#8B5CF6]/50 text-[11px] font-medium text-[#E2E8F0] transition-colors whitespace-nowrap"
                >
                  {phrase}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.telemetry.messagePlaceholder}
                className="flex-1 min-w-0 rounded-xl bg-[#0B0F19]/90 border border-white/15 px-3 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
              />
              <button
                type="submit"
                aria-label="Send"
                className="w-9 h-9 rounded-xl btn-primary-violet flex items-center justify-center text-white shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
};
