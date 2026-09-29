import mongoose from "mongoose";

const partySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ["customer", "supplier"],
      required: true
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
    openingBalance: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export const Party = mongoose.model("Party", partySchema);
