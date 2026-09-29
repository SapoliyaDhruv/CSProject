import { BusinessSetting } from "../models/BusinessSetting.js";
import { Item } from "../models/Item.js";
import { Sale } from "../models/Sale.js";
import { nextDocumentNumber, previewDocumentNumber, splitGst } from "../utils/invoice.js";
import { buildSaleInvoicePdf } from "../utils/invoicePdf.js";
import { buildThermalReceiptText } from "../utils/thermalReceipt.js";

function getStatus(grandTotal, paidAmount) {
  if (paidAmount >= grandTotal) {
    return "paid";
  }

  return paidAmount > 0 ? "partial" : "unpaid";
}

export async function getSales(req, res) {
  const sales = await Sale.find().sort({ createdAt: -1 }).limit(100);
  res.json(sales);
}

export async function getNextInvoiceNumber(req, res) {
  const invoiceNumber = await previewDocumentNumber("sale");
  res.json({ invoiceNumber });
}

export async function getSale(req, res) {
  const sale = await Sale.findById(req.params.id);

  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }

  res.json({
    ...sale.toObject(),
    gst: splitGst(sale.taxTotal)
  });
}

export async function downloadSalePdf(req, res) {
  const sale = await Sale.findById(req.params.id);

  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }

  try {
    const pdfBuffer = await buildSaleInvoicePdf(sale);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sale.invoiceNumber.replace(/\//g, "-")}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getSaleThermalReceipt(req, res) {
  const sale = await Sale.findById(req.params.id);

  if (!sale) {
    return res.status(404).json({ message: "Sale not found" });
  }

  const settings = (await BusinessSetting.findOne()) || {};
  const is80 = req.query.width === "80";
  const width = is80 ? 48 : 32;
  const receiptText = buildThermalReceiptText(sale, settings, width);

  res.json({
    receiptText,
    paperWidth: is80 ? "80mm" : "58mm",
    sale,
    settings
  });
}

export async function createSale(req, res) {
  try {
    const saleItems = [];
    let subtotal = 0;
    let taxTotal = 0;

    for (const line of req.body.items || []) {
      const item = await Item.findById(line.item);

      if (!item) {
        return res.status(404).json({ message: "Sale item not found" });
      }

      if (item.quantity < Number(line.quantity)) {
        return res
          .status(400)
          .json({ message: `${item.name} does not have enough stock` });
      }

      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice ?? item.salePrice);
      const discount = Number(line.discount || 0);
      const taxRate = Number(line.taxRate ?? item.taxRate);
      const taxableAmount = Math.max(quantity * unitPrice - discount, 0);
      const taxAmount = (taxableAmount * taxRate) / 100;

      subtotal += taxableAmount;
      taxTotal += taxAmount;

      saleItems.push({
        item: item._id,
        name: item.name,
        sku: item.sku,
        quantity,
        unitPrice,
        discount,
        taxRate,
        lineTotal: taxableAmount + taxAmount
      });

      item.quantity -= quantity;
      await item.save();
    }

    if (!saleItems.length) {
      return res.status(400).json({ message: "Add at least one sale item" });
    }

    const grandTotal = subtotal + taxTotal;
    const paidAmount = Number(req.body.paidAmount || 0);
    const invoiceNumber =
      req.body.invoiceNumber || (await nextDocumentNumber("sale"));
    const sale = await Sale.create({
      invoiceNumber,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone || "",
      paymentMethod: req.body.paymentMethod || "cash",
      items: saleItems,
      subtotal,
      taxTotal,
      grandTotal,
      paidAmount,
      dueAmount: Math.max(grandTotal - paidAmount, 0),
      status: getStatus(grandTotal, paidAmount)
    });

    res.status(201).json({
      ...sale.toObject(),
      gst: splitGst(sale.taxTotal)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
