import { Item } from "../models/Item.js";

export async function getItems(req, res) {
  const filter = {};

  if (req.query.alert === "low-stock") {
    filter.$expr = { $lte: ["$quantity", "$lowStockLevel"] };
  }

  const items = await Item.find(filter).sort({ createdAt: -1 });
  res.json(items);
}

export async function createItem(req, res) {
  try {
    const payload = {
      ...req.body,
      price: req.body.salePrice ?? req.body.price
    };
    const item = await Item.create(payload);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function updateItem(req, res) {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function deleteItem(req, res) {
  const item = await Item.findByIdAndDelete(req.params.id);

  if (!item) {
    return res.status(404).json({ message: "Item not found" });
  }

  res.json({ message: "Item deleted" });
}

export async function getItemByBarcode(req, res) {
  const code = String(req.params.code || "").trim();

  if (!code) {
    return res.status(400).json({ message: "Barcode is required" });
  }

  const item = await Item.findOne({
    $or: [{ barcode: code }, { sku: code.toUpperCase() }]
  });

  if (!item) {
    return res.status(404).json({ message: "No item found for this barcode" });
  }

  res.json(item);
}
