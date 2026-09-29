import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    sku: {
      type: String,
      default: ""
    },
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
    taxRate: {
      type: Number,
      default: 0
    },
    lineTotal: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const returnOrderSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    type: {
      type: String,
      enum: ["sales_return", "purchase_return"],
      required: true
    },
    partyName: {
      type: String,
      required: true,
      trim: true
    },
    items: {
      type: [returnItemSchema],
      default: []
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0
    },
    taxTotal: {
      type: Number,
      required: true,
      default: 0
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0
    },
    refundMethod: {
      type: String,
      enum: ["credit_note", "cash_refund", "upi_refund", "cash", "upi", "bank", "ledger_credit"],
      default: "cash"
    },
    reason: {
      type: String,
      trim: true,
      default: "Customer return / Damaged"
    },
    returnDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const ReturnOrder = mongoose.model("ReturnOrder", returnOrderSchema);
