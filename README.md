# Regulr Frontend

The customer-facing loyalty card web application and merchant store management portal for **Regulr** — built with React 18, Vite 5, TypeScript, and MapLibre GL.

---

## 🛠 Tech Stack
- **Framework:** React 18 + TypeScript
- **Bundler:** Vite 5 (Instant Hot Module Replacement)
- **Routing:** React Router 6
- **Maps:** MapLibre GL + OpenStreetMap (vector tiles)
- **Styling:** Custom CSS design system

---

## 🚀 Getting Started Locally

Follow these steps to run the frontend locally:

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v20 or higher
- [Git](https://git-scm.com/)
- The **Regulr Backend** running locally on port `3001` (see the [backend repo](https://github.com/regulr-dev/backend))

### 2. Install Dependencies
```bash
git clone https://github.com/regulr-dev/frontend.git
cd frontend
npm install
```

### 3. Environment Configuration
Create a `.env` file from the example:
```bash
cp .env.example .env
```
In `.env`:
```env
# Leave blank for local development!
# When empty, Vite automatically proxies all requests to http://localhost:3001.
VITE_API_URL=

# Marketing website URL (optional)
VITE_WEBSITE_URL=https://regulr.app
```

### 4. Start the Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

> **💡 How the Local Proxy Works:**  
> During local development, Vite proxies all `/api/*`, `/t/*`, and `/uploads/*` requests directly to `http://localhost:3001`. Developers do not need to configure CORS or custom URLs on their machine.

---

## 🧪 Testing Your Changes Locally (Before Pushing)

Always run these checks before pushing code or opening a Pull Request:

### 1. TypeScript Verification
Ensures there are no TypeScript compile errors:
```bash
npm run typecheck
```

### 2. Production Build Check
Verifies that the production bundle builds cleanly:
```bash
npm run build
```

### 3. Testing Features Locally in Browser
- **Merchant Portal:** Go to `http://localhost:3000/portal`
  - Sign in with any test email using the **Dev Login** box (e.g. `owner@cafe.com`).
  - Create a test store, customize branding, add reward tiers, configure happy hours.
- **Customer Card:** Go to `http://localhost:3000/s/<your-store-slug>`
  - Sign in as a customer (e.g. `customer@gmail.com`).
  - View the live stamp ladder art, claim rewards, and test redemption screens.
- **Discover Map:** Go to `http://localhost:3000/discover`
  - View the interactive map and test nearby store search and operating hours display.

---

## 🌿 Git & Pull Request Workflow

We follow standard branch and PR collaboration:

1. **Branch off `main`:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature-name
   # or: git checkout -b fix/bug-description
   ```
2. **Make your changes & test locally:**
   ```bash
   npm run typecheck
   npm run build
   ```
3. **Commit with clean messages:**
   ```bash
   git add .
   git commit -m "feat(portal): add export customer list button"
   ```
4. **Push to GitHub and open a Pull Request:**
   ```bash
   git push -u origin feat/your-feature-name
   ```
5. **Automated CI:** GitHub Actions runs `npm run typecheck` and `npm run build` on your PR.
6. Once reviewed and approved, merge into `main` (which automatically deploys to Vercel).
