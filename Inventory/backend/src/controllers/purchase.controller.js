import { Item } from "../models/Item.js";
import { Purchase } from "../models/Purchase.js";
import { nextDocumentNumber, previewDocumentNumber, splitGst } from "../utils/invoice.js";

function getStatus(grandTotal, paidAmount) {
  if (paidAmount >= grandTotal) {
    return "paid";
  }

  return paidAmount > 0 ? "partial" : "unpaid";
}

export async function getPurchases(req, res) {
  const purchases = await Purchase.find().sort({ createdAt: -1 }).limit(100);
  res.json(purchases);
}

export async function getNextBillNumber(req, res) {
  const billNumber = await previewDocumentNumber("purchase");
  res.json({ billNumber });
}

export async function createPurchase(req, res) {
  try {
    const purchaseItems = [];
    let subtotal = 0;
    let taxTotal = 0;

    for (const line of req.body.items || []) {
      const item = await Item.findById(line.item);

      if (!item) {
        return res.status(404).json({ message: "Purchase item not found" });
      }

      const quantity = Number(line.quantity);
      const unitCost = Number(line.unitCost ?? item.purchasePrice);
      const taxRate = Number(line.taxRate ?? item.taxRate);
      const taxableAmount = quantity * unitCost;
      const taxAmount = (taxableAmount * taxRate) / 100;

      subtotal += taxableAmount;
      taxTotal += taxAmount;

      purchaseItems.push({
        item: item._id,
        name: item.name,
        sku: item.sku,
        quantity,
        unitCost,
        taxRate,
        lineTotal: taxableAmount + taxAmount
      });

      item.quantity += quantity;
      item.purchasePrice = unitCost;
      await item.save();
    }

    if (!purchaseItems.length) {
      return res.status(400).json({ message: "Add at least one purchase item" });
    }

    const grandTotal = subtotal + taxTotal;
    const paidAmount = Number(req.body.paidAmount || 0);
    const billNumber =
      req.body.billNumber || (await nextDocumentNumber("purchase"));
    const purchase = await Purchase.create({
      billNumber,
      supplierName: req.body.supplierName,
      items: purchaseItems,
      subtotal,
      taxTotal,
      grandTotal,
      paidAmount,
      dueAmount: Math.max(grandTotal - paidAmount, 0),
      status: getStatus(grandTotal, paidAmount)
    });

    res.status(201).json({
      ...purchase.toObject(),
      gst: splitGst(purchase.taxTotal)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
