# Kashif Traders automated document workflow

## Supplier invoices
Registered supplier WhatsApp -> inbound WhatsApp webhook -> attachment -> AI OCR -> supplier match by normalized WhatsApp number -> duplicate check -> pending Admin approval -> on approval create Supplier Bill.

Supplier invoice camera scanning is intentionally removed from the ERP form. M48/OCR remains a background intelligence service.

## Supplier payments
ERP Supplier Payments keeps Camera/Gallery. For BANK/ONLINE payments, capture the bank transfer receipt/slip; AI extracts date, amount, bank and reference. Cash stays manual. After an approved supplier payment, the outbound WhatsApp worker must send the payment-slip image plus the refreshed supplier statement and new balance to the supplier's registered WhatsApp number.

## Client invoices and receipts
Client Bills keeps Camera/Gallery so a mobile photo of the client's bill can populate a draft invoice. Client Payments keeps Camera/Gallery for bank-transfer receipt images; cash stays manual. Bank receipt images populate date, amount, bank and reference before save/approval.

## Approval rule
AI/OCR never posts accounting entries by itself. Automated supplier WhatsApp invoices and document-derived payments must be drafts/pending approval. Admin approval is the posting boundary.

## WhatsApp dependency
The repository currently has no inbound/outbound WhatsApp provider webhook/credential implementation. Production auto-collection and auto-send therefore requires a WhatsApp Business provider (for example Meta WhatsApp Cloud API) plus webhook verification/token environment variables. Do not simulate sending until that provider is connected.
