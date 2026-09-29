import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: "Food"
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    barcode: {
      type: String,
      trim: true
    },
    unit: {
      type: String,
      enum: ["kg", "g", "ltr", "ml", "pcs", "box"],
      default: "pcs"
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    lowStockLevel: {
      type: Number,
      min: 0,
      default: 5
    },
    purchasePrice: {
      type: Number,
      min: 0,
      default: 0
    },
    salePrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    price: {
      type: Number,
      min: 0,
      default: 0
    },
    taxRate: {
      type: Number,
      min: 0,
      default: 5
    },
    supplierName: {
      type: String,
      trim: true
    },
    batchNumber: {
      type: String,
      trim: true
    },
    manufacturingDate: {
      type: Date
    },
    expiryDate: {
      type: Date
    },
    storageLocation: {
      type: String,
      trim: true,
      default: "Main Store"
    },
    isColdStorage: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

itemSchema.pre("validate", function syncLegacyPrice() {
  if (!this.salePrice && this.price) {
    this.salePrice = this.price;
  }

  if (!this.price && this.salePrice) {
    this.price = this.salePrice;
  }
});

export const Item = mongoose.model("Item", itemSchema);
