# FreshMart Demo & Cloud Deployment Guide (Method B + iPhone Setup)

This guide covers everything required to deploy the Web App on **Vercel**, the Backend on **Render**, connect to **MongoDB Atlas**, and run the app seamlessly on **iPhones (iOS)**.

---

## 1. Credentials for Testing & Live Demo

The database has been seeded with realistic Indian supermarket/dairy items, customer & supplier parties, GST tax slabs, purchase bills, sales invoices, payment vouchers, returns, and business expenses.

| Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin (Owner)** | `admin@freshmart.in` | `admin123` | Full access: POS Billing, Stock, Parties, Daybook, GST Reports, DB Backups, User Management |
| **Staff (Cashier)**| `staff@freshmart.in` | `staff123` | POS Counter Billing, Item catalog, Customer balances, Sales history |

> [!NOTE]
> **Authentication is strictly enforced.** Both the Web app and Mobile app will block all reads, writes, edits, and deletions unless logged in with valid credentials. Quick one-click demo buttons are provided on both login screens for fast testing.

---

## 2. Deploying Backend to Cloud (Render.com + Free MongoDB Atlas)

### Step 2.1: Free MongoDB Atlas (Database)
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up for free.
2. Create a **Shared Cluster (M0 Free Tier)**.
3. Under **Database Access**, create a user (e.g. `admin` and password `freshmart123`).
4. Under **Network Access**, click **Add IP Address** -> Select **Allow Access From Anywhere (`0.0.0.0/0`)**.
5. Click **Connect** -> **Drivers (Node.js)** -> Copy your connection string:
   ```env
   mongodb+srv://admin:freshmart123@cluster0.xxxx.mongodb.net/inventory?retryWrites=true&w=majority
   ```

### Step 2.2: Deploy Backend on Render.com (Free Tier)
1. Go to [render.com](https://render.com) and sign in with your GitHub account.
2. Click **New +** -> **Web Service**.
3. Select your repository `SapoliyaDhruv/CSProject`.
4. Configure the settings:
   - **Name**: `freshmart-inventory-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add:
   - `PORT`: `5000`
   - `MONGO_URI`: *(Paste your MongoDB Atlas connection string from Step 2.1)*
   - `CLIENT_ORIGIN`: `*`
   - `JWT_SECRET`: `freshmart-secret-2026-production-token`
6. Click **Deploy Web Service**.
7. In ~2 minutes, Render gives you a public URL (e.g., `https://freshmart-inventory-api.onrender.com`).
8. Seed the remote database:
   Run from your computer terminal in `backend/`:
   ```bash
   MONGO_URI="mongodb+srv://admin:freshmart123@cluster0.xxxx.mongodb.net/inventory?retryWrites=true&w=majority" npm run seed
   ```

---

## 3. Deploying Web Client to Vercel

1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New...** -> **Project**.
3. Select your repository `SapoliyaDhruv/CSProject`.
4. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: click `Edit` and select `client`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://freshmart-inventory-api.onrender.com/api` *(your Render API URL from Section 2)*
6. Click **Deploy**.
7. Vercel will build and assign you a fast, global URL (e.g., `https://freshmart-store.vercel.app`).
   *(SPA routing is already handled by `client/vercel.json`)*.

---

## 4. How iPhone (iOS) Users Can Test and Use the App

Because Apple iOS does **not** allow direct `.apk` downloads (which are Android-only), here are the two native, seamless ways for iPhone users:

### Option A: Mobile Web App (Add to Home Screen) — *Zero Install, Instant Demo*
Our web frontend is built to be 100% responsive with mobile touch POS layout, drawer navigation, and dark mode:
1. Send the iPhone user your Vercel URL (e.g. `https://freshmart-store.vercel.app`).
2. The user opens the link in **Safari** on their iPhone.
3. Tap the **Share icon** (the square with an arrow pointing up at the bottom).
4. Scroll down and tap **"Add to Home Screen"**.
5. Tap **Add**.
6. A FreshMart app icon will appear on their iPhone home screen. When launched:
   - It runs in **standalone fullscreen mode** with no Safari address bars.
   - It prompts for login (`admin@freshmart.in` or `staff@freshmart.in`).
   - Supports camera barcode scanning directly through mobile Safari!

### Option B: Expo Go on iPhone — *Native React Native Experience*
If you want the user to experience the native React Native mobile app:
1. Ask the iPhone user to open the **App Store** and install the free **Expo Go** app.
2. In the `mobile/` directory, run:
   ```bash
   npx expo start --tunnel
   ```
3. A QR code and URL (e.g., `exp://u.expo.dev/...`) will be generated.
4. On iPhone:
   - Open the **Camera app** and point it at the QR code (or open the link in Safari).
   - Tap the banner **"Open in Expo Go"**.
   - The native iOS app will immediately load on their iPhone with native camera barcode scanning, haptics, and instant offline cache!
