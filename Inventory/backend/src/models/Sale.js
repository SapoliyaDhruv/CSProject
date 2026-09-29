import mongoose from "mongoose";

const saleLineSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },
    name: String,
    sku: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      min: 0,
      default: 0
    },
    taxRate: {
      type: Number,
      min: 0,
      default: 0
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true
    },
    customerName: {
      type: String,
      required: true,
      trim: true
    },
    customerPhone: {
      type: String,
      trim: true,
      default: ""
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "bank", "credit"],
      default: "cash"
    },
    items: [saleLineSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    taxTotal: {
      type: Number,
      required: true,
      min: 0
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0
    },
    paidAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    dueAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    status: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "unpaid"
    }
  },
  { timestamps: true }
);

export const Sale = mongoose.model("Sale", saleSchema);
