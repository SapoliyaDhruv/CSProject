# Inventory

Inventory is a MERN project with one website and one mobile app connected to the same backend API.

## Structure

```text
Inventory/
  backend/   Node.js + Express + MongoDB API
  client/    Vite + React website
  mobile/    Expo + React Native mobile app
```

## First Setup

Create `backend/.env` from `backend/.env.example`.

```bash
cd Inventory/backend
copy .env.example .env
```

Create `client/.env` from `client/.env.example`.

```bash
cd Inventory/client
copy .env.example .env
```

Install and run MongoDB locally, or replace `MONGO_URI` with your MongoDB Atlas connection string.

## Run Backend

```bash
cd Inventory/backend
npm run dev
```

Backend runs at:

```text
http://localhost:5000
```

## Run Website

```bash
cd Inventory/client
npm run dev
```

Website runs at:

```text
http://localhost:5173
```

## Run Mobile App

This project is pinned to Expo SDK 54 because your Expo Go app shows SDK 54.0.8.

Install Expo Go on your phone, then run:

```bash
cd Inventory/mobile
npx expo start -c
```

Scan the QR code with Expo Go.

For Android emulator, the mobile app uses:

```text
http://10.0.2.2:5000/api
```

For a real phone, replace `API_URL` in `mobile/App.js` with your computer IP address, for example:

```text
http://192.168.1.10:5000/api
```

## Shared API

Both website and mobile app call the same API:

```text
GET    /api/items
GET    /api/items/lookup/barcode/:code
POST   /api/items
PATCH  /api/items/:id
DELETE /api/items/:id

GET    /api/sales
GET    /api/sales/next-number
GET    /api/sales/:id
GET    /api/sales/:id/pdf
POST   /api/sales

GET    /api/purchases
GET    /api/purchases/next-number
POST   /api/purchases

GET    /api/expenses
POST   /api/expenses
DELETE /api/expenses/:id

GET    /api/store/catalog
POST   /api/store/orders
GET    /api/store/orders
PATCH  /api/store/orders/:id

GET    /api/parties
POST   /api/parties

GET    /api/reports/dashboard
GET    /api/reports/business
GET    /api/reports/payment-reminders
GET    /api/reports/ledger/:name

GET    /api/settings
PATCH  /api/settings

GET    /api/backup/export
POST   /api/backup/restore

POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/users
```

## Project Status

This app now includes a complete Vyapar-style feature set:

- **GST Billing & Invoicing**:
  - Proper GST invoice screen with automatic CGST/SGST tax calculation.
  - Sequential GST invoice numbering (`SALE/25-26/0001` format).
  - Downloadable PDF invoices generated server-side.
- **WhatsApp Integration (Web & Mobile)**:
  - Instant one-click WhatsApp sharing for GST invoices with line items, grand total, balance due, and UPI ID.
  - WhatsApp payment due reminders sent directly to customers with outstanding balances from the Party Ledger and Reports.
- **Thermal POS Printer Support (58mm / 80mm)**:
  - Thermal receipt printing with dedicated `@media print` roll styles (58mm 2-inch & 80mm 3-inch).
  - Raw monospace receipt text export and clipboard copy for Bluetooth/USB ESC-POS mobile printers.
- **Online Store & Digital Catalog**:
  - Customer-facing digital storefront with live search and category filter pills (Dairy, Cold Storage, etc.).
  - Interactive shopping cart with subtotal calculation.
  - "Order on WhatsApp" direct merchant messaging + "Place Online Order" checkout.
  - Merchant online order management with one-click conversion to GST sales invoices.
- **Business Expense Tracking**:
  - Full expense recording (Rent, Electricity, Wages, Raw Materials, Logistics, Maintenance).
  - Automatic deduction in Business Profit & Loss reporting.
- **Parties & Ledgers**:
  - Customer & supplier directories tracking net running balances and history.
- **Barcode & Batch Tracking**:
  - Barcode lookup on website and live camera barcode scanner on mobile (`expo-camera`).
  - Cold storage flags, batch numbers, manufacturing dates, and expiration date warnings.
- **Analytics & Reports**:
  - Dashboard overview, Business P/L, expiry alerts, low stock alerts, receivables & payables.
- **User Roles & Security**:
  - Role-based permissions (`admin` vs `staff`).
- **Database Backup & Restore**:
  - One-click full database export and file-based JSON backup restoration.

