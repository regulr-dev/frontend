import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type Config, type HappyHourInfo, type PublicStore } from '../api';
import { useSession } from '../session';
import { StoreCard } from '../components/StoreCard';
import { RedeemScreen } from '../components/RedeemScreen';
import { DAYS, directionsUrl, openStatus } from '../lib/hours';

type Notice = { kind: 'good' | 'info' | 'bad'; text: string } | null;
type WalletState = 'idle' | 'syncing' | 'updated';
type TapResult = {
  stamped?: boolean;
  added?: number;
  happyHour?: { name: string; multiplier: number } | null;
  birthdayBonus?: number;
  reason?: string;
  nextStampAt?: string;
  expiresAt?: string;
  error?: string;
};
type OpenResponse = {
  config: Config;
  store: PublicStore;
  user: { name: string | null; email: string; birthMonth?: number | null; birthDay?: number | null } | null;
  joined?: boolean;
  tap?: TapResult | null;
  membership?: { balance: number; inWallet: boolean; messagesOff: boolean };
  happyHours: { now: HappyHourInfo | null; today: HappyHourInfo[] };
  claims?: Record<string, number>;
  /** IDs of rewards claimed in the current progressive ladder cycle */
  cycleClaims?: string[];
};

const DEFAULT_HERO = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

const timesWord = (m: number) => (m === 2 ? 'Double' : m === 3 ? 'Triple' : `${m}×`);

function HappyHourBanner({ now, today }: OpenResponse['happyHours']) {
  const next = now ?? today[0];
  if (!next) return null;
  return (
    <div className={`happy-banner${now ? ' live' : ''}`}>
      <span className="happy-x">{next.multiplier}×</span>
      <span>
        <strong>{now ? `${timesWord(now.multiplier)} stamps now` : `${timesWord(next.multiplier)} stamps today`}</strong>
        <span className="hint">
          {next.name} · {now ? `until ${now.endTime}` : `${next.startTime}–${next.endTime}`}
        </span>
      </span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21 7.28V5c0-1.1-.9-2-2-2H5C3.89 3 3 3.9 3 5v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-2.28c.59-.35 1-.99 1-1.72V9c0-.73-.41-1.37-1-1.72zM20 9v6h-7V9h7zM5 19V5h14v2h-6c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6v2H5z" fill="currentColor" />
      <circle cx="16" cy="12" r="1.5" fill="#4285F4" />
    </svg>
  );
}

type HistoryEvent = { id: string; kind: string; delta: number; rewardName: string | null; note: string | null; createdAt: string };
const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

function readTipDismissed() {
  try {
    return Boolean(localStorage.getItem('regulr_tip_always'));
  } catch {
    return true;
  }
}

