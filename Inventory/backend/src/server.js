import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { connectDatabase } from "./utils/database.js";
import authRoutes from "./routes/auth.routes.js";
import backupRoutes from "./routes/backup.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import itemRoutes from "./routes/item.routes.js";
import partyRoutes from "./routes/party.routes.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import reportRoutes from "./routes/report.routes.js";
import saleRoutes from "./routes/sale.routes.js";
import settingRoutes from "./routes/setting.routes.js";
import storeRoutes from "./routes/store.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import returnRoutes from "./routes/return.routes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:8081", "*"];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, postman)
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for demo & testing
    },
    credentials: true
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "inventory-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/returns", returnRoutes);

import { startAutoBackupSchedule } from "./utils/autoBackup.js";

connectDatabase()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Inventory API running on http://localhost:${port}`);
      startAutoBackupSchedule();
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
