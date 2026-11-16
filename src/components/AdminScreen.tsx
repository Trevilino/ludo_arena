import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Check,
  Coins,
  Crown,
  LogIn,
  LogOut,
  MessageSquare,
  Radio,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminLiveRoomSummary,
  AdminUserRecord,
  FirestoreUserProfile,
  PlatformCurrency,
  PlatformSettings,
  ShopOrderRecord,
} from '../types/ludo';
import {
  ADMIN_BOOTSTRAP_EMAIL,
  adminGrantAdminRole,
  adminProcessShopOrder,
  adminRevokeAdminRole,
  adminSavePlatformSettings,
  adminUpdateUserAccount,
  formatFiatFromCents,
  subscribeAdminDashboard,
} from '../utils/firestoreService';
import { PlayerAvatar } from './PlayerAvatar';

interface AdminScreenProps {
  firebaseUser: User | null;
  authLoading: boolean;
  authError: string | null;
  isAdmin: boolean;
  platformSettings: PlatformSettings;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onBackToArena: () => void;
}

type AdminTab = 'overview' | 'users' | 'orders' | 'rooms' | 'settings';

function formatShortDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const AdminScreen: React.FC<AdminScreenProps> = ({
  firebaseUser,
  authLoading,
  authError,
  isAdmin,
  platformSettings,
  onSignInGoogle,
  onSignOut,
  onBackToArena,
}) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<FirestoreUserProfile[]>([]);
  const [orders, setOrders] = useState<ShopOrderRecord[]>([]);
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);

  // Live server telemetry
  const [liveRooms, setLiveRooms] = useState<AdminLiveRoomSummary[]>([]);
  const [connectedSockets, setConnectedSockets] = useState<number>(0);
  const [activeWallets, setActiveWallets] = useState<number>(0);
  const [liveLoading, setLiveLoading] = useState<boolean>(false);

  // Filters & drafts
  const [userSearch, setUserSearch] = useState<string>('');
  const [orderFilter, setOrderFilter] = useState<'pending' | 'all' | 'buy' | 'sell'>('pending');
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  // User editor drawer/panel
  const [editingUser, setEditingUser] = useState<FirestoreUserProfile | null>(null);
  const [editCoinsStr, setEditCoinsStr] = useState<string>('0');
  const [editEloStr, setEditEloStr] = useState<string>('2140');
  const [editSuspended, setEditSuspended] = useState<boolean>(false);
  const [editReason, setEditReason] = useState<string>('Ajustement administrateur');
  const [userBusy, setUserBusy] = useState<boolean>(false);

  // Live room controls
  const [roomMessageDrafts, setRoomMessageDrafts] = useState<Record<string, string>>({});
  const [confirmCloseCode, setConfirmCloseCode] = useState<string | null>(null);

  // Settings form state
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(platformSettings);
  const [settingsBusy, setSettingsBusy] = useState<boolean>(false);

  // Global status toast
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setSettingsDraft(platformSettings);
  }, [platformSettings]);

  const showToast = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  const fetchLiveServer = useCallback(async () => {
    if (!firebaseUser || !isAdmin) return;
    setLiveLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/admin/live', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok: boolean;
        connectedSockets: number;
        activeWallets: number;
        rooms: AdminLiveRoomSummary[];
      };
      if (data.ok) {
        setConnectedSockets(data.connectedSockets || 0);
        setActiveWallets(data.activeWallets || 0);
        setLiveRooms(data.rooms || []);
      }
    } catch {
      // Network polling errors handled silently
    } finally {
      setLiveLoading(false);
    }
  }, [firebaseUser, isAdmin]);

  useEffect(() => {
    if (!firebaseUser || !isAdmin) return;
    const unsub = subscribeAdminDashboard({
      onUsers: setUsers,
      onOrders: setOrders,
      onAdmins: setAdmins,
    });
    void fetchLiveServer();
    const interval = window.setInterval(() => {
      void fetchLiveServer();
    }, 15000);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, [firebaseUser, isAdmin, fetchLiveServer]);

  const syncServerWallet = useCallback(
    async (playerId: string, coins: number) => {
      if (!firebaseUser) return;
      try {
        const token = await firebaseUser.getIdToken();
        await fetch('/api/admin/wallet/set', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ playerId, coins }),
        });
      } catch {
        // Live server sync is best-effort
      }
    },
    [firebaseUser]
  );

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );
  const totalCoinsInCirculation = useMemo(
    () => users.reduce((sum, u) => sum + u.coins, 0),
    [users]
  );
  const adminUidSet = useMemo(() => new Set(admins.map((a) => a.uid)), [admins]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'pending') return orders.filter((o) => o.status === 'pending');
    if (orderFilter === 'buy') return orders.filter((o) => o.orderType === 'buy');
    if (orderFilter === 'sell') return orders.filter((o) => o.orderType === 'sell');
    return orders;
  }, [orders, orderFilter]);

  const openUserEditor = (u: FirestoreUserProfile) => {
    setEditingUser(u);
    setEditCoinsStr(String(u.coins));
    setEditEloStr(String(u.elo));
    setEditSuspended(Boolean(u.isSuspended));
    setEditReason('Ajustement administrateur');
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const nextCoins = Math.max(0, Math.min(10000000, Math.floor(Number(editCoinsStr) || 0)));
    const nextElo = Math.max(0, Math.min(100000, Math.floor(Number(editEloStr) || 0)));
    setUserBusy(true);
    try {
      await adminUpdateUserAccount(editingUser, {
        coins: nextCoins,
        elo: nextElo,
        isSuspended: editSuspended,
        reasonLabel: editReason.trim() || 'Ajustement administrateur',
      });
      await syncServerWallet(editingUser.uid, nextCoins);
      showToast('ok', `Compte ${editingUser.displayName} mis à jour.`);
      setEditingUser(null);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Erreur lors de la mise à jour.');
    } finally {
      setUserBusy(false);
    }
  };

  const handleToggleAdminRole = async (u: FirestoreUserProfile) => {
    if (u.email === ADMIN_BOOTSTRAP_EMAIL) return;
    try {
      if (adminUidSet.has(u.uid)) {
        await adminRevokeAdminRole(u.uid);
        showToast('ok', `Droits admin retirés pour ${u.displayName}.`);
      } else {
        await adminGrantAdminRole(u.uid, u.email || `${u.uid}@ludoarena.app`);
        showToast('ok', `${u.displayName} nommé administrateur.`);
      }
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Action impossible.');
    }
  };

  const handleProcessOrder = async (
    order: ShopOrderRecord,
    decision: 'completed' | 'rejected'
  ) => {
    setBusyOrderId(order.id);
    try {
      const note = (orderNotes[order.id] || '').trim();
      const updatedCoins = await adminProcessShopOrder(order, decision, note);
      if (updatedCoins !== null) {
        await syncServerWallet(order.uid, updatedCoins);
      }
      showToast(
        'ok',
        decision === 'completed'
          ? `Commande ${order.orderType === 'buy' ? "d'achat" : 'de vente'} validée.`
          : order.orderType === 'sell'
          ? `Vente refusée et ${order.coinsAmount.toLocaleString()} pièces remboursées.`
          : "Commande d'achat refusée."
      );
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Erreur traitement commande.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleCloseLiveRoom = async (code: string) => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(code)}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        showToast('err', `Impossible de fermer le salon ${code}.`);
        return;
      }
      setConfirmCloseCode(null);
      showToast('ok', `Salon ${code} fermé et mises remboursées.`);
      await fetchLiveServer();
    } catch {
      showToast('err', 'Erreur réseau.');
    }
  };

  const handleSendRoomAdminMessage = async (code: string) => {
    if (!firebaseUser) return;
    const text = (roomMessageDrafts[code] || '').trim();
    if (!text) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(code)}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        showToast('err', 'Échec de l’envoi du message.');
        return;
      }
      setRoomMessageDrafts((prev) => ({ ...prev, [code]: '' }));
      showToast('ok', `Message [ADMIN] envoyé au salon ${code}.`);
    } catch {
      showToast('err', 'Erreur réseau.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsBusy(true);
    try {
      await adminSavePlatformSettings(settingsDraft);
      showToast('ok', 'Paramètres globaux enregistrés et appliqués en direct.');
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Erreur de sauvegarde.');
    } finally {
      setSettingsBusy(false);
    }
  };

  // Unauthenticated Gate
  if (!firebaseUser) {
    return (
      <div className="min-h-dvh bg-[#0B0F19] text-[#E2E8F0] flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl w-full max-w-md p-6 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl mx-auto bg-[#8B5CF6]/20 border border-[#A78BFA]/50 flex items-center justify-center">
            <Shield className="w-7 h-7 text-[#A78BFA]" />
          </div>
          <div>
            <p className="text-[11px] font-display font-bold uppercase tracking-widest text-[#4cd7f6]">
              Ludo Arena · /admin
            </p>
            <h1 className="font-display text-2xl font-extrabold text-white mt-1">
              Console Administrateur
            </h1>
            <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
              Connectez-vous avec votre compte Google administrateur pour gérer les joueurs, les
              achats/ventes de pièces, les salons en direct et les paramètres de la plateforme.
            </p>
          </div>

          {authError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">
              {authError}
            </p>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={authLoading}
              onClick={onSignInGoogle}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-display text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-60"
            >
              <LogIn className="w-4 h-4 text-[#7C3AED]" />
              Connexion Google Admin
            </button>
            <button
              type="button"
              onClick={onBackToArena}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-[#E2E8F0] inline-flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour à L'Arène
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Non-Admin Access Denied Gate
  if (!isAdmin) {
    return (
      <div className="min-h-dvh bg-[#0B0F19] text-[#E2E8F0] flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl w-full max-w-md p-6 text-center space-y-5 border border-rose-500/35">
          <div className="w-14 h-14 rounded-2xl mx-auto bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-rose-400" />
          </div>
          <div>
            <p className="text-[11px] font-display font-bold uppercase tracking-widest text-rose-400">
              Accès Refusé
            </p>
            <h1 className="font-display text-2xl font-extrabold text-white mt-1">
              Droits Administrateur Requis
            </h1>
            <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
              Le compte <span className="text-white font-semibold">{firebaseUser.email}</span> n'est
              pas autorisé à accéder au panneau d'administration.
            </p>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onBackToArena}
              className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-[#E2E8F0] inline-flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Arène
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-xs font-display font-bold text-rose-300 inline-flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Changer de compte
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0B0F19] text-[#E2E8F0] relative overflow-x-hidden">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[460px] h-[460px] rounded-full bg-[#8B5CF6]/12 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[460px] h-[460px] rounded-full bg-[#06B6D4]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Admin Header */}
        <header className="glass-card rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.45)] shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white">
                  Administration Ludo Arena
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-display font-bold text-emerald-300">
                  ADMIN CONNECTÉ
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                {firebaseUser.displayName} · {firebaseUser.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchLiveServer()}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-[#4cd7f6] inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={onBackToArena}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-white inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour au Jeu
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-display font-bold text-rose-300 inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Déconnexion
            </button>
          </div>
        </header>

        {/* Feedback Toast */}
        {toast && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-display font-bold border flex items-center justify-between gap-2 ${
              toast.kind === 'ok'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
            }`}
          >
            <span>{toast.text}</span>
            <button type="button" onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap gap-2">
          {(
            [
              { id: 'overview', label: "Vue d'ensemble", icon: Crown },
              { id: 'users', label: `Joueurs (${users.length})`, icon: Users },
              {
                id: 'orders',
                label: `Boutique Pièces (${pendingOrders.length})`,
                icon: ShoppingBag,
              },
              { id: 'rooms', label: `Salons En Ligne (${liveRooms.length})`, icon: Radio },
              { id: 'settings', label: 'Paramètres Plateforme', icon: Settings },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-display font-bold inline-flex items-center gap-2 transition-all ${
                  active
                    ? 'bg-[#8B5CF6] text-white shadow-[0_0_18px_rgba(139,92,246,0.35)]'
                    : 'bg-[#111827]/85 text-[#94A3B8] border border-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* TAB 1: OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel rounded-2xl p-5">
                <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                  Joueurs Inscrits
                </div>
                <div className="font-mono-num text-3xl font-extrabold text-white mt-2">
                  {users.length}
                </div>
                <div className="text-xs text-[#64748B] mt-1">
                  {users.filter((u) => u.isSuspended).length} suspendu(s)
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                  Pièces en Circulation
                </div>
                <div className="font-mono-num text-3xl font-extrabold text-[#FBBF24] mt-2">
                  {totalCoinsInCirculation.toLocaleString()}
                </div>
                <div className="text-xs text-[#64748B] mt-1">
                  {activeWallets} wallets en mémoire serveur
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                  Commandes En Attente
                </div>
                <div className="font-mono-num text-3xl font-extrabold text-[#4cd7f6] mt-2">
                  {pendingOrders.length}
                </div>
                <div className="text-xs text-[#64748B] mt-1">
                  Sur {orders.length} demandes boutique
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5">
                <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[#94A3B8]">
                  Salons & WebSockets
                </div>
                <div className="font-mono-num text-3xl font-extrabold text-emerald-400 mt-2">
                  {liveRooms.length}
                </div>
                <div className="text-xs text-[#64748B] mt-1">
                  {connectedSockets} connexion(s) actives
                </div>
              </div>
            </div>

            {/* Platform Status Strip */}
            <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-display text-sm font-extrabold text-white">
                  État Actuel de la Plateforme
                </div>
                <div className="text-xs text-[#94A3B8] flex flex-wrap gap-3">
                  <span>
                    Maintenance :{' '}
                    <strong className={platformSettings.maintenanceMode ? 'text-rose-400' : 'text-emerald-400'}>
                      {platformSettings.maintenanceMode ? 'ACTIVÉE' : 'Désactivée'}
                    </strong>
                  </span>
                  <span>
                    Tarif achat :{' '}
                    <strong className="text-white">
                      {formatFiatFromCents(platformSettings.buyRatePer1000Cents, platformSettings.currency)} / 1 000
                    </strong>
                  </span>
                  <span>
                    Tarif rachat :{' '}
                    <strong className="text-white">
                      {formatFiatFromCents(platformSettings.sellRatePer1000Cents, platformSettings.currency)} / 1 000
                    </strong>
                  </span>
                  <span>
                    Mise max :{' '}
                    <strong className="text-[#FBBF24]">{platformSettings.maxStake.toLocaleString()}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTab('settings')}
                className="btn-secondary-cyan px-4 py-2 rounded-xl text-xs font-display font-bold"
              >
                Modifier les paramètres
              </button>
            </div>

            {/* Pending Orders Quick Queue */}
            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-extrabold text-white">
                  Demandes Boutique En Attente ({pendingOrders.length})
                </h2>
                {orders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTab('orders')}
                    className="text-xs font-display font-bold text-[#4cd7f6] hover:underline"
                  >
                    Tout voir →
                  </button>
                )}
              </div>

              {pendingOrders.length === 0 ? (
                <p className="text-xs text-[#64748B] py-4">
                  Aucune commande d'achat ou de vente en attente de validation.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {pendingOrders.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl bg-[#0B0F19]/85 border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-display font-bold ${
                              order.orderType === 'buy'
                                ? 'bg-[#06B6D4]/20 text-[#4cd7f6]'
                                : 'bg-[#F97316]/20 text-[#FBBF24]'
                            }`}
                          >
                            {order.orderType === 'buy' ? 'ACHAT' : 'VENTE'}
                          </span>
                          <span className="font-display text-xs font-extrabold text-white">
                            {order.displayName}
                          </span>
                          <span className="font-mono-num text-xs font-bold text-[#FBBF24]">
                            {order.coinsAmount.toLocaleString()} pièces
                          </span>
                          <span className="font-mono-num text-xs text-[#94A3B8]">
                            ({formatFiatFromCents(order.fiatCents, order.currency)})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          {order.paymentMethod}
                          {order.payoutDetails ? ` · ${order.payoutDetails}` : ''}
                          {' · '}
                          {formatShortDate(order.createdAtMs)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => void handleProcessOrder(order, 'completed')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-display font-bold text-emerald-300 inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Valider
                        </button>
                        <button
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => void handleProcessOrder(order, 'rejected')}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-display font-bold text-rose-300 inline-flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Refuser
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: USERS & WALLETS */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
              <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher un joueur par pseudo, email ou UID..."
                className="flex-1 bg-transparent text-sm font-display text-white placeholder:text-[#64748B] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredUsers.map((u) => {
                const isRootAdmin = u.email === ADMIN_BOOTSTRAP_EMAIL;
                const hasAdminRole = isRootAdmin || adminUidSet.has(u.uid);
                return (
                  <div
                    key={u.uid}
                    className={`glass-panel rounded-2xl p-4 space-y-3 border ${
                      u.isSuspended ? 'border-rose-500/40 opacity-85' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <PlayerAvatar src={u.photoURL} name={u.displayName} color="red" size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-display text-sm font-extrabold text-white truncate">
                              {u.displayName}
                            </span>
                            {hasAdminRole && (
                              <span className="px-1.5 py-0.5 rounded bg-[#8B5CF6]/25 border border-[#A78BFA]/45 text-[9px] font-display font-bold text-[#d0bcff]">
                                ADMIN
                              </span>
                            )}
                            {u.isSuspended && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[9px] font-display font-bold text-rose-300">
                                SUSPENDU
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#94A3B8] truncate">{u.email || u.uid}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono-num text-sm font-extrabold text-[#FBBF24] inline-flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          {u.coins.toLocaleString()}
                        </div>
                        <div className="font-mono-num text-[10px] text-[#94A3B8]">
                          ELO {u.elo} · {u.wins}V / {u.matchesPlayed}M
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => openUserEditor(u)}
                        className="px-3 py-1.5 rounded-lg bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 border border-[#06B6D4]/40 text-xs font-display font-bold text-[#4cd7f6]"
                      >
                        Gérer Wallet / Compte
                      </button>

                      {!isRootAdmin && (
                        <button
                          type="button"
                          onClick={() => void handleToggleAdminRole(u)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-display font-bold ${
                            adminUidSet.has(u.uid)
                              ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
                              : 'bg-white/5 hover:bg-white/10 border-white/15 text-[#CBD5E1]'
                          }`}
                        >
                          {adminUidSet.has(u.uid) ? 'Révoquer Admin' : 'Nommer Admin'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SHOP ORDERS */}
        {tab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'pending', label: `En attente (${pendingOrders.length})` },
                  { id: 'all', label: `Toutes (${orders.length})` },
                  { id: 'buy', label: 'Achats' },
                  { id: 'sell', label: 'Ventes / Retraits' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setOrderFilter(f.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold ${
                    orderFilter === f.id
                      ? 'bg-[#06B6D4]/25 border border-[#4cd7f6] text-[#4cd7f6]'
                      : 'bg-[#111827]/80 border border-white/10 text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="glass-panel rounded-2xl p-8 text-center text-xs text-[#64748B]">
                Aucune commande dans cette catégorie.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="glass-panel rounded-2xl p-4 space-y-3 border border-white/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            order.orderType === 'buy'
                              ? 'bg-[#06B6D4]/15 text-[#4cd7f6]'
                              : 'bg-[#F97316]/15 text-[#FBBF24]'
                          }`}
                        >
                          {order.orderType === 'buy' ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display text-sm font-extrabold text-white">
                              {order.displayName}
                            </span>
                            <span className="font-mono-num text-xs font-extrabold text-[#FBBF24]">
                              {order.coinsAmount.toLocaleString()} pièces
                            </span>
                            <span className="font-mono-num text-xs font-bold text-[#4cd7f6]">
                              · {formatFiatFromCents(order.fiatCents, order.currency)}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#94A3B8] mt-0.5">
                            {order.orderType === 'buy' ? 'Achat' : 'Vente'} via {order.paymentMethod}
                            {order.payoutDetails ? ` · Destination : ${order.payoutDetails}` : ''}
                            {' · '}
                            {formatShortDate(order.createdAtMs)}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-bold ${
                          order.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : order.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {order.status === 'completed'
                          ? 'Validée'
                          : order.status === 'rejected'
                          ? 'Refusée'
                          : 'En attente'}
                      </span>
                    </div>

                    {order.adminNote && order.status !== 'pending' && (
                      <div className="text-xs text-[#94A3B8] bg-[#0B0F19]/60 rounded-lg px-3 py-2">
                        Note admin : {order.adminNote}
                      </div>
                    )}

                    {order.status === 'pending' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          type="text"
                          maxLength={160}
                          value={orderNotes[order.id] ?? ''}
                          onChange={(e) =>
                            setOrderNotes((prev) => ({ ...prev, [order.id]: e.target.value }))
                          }
                          placeholder="Note optionnelle (réf. paiement, motif...)"
                          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-[#0B0F19]/85 border border-white/15 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#4cd7f6]"
                        />
                        <button
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => void handleProcessOrder(order, 'completed')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-display font-bold text-emerald-300 inline-flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {order.orderType === 'buy' ? 'Valider & Créditer' : 'Marquer Payée'}
                        </button>
                        <button
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => void handleProcessOrder(order, 'rejected')}
                          className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-display font-bold text-rose-300 inline-flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          {order.orderType === 'sell' ? 'Refuser & Rembourser' : 'Refuser'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LIVE ROOMS */}
        {tab === 'rooms' && (
          <div className="space-y-4">
            {liveRooms.length === 0 ? (
              <div className="glass-panel rounded-2xl p-8 text-center space-y-2">
                <Radio className="w-8 h-8 text-[#64748B] mx-auto" />
                <p className="text-sm font-display font-bold text-white">
                  Aucun salon actif en ce moment
                </p>
                <p className="text-xs text-[#94A3B8]">
                  Les parties en ligne publiques et privées apparaissent ici en temps réel.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {liveRooms.map((room) => (
                  <div key={room.code} className="glass-panel rounded-2xl p-5 space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-lg font-black tracking-widest text-[#FBBF24]">
                            {room.code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-display font-bold uppercase ${
                              room.status === 'playing'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : room.status === 'waiting'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-white/10 text-[#94A3B8]'
                            }`}
                          >
                            {room.status}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-display font-bold text-[#CBD5E1]">
                            {room.isPublic ? 'Public' : 'Privé'}
                          </span>
                        </div>
                        <div className="text-xs text-[#94A3B8] mt-1">
                          Hôte : <strong className="text-white">{room.hostName}</strong> ·{' '}
                          {room.humanCount}/{room.maxPlayers} humains ({room.connectedCount} connectés)
                        </div>
                      </div>

                      <div className="text-right font-mono-num">
                        <div className="text-xs font-bold text-white">
                          Mise : {room.stake.toLocaleString()}
                        </div>
                        <div className="text-xs font-bold text-[#FBBF24]">
                          Cagnotte : {room.wagerPot.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Admin broadcast chat message */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSendRoomAdminMessage(room.code);
                      }}
                      className="flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4 text-[#A78BFA] shrink-0" />
                      <input
                        type="text"
                        maxLength={140}
                        value={roomMessageDrafts[room.code] ?? ''}
                        onChange={(e) =>
                          setRoomMessageDrafts((prev) => ({
                            ...prev,
                            [room.code]: e.target.value,
                          }))
                        }
                        placeholder="Envoyer un message [ADMIN] dans ce salon..."
                        className="flex-1 px-3 py-2 rounded-xl bg-[#0B0F19]/85 border border-white/15 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#A78BFA]"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 rounded-xl btn-primary-violet text-xs font-display font-bold text-white inline-flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>

                    {/* Force close room */}
                    <div className="pt-1 flex justify-end">
                      {confirmCloseCode === room.code ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-rose-300 font-display">
                            Confirmer fermeture & remboursement ?
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCloseLiveRoom(room.code)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-display font-bold text-white"
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCloseCode(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 text-xs font-display text-[#94A3B8]"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmCloseCode(room.code)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-display font-bold text-rose-300 inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Fermer le salon & Rembourser
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: GLOBAL SETTINGS */}
        {tab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="glass-panel rounded-2xl p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#0B0F19]/80 border border-white/10 cursor-pointer">
                <div>
                  <div className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Mode Maintenance
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-0.5">
                    Affiche un avis de maintenance sur toute la plateforme.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settingsDraft.maintenanceMode}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, maintenanceMode: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#8B5CF6]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#0B0F19]/80 border border-white/10 cursor-pointer">
                <div>
                  <div className="font-display text-sm font-bold text-white">
                    Crédit Instantané des Achats
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-0.5">
                    Si décoché, chaque achat de pièces attendra votre validation admin.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settingsDraft.instantBuyCredit}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, instantBuyCredit: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#8B5CF6]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#0B0F19]/80 border border-white/10 cursor-pointer">
                <div>
                  <div className="font-display text-sm font-bold text-white">
                    Achat de Pièces Activé
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-0.5">
                    Autorise les joueurs à acheter des pièces dans la Boutique.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settingsDraft.shopBuyEnabled}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, shopBuyEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#8B5CF6]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#0B0F19]/80 border border-white/10 cursor-pointer">
                <div>
                  <div className="font-display text-sm font-bold text-white">
                    Vente / Retrait Activé
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-0.5">
                    Autorise les joueurs à soumettre des demandes de vente de pièces.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settingsDraft.shopSellEnabled}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, shopSellEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#8B5CF6]"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Bannière d'Annonce Globale (optionnel)
              </label>
              <input
                type="text"
                maxLength={200}
                value={settingsDraft.announcement}
                onChange={(e) =>
                  setSettingsDraft((s) => ({ ...s, announcement: e.target.value }))
                }
                placeholder="Ex : Tournoi Spécial Ce Soir à 21h ! Cagnotte doublée..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/85 border border-white/15 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#4cd7f6]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Devise de la Boutique
                </label>
                <select
                  value={settingsDraft.currency}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      currency: e.target.value as PlatformCurrency,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/90 border border-white/15 text-sm font-display font-bold text-white focus:outline-none focus:border-[#4cd7f6]"
                >
                  <option value="EUR">EUR (€ · en centimes)</option>
                  <option value="USD">USD ($ · en cents)</option>
                  <option value="XOF">XOF (FCFA · montant direct)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Prix Achat / 1 000 pièces ({settingsDraft.currency === 'XOF' ? 'FCFA' : 'centimes'})
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000000}
                  value={settingsDraft.buyRatePer1000Cents}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      buyRatePer1000Cents: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/90 border border-white/15 font-mono-num text-sm font-bold text-white focus:outline-none focus:border-[#4cd7f6]"
                />
                <p className="text-[11px] text-[#4cd7f6] mt-1">
                  Aperçu : {formatFiatFromCents(settingsDraft.buyRatePer1000Cents, settingsDraft.currency)} / 1 000
                </p>
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Prix Rachat / 1 000 pièces ({settingsDraft.currency === 'XOF' ? 'FCFA' : 'centimes'})
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000000}
                  value={settingsDraft.sellRatePer1000Cents}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      sellRatePer1000Cents: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/90 border border-white/15 font-mono-num text-sm font-bold text-white focus:outline-none focus:border-[#FBBF24]"
                />
                <p className="text-[11px] text-[#FBBF24] mt-1">
                  Aperçu : {formatFiatFromCents(settingsDraft.sellRatePer1000Cents, settingsDraft.currency)} / 1 000
                </p>
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Minimum de pièces pour vendre
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000000}
                  value={settingsDraft.minSellCoins}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      minSellCoins: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/90 border border-white/15 font-mono-num text-sm font-bold text-white focus:outline-none focus:border-[#4cd7f6]"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Bonus Quotidien (pièces)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={settingsDraft.dailyBonusCoins}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      dailyBonusCoins: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/90 border border-white/15 font-mono-num text-sm font-bold text-white focus:outline-none focus:border-[#4cd7f6]"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Mise Maximale Autorisée
                </label>
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  value={settingsDraft.maxStake}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({
                      ...s,
                      maxStake: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/90 border border-white/15 font-mono-num text-sm font-bold text-white focus:outline-none focus:border-[#4cd7f6]"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={settingsBusy}
                className="btn-primary-violet px-6 py-3 rounded-xl text-xs font-display font-bold text-white inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Enregistrer les Paramètres
              </button>
            </div>
          </form>
        )}
      </div>

      {/* User Edit Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Modifier compte joueur"
        >
          <form
            onSubmit={handleSaveUserEdit}
            className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              aria-label="Fermer"
              className="absolute right-4 top-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <PlayerAvatar
                src={editingUser.photoURL}
                name={editingUser.displayName}
                color="red"
                size="sm"
              />
              <div>
                <h2 className="font-display text-lg font-extrabold text-white">
                  {editingUser.displayName}
                </h2>
                <p className="text-xs text-[#94A3B8]">{editingUser.email || editingUser.uid}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Solde de Pièces
              </label>
              <div className="flex gap-2 mb-2">
                {[500, 1000, 5000, -500].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, Math.floor(Number(editCoinsStr) || 0));
                      setEditCoinsStr(String(Math.max(0, cur + delta)));
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-mono-num text-[11px] font-bold text-white"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                max={10000000}
                value={editCoinsStr}
                onChange={(e) => setEditCoinsStr(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/90 border border-white/15 font-mono-num text-sm font-bold text-[#FBBF24] focus:outline-none focus:border-[#FBBF24]"
              />
            </div>

            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Score ELO
              </label>
              <input
                type="number"
                min={0}
                max={100000}
                value={editEloStr}
                onChange={(e) => setEditEloStr(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/90 border border-white/15 font-mono-num text-sm font-bold text-white focus:outline-none focus:border-[#4cd7f6]"
              />
            </div>

            <div>
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Motif (journal wallet)
              </label>
              <input
                type="text"
                maxLength={120}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/90 border border-white/15 text-xs text-white focus:outline-none focus:border-[#4cd7f6]"
              />
            </div>

            <label className="flex items-center justify-between gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 cursor-pointer">
              <div className="flex items-center gap-2 text-xs font-display font-bold text-rose-300">
                <Ban className="w-4 h-4" />
                Suspendre le compte
              </div>
              <input
                type="checkbox"
                checked={editSuspended}
                onChange={(e) => setEditSuspended(e.target.checked)}
                className="w-4 h-4 accent-rose-500"
              />
            </label>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-display font-bold text-[#E2E8F0]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={userBusy}
                className="flex-1 py-2.5 rounded-xl btn-primary-violet text-xs font-display font-bold text-white"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
