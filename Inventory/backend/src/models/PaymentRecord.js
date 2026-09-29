import mongoose from "mongoose";

const paymentRecordSchema = new mongoose.Schema(
  {
    voucherNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    partyName: {
      type: String,
      required: true,
      trim: true
    },
    partyType: {
      type: String,
      enum: ["customer", "supplier"],
      default: "customer"
    },
    type: {
      type: String,
      enum: ["payment_in", "payment_out"],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "bank", "cheque"],
      default: "cash"
    },
    referenceNote: {
      type: String,
      trim: true,
      default: ""
    },
    paymentDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const PaymentRecord = mongoose.model("PaymentRecord", paymentRecordSchema);
