import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: "General"
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "bank", "credit"],
      default: "cash"
    },
    note: {
      type: String,
      trim: true
    },
    expenseDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const Expense = mongoose.model("Expense", expenseSchema);
