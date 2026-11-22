import { useState, useEffect, useRef, type FormEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../session';

type LoginStep = 'email' | 'otp';

export function Login() {
  const { user, loading, refresh } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);
  const redirectTarget = params.get('redirect') ? decodeURIComponent(params.get('redirect')!) : '/cards';

  // If already signed in, immediately route to destination
  useEffect(() => {
    if (!loading && user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [user, loading, navigate, redirectTarget]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Auto-focus first OTP digit when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      otpInputs.current[0]?.focus();
    }
  }, [step]);

  async function handleSendEmail(e: FormEvent) {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      // Transition to OTP verification step
      setStep('otp');
      setResendCountdown(30);
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err?.data?.detail || 'Failed to send login code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOtpChange(index: number, val: string) {
    const digit = val.slice(-1); // Only accept the last typed character
    if (digit && !/^\d$/.test(digit)) return; // Digits only

    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');

    // Auto-advance to next input
    if (digit && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().slice(0, 6);
    if (!/^\d+$/.test(pasted)) return;

    const next = [...otp];
    pasted.split('').forEach((char, i) => {
      if (i < 6) next[i] = char;
    });
    setOtp(next);

    const targetFocus = Math.min(pasted.length, 5);
    otpInputs.current[targetFocus]?.focus();
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setSubmitting(true);
    try {
      // Authenticate customer session
      await api('/api/auth/customer-login', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      });
      await refresh();
      navigate(redirectTarget, { replace: true });
    } catch (err: any) {
      if (err?.code === 'user_not_found') {
        setError("No loyalty account found for this email. Visit a store counter to join!");
      } else {
        setError(err?.data?.detail || 'Invalid or expired code. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleResend() {
    if (resendCountdown > 0) return;
    setError('');
    setResendCountdown(30);
    setOtp(['', '', '', '', '', '']);
    otpInputs.current[0]?.focus();
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page login-page" style={{ maxWidth: '400px', margin: '48px auto 32px', padding: '0 16px' }}>
      <div
        className="login-card"
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        {/* Brand Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.5px', color: '#0f172a', marginBottom: '8px' }}>
            REGULR<span style={{ color: 'var(--brand-green)' }}>.</span>
          </div>

          {step === 'email' ? (
            <>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
                Sign in
              </h1>
              <p className="muted small" style={{ margin: 0, lineHeight: 1.4 }}>
                Enter your email to receive a one-time verification code.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
                Check your email
              </h1>
              <p className="muted small" style={{ margin: 0, lineHeight: 1.4 }}>
                We sent a 6-digit code to <strong style={{ color: 'var(--text)' }}>{email}</strong>
              </p>
            </>
          )}
        </div>

        {/* Step 1: Email Form */}
        {step === 'email' ? (
          <form onSubmit={handleSendEmail} style={{ display: 'grid', gap: '16px', textAlign: 'left' }}>
            <div>
              <label
                htmlFor="login-email"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="name@example.com"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn brand"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 600,
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Sending code…' : 'Continue'}
            </button>

            {error && (
              <div className="notice bad" style={{ fontSize: '0.85rem', padding: '10px 12px', borderRadius: '8px' }}>
                {error}
              </div>
            )}
          </form>
        ) : (
          /* Step 2: OTP Verification Form */
          <form onSubmit={handleVerifyOtp} style={{ display: 'grid', gap: '18px' }}>
            <div>
              <label
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '10px', textAlign: 'left' }}
              >
                Verification code
              </label>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpInputs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    style={{
                      width: '44px',
                      height: '50px',
                      textAlign: 'center',
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: digit ? '2px solid #0f172a' : '1px solid var(--border)',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn brand"
              disabled={submitting || otp.join('').length < 6}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 600,
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                cursor: submitting || otp.join('').length < 6 ? 'not-allowed' : 'pointer',
                opacity: otp.join('').length < 6 ? 0.6 : 1,
              }}
            >
              {submitting ? 'Verifying…' : 'Verify & Sign in'}
            </button>

            {error && (
              <div className="notice bad" style={{ fontSize: '0.85rem', padding: '10px 12px', borderRadius: '8px', textAlign: 'left' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', paddingTop: '4px' }}>
              <button
                type="button"
                className="link-btn muted"
                onClick={() => {
                  setStep('email');
                  setError('');
                }}
                style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                ← Change email
              </button>

              <button
                type="button"
                className="link-btn"
                disabled={resendCountdown > 0}
                onClick={handleResend}
                style={{
                  cursor: resendCountdown > 0 ? 'default' : 'pointer',
                  color: resendCountdown > 0 ? 'var(--muted)' : 'var(--brand-green)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontWeight: 500,
                }}
              >
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {/* Footer Navigation */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '0.88rem' }}>
          <Link
            to="/discover"
            style={{
              fontWeight: 500,
              color: 'var(--muted)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Explore nearby shops (Discover) →
          </Link>
        </div>
      </div>
    </div>
  );
}
