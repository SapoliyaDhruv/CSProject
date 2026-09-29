import { BusinessSetting } from "../models/BusinessSetting.js";

function financialYearLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month >= 4) {
    return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  }

  return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

export async function nextDocumentNumber(type = "sale") {
  const field =
    type === "sale" ? "lastSaleInvoiceNumber" : "lastPurchaseBillNumber";
  const settings = await BusinessSetting.findOneAndUpdate(
    {},
    { $inc: { [field]: 1 } },
    { new: true, upsert: true }
  );
  const prefix =
    type === "sale" ? settings.invoicePrefix : settings.purchasePrefix;
  const sequence =
    type === "sale"
      ? settings.lastSaleInvoiceNumber
      : settings.lastPurchaseBillNumber;

  return `${prefix}/${financialYearLabel()}/${String(sequence).padStart(4, "0")}`;
}

export async function previewDocumentNumber(type = "sale") {
  const settings = await BusinessSetting.findOne();

  if (!settings) {
    return type === "sale" ? "SALE/25-26/0001" : "PUR/25-26/0001";
  }

  const prefix =
    type === "sale" ? settings.invoicePrefix : settings.purchasePrefix;
  const sequence =
    (type === "sale"
      ? settings.lastSaleInvoiceNumber
      : settings.lastPurchaseBillNumber) + 1;

  return `${prefix}/${financialYearLabel()}/${String(sequence).padStart(4, "0")}`;
}

export function splitGst(taxTotal) {
  const tax = Number(taxTotal || 0);
  const half = tax / 2;

  return {
    cgst: half,
    sgst: half,
    igst: 0,
    taxTotal: tax
  };
}
