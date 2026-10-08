# Optional Windows thermal print bridge (experimental)

Browser and BlackCopper's 3276mm driver form produce extra blank paper. The RAW ESC/POS route bypasses page-size printing entirely. It is **not yet integrated into the Cashier button** and must not be considered tested on the physical BlackCopper model.

Run `local-server/start-thermal-test.cmd` to start **DRY RUN (no paper)** on loopback 127.0.0.1:8788. This accepts approved origins only: localhost:8787 or the exact origin in KT_PRINT_ORIGIN. To perform an intentional supervised physical test, restart with argument `print`. Only test if BlackCopper supports ESC/POS; no auto-cut and no form feed are sent. There is no auto-start and no ERP button wired to it yet. Avoid 3276mm browser print. Use Ctrl+C to stop.

The plain-text 42-column ESC/POS layout retains company title, customer details, product name, qty/rate/amount and totals. It cannot exactly reproduce CSS/PDF typography. Verify its dry run and a short physical receipt before any integration or wider use. Production unchanged.


## Easy dry-run verification - NO PAPER

1. Open the working branch repository on GitHub. Click **Code > Download ZIP**, extract the archive on your Windows laptop.
2. Open the extracted folder, then its **local-server** folder.
3. Double-click **start-thermal-test.cmd**. Keep its black terminal open. It must show **DRY_RUN=true**. This runs locally and does not print.
4. Double-click **check-thermal-dry-run.cmd** in the same folder. It sends only sample receipt data (1, 5, 23, 28, and 50 items) to the dry-run bridge. It refuses to send anything if the bridge reports physical printing enabled.
5. Confirm the final line **ALL DRY-RUN CHECKS PASSED**, take a screenshot, then close the second window. Stop the server with Ctrl+C in the first window.

The check never uses real customer invoices. **Do not run \`start-thermal-test.cmd print\` yet**. Physical BlackCopper compatibility and the correct printer mode require a separate supervised 1-item test. Current Cashier **Print Receipt** is unchanged.
