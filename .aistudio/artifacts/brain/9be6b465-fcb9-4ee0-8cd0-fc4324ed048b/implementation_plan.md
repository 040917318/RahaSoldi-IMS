# Bluetooth Receipt Printing for Xprinter XP-420B

A high-reliability, hardware-tested thermal receipt printing engine for the Xprinter XP-420B label printer, enabling direct one-tap Bluetooth printing from Android, iOS (via WebBLE/Bluefy or AirPrint fallback), and desktop browsers without manual downloads.

> [!IMPORTANT]
> **Hardware Configuration Confirmed by User**:
> - **Connectivity**: Web Bluetooth BLE with cross-platform mobile browser support (Android Chrome, Edge, and iOS WebBLE/Bluefy compatibility + browser thermal print fallback).
> - **Media**: Continuous thermal receipt roll (configured dynamically for 80mm to 108mm width at 203 DPI, 8 dots/mm, with continuous paper `GAP 0,0` settings).
> - **Command Architecture**: Native TSPL/TSPL2 command generation (with support for scalable text, clean tabular line items, QR/barcode codes, and canvas bitmap rendering for business logos/accents).

---

## 1. Overview & Core Concept

The Raha Soldi inventory application currently exports PDF receipts and WhatsApp text summaries. This feature adds a native hardware printing engine targeting the **Xprinter XP-420B (203 DPI 4-inch thermal printer)** via Web Bluetooth BLE:

- **Instant POS Printing**: Cashiers complete a sale in the Sales Terminal and print a receipt directly with zero intermediate file downloads.
- **Historic & Pending Orders**: Receipts can be reprinted anytime from Sales History or Invoice Generator.
- **Zero-Waste Formatting**: Formatted specifically for continuous thermal rolls (or die-cut labels), eliminating blank margins and awkward page breaks.
- **Resilient Dual-Engine Fallback**: Direct Web Bluetooth TSPL stream for supported browsers; automated 80mm/100mm CSS thermal print fallback for standard iOS Safari where Web Bluetooth is restricted by Apple.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Printer Pairing & Status**:
   - Cashiers tap the **Printer Status Icon** in the application header or POS toolbar (shows `Disconnected`, `Connecting`, `Connected: XP-420B`, or `Printing`).
   - Tapping opens the **Thermal Printer Settings Drawer/Modal**:
     - Auto-scan & connect via Web Bluetooth.
     - Live signal & battery/status indicator.
     - Media settings: Roll width (80mm / 100mm / 108mm), Media mode (Continuous Roll vs Die-Cut Label), Print Density (1 to 15, default 8).
     - One-tap **Test Print** to verify paper alignment and font rendering.
     - Remembers previously paired printer ID in `localStorage` for rapid reconnects.
2. **Checkout Print Flow**:
   - In `SalesTerminal`, after completing a checkout or deferring a sale, the success notification presents a prominent **Print Receipt** action.
   - If connected, it streams directly via Bluetooth in ~1.2 seconds with a progress spinner.
   - If disconnected, it prompts with a quick-connect modal or 1-tap browser print fallback.
3. **Sales History & Invoicing Reprints**:
   - Every completed or pending sale card in `SalesHistory` includes a **Print Receipt** action.
   - In `InvoiceReceiptGenerator`, a **Print via XP-420B** button is added beside WhatsApp & PDF actions.

