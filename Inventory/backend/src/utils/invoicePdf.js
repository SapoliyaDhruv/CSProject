import PDFDocument from "pdfkit";
import { BusinessSetting } from "../models/BusinessSetting.js";
import { splitGst } from "./invoice.js";

function formatMoney(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

export async function buildSaleInvoicePdf(sale) {
  const settings = (await BusinessSetting.findOne()) || {};
  const gst = splitGst(sale.taxTotal);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(settings.businessName || "Inventory Food Business", {
      align: "center"
    });
    doc.moveDown(0.3);
    doc.fontSize(10).text(settings.address || "", { align: "center" });
    if (settings.phone) {
      doc.text(`Phone: ${settings.phone}`, { align: "center" });
    }
    if (settings.gstNumber) {
      doc.text(`GSTIN: ${settings.gstNumber}`, { align: "center" });
    }

    doc.moveDown();
    doc.fontSize(14).text("TAX INVOICE", { align: "center" });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Invoice No: ${sale.invoiceNumber}`);
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleDateString("en-IN")}`);
    doc.text(`Customer: ${sale.customerName}`);
    doc.text(`Payment: ${sale.paymentMethod}`);
    doc.text(`Status: ${sale.status}`);
    doc.moveDown();

    doc.text("Item", 40, doc.y, { continued: true, width: 180 });
    doc.text("Qty", { continued: true, width: 40 });
    doc.text("Rate", { continued: true, width: 60 });
    doc.text("Tax%", { continued: true, width: 40 });
    doc.text("Amount", { width: 80 });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);

    for (const line of sale.items || []) {
      const y = doc.y;
      doc.text(line.name, 40, y, { width: 180 });
      doc.text(String(line.quantity), 220, y, { width: 40 });
      doc.text(formatMoney(line.unitPrice), 260, y, { width: 60 });
      doc.text(`${line.taxRate}%`, 320, y, { width: 40 });
      doc.text(formatMoney(line.lineTotal), 360, y, { width: 100 });
      doc.moveDown();
    }

    doc.moveDown();
    doc.text(`Subtotal: ${formatMoney(sale.subtotal)}`, { align: "right" });
    doc.text(`CGST: ${formatMoney(gst.cgst)}`, { align: "right" });
    doc.text(`SGST: ${formatMoney(gst.sgst)}`, { align: "right" });
    doc.text(`Tax total: ${formatMoney(sale.taxTotal)}`, { align: "right" });
    doc.fontSize(12).text(`Grand total: ${formatMoney(sale.grandTotal)}`, {
      align: "right"
    });
    doc.fontSize(10);
    doc.text(`Paid: ${formatMoney(sale.paidAmount)}`, { align: "right" });
    doc.text(`Due: ${formatMoney(sale.dueAmount)}`, { align: "right" });

    if (settings.upiId) {
      doc.moveDown();
      doc.text(`UPI: ${settings.upiId}`);
    }

    doc.end();
  });
}
