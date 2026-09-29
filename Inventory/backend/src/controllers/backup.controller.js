import { BusinessSetting } from "../models/BusinessSetting.js";
import { Expense } from "../models/Expense.js";
import { Item } from "../models/Item.js";
import { Party } from "../models/Party.js";
import { Purchase } from "../models/Purchase.js";
import { Sale } from "../models/Sale.js";
import { User } from "../models/User.js";

export async function exportBackup(req, res) {
  const [settings, items, parties, sales, purchases, expenses, users] =
    await Promise.all([
      BusinessSetting.find(),
      Item.find(),
      Party.find(),
      Sale.find(),
      Purchase.find(),
      Expense.find(),
      User.find().select("-passwordHash")
    ]);

  res.json({
    exportedAt: new Date().toISOString(),
    app: "Inventory",
    version: 1,
    collections: {
      settings,
      items,
      parties,
      sales,
      purchases,
      expenses,
      users
    }
  });
}

export async function restoreBackup(req, res) {
  try {
    const { collections } = req.body;

    if (!collections) {
      return res.status(400).json({ message: "Invalid backup format: missing collections" });
    }

    const results = {};

    if (Array.isArray(collections.settings) && collections.settings.length) {
      await BusinessSetting.deleteMany({});
      await BusinessSetting.insertMany(collections.settings);
      results.settings = collections.settings.length;
    }

    if (Array.isArray(collections.items) && collections.items.length) {
      await Item.deleteMany({});
      await Item.insertMany(collections.items);
      results.items = collections.items.length;
    }

    if (Array.isArray(collections.parties) && collections.parties.length) {
      await Party.deleteMany({});
      await Party.insertMany(collections.parties);
      results.parties = collections.parties.length;
    }

    if (Array.isArray(collections.sales) && collections.sales.length) {
      await Sale.deleteMany({});
      await Sale.insertMany(collections.sales);
      results.sales = collections.sales.length;
    }

    if (Array.isArray(collections.purchases) && collections.purchases.length) {
      await Purchase.deleteMany({});
      await Purchase.insertMany(collections.purchases);
      results.purchases = collections.purchases.length;
    }

    if (Array.isArray(collections.expenses) && collections.expenses.length) {
      await Expense.deleteMany({});
      await Expense.insertMany(collections.expenses);
      results.expenses = collections.expenses.length;
    }

    res.json({
      message: "Backup restored successfully",
      restoredAt: new Date().toISOString(),
      counts: results
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to restore backup: " + error.message });
  }
}

