# NODE Virtual POS — Technical Documentation

## 1) Overview

This repository contains a cross-platform POS app built with:
- **Expo SDK** (React Native)
- **Expo Router** (file-based navigation)
- **TypeScript**
- Local persistence via **AsyncStorage**
- Backend integration via **Hono + tRPC** (in `backend/`)

The app is designed to run in:
- **Expo Go** on device
- **React Native Web** in a browser preview

## 2) Key runtime concepts

### Operators & auth
- Operators are loaded from locally stored/synced data.
- Login is operator selection + optional 4-digit PIN.
- Current operator is persisted in AsyncStorage (`currentOperator`).

### Server/venue data
The app syncs venue data (operators, products, tables, pricing, etc.) from a remote API.
- Data sync logic: `services/dataSync.ts`
- API client logic: `services/api.ts`
- Parsing: `services/dataParser.ts`

### POS state
Primary shared state is implemented with `@nkzw/create-context-hook`:
- `contexts/POSContext.tsx`

It owns:
- basket
- table selection & table orders
- tenders, VAT rates
- payment toggles (cash/card, split)
- refund mode and related behavior
- receipt settings

State persistence:
- A mixture of AsyncStorage keys and sync-stored datasets.

### Inactivity / screensaver
- `contexts/InactivityContext.tsx`
- UI overlay: `components/ScreensaverOverlay.tsx`

The overlay is interactive and dismisses on tap.

## 3) Navigation structure

Expo Router routes (high level):
- `app/_layout.tsx`: root layout, providers, global navigation
- `app/login/*`: login flow
- `app/(tabs)/*`: main application tabs

Tab layout:
- `app/(tabs)/_layout.tsx`

Notable behavior:
- If `currentOperator` is null, tabs redirect to `/login`.
- Basket header contains “Print Bill” and Logout.

## 4) Core screens (by file)

- `app/login/index.tsx`
  - Operator selection
  - PIN keypad flow
  - Loads operators from `dataSyncService.getStoredOperators()`

- `app/(tabs)/index.tsx`
  - Product browsing/catalog UI (Products tab)

- `app/(tabs)/search.tsx`
  - Product search and add-to-basket

- `app/(tabs)/basket.tsx`
  - Basket editing
  - Discounts/gratuity/payment flows (as configured)
  - Print actions
  - Split bill UI (if enabled)
  - Swipe gestures use `PanResponder`

- `app/(tabs)/reports.tsx`
  - Reporting UI (transactions/totals; depends on local storage and/or backend)

- `app/(tabs)/settings.tsx`
  - Large configuration surface: syncing, UI preferences, tender/payment toggles, printer setup, etc.

## 5) Printing

- Printer logic is abstracted in `services/printerService.ts` and `services/escpos.ts`.
- `app/(tabs)/_layout.tsx` uses `printerService.isConnected()` to determine if Print Bill is enabled.
- A “bill transaction” is assembled from the current basket and sent to `printerService.printReceipt(...)`.

## 6) Tables / tabs & persistence

Tables and open tabs are managed in:
- `services/tableDataService.ts`
- State in `contexts/POSContext.tsx` (`currentTable`, `tableOrders`, `basket`)

Logout behavior (important):
- If a table is selected and there are items in the basket, logout attempts to save/sync table data before clearing state.

## 7) Backend (Hono + tRPC)

Backend entry points:
- `backend/hono.ts`
- `backend/trpc/app-router.ts`
- `backend/trpc/create-context.ts`

Route structure (examples):
- `backend/trpc/routes/tabledata/sync/route.ts`
- `backend/trpc/routes/tabledata/upload/route.ts`
- `backend/trpc/routes/transaction/upload/route.ts`
- `backend/trpc/routes/settingsprofile/*`

Client integration:
- `lib/trpc.ts`

## 8) Environment variables

The app expects the following variables to exist at runtime:
- `process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT`
- `process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE`
- `process.env.EXPO_PUBLIC_RORK_DB_TOKEN`
- (system-provided) `process.env.EXPO_PUBLIC_RORK_API_BASE_URL`

These are public Expo variables (safe to ship to clients).

## 9) Web compatibility notes

This app runs in React Native Web. Key constraints:
- Prefer React Native core APIs and Expo modules that support web.
- Avoid native-only modules unless guarded or polyfilled.

Known compatible modules used here:
- `expo-blur` (used for tab bar background)
- AsyncStorage
- Standard React Native components and Animated API

## 10) Debugging & logging

The codebase uses verbose logs (e.g., `[POS]`, `[DataSync]`) to support operational troubleshooting.

Recommended debugging workflow:
1. Reproduce issue.
2. Capture console logs around the failing action.
3. Identify which subsystem is involved:
   - sync/parsing
   - product matching
   - tables
   - printing
   - transaction completion/upload

## 11) Data model

Primary types live in:
- `types/pos.ts`

Common types include:
- `Operator`
- `Product`
- `BasketItem`
- `Tender`
- `VATRate`
- `Table`, `TableOrder`
- `Transaction`

## 12) Operational configuration storage

Storage is primarily via AsyncStorage, using keys in `services/dataSync.ts` (and additional keys in other services).

Examples:
- site info (ID/name)
- credentials (optional)
- operators/products/tables datasets
- UI settings (theme/button skin)
- tender/VAT settings

## 13) Common extension points

- Add a new setting: `app/(tabs)/settings.tsx` + persistence via AsyncStorage or `dataSyncService`.
- Add a new report: `app/(tabs)/reports.tsx` + a service to query or aggregate data.
- Modify receipt formatting: `services/escpos.ts` and receipt settings in POS context.
- Add a backend route: `backend/trpc/routes/*` + register in `backend/trpc/app-router.ts`.
