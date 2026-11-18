import { useState, type FormEvent } from 'react';
import { api, type Config } from '../api';

/** Customer Email-only Sign-In (no Google OAuth required). */
export function SignIn({ onSignedIn }: { config?: Config; onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/customer-login', { method: 'POST', body: { email: cleanEmail } });
      onSignedIn();
    } catch (err: any) {
      setError(
        err?.data?.detail ||
          (err?.code === 'user_not_found'
            ? 'No loyalty cards found for this email. Visit a store to join!'
            : 'Could not log in. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signin">
      <form className="customer-email-login" onSubmit={handleLogin}>
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '4px' }}>▤</div>
          <strong style={{ fontSize: '1.1rem', color: 'var(--text)' }}>Access your loyalty cards</strong>
          <p className="muted small" style={{ margin: '6px 0 0', lineHeight: 1.4 }}>
            Enter your email to view all the loyalty cards you've collected.
          </p>
        </div>
        <input
          type="email"
          placeholder="your.email@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', marginBottom: '10px' }}
        />
        <button type="submit" className="btn brand" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Finding your cards…' : 'View My Cards'}
        </button>
        {error && <p className="notice bad small" style={{ margin: '10px 0 0' }}>{error}</p>}
      </form>
    </div>
  );
}
