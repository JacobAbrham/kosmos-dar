# KOSMOS Frontend - Local Development Quick Start

## Prerequisites
- Node.js 18+ installed
- npm 9+ installed

## One-Time Setup

```powershell
# Navigate to frontend directory
cd C:\Users\JacobVM\Downloads\kosmos-dar-main\implementation\frontend

# Install dependencies
npm install

# Verify build works
npm run build
```

## Daily Development

```powershell
# Start dev server
npm run dev

# Opens at http://localhost:3000
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript validation |
| `npm run test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |

## Keyboard Shortcuts (In App)

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `⌘K` | Open command bar |
| `Ctrl+B` / `⌘B` | Toggle dock |
| `Ctrl+N` / `⌘N` | Toggle notifications |
| `Ctrl+1-5` | Switch canvases |
| `Ctrl+Shift+F` | Toggle focus mode |
| `Esc` | Close overlays |

## Project Structure

```
src/
├── app/           → Next.js routes & layouts
├── components/
│   └── workspace/ → UII System (main UI)
├── stores/        → Zustand state
├── hooks/         → React hooks
└── services/      → API clients
```

## Troubleshooting

### Port Already in Use
```powershell
# Find process on port 3000
netstat -ano | findstr :3000

# Kill it
taskkill /PID <PID> /F
```

### Build Errors After Pull
```powershell
# Clean and rebuild
Remove-Item -Recurse -Force .next, node_modules
npm install
npm run build
```

### TypeScript Errors
```powershell
# Check types without building
npm run type-check
```
