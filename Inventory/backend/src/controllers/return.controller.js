import { Item } from "../models/Item.js";
import { ReturnOrder } from "../models/ReturnOrder.js";

export async function getReturns(req, res) {
  try {
    const filter = {};
    if (req.query.type) {
      filter.type = req.query.type;
    }
    if (req.query.partyName) {
      filter.partyName = req.query.partyName;
    }
    const returns = await ReturnOrder.find(filter).sort({ returnDate: -1, createdAt: -1 }).limit(100);
    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function createReturn(req, res) {
  try {
    const { type, partyName, items, refundMethod, reason, returnDate } = req.body;

    if (!type || !["sales_return", "purchase_return"].includes(type)) {
      return res.status(400).json({ message: "Type must be sales_return or purchase_return" });
    }

    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ message: "Party name is required" });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "At least one item is required for return" });
    }

    const returnItems = [];
    let subtotal = 0;
    let taxTotal = 0;

    for (const line of items) {
      const dbItem = await Item.findById(line.item);
      if (!dbItem) {
        return res.status(404).json({ message: `Item not found: ${line.name || line.item}` });
      }

      const qty = Number(line.quantity || 1);
      const unitPrice = Number(line.unitPrice ?? (type === "sales_return" ? dbItem.salePrice : dbItem.purchasePrice));
      const taxRate = Number(line.taxRate ?? dbItem.taxRate ?? 0);
      const lineTaxable = qty * unitPrice;
      const lineTax = (lineTaxable * taxRate) / 100;
      const lineTotal = lineTaxable + lineTax;

      subtotal += lineTaxable;
      taxTotal += lineTax;

      returnItems.push({
        item: dbItem._id,
        name: dbItem.name,
        sku: dbItem.sku || "",
        quantity: qty,
        unitPrice,
        taxRate,
        lineTotal
      });

      // Update inventory stock
      if (type === "sales_return") {
        // Customer returned item to us -> add back to shelf stock
        dbItem.quantity += qty;
      } else {
        // We returned item to supplier -> deduct from stock
        dbItem.quantity = Math.max(0, dbItem.quantity - qty);
      }
      await dbItem.save();
    }

    const grandTotal = subtotal + taxTotal;
    const dateStr = new Date().toISOString().slice(2, 4);
    const count = await ReturnOrder.countDocuments({ type });
    const prefix = type === "sales_return" ? "CN" : "DN";
    const returnNumber = `${prefix}/${dateStr}/${String(count + 1).padStart(4, "0")}`;

    const returnRecord = await ReturnOrder.create({
      returnNumber,
      type,
      partyName: partyName.trim(),
      items: returnItems,
      subtotal,
      taxTotal,
      grandTotal,
      refundMethod: refundMethod || "credit_note",
      reason: reason || "Returned stock",
      returnDate: returnDate ? new Date(returnDate) : new Date()
    });

    res.status(201).json(returnRecord);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