export function CardPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();

  const tapRef = useRef<string | null>(params.get('tap'));
  const passTokenRef = useRef<string | null>(params.get('passToken'));
  const tapErrorRef = useRef(params.has('tap_error'));
  const cameFromTap = useRef(Boolean(tapRef.current));
  const opened = useRef(false);

  const [data, setData] = useState<OpenResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [cycleClaims, setCycleClaims] = useState<string[]>([]);
  const [inWallet, setInWallet] = useState(false);
  const [messagesOff, setMessagesOff] = useState(false);
  const [tapExpiresAt, setTapExpiresAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [walletState, setWalletState] = useState<WalletState>('idle');
  const [burst, setBurst] = useState<number | null>(null);
  const [bump, setBump] = useState(false);
  const [pop, setPop] = useState(false);
  const [redemption, setRedemption] = useState<{ name: string; at: Date } | null>(null);
  const [tipDismissed, setTipDismissed] = useState(readTipDismissed);
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const [, forceTick] = useState(0);

  // Candour-style cards accordion / expansion state
  const [rewardsOpen, setRewardsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  // Join / Login mode state
  const [customerMode, setCustomerMode] = useState<'join' | 'login'>('join');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthMonth, setBirthMonth] = useState<number | ''>('');
  const [birthDay, setBirthDay] = useState<number | ''>('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (params.has('tap') || params.has('tap_error') || params.has('passToken')) {
      navigate(`/s/${slug}`, { replace: true });
    }
  }, [params, navigate, slug]);

  const syncWallet = useCallback(async () => {
    setWalletState('syncing');
    try {
      const { updated, saved } = await api<{ updated: boolean; saved: boolean }>(`/api/stores/${slug}/wallet/sync`, { method: 'POST' });
      setWalletState(updated ? 'updated' : 'idle');
      if (!saved) setInWallet(false);
    } catch {
      setWalletState('idle');
    }
  }, [slug]);

  const celebrate = useCallback((from: number, to: number) => {
    setBurst(to - from);
    setTimeout(() => setBurst(null), reducedMotion ? 1500 : 2200);
    if (reducedMotion) return;
    setBalance(from);
    setBump(true);
    setTimeout(() => {
      setBalance(to);
      setPop(true);
    }, 450);
    setTimeout(() => {
      setBump(false);
      setPop(false);
    }, 1400);
  }, []);

  const open = useCallback(async () => {
    let res: OpenResponse;
    try {
      res = await api<OpenResponse>(`/api/stores/${encodeURIComponent(slug)}/open`, {
        method: 'POST',
        body: {
          tapId: tapRef.current ?? undefined,
          passToken: passTokenRef.current ?? undefined,
        },
      });
    } catch {
      setMissing(true);
      return;
    }
    setData(res);
    if (!res.user || !res.membership) return;

    const finalBalance = res.membership.balance;
    setBalance(finalBalance);
    setCycleClaims(res.cycleClaims ?? []);
    setInWallet(res.membership.inWallet);
    setMessagesOff(res.membership.messagesOff);

    let next: Notice = null;
    if (res.joined) {
      const n = res.store.welcomeStamps;
      next = { kind: 'good', text: `Welcome to ${res.store.name} Rewards!${n ? ` You've got your first ${n === 1 ? 'stamp' : `${n} stamps`}.` : ''}` };
    }
    const tap = res.tap;
    if (tap?.error) {
      tapRef.current = null;
      next = { kind: 'bad', text: tap.error === 'tap_expired' ? 'That tap expired. Ask the cashier to tap again.' : 'That tap was already used.' };
    } else if (tap?.expiresAt) {
      const expires = new Date(tap.expiresAt);
      setTapExpiresAt(expires);
      setTimeout(() => forceTick((n) => n + 1), expires.getTime() - Date.now() + 500);
      if (!tap.stamped && !res.joined && tap.reason === 'cooldown' && tap.nextStampAt) {
        const at = new Date(tap.nextStampAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        next = { kind: 'info', text: `You got a stamp recently. The next one is available from ${at}.` };
      }
      if (tap.stamped && tap.birthdayBonus) {
        next = { kind: 'good', text: `Happy birthday! 🎂 ${res.store.name} gave you ${tap.birthdayBonus} bonus stamp${tap.birthdayBonus === 1 ? '' : 's'}.` };
      } else if (tap.stamped && tap.happyHour) {
        next = { kind: 'good', text: `${tap.happyHour.name}: ${timesWord(tap.happyHour.multiplier).toLowerCase()} stamps! You got +${tap.added}.` };
      }
    }
    if (tapErrorRef.current) next = { kind: 'bad', text: "That tap couldn't be verified. Ask the cashier to tap again." };
    setNotice(next);

    if (tap?.stamped) {
      celebrate(finalBalance - (tap.added ?? 1), finalBalance);
      if (res.membership.inWallet && res.config.googleWallet) syncWallet();
    }
  }, [slug, celebrate, syncWallet]);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open();
  }, [open]);

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setJoinError('Please enter your name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setJoinError('Please enter a valid email address');
      return;
    }
    setJoinLoading(true);
    setJoinError(null);
    try {
      const res = await api<OpenResponse>(`/api/stores/${encodeURIComponent(slug)}/join`, {
        method: 'POST',
        body: {
          name: name.trim(),
          email: email.trim(),
          birthMonth: birthMonth === '' ? null : Number(birthMonth),
          birthDay: birthDay === '' ? null : Number(birthDay),
          tapId: tapRef.current ?? undefined,
        },
      });
      setData(res);
      await session.refresh();

      if (res.membership) {
        setBalance(res.membership.balance);
        setCycleClaims(res.cycleClaims ?? []);
        setInWallet(res.membership.inWallet);
        setMessagesOff(res.membership.messagesOff);
      }
      if (res.joined) {
        celebrate(0, res.membership?.balance ?? 1);
        setNotice({
          kind: 'good',
          text: `Welcome to ${res.store.name} Rewards! You got ${res.membership?.balance ?? 1} stamp${(res.membership?.balance ?? 1) === 1 ? '' : 's'}. Tap 'Add to Google Wallet' below!`,
        });
      }
      setRewardsOpen(true);
    } catch (err: any) {
      setJoinError(err?.message || 'Failed to join loyalty program. Please try again.');
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleCustomerLogin(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setJoinError('Please enter a valid email address');
      return;
    }
    setJoinLoading(true);
    setJoinError(null);
    try {
      await api('/api/auth/customer-login', { method: 'POST', body: { email: cleanEmail } });
      await session.refresh();
      await open();
    } catch (err: any) {
      setJoinError(
        err?.data?.detail ||
          (err?.code === 'user_not_found'
            ? 'No cards found for this email. Switch to "Join" above to get your first stamp!'
            : 'Could not log in. Please try again.')
      );
    } finally {
      setJoinLoading(false);
    }
  }

  async function addToWallet() {
    try {
      const { url } = await api<{ url: string }>(`/api/stores/${slug}/wallet/google`);
      location.href = url;
    } catch {
      setNotice({ kind: 'bad', text: 'Could not create your Google Wallet card. Please try again.' });
    }
  }

  async function claimReward(rewardId: string) {
    const reward = data!.store.rewards.find((r) => r.id === rewardId)!;
    if (!confirm(`Claim "${reward.name}" for ${reward.cost} stamps?\n\nOnly confirm in front of the cashier.`)) return;
    try {
      const result = await api<{ membership: { balance: number }; reward: { name: string }; redeemedAt: string; cycleClaims?: string[] }>(
        `/api/stores/${slug}/redeem`,
        { method: 'POST', body: { rewardId, tapId: tapRef.current } },
      );
      setBalance(result.membership.balance);
      setCycleClaims(result.cycleClaims ?? []);
      tapRef.current = null;
      setNotice(null);
      setHistory(null);
      setRedemption({ name: result.reward.name, at: new Date(result.redeemedAt) });
      if (inWallet) syncWallet();
    } catch (err: any) {
      const messages: Record<string, string> = {
        not_enough_stamps: "You don't have enough stamps for that yet.",
        reward_already_claimed_in_cycle: "You've already claimed this reward in your current card cycle.",
        tap_required: 'Ask the cashier to tap their card, then claim again.',
        tap_already_used_for_reward: 'That tap was already used for a reward. Ask for another tap.',
      };
      setNotice({ kind: 'bad', text: messages[err?.code] ?? 'Something went wrong. Please try again.' });
    }
  }

  async function toggleMessages() {
    const off = !messagesOff;
    setMessagesOff(off);
    try {
      await api(`/api/stores/${slug}/messages`, { method: 'PATCH', body: { off } });
    } catch {
      setMessagesOff(!off);
    }
  }

  async function loadHistory() {
    const { events } = await api<{ events: HistoryEvent[] }>(`/api/stores/${slug}/history`);
    setHistory(events);
  }

  function handleShare() {
    const shareUrl = window.location.origin + `/s/${slug}`;
    if (navigator.share) {
      navigator.share({
        title: `${data?.store.name ?? 'Regulr'} Rewards`,
        text: `Collect stamps and earn rewards at ${data?.store.name ?? 'this store'}!`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  }

  function copyWifi() {
    navigator.clipboard.writeText(`${data?.store.name} Guest`);
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 2000);
  }

  if (missing) {
    return (
      <div className="page">
        <p className="muted">This rewards card doesn't exist.</p>
        <Link to="/discover">Find stores near you</Link>
      </div>
    );
  }
  if (!data) return <div className="page"><p className="muted">Loading…</p></div>;

  const { store, config } = data;
  const canRedeem = Boolean(tapRef.current && tapExpiresAt && tapExpiresAt > new Date());
  const status = openStatus(store.hours);
  const isJoined = Boolean(data.user && data.membership);
  const heroImage = store.coverUrl || DEFAULT_HERO;

  return (
    <div className="store-hub">
      {/* 1. Header Hero Cover Photo */}
      <div className="store-hub-hero">
        <img src={heroImage} alt={store.name} />
        <div className="store-hub-hero-overlay" />
      </div>

      {/* 2. Overlapping Circular Logo */}
      <div className="store-hub-logo-container">
        {store.logoUrl ? (
          <img className="store-hub-logo" src={store.logoUrl} alt={store.name} />
        ) : (
          <div className="store-hub-logo" style={{ background: store.bgColor, color: store.textColor }}>
            {store.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* 3. Store Title & Tagline */}
      <div className="store-hub-header">
        <h1 className="store-hub-title">{store.name}</h1>
        <p className="store-hub-tagline">{store.description || 'Simply good coffee · Collect stamps & earn rewards'}</p>
      </div>

      {/* 4. Candour-Style Action Cards Stack */}
      <div className="store-hub-cards">
        {/* CARD 1: Start Earning Rewards / Your Loyalty Card */}
        <div className="hub-card">
          <button
            type="button"
            className="hub-card-header"
            onClick={() => setRewardsOpen((prev) => !prev)}
            aria-expanded={rewardsOpen}
          >
            <div className="hub-icon-pill pink">❤️</div>
            <div className="hub-card-info">
              <div className="hub-card-title">
                {isJoined ? `Your Loyalty Card (${balance} ★)` : 'Start earning rewards'}
              </div>
              <div className="hub-card-subtitle">
                {isJoined ? `Member: ${data.user?.name || data.user?.email}` : 'Collect stamps for free rewards'}
              </div>
            </div>
            <span className={`hub-card-arrow ${rewardsOpen ? 'rotated' : ''}`}>▾</span>
          </button>

          {rewardsOpen && (
            <div className="hub-card-body">
              {!isJoined ? (
                /* Candour Signup / Login View */
                <div className="rewards-join-box">
                  <div className="rewards-join-heart">❤️</div>
                  <div>
                    <h2 className="rewards-join-title">{store.name}</h2>
                    <p className="rewards-join-subtitle">
                      {customerMode === 'join' ? 'Collect stamps to earn rewards' : 'Welcome back! View your loyalty card'}
                    </p>
                  </div>

                  {/* Mode switcher: Join vs Sign In */}
                  <div className="hub-mode-toggle">
                    <button
                      type="button"
                      className={`hub-mode-btn ${customerMode === 'join' ? 'active' : ''}`}
                      onClick={() => { setCustomerMode('join'); setJoinError(null); }}
                    >
                      Join Rewards
                    </button>
                    <button
                      type="button"
                      className={`hub-mode-btn ${customerMode === 'login' ? 'active' : ''}`}
                      onClick={() => { setCustomerMode('login'); setJoinError(null); }}
                    >
                      Log In
                    </button>
                  </div>

                  {/* Reward Badges Preview */}
                  {store.rewards.length > 0 && customerMode === 'join' && (
                    <div className="rewards-badges-row">
                      {store.rewards.slice(0, 3).map((r, i) => (
                        <div key={r.id} className="reward-badge-card">
                          <div className={`reward-badge-circle ${i === 1 ? 'pink' : i === 2 ? 'green' : ''}`}>
                            {r.cost}
                          </div>
                          <span className="reward-badge-name">{r.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {customerMode === 'join' ? (
                    /* Name + Email + Birthday Join Form */
                    <form className="join-form" onSubmit={handleJoin}>
                      <input
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />

                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />

                      <div className="join-birthday-group">
                        <label className="join-birthday-label">
                          Birthday 🎂 <span className="hint">(for birthday bonus stamps)</span>
                        </label>
                        <div className="join-birthday-row">
                          <select
                            value={birthMonth}
                            onChange={(e) => setBirthMonth(e.target.value ? Number(e.target.value) : '')}
                          >
                            <option value="">Month</option>
                            {MONTHS.map((m, idx) => (
                              <option key={m} value={idx + 1}>{m}</option>
                            ))}
                          </select>
                          <select
                            value={birthDay}
                            onChange={(e) => setBirthDay(e.target.value ? Number(e.target.value) : '')}
                          >
                            <option value="">Day</option>
                            {DAYS_OF_MONTH.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <p className="join-disclaimer">
                        {store.name} uses your name and email to run your card and send your pass.
                      </p>

                      {joinError && <div className="notice bad" style={{ margin: '4px 0' }}>{joinError}</div>}

                      <button type="submit" className="btn-join" disabled={joinLoading}>
                        {joinLoading ? 'Joining…' : 'Join Loyalty Program'}
                      </button>

                      <p className="hint" style={{ marginTop: '12px', textAlign: 'center' }}>
                        Already a member?{' '}
                        <button
                          type="button"
                          className="link-btn small"
                          onClick={() => { setCustomerMode('login'); setJoinError(null); }}
                        >
                          Sign in with email
                        </button>
                      </p>
                    </form>
                  ) : (
                    /* Direct Email Login Form */
                    <form className="join-form" onSubmit={handleCustomerLogin}>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />

                      <p className="join-disclaimer">
                        Enter the email address you used when joining {store.name} Rewards.
                      </p>

                      {joinError && <div className="notice bad" style={{ margin: '4px 0' }}>{joinError}</div>}

                      <button type="submit" className="btn-join" disabled={joinLoading}>
                        {joinLoading ? 'Finding your card…' : 'Log In & View My Card'}
                      </button>

                      <p className="hint" style={{ marginTop: '12px', textAlign: 'center' }}>
                        New to {store.name}?{' '}
                        <button
                          type="button"
                          className="link-btn small"
                          onClick={() => { setCustomerMode('join'); setJoinError(null); }}
                        >
                          Join loyalty program
                        </button>
                      </p>
                    </form>
                  )}
                </div>
              ) : (
                /* Joined / Logged In Customer View */
                <div className="member-active-section">
                  <StoreCard
                    name={store.name}
                    logoUrl={store.logoUrl}
                    coverUrl={store.coverUrl}
                    bgColor={store.bgColor}
                    textColor={store.textColor}
                    balance={balance}
                    rewards={store.rewards}
                    cycleClaims={cycleClaims}
                    memberName={data.user?.name || data.user?.email}
                    balanceClassName={bump ? 'bump' : ''}
                    pop={pop}
                  >
                    {burst !== null && (
                      <div className="stamp-burst">
                        <span>+{burst} ⭑</span>
                      </div>
                    )}
                  </StoreCard>

                  {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

                  <HappyHourBanner {...data.happyHours} />

                  {/* Add to Google Wallet */}
                  {config.googleWallet && (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {walletState === 'syncing' && <div className="wallet-status">Updating your Google Wallet card…</div>}
                      {walletState === 'updated' && <div className="wallet-status ok">✓ Google Wallet card updated.</div>}
                      <button
                        type="button"
                        className={`btn-wallet ${inWallet ? 'saved' : ''}`}
                        onClick={addToWallet}
                      >
                        <WalletIcon />
                        {inWallet ? 'In Google Wallet ✓ (Open Pass)' : 'Add to Google Wallet'}
                      </button>
                    </div>
                  )}

                  {cameFromTap.current && isAndroid && !tipDismissed && (
                    <div className="notice info tip">
                      <div>
                        Tip: if your phone asked which app to open this with, pick your browser and tap <strong>Always</strong>.
                      </div>
                      <button
                        className="btn secondary small-btn"
                        onClick={() => {
                          try {
                            localStorage.setItem('regulr_tip_always', '1');
                          } catch {}
                          setTipDismissed(true);
                        }}
                      >
                        Got it
                      </button>
                    </div>
                  )}

                  {/* Reward Menu */}
                  <div style={{ marginTop: '8px' }}>
                    <h3 className="section-title">Reward menu</h3>
                    <div className="rewards">
                      {store.rewards.length === 0 && <p className="muted">No rewards yet.</p>}
                      {store.rewards.map((r) => {
                        const missingStamps = r.cost - balance;
                        const used = data.claims?.[r.id] ?? 0;
                        const usedUp = r.perCustomerLimit != null && used >= r.perCustomerLimit;
                        const claimedInCycle = cycleClaims.includes(r.id);
                        const lastDay = r.endsAt && new Date(new Date(r.endsAt).getTime() - 1).toLocaleDateString([], { day: 'numeric', month: 'short' });
                        return (
                          <div className={`reward${usedUp || claimedInCycle ? ' used-up' : ''}`} key={r.id}>
                            <div className="info">
                              <div><strong>{r.name}</strong></div>
                              {r.description && <div className="hint">{r.description}</div>}
                              {(lastDay || r.perCustomerLimit) && (
                                <div className="pills">
                                  {lastDay && <span className="pill soon">Until {lastDay}</span>}
                                  {r.perCustomerLimit != null && <span className="pill">{r.perCustomerLimit === 1 ? 'Once per customer' : `${r.perCustomerLimit} per customer`}</span>}
                                </div>
                              )}
                            </div>
                            <div className="cost">{r.cost} ⭑</div>
                            {claimedInCycle ? (
                              <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>Claimed</span>
                            ) : usedUp ? (
                              <span className="hint">Already claimed</span>
                            ) : missingStamps > 0 ? (
                              <span className="hint">Collect {missingStamps} more</span>
                            ) : canRedeem ? (
                              <button className="btn brand" style={{ background: store.bgColor, color: store.textColor }} onClick={() => claimReward(r.id)}>
                                Claim
                              </button>
                            ) : (
                              <span className="hint">Tap cashier card to claim</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Messages Toggle */}
                  <label className="switch-row" style={{ marginTop: '14px' }}>
                    <span>
                      <strong>Messages from {store.name}</strong>
                      <span className="hint">News and offers in your inbox{inWallet ? ' and Google Wallet' : ''}</span>
                    </span>
                    <input type="checkbox" role="switch" aria-label={`Messages from ${store.name}`} checked={!messagesOff} onChange={toggleMessages} />
                  </label>

                  {/* History */}
                  <div style={{ marginTop: '10px' }}>
                    <h3 className="section-title">Your history</h3>
                    {history === null ? (
                      <button className="btn secondary" onClick={loadHistory}>Show history</button>
                    ) : history.length === 0 ? (
                      <p className="muted">No activity yet.</p>
                    ) : (
                      <ul className="history">
                        {history.map((e) => (
                          <li key={e.id}>
                            <span>
                              {e.kind === 'redeem'
                                ? `Claimed ${e.rewardName}`
                                : e.kind === 'welcome'
                                  ? 'Joined'
                                  : e.kind === 'birthday'
                                    ? 'Birthday bonus 🎂'
                                    : e.kind === 'adjust'
                                      ? `Adjusted by the shop${e.note ? `: ${e.note}` : ''}`
                                      : `Stamp${e.note ? ` · ${e.note}` : ''}`}
                            </span>
                            <span className="muted small">{new Date(e.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            <span className={e.delta >= 0 ? 'plus' : 'minus'}>
                              {e.delta >= 0 ? '+' : ''}
                              {e.delta}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Account switcher */}
                  <div style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'center', marginTop: '12px' }}>
                    Signed in as {data.user?.name || data.user?.email} ·{' '}
                    <button
                      type="button"
                      className="link-btn small"
                      onClick={async () => {
                        await session.signOut();
                        await open();
                      }}
                    >
                      Sign out / Switch
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CARD 2: Leave a Google Review */}
        <div className="hub-card">
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(store.name + ' ' + (store.address || ''))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hub-card-header"
            style={{ textDecoration: 'none' }}
          >
            <div className="hub-icon-pill white">
              <GoogleIcon />
            </div>
            <div className="hub-card-info">
              <div className="hub-card-title">Leave a Google Review</div>
              <div className="hub-card-subtitle">Help others find us on Google</div>
            </div>
            <span className="hub-card-arrow">›</span>
          </a>
        </div>

        {/* CARD 3: View Menu */}
        <div className="hub-card">
          <button
            type="button"
            className="hub-card-header"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
          >
            <div className="hub-icon-pill orange">📋</div>
            <div className="hub-card-info">
              <div className="hub-card-title">View Menu</div>
              <div className="hub-card-subtitle">{store.rewards.length} loyalty items available</div>
            </div>
            <span className={`hub-card-arrow ${menuOpen ? 'rotated' : ''}`}>▾</span>
          </button>

          {menuOpen && (
            <div className="hub-card-body">
              <div className="hub-menu-list">
                {store.rewards.length === 0 ? (
                  <p className="muted">No menu items added yet.</p>
                ) : (
                  store.rewards.map((r) => (
                    <div key={r.id} className="reward" style={{ background: '#f8fafc' }}>
                      <div className="info">
                        <strong>{r.name}</strong>
                        {r.description && <div className="hint">{r.description}</div>}
                      </div>
                      <div className="cost">{r.cost} ★</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* CARD 4: Connect to Wi-Fi */}
        <div className="hub-card">
          <button
            type="button"
            className="hub-card-header"
            onClick={() => setWifiOpen((prev) => !prev)}
            aria-expanded={wifiOpen}
          >
            <div className="hub-icon-pill green">📶</div>
            <div className="hub-card-info">
              <div className="hub-card-title">Connect to Wi-Fi</div>
              <div className="hub-card-subtitle">Free high-speed guest Wi-Fi</div>
            </div>
            <span className={`hub-card-arrow ${wifiOpen ? 'rotated' : ''}`}>▾</span>
          </button>

          {wifiOpen && (
            <div className="hub-card-body">
              <div className="wifi-box">
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Network Name</div>
                <div className="wifi-net-name">{store.name} Guest</div>
                <div className="wifi-pass-hint">
                  Password: Ask barista or see counter card
                </div>
                <button type="button" className="btn secondary small-btn" onClick={copyWifi}>
                  {copiedWifi ? '✓ Network Copied' : 'Copy Network Name'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CARD 5: Directions & Hours */}
        {(store.address || store.hours) && (
          <div className="hub-card">
            <button
              type="button"
              className="hub-card-header"
              onClick={() => setHoursOpen((prev) => !prev)}
              aria-expanded={hoursOpen}
            >
              <div className="hub-icon-pill blue">📍</div>
              <div className="hub-card-info">
                <div className="hub-card-title">Directions & Hours</div>
                <div className="hub-card-subtitle">
                  {status ? status.text : (store.address || 'Visit us')}
                </div>
              </div>
              <span className={`hub-card-arrow ${hoursOpen ? 'rotated' : ''}`}>▾</span>
            </button>

            {hoursOpen && (
              <div className="hub-card-body">
                <div style={{ paddingTop: '10px' }}>
                  {store.address && <p style={{ margin: '6px 0', fontWeight: 500 }}>{store.address}</p>}
                  {status && (
                    <div style={{ margin: '8px 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`dot ${status.open ? 'open' : 'closed'}`} /> {status.text}
                    </div>
                  )}
                  {store.hours && (
                    <table className="hours-table" style={{ width: '100%', margin: '10px 0' }}>
                      <tbody>
                        {store.hours.map((d, i) => (
                          <tr key={DAYS[i]}>
                            <td>{DAYS[i]}</td>
                            <td>{d.closed ? 'Closed' : `${d.open} – ${d.close}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="actions">
                    <a className="btn secondary" href={directionsUrl(store)} target="_blank" rel="noreferrer">
                      Get Directions
                    </a>
                    {store.phone && (
                      <a className="btn secondary" href={`tel:${store.phone.replace(/\s/g, '')}`}>
                        Call Store
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CARD 6: Share with Friends */}
        <div className="hub-card">
          <button
            type="button"
            className="hub-card-header"
            onClick={handleShare}
          >
            <div className="hub-icon-pill purple">🎁</div>
            <div className="hub-card-info">
              <div className="hub-card-title">Share with Friends</div>
              <div className="hub-card-subtitle">
                {shareToast ? '✓ Link copied to clipboard!' : 'Invite friends to earn rewards'}
              </div>
            </div>
            <span className="hub-card-arrow">›</span>
          </button>
        </div>
      </div>

      {/* 5. Footer */}
      <div className="store-hub-footer">
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className="social-link"
          aria-label="Instagram"
        >
          📷
        </a>
        <a href="/" className="hub-brand-footer">
          <span>❤️</span>
          <span>Powered by Regulr</span>
        </a>
      </div>

      {redemption && (
        <RedeemScreen
          store={store}
          rewardName={redemption.name}
          redeemedAt={redemption.at}
          onDone={() => setRedemption(null)}
        />
      )}
    </div>
  );
}
