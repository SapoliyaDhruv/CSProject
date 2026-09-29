import { splitGst } from "./invoice.js";

function center(text = "", width = 32) {
  const str = String(text).trim();
  if (str.length >= width) return str.slice(0, width);
  const leftPad = Math.floor((width - str.length) / 2);
  const rightPad = width - str.length - leftPad;
  return " ".repeat(leftPad) + str + " ".repeat(rightPad);
}

function lineBetween(left = "", right = "", width = 32) {
  const l = String(left).trim();
  const r = String(right).trim();
  const total = l.length + r.length;
  if (total >= width) {
    const available = width - r.length - 1;
    return l.slice(0, Math.max(0, available)) + " " + r;
  }
  return l + " ".repeat(width - total) + r;
}

export function buildThermalReceiptText(sale, settings = {}, width = 32) {
  const divider = "-".repeat(width);
  const doubleDivider = "=".repeat(width);
  const gst = splitGst(sale.taxTotal);

  const lines = [];

  // Header
  lines.push(center(settings.businessName || "INVENTORY FOOD STORE", width));
  if (settings.address) {
    lines.push(center(settings.address, width));
  }
  if (settings.phone) {
    lines.push(center(`Phone: ${settings.phone}`, width));
  }
  if (settings.gstNumber) {
    lines.push(center(`GSTIN: ${settings.gstNumber}`, width));
  }
  lines.push(doubleDivider);

  // Invoice Meta
  lines.push(lineBetween("INVOICE NO:", sale.invoiceNumber, width));
  lines.push(
    lineBetween(
      "DATE:",
      new Date(sale.createdAt || Date.now()).toLocaleDateString("en-IN"),
      width
    )
  );
  lines.push(lineBetween("CUSTOMER:", sale.customerName || "Walk-in", width));
  if (sale.customerPhone) {
    lines.push(lineBetween("PHONE:", sale.customerPhone, width));
  }
  lines.push(lineBetween("PAYMENT:", String(sale.paymentMethod || "CASH").toUpperCase(), width));
  lines.push(divider);

  // Table Header
  lines.push(lineBetween("ITEM", "QTY x RATE   TOTAL", width));
  lines.push(divider);

  // Items
  for (const item of sale.items || []) {
    lines.push(item.name.slice(0, width));
    const qtyRate = `${item.quantity} x Rs.${Number(item.unitPrice).toFixed(2)}`;
    const lineTot = `Rs.${Number(item.lineTotal).toFixed(2)}`;
    lines.push(lineBetween(`  ${qtyRate}`, lineTot, width));
  }

  lines.push(divider);

  // Totals
  lines.push(lineBetween("Subtotal:", `Rs.${Number(sale.subtotal).toFixed(2)}`, width));
  if (gst.cgst > 0) {
    lines.push(lineBetween("CGST:", `Rs.${Number(gst.cgst).toFixed(2)}`, width));
    lines.push(lineBetween("SGST:", `Rs.${Number(gst.sgst).toFixed(2)}`, width));
  }
  lines.push(doubleDivider);
  lines.push(lineBetween("GRAND TOTAL:", `Rs.${Number(sale.grandTotal).toFixed(2)}`, width));
  lines.push(doubleDivider);
  lines.push(lineBetween("Paid Amount:", `Rs.${Number(sale.paidAmount || 0).toFixed(2)}`, width));
  if (Number(sale.dueAmount) > 0) {
    lines.push(lineBetween("DUE AMOUNT:", `Rs.${Number(sale.dueAmount).toFixed(2)}`, width));
  }

  // Footer / UPI
  if (settings.upiId) {
    lines.push(divider);
    lines.push(center(`UPI ID: ${settings.upiId}`, width));
  }
  lines.push(divider);
  lines.push(center("THANK YOU! VISIT AGAIN", width));
  lines.push("");

  return lines.join("\n");
}
