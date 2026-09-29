import { Party } from "../models/Party.js";
import { PaymentRecord } from "../models/PaymentRecord.js";
import { Purchase } from "../models/Purchase.js";
import { Sale } from "../models/Sale.js";

export async function getPayments(req, res) {
  try {
    const filter = {};
    if (req.query.partyName) {
      filter.partyName = req.query.partyName;
    }
    if (req.query.type) {
      filter.type = req.query.type;
    }
    const payments = await PaymentRecord.find(filter).sort({ paymentDate: -1, createdAt: -1 }).limit(100);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function createPayment(req, res) {
  try {
    const { partyName, partyType, type, amount, paymentMethod, referenceNote, paymentDate } = req.body;

    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ message: "Party name is required" });
    }

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ message: "Valid payment amount is required" });
    }

    if (!type || !["payment_in", "payment_out"].includes(type)) {
      return res.status(400).json({ message: "Type must be payment_in or payment_out" });
    }

    const dateStr = new Date().toISOString().slice(2, 4);
    const count = await PaymentRecord.countDocuments();
    const prefix = type === "payment_in" ? "REC" : "PAY";
    const voucherNumber = `${prefix}/${dateStr}/${String(count + 1).padStart(4, "0")}`;

    let remaining = payAmount;

    // Settle against pending invoices if payment_in (customer paying us)
    if (type === "payment_in") {
      const dueSales = await Sale.find({
        customerName: partyName.trim(),
        dueAmount: { $gt: 0 }
      }).sort({ createdAt: 1 });

      for (const sale of dueSales) {
        if (remaining <= 0) break;
        const alloc = Math.min(remaining, Number(sale.dueAmount || 0));
        sale.paidAmount = Number(sale.paidAmount || 0) + alloc;
        sale.dueAmount = Math.max(0, Number(sale.grandTotal || 0) - sale.paidAmount);
        sale.status = sale.dueAmount <= 0 ? "paid" : "partial";
        await sale.save();
        remaining -= alloc;
      }
    }

    // Settle against pending purchase bills if payment_out (we paying supplier)
    if (type === "payment_out") {
      const duePurchases = await Purchase.find({
        supplierName: partyName.trim(),
        dueAmount: { $gt: 0 }
      }).sort({ createdAt: 1 });

      for (const purchase of duePurchases) {
        if (remaining <= 0) break;
        const alloc = Math.min(remaining, Number(purchase.dueAmount || 0));
        purchase.paidAmount = Number(purchase.paidAmount || 0) + alloc;
        purchase.dueAmount = Math.max(0, Number(purchase.grandTotal || 0) - purchase.paidAmount);
        purchase.status = purchase.dueAmount <= 0 ? "paid" : "partial";
        await purchase.save();
        remaining -= alloc;
      }
    }

    const payment = await PaymentRecord.create({
      voucherNumber,
      partyName: partyName.trim(),
      partyType: partyType || (type === "payment_in" ? "customer" : "supplier"),
      type,
      amount: payAmount,
      paymentMethod: paymentMethod || "cash",
      referenceNote: referenceNote || "",
      paymentDate: paymentDate ? new Date(paymentDate) : new Date()
    });

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
