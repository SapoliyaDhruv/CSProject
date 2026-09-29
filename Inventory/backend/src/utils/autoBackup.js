import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BusinessSetting } from "../models/BusinessSetting.js";
import { Expense } from "../models/Expense.js";
import { Item } from "../models/Item.js";
import { Party } from "../models/Party.js";
import { Purchase } from "../models/Purchase.js";
import { Sale } from "../models/Sale.js";
import { User } from "../models/User.js";
import { StoreOrder } from "../models/StoreOrder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUPS_DIR = path.resolve(__dirname, "../../backups");

let lastAutoBackupTime = null;

export async function runAutomatedBackup() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const [settings, items, parties, sales, purchases, expenses, users, storeOrders] =
      await Promise.all([
        BusinessSetting.find(),
        Item.find(),
        Party.find(),
        Sale.find(),
        Purchase.find(),
        Expense.find(),
        User.find().select("-passwordHash"),
        StoreOrder.find()
      ]);

    const backupData = {
      exportedAt: new Date().toISOString(),
      app: "Inventory",
      type: "automated",
      version: 1,
      collections: {
        settings,
        items,
        parties,
        sales,
        purchases,
        expenses,
        users,
        storeOrders
      }
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `auto-backup-${dateStr}.json`;
    const filePath = path.join(BACKUPS_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf8");
    lastAutoBackupTime = new Date().toISOString();
    console.log(`[AutoBackup] Automated database snapshot saved to ${fileName}`);

    // Prune backups older than 7 days
    pruneOldBackups(7);
  } catch (err) {
    console.error("[AutoBackup] Failed to run automated backup:", err.message);
  }
}

function pruneOldBackups(maxDays = 7) {
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith("auto-backup-") && f.endsWith(".json"));
    if (files.length > maxDays) {
      files.sort();
      const filesToDelete = files.slice(0, files.length - maxDays);
      for (const file of filesToDelete) {
        fs.unlinkSync(path.join(BACKUPS_DIR, file));
        console.log(`[AutoBackup] Pruned old backup: ${file}`);
      }
    }
  } catch (e) {
    console.error("[AutoBackup] Pruning error:", e.message);
  }
}

export function startAutoBackupSchedule() {
  // Run once shortly after startup (after 5 seconds)
  setTimeout(() => {
    runAutomatedBackup();
  }, 5000);

  // Then run every 12 hours (12 * 60 * 60 * 1000 ms)
  setInterval(() => {
    runAutomatedBackup();
  }, 12 * 60 * 60 * 1000);
}

export function getLastAutoBackupStatus() {
  let fileList = [];
  try {
    if (fs.existsSync(BACKUPS_DIR)) {
      fileList = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith(".json"));
    }
  } catch {
    fileList = [];
  }

  return {
    lastAutoBackupTime,
    backupsDirectory: BACKUPS_DIR,
    availableBackups: fileList
  };
}
