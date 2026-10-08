# Kashif Traders Cashier - One Click Direct Thermal Print (working branch)

This is **opt-in** and limited to a dedicated Windows cashier browser window. The normal Cashier URL still opens the PDF viewer and standard print dialog. No production changes are intended.

## One time: Windows laptop

1. Go to Windows **Settings > Bluetooth & devices > Printers & scanners**, choose your working USB thermal printer and set it as the **default printer**. Turn **Let Windows manage my default printer** off.
2. Open **Printing preferences** for that printer and save the working receipt setup: **80mm roll** (your driver labels it 72.1mm printable width), **100%/Actual size**, normal portrait, auto-cut if the hardware supports it. Test a normal PDF bill first.
3. Download `local-server/cashier-direct-print-windows.cmd` from the working GitHub branch, put it on the Windows desktop, and double-click. **Google Chrome required.** It opens an isolated Cashier app with `--kiosk-printing`.
4. Sign into Cashier in this separate Chrome window (one-time for its own Chrome profile). Print from the **Print Receipt** button. The new direct path prints HTML to the Windows default printer; **PDF Share** still produces a PDF.
5. If a dialog still appears, close all cashier windows, verify Chrome version and default printer, then re-open the .cmd. Browser or driver configuration may prevent silent printing; it cannot be guaranteed by the website alone.

### Alternate Microsoft Edge route

Microsoft Edge version **144+** has official enterprise policy **SilentPrintingEnabled**. Enabling this policy affects **all Edge tabs/profiles**, not just Cashier. **Do not enable it on a shared browsing PC** without accepting that risk. It can be configured by an administrator via Edge group policy/registry; then open the working branch Cashier with `?directPrint=1`. Inspect `edge://policy` to verify, and use the same Windows default thermal printer. Official documentation: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/SilentPrintingEnabled

### Troubleshooting

- If the HTML prints too long or gets cropped, driver paper-size support may be overriding the receipt's content-length @page setting. Test first before relying on it for shop operations.
- If multiple printers are installed, keep the thermal printer as Windows default for the Cashier window.
- If you need PDF preview, open the normal Cashier URL **without** `?directPrint=1`.
- This cannot bypass printer failure, a disconnected USB cable, or the OS print spooler.

## Seeing the PDF viewer instead of direct printing?

Login redirects can lose the original `?directPrint=1` query. After signing in, **close the PDF viewer and double-click the same Desktop shortcut again**. The Cashier page now retains direct-print mode in the shortcut's isolated Chrome profile. The label **DIRECT PRINT ON** must be visible next to the print button; **PDF PRINT MODE** means the normal flow is active. No new shortcut download is needed if it already points to the working-branch alias. Other Chrome/Edge browser profiles remain unaffected.

To intentionally turn off silent printing within that special profile, navigate to `/cashier-sales.html?directPrint=0`, or use a standard browser to open the regular Cashier URL.
