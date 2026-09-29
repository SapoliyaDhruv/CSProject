import mongoose from "mongoose";

const businessSettingSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      trim: true,
      default: "Inventory Food Business"
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    gstNumber: {
      type: String,
      uppercase: true,
      trim: true
    },
    upiId: {
      type: String,
      trim: true
    },
    invoicePrefix: {
      type: String,
      uppercase: true,
      trim: true,
      default: "SALE"
    },
    purchasePrefix: {
      type: String,
      uppercase: true,
      trim: true,
      default: "PUR"
    },
    lowStockDefault: {
      type: Number,
      min: 0,
      default: 5
    },
    expiryAlertDays: {
      type: Number,
      min: 1,
      default: 7
    },
    lastSaleInvoiceNumber: {
      type: Number,
      min: 0,
      default: 0
    },
    lastPurchaseBillNumber: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  { timestamps: true }
);

export const BusinessSetting = mongoose.model(
  "BusinessSetting",
  businessSettingSchema
);
