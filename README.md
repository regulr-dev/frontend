# Regulr Frontend

The customer-facing loyalty card web application and merchant management portal for Regulr.

## Tech Stack
- **Framework:** React 18 + TypeScript
- **Bundler:** Vite 5
- **Routing:** React Router 6
- **Maps:** MapLibre GL + OpenStreetMap
- **Styling:** Custom CSS design system

## Getting Started Locally

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`. In development, requests to `/api` and `/t` are automatically proxied to the backend at `http://localhost:3001`.

## Scripts
- `npm run dev` - Start Vite dev server with instant HMR
- `npm run typecheck` - Run TypeScript compiler verification
- `npm run build` - Build production bundle to `dist/`
- `npm run preview` - Preview production build locally

