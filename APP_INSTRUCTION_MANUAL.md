# NODE Virtual POS — Instruction Manual

This app is a point-of-sale (POS) client for **NODE Virtual**, built with Expo + React Native. It runs on **iOS, Android, and Web**.

## 1) Quick start (daily use)

### Log in
1. Open the app.
2. Select your **operator**.
3. If prompted, enter your **4-digit PIN**.
4. You’ll land in the main app with tabs at the bottom.

If an operator has no PIN set, selecting them logs in immediately.

### Navigation (tabs)
- **Products**: Browse the product catalogue.
- **Search**: Find products quickly by name.
- **Basket**: Review items, apply actions, take payment, print, and (optionally) split bills.
- **Reports**: View reporting/transaction information (manager-focused).
- **Settings**: Setup, syncing, printer settings, appearance, and operational toggles.

### Print a bill (header button)
1. Go to **Basket**.
2. Tap **Print Bill** in the top-right header (printer icon).
3. If a printer is not connected, the app will prompt you to connect one in **Settings**.

## 2) Selling items

### Add items to the basket
1. Go to **Products** or **Search**.
2. Tap a product to add it to the **Basket**.
3. The basket badge shows the current item count.

### Basket basics
In **Basket**, each line item shows:
- Item name
- Quantity
- Line total
- Optional line message (if used)

#### Change quantity
- Use **+ / −** controls to adjust quantity.
- Setting quantity to 0 removes the item.

#### Remove an item
- Swipe the item to reveal actions (delete).

#### Refund/void (manager)
- Manager operators can swipe the other direction to mark an item as refund/return (behavior depends on configuration and current mode).

## 3) Prices & “prefix” items (e.g., STAFF / TRADE / DBL)

Some items may appear with a prefix in their name to indicate a price band or variant, for example:
- `STAFF Soup of the Day`
- `DBL Gin`
- `125ML Wine`

The app supports a set of built-in prefixes (e.g., **HALF, DBL, SML, LRG, 125ML, 175ML, 250ML, 2/3PT, OPEN, NOT SET**) and can also use **custom price prefixes** configured via sync/settings.

When a prefixed item is loaded (for example, from a saved table/tab), the app:
1. Detects the prefix.
2. Locates the base product.
3. Applies the corresponding price label.

If the base product cannot be found or the product reference does not match the source PLU/identifier, the row may be skipped.

## 4) Tables / tabs (if enabled)

If your venue uses **tables/tabs**:
- You may be required to select a table before selling.
- A table can hold an in-progress basket.
- Logging out can trigger a save/sync of the current table.

Common flows:
- **Open a table** → items load into Basket.
- **Add/remove items** → basket updates.
- **Save table** → keeps the tab open for later.
- **Pay/close** → completes the transaction and clears/updates the table.

## 5) Discounts & gratuity (if enabled)

- Discounts may be configured as preset percentages.
- Gratuity (service charge/tips) can be enabled with preset percentages.

These options are typically managed in **Settings** and applied in **Basket**.

## 6) Taking payment

Supported tender types depend on your configuration:
- **Cash**
- **Card**

Options may include:
- Split payments (if enabled)
- Change allowed / cashback allowed (if enabled)

To complete a sale:
1. Go to **Basket**.
2. Confirm items and totals.
3. Choose tender (cash/card, or split if enabled).
4. Confirm to complete.

## 7) Split bill (if enabled)

When split bill is enabled, a floating **Split** button can appear in the Basket.

Typical usage:
1. Open **Basket**.
2. Tap **Split bill**.
3. Select how to split items / amounts.
4. Complete each portion.

If the button is not visible, confirm split functionality is enabled in **Settings** and/or the current operator has permission.

## 8) Screensaver (inactivity)

If the app is left idle for ~**5 minutes** (config may vary), a screensaver overlay appears:
- Shows the **NODE Virtual** logo
- Shows “Tap to Start”

To dismiss:
- Tap anywhere on the screensaver.

## 9) Settings (operator/manager)

Settings contains operational controls and configuration such as:
- Data sync controls (download/refresh venue data)
- Payment toggles (cash/card)
- Split payments toggle
- Refund/manager controls
- Printer connection/settings
- Appearance (theme/button style)

Some settings are restricted to managers or are shown until initial setup is complete.

## 10) Troubleshooting

### Printer says “Not Connected”
- Go to **Settings** → Printer and connect/configure.
- Return to Basket and try printing again.

### Missing products or table items don’t load
- Run a **sync** in Settings.
- Confirm the product exists in the catalogue.
- If the item is prefixed (STAFF/TRADE/etc.), confirm the base product and price label exist.

### Login issues
- Confirm operator exists and has the correct PIN.
- If using remembered credentials for sync, re-link the account if needed.

### General recovery steps
- Perform a full sync.
- Log out and log back in.
- If the issue persists, capture the console logs around the failing action (open table, add item, complete sale).
