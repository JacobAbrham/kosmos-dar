# KOSMOS Frontend Validation Checklist

## Pre-flight Checks

Run these commands from `implementation/frontend/`:

```powershell
# 1. Install dependencies (will update tailwind-merge to v2.6.0)
npm install

# 2. Check for TypeScript errors
npx tsc --noEmit

# 3. Run linter
npm run lint

# 4. Start development server
npm run dev
```

## Manual Verification Steps

### Navigation Test
After `npm run dev`, open http://localhost:3000 and verify:

- [ ] Home page loads with chat interface
- [ ] Sidebar is visible with all menu items
- [ ] Click "Conversations" → navigates without full page reload
- [ ] Click "Agents" → shows agent management page
- [ ] Click "Schedule" → shows calendar placeholder
- [ ] Click "Analytics" → shows analytics page
- [ ] Click "Knowledge" → shows knowledge base page
- [ ] Click "Security" → shows security page
- [ ] Click "Operations" → shows operations page
- [ ] Click "Settings" → shows settings page
- [ ] Click "Help" → shows help page
- [ ] Active route is highlighted in sidebar
- [ ] Browser back/forward buttons work correctly

### Error Handling Test
- [ ] Open browser DevTools console
- [ ] Check no hydration errors on page load
- [ ] Check no React warnings about mismatched content

### WebSocket Test (if backend running)
- [ ] StatusBar shows connection status
- [ ] No infinite reconnection attempts in console

## Files Modified in This Session

### Critical Fixes
1. `package.json` - tailwind-merge v3.4.0 → v2.6.0
2. `src/components/Sidebar.tsx` - Fixed navigation with Next.js Link
3. `src/hooks/useWebSocket.ts` - Environment-aware WebSocket URL
4. `src/app/providers.tsx` - Graceful provider loading

### New Error Handling
5. `src/components/ErrorBoundary.tsx` - Global error boundary
6. `src/app/error.tsx` - Route error page
7. `src/app/global-error.tsx` - Root error handler
8. `src/app/not-found.tsx` - 404 page
9. `src/app/loading.tsx` - Loading state

### New Pages (Stub implementations)
10. `src/app/conversations/page.tsx`
11. `src/app/schedule/page.tsx`
12. `src/app/knowledge/page.tsx`
13. `src/app/security/page.tsx`
14. `src/app/operations/page.tsx`
15. `src/app/help/page.tsx`

### Index Files
16. `src/context/index.ts` - Context barrel export
17. `src/components/index.ts` - Components barrel export

## Cleanup (Optional)
Delete these files if they exist and are unused:
- `src/components/AppLayout.tsx` (redundant - use DashboardShell)
- `src/pages/_error.tsx` (if exists - Next.js 13+ uses app/error.tsx)

## Known Limitations
- Pages are stub implementations - functionality requires backend
- WebSocket will show "Not connected" without backend running
- Agent data is mocked in demo mode

## Next Steps
1. Run the backend API (`cd ../backend && uvicorn main:app --reload`)
2. Create `.env.local` from `.env.example`
3. Test full stack integration
