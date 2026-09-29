import crypto from "crypto";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "staff"],
      default: "staff"
    }
  },
  { timestamps: true }
);

userSchema.methods.verifyPassword = function verifyPassword(password) {
  return this.passwordHash === hashPassword(password);
};

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export const User = mongoose.model("User", userSchema);
