# SAFETY NOTICE (2026-10-09): Automatic receipt printing paused

A live BlackCopper 80mm Series(1) printer test sent excessive blank paper after the short receipt. The driver currently advertises a 72.1mm x 3276mm paper form. The dedicated Chrome kiosk-printing / hidden HTML iframe route is **not safe for this configuration**.

**Do not use the old Desktop launcher to attempt silent printing.** Stop any runaway job via Windows Settings > Printers & scanners > BlackCopper 80mm Series(1) > Open print queue > Cancel. Power-cycle the printer only once the queue is empty.

The working-branch Cashier now shows **AUTO PRINT PAUSED** and the Print Receipt button opens the PDF viewer rather than triggering kiosk auto-print. Printed bill geometry remains unchanged. The latest Desktop launcher no longer uses `--kiosk-printing`. On an already-downloaded launcher, open the normal Cashier in Edge/Chrome; you do not need the shortcut until a tested printing bridge exists.

A proper one-click printing implementation will need Windows-side controlled RAW ESC/POS (if BlackCopper supports it) or a driver-specific print bridge that sends only receipt-length bytes and a cut instruction. The browser page alone cannot guarantee correct physical feed length on this driver. Do not enable silent mode until tested with one very short bill and an emergency Cancel action.
