# SAFETY NOTICE (2026-10-09): Automatic receipt printing paused

A live BlackCopper 80mm Series(1) printer test sent excessive blank paper after the short receipt. The driver currently advertises a 72.1mm x 3276mm paper form. The dedicated Chrome kiosk-printing / hidden HTML iframe route is **not safe for this configuration**.

**Do not use the old Desktop launcher to attempt silent printing.** Stop any runaway job via Windows Settings > Printers & scanners > BlackCopper 80mm Series(1) > Open print queue > Cancel. Power-cycle the printer only once the queue is empty.

The working-branch Cashier now shows **AUTO PRINT PAUSED** and the Print Receipt button opens the PDF viewer rather than triggering kiosk auto-print. Printed bill geometry remains unchanged. The latest Desktop launcher no longer uses `--kiosk-printing`. On an already-downloaded launcher, open the normal Cashier in Edge/Chrome; you do not need the shortcut until a tested printing bridge exists.

A proper one-click printing implementation will need Windows-side controlled RAW ESC/POS (if BlackCopper supports it) or a driver-specific print bridge that sends only receipt-length bytes and a cut instruction. The browser page alone cannot guarantee correct physical feed length on this driver. Do not enable silent mode until tested with one very short bill and an emergency Cancel action.

## One PDF page, one receipt (2026-10-09)

Cashier invoices now produce **one unbroken PDF page**, irrespective of product count (within the PDF page-size limit). A 28-item bill is roughly 536mm high. This fixes repeated physical page-breaks in preview, **not** BlackCopper's fixed-size driver behavior. The working browser's silent print remains disabled. For long bills, the standard 210mm selection will crop/reflow, while the 3276mm driver form previously caused excessive blank feed. Do **not** print long invoices until printer-specific continuous-feed or tested ESC/POS support is available. Short bills can use the successfully tested 72.1 x 210mm manual configuration.

## HTML thermal print restored on working branch (2026-10-09)

The Cashier **Print Receipt** button now opens an HTML receipt generated using exactly the same layout coordinates as the working-branch PDF Share generator. It uses the successful production browser-print approach rather than routing print via PDF. The HTML page declares the measured page height in `@page` and remeasures the receipt when the page loads before opening a **normal print dialog**. For 28 items the expected receipt is about 536mm high, not 3276mm.

**Check the Windows print preview before pressing Print.** If the printer driver forces a 3276mm blank page (or more than one page), **Cancel**. This mechanism improves the layout but physical output still requires one controlled BlackCopper test; browser CSS does not override every driver. The old silent/kiosk printer shortcut is **NOT** re-enabled. PDF Share still uses the continuous, working-branch PDF layout. The `CS-N` daily numbering is unchanged.
