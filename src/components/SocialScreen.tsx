import React, { useState } from 'react';
import { Swords, UserPlus } from 'lucide-react';
import { FRIENDS_LIST } from '../data/mockArenaData';
import { fmt, Translations } from '../i18n/translations';
import { FriendEntry } from '../types/ludo';
import { PlayerAvatar } from './PlayerAvatar';

interface SocialScreenProps {
  t: Translations;
  onChallengeFriend: (friend: FriendEntry) => void;
}

export const SocialScreen: React.FC<SocialScreenProps> = ({ t, onChallengeFriend }) => {
  const [invitedHandle, setInvitedHandle] = useState('');
  const [customFriends, setCustomFriends] = useState<FriendEntry[]>(FRIENDS_LIST);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = invitedHandle.trim();
    if (!cleaned) return;
    const normalized = cleaned.startsWith('@') ? cleaned : `@${cleaned}`;

    if (customFriends.some((f) => f.handle.toLowerCase() === normalized.toLowerCase())) {
      setFeedback(fmt(t.social.alreadyAdded, { handle: normalized }));
      return;
    }

    const newFriend: FriendEntry = {
      id: `f-${Date.now()}`,
      name: normalized.replace('@', '').toUpperCase(),
      handle: normalized.toLowerCase(),
      avatar: FRIENDS_LIST[customFriends.length % FRIENDS_LIST.length].avatar,
      color: (['green', 'yellow', 'blue'] as const)[customFriends.length % 3],
      elo: 1920,
      status: 'Online',
      record: '0W - 0L',
      difficulty: 'standard',
    };

    setCustomFriends((prev) => [newFriend, ...prev]);
    setInvitedHandle('');
    setFeedback(fmt(t.social.addedSuccess, { handle: normalized }));
  };

  const statusText = (status: FriendEntry['status']) => {
    if (status === 'Online') return t.social.statusOnline;
    if (status === 'In Match') return t.social.statusInMatch;
    return t.social.statusAway;
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-display font-bold uppercase tracking-widest text-[#4cd7f6]">
            {t.social.kicker}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            {t.social.title}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">{t.social.subtitle}</p>
        </div>

        <form onSubmit={handleAddFriend} className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={invitedHandle}
            onChange={(e) => setInvitedHandle(e.target.value)}
            placeholder={t.social.placeholder}
            className="rounded-xl bg-[#0B0F19]/90 border border-white/15 px-3 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4] w-40 sm:w-44"
          />
          <button
            type="submit"
            className="btn-secondary-cyan px-3.5 py-2 rounded-xl text-xs font-display font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {t.social.addRival}
          </button>
        </form>
      </div>

      {feedback && (
        <div className="rounded-xl bg-[#06B6D4]/10 border border-[#06B6D4]/40 px-4 py-2.5 text-xs text-[#4cd7f6]">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {customFriends.map((friend) => (
          <div
            key={friend.id}
            className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <PlayerAvatar
                src={friend.avatar}
                name={friend.name}
                color={friend.color}
                size="md"
              />
              <div className="min-w-0">
                <div className="font-display text-base font-bold text-white truncate">
                  {friend.name}
                </div>
                <div className="text-xs text-[#94A3B8] truncate">
                  {friend.handle} · <span className="font-mono-num">{friend.elo} ELO</span>
                </div>
                <div className="mt-1 text-xs flex items-center gap-2">
                  <span
                    className={
                      friend.status === 'Online' ? 'text-[#10B981]' : 'text-[#FBBF24]'
                    }
                  >
                    {statusText(friend.status)}
                  </span>
                  <span className="text-[#64748B]">·</span>
                  <span className="text-[#94A3B8] font-mono-num">
                    {friend.record.replace(' vs You', '')} {t.social.vsYou}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onChallengeFriend(friend)}
              className="btn-primary-violet px-3.5 py-2.5 rounded-xl text-xs font-display font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Swords className="w-3.5 h-3.5" />
              {t.social.duelBtn}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
