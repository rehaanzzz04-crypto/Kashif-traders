# Optional Windows thermal print bridge (experimental)

Browser and BlackCopper's 3276mm driver form produce extra blank paper. The RAW ESC/POS route bypasses page-size printing entirely. It is **not yet integrated into the Cashier button** and must not be considered tested on the physical BlackCopper model.

Run `local-server/start-thermal-test.cmd` to start **DRY RUN (no paper)** on loopback 127.0.0.1:8788. This accepts approved origins only: localhost:8787 or the exact origin in KT_PRINT_ORIGIN. To perform an intentional supervised physical test, restart with argument `print`. Only test if BlackCopper supports ESC/POS; no auto-cut and no form feed are sent. There is no auto-start and no ERP button wired to it yet. Avoid 3276mm browser print. Use Ctrl+C to stop.

The plain-text 42-column ESC/POS layout retains company title, customer details, product name, qty/rate/amount and totals. It cannot exactly reproduce CSS/PDF typography. Verify its dry run and a short physical receipt before any integration or wider use. Production unchanged.
