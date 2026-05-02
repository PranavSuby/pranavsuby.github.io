# GymApp — Personal PWA Workout Tracker

A React Progressive Web App for tracking workouts, exercises, and sessions.  
All data stored locally via IndexedDB. Exercise library powered by the free ExerciseDB API (no key needed).

---

## Features

- 📚 **Exercise Library** — 1,300+ exercises with GIF animations via ExerciseDB
- 🔍 **Search** — search by name or filter by body part
- ➕ **Custom Exercises** — create your own with reps or timed tracking
- 🏋️ **Workout Builder** — group exercises into named workouts
- 🔗 **Supersets** — link any two adjacent exercises as a superset
- 📱 **Active Session** — log sets in real time, with auto rest timer
- ⏱️ **Timed Exercises** — start/stop timer baked into each set
- 📊 **History** — view past sessions with full set breakdown
- 🔥 **Streak tracking** — consecutive day streak on the dashboard
- 📵 **Offline** — app shell cached via service worker

---

## Setup

### 1. Prerequisites
- Node.js 18+  
- npm

### 2. Install dependencies
```bash
cd gym-app
npm install
```

### 3. Run locally (for testing)
```bash
npm start
```
Opens at `http://localhost:3000`

### 4. Build for production
```bash
npm run build
```
Creates a `build/` folder ready to deploy.

---

## Deploy to GitHub Pages (free, recommended)

### First time
1. Create a GitHub repo (e.g. `gym-app`)
2. Push this project to it:
   ```bash
   git init
   git remote add origin https://github.com/YOUR_USERNAME/gym-app.git
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```
3. Install gh-pages:
   ```bash
   npm install --save-dev gh-pages
   ```
4. Add to `package.json` scripts:
   ```json
   "deploy": "gh-pages -d build"
   ```
   And set `"homepage": "https://YOUR_USERNAME.github.io/gym-app"`
5. Deploy:
   ```bash
   npm run predeploy && npm run deploy
   ```
6. In GitHub repo → Settings → Pages → Source: `gh-pages` branch

### Subsequent updates
```bash
npm run predeploy && npm run deploy
```

---

## Add to Phone Home Screen

### Android (Chrome)
1. Open `https://YOUR_USERNAME.github.io/gym-app` in Chrome
2. Tap ⋮ → "Add to Home screen"
3. Done — it appears as an app icon

### iOS (Safari)
1. Open the URL in **Safari** (not Chrome — PWAs only install from Safari on iOS)
2. Tap Share → "Add to Home Screen"
3. Done

---

## Tech Stack
- React 18
- IndexedDB via `idb` library
- ExerciseDB free API (https://exercisedb.dev) — 1,300+ exercises, GIFs
- Service Worker for offline support
- No backend, no auth, no cost

---

## Data

All your workout templates and session logs are stored in your phone's browser storage (IndexedDB).  
**Clearing browser data will erase your history** — this is fully local.

Exercise data (GIFs, names, instructions) comes from the ExerciseDB API and is fetched live — requires internet connection to browse exercises.