### Receipt Layout Spec (XP-420B @ 203 DPI)
- **Header**: Store name (`RAHA SOLDI ENTERPRISE`), location (`Adabraka, Accra, Ghana`), and official contact phone numbers.
- **Transaction Metadata**: Receipt #, Order ID, Date/Time, Cashier name, and Customer name (if assigned).
- **Line Items**: Clean tabular layout with quantity, item name (with word-wrap for long titles), unit price, and line totals in Ghana Cedis (`GH₵`).
- **Financial Totals**: Subtotal, discount deduction, VAT/tax (if applied), and bold Grand Total.
- **Footer**: Payment method/status, return policy, and a clean transaction QR/Barcode.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale | Alternatives Considered |
|---|---|---|---|
| **Bluetooth Protocol** | Web Bluetooth BLE with multi-service UUID discovery | Native browser execution without installing local native background servers or external APKs on Android. | Bluetooth Classic SPP (requires external native Android app bridge). |
| **Command Protocol** | Native TSPL/TSPL2 (`SIZE`, `GAP 0,0`, `CLS`, `TEXT`, `PRINT 1,1`) | Native language of the XP-420B chipset. Produces crisp 203 DPI typography, precise dot-level spacing, and zero page waste. | ESC/POS emulation (inconsistent label feed on 4-inch label printers). |
| **iOS Compatibility** | Dual-Path: WebBLE / Bluefy browser support + Optimized CSS Thermal Print Fallback | iOS Safari prohibits Web Bluetooth. Bluefy/WebBLE enables full BLE, while CSS `@media print` formatted for 80/100mm rolls covers standard Safari via AirPrint. | Rejecting iOS entirely (bad user experience for iPhone/iPad cashiers). |
| **BLE Packet Slicing** | 64-byte chunked writes with 20ms pacing | XP-420B BLE modules drop packets if whole print jobs (>1KB) are pushed in a single synchronous write. | Unchunked writes (causes buffer overflow and incomplete receipts). |

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Raha Soldi React UI                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │  SalesTerminal   │  │   SalesHistory   │  │InvoiceReceiptGenerator│ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────────┬───────────┘ │
│           │                     │                        │             │
│           └─────────────────────┼────────────────────────┘             │
│                                 ▼                                      │
│               ┌───────────────────────────────────┐                    │
│               │   usePrinter / PrinterContext     │                    │
│               │ - Connection State & Device Info  │                    │
│               │ - Settings (80/100mm, Density)    │                    │
│               │ - Mutex Lock (prevents duplicates)│                    │
│               └─────────────────┬─────────────────┘                    │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  ▼
        ┌───────────────────────────────────────────────────┐
        │        Printer Engine (services/printer/)         │
        ├─────────────────────────┬─────────────────────────┤
        │  tsplGenerator.ts       │  blePrinterService.ts   │
        │  - Formats receipts     │  - Web Bluetooth GATT   │
        │  - Word-wrap line items │  - Service UUID scanner │
        │  - Calculates heights   │  - MTU chunked writer   │
        │  - Generates TSPL binary│  - Disconnect listener  │
        └─────────────────────────┴─────────────────────────┘
                                  │
                                  ▼
                   ┌───────────────────────────────┐
                   │    Xprinter XP-420B (BLE)     │
                   │    - 203 DPI Continuous Roll  │
                   │    - Direct Hardware Printing │
                   └───────────────────────────────┘
```

### Components to Create & Update:
1. `services/printer/tsplGenerator.ts`: Generates TSPL2 byte commands for continuous 80mm-108mm receipts, order headers, itemized grids, totals, and barcodes.
2. `services/printer/blePrinterService.ts`: Web Bluetooth driver with known Xprinter GATT services (`0xFF00`, `0xFEE7`, `0x18F0`, `49535343-...`, Nordic UART), connection management, MTU chunking, and error recovery.
3. `services/printer/types.ts`: Printer config, status types, and connection interfaces.
4. `components/PrinterSettingsModal.tsx`: Modern, anti-slop printer drawer to scan, test-print, adjust paper width/density, and view BLE telemetry.
5. Integration into:
   - `App.tsx`: Header printer status icon + global printer context/hook.
   - `components/SalesTerminal.tsx`: Post-checkout 1-tap print receipt.
   - `components/SalesHistory.tsx`: Row-level and modal receipt printing.
   - `components/InvoiceReceiptGenerator.tsx`: Bluetooth thermal print button.
