import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../session';

/**
 * Route guard that requires an authenticated customer session.
 * Unauthenticated users are redirected to /login with the intended destination preserved.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}
