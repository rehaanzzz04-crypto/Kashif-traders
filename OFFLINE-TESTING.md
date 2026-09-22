# Working-branch offline preview

This is an initial offline sync implementation, **not a fully verified offline APK release**.

## Available in this change

- Static pages and current assets are cached separately; Cash Sale no longer overwrites the dashboard cache.
- Standalone pages register the service worker. Staff pages load the offline layer before their API calls.
- `Offline Data` → `Offline Data Tayyar` saves accessible lists on the current device. Cached reads show the last saved data; unvisited/unprepared data is not fabricated.
- JSON creates/updates/deletes for supplier/client accounts, bills/payments, Cash Sale customers/catalog/bills, inventory and salary requests are durably queued in IndexedDB before transmission.
- Pending entries belong to their original employee. Linked temporary IDs resolve after parent records sync. Server authorization and approval checks still run.
- A server claim and response journal prevents repeat execution of an operation ID. A crash with an uncertain result stops for review; it is **not** silently retried as a new posting. This is conservative at-most-once execution, not an atomic transaction across all existing ledger statements.
- Cash Sale and cashier messages distinguish phone storage from server confirmation. Server balances and paid statuses are not optimistically changed by local pending actions.
- The old unscoped queue remains intact and is flagged for review instead of being assigned to whoever happens to log in next.

## Known incomplete areas / release gates

- Actual APK/WebView behavior, browser end-to-end testing and live database integration still require validation. A prepared browser test could not run locally because the browser binary download failed.
- New uploads, OCR, WhatsApp, online orders, employee/security changes, approvals, e-commerce writes and generating fresh server PDFs require internet. Previously fetched PDFs can be read from the device cache. Cached Cashier receipts retain their existing client-side printing/PDF path.
- Offline edits/payment actions are pending requests; they do not create a final offline ledger or final offline receipt. Multi-device conflict resolution is not yet implemented.
- Lists with server limits are snapshots of the returned subset, not a complete database replica. Exact cached filtered queries work; new Cash Sale catalog searches can derive from a prepared full catalog response.
- Offline access uses the most recent employee session, up to 12 hours. First login requires internet.
- Review items deliberately block subsequent sync for that employee. Admin reconciliation UI and migration of legacy unattributed queued entries are not implemented yet. Do not recreate uncertain financial entries.
- No production deployment or live financial test entries were made by this work.

## Code checks

Run `npm run test:offline` after installing dependencies. It covers shell routing, operation replay, crash recovery, account isolation, dependent IDs, persistence across reload, catalog fallback and retained review states.

Regenerate the static asset manifest with `npm run build:offline` when pages or assets change.

## Device acceptance test (test records only)

1. Open the working preview online and sign in with a test employee. Tap Offline Data → Offline Data Tayyar.
2. Turn off Wi-Fi/mobile data. Reopen Cash Sale; search a cached product; create a test customer and bill. Confirm Pending Sync, not Sent to Cashier.
3. Close/reopen the app. Confirm the queued entries remain listed.
4. Restore internet with the same employee logged in. Confirm one customer and one bill arrive with correctly linked IDs; repeat sync and verify no duplicates.
5. Repeat with a cached supplier/client payment and with a second employee. Verify isolation and all server ledger effects in an isolated test database before using real transactions.
6. Test rejected, stale and interrupted operations. Resolve review items before production promotion.
