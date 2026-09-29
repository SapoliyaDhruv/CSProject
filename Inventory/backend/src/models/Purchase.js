import mongoose from "mongoose";

const purchaseLineSchema = new mongoose.Schema(
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
    unitCost: {
      type: Number,
      required: true,
      min: 0
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

const purchaseSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true
    },
    supplierName: {
      type: String,
      required: true,
      trim: true
    },
    items: [purchaseLineSchema],
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

export const Purchase = mongoose.model("Purchase", purchaseSchema);
