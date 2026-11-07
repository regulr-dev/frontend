# Regulr Frontend — Developer & Claude Guide

This repository contains the customer-facing loyalty card web application and merchant store portal for **Regulr**, built with React 18, Vite 5, TypeScript, and MapLibre GL.

## Quick Reference Commands

- `npm run dev` - Start Vite dev server on port 3000 with HMR
- `npm run typecheck` - Run TypeScript compiler checks (`tsc --noEmit`)
- `npm run build` - Build production bundle to `dist/`
- `npm run preview` - Preview production build locally

## Architecture Overview

```
frontend/
├── public/               # Static public assets (icons, logo)
├── shared/
│   ├── stampArt.ts       # Shared reward ladder SVG generator & icon catalog
│   └── promotions.ts     # Shared promotion & happy hour formatting
├── src/
│   ├── main.tsx          # Application entrypoint & React Router setup
│   ├── api.ts            # Typed HTTP client calling the backend with error formatting
│   ├── session.tsx       # Auth context provider & current user state
│   ├── styles.css        # Core stylesheet and CSS design tokens
│   ├── lib/              # Utility helpers
│   │   ├── hours.ts      # Operating hours formatting and open/closed calculations
│   │   └── time.ts       # Timezone-aware date and time formatting
│   ├── components/       # Shared reusable UI components
│   │   ├── StoreCard.tsx # Visual stamp card showing ladder art and progress
│   │   ├── RedeemScreen.tsx # Live redemption screen with ticking animated clock
│   │   ├── MapView.tsx   # MapLibre vector map wrapper
│   │   ├── SignIn.tsx    # Google Sign-In & dev login modal
│   │   ├── StoreInfo.tsx # Store operating hours, address, and directions
│   │   └── BarChart.tsx  # Analytics bar chart component
│   └── pages/            # Application routes
│       ├── CardPage.tsx  # /s/:store (Single store card, stamp balance, reward menu)
│       ├── MyCards.tsx   # /cards (All customer cards across joined shops)
│       ├── Discover.tsx  # /discover (Interactive shop map, nearby cafes, hours)
│       ├── Inbox.tsx     # /inbox (Merchant messages & announcements)
│       ├── Account.tsx   # /account (Birthday bonuses, profile, account deletion)
│       └── portal/       # /portal/* (Merchant management tabs)
│           ├── Portal.tsx        # Portal layout & tab navigation
│           ├── DashboardTab.tsx  # Live store statistics & metrics
│           ├── ActivityTab.tsx   # Real-time ledger of stamps & redemptions
│           ├── CustomersTab.tsx  # Regular customer list & manual stamp adjustments
│           ├── RewardsTab.tsx    # Reward menu builder (costs, icons, limits)
│           ├── PromotionsTab.tsx # Happy hours & birthday bonus configuration
│           ├── ProfileTab.tsx    # Store profile, map coordinates, opening hours
│           ├── DesignTab.tsx     # Custom card branding (colors, logo, cover photo)
│           ├── NfcTab.tsx        # NFC card registration (+1/+2 stamps) & counter QR
│           └── MessagesTab.tsx   # Targeted push broadcasts to customer inboxes
└── vite.config.ts        # Vite config with dev proxy routing /api, /t to localhost:3001
```

## Local Development & Proxy

In development (`npm run dev`), Vite automatically proxies all requests to the backend:
- `/api/*` → `http://localhost:3001/api/*`
- `/t/*` → `http://localhost:3001/t/*`
- `/uploads/*` → `http://localhost:3001/uploads/*`

Developers do not need to configure CORS or custom URLs locally.

## Deployment Settings (Vercel)

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **SPA Routing:** Configured in `vercel.json` (`/(.*)` → `/index.html`)
- **Environment Variables:**
  - `VITE_API_URL`: Backend Vercel URL (e.g. `https://regulr-backend.vercel.app`)
  - `VITE_WEBSITE_URL`: Marketing website URL (optional)
