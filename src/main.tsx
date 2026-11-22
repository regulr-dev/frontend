import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { SessionProvider } from './session';
import { CustomerLayout } from './components/CustomerLayout';
import { RequireAuth } from './components/RequireAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CardPage } from './pages/CardPage';
import { MyCards } from './pages/MyCards';
import { Account } from './pages/Account';
import { Inbox } from './pages/Inbox';
import { Login } from './pages/Login';

// The map library and the portal load only when opened, so the page a customer
// lands on after an NFC tap stays small and fast.
const Discover = lazy(() => import('./pages/Discover').then((m) => ({ default: m.Discover })));
const Portal = lazy(() => import('./pages/portal/Portal').then((m) => ({ default: m.Portal })));
const loading = <div className="page"><p className="muted">Loading…</p></div>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<CustomerLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/discover" element={<Suspense fallback={loading}><Discover /></Suspense>} />
              <Route
                path="/cards"
                element={
                  <RequireAuth>
                    <MyCards />
                  </RequireAuth>
                }
              />
              <Route
                path="/inbox"
                element={
                  <RequireAuth>
                    <Inbox />
                  </RequireAuth>
                }
              />
              <Route
                path="/account"
                element={
                  <RequireAuth>
                    <Account />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="/s/:slug" element={<CardPage />} />
            <Route path="/portal/*" element={<Suspense fallback={loading}><Portal /></Suspense>} />
            <Route path="*" element={<Navigate to="/cards" replace />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </ErrorBoundary>
  </StrictMode>,
);
