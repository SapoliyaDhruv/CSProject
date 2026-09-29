import { BusinessSetting } from "../models/BusinessSetting.js";
import { Item } from "../models/Item.js";
import { StoreOrder } from "../models/StoreOrder.js";

function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${rand}`;
}

export async function getStoreCatalog(req, res) {
  try {
    const [settings, items] = await Promise.all([
      BusinessSetting.findOne(),
      Item.find({ active: { $ne: false } }).sort({ category: 1, name: 1 })
    ]);

    const storeInfo = {
      businessName: settings?.businessName || "Inventory Online Store",
      phone: settings?.phone || "",
      address: settings?.address || "",
      gstNumber: settings?.gstNumber || "",
      upiId: settings?.upiId || ""
    };

    const categories = Array.from(new Set(items.map((i) => i.category || "General")));

    const catalogItems = items.map((item) => ({
      _id: item._id,
      name: item.name,
      category: item.category,
      unit: item.unit || "pcs",
      salePrice: item.salePrice,
      isColdStorage: item.isColdStorage,
      inStock: (item.quantity || 0) > 0,
      stockQuantity: item.quantity || 0,
      batchNumber: item.batchNumber || "",
      expiryDate: item.expiryDate || null
    }));

    res.json({
      store: storeInfo,
      categories,
      items: catalogItems
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function createStoreOrder(req, res) {
  try {
    const { customerName, customerPhone, deliveryAddress, notes, items } = req.body;

    if (!customerName || !customerPhone) {
      return res.status(400).json({ message: "Customer name and phone are required" });
    }

    if (!items || !items.length) {
      return res.status(400).json({ message: "Order must contain at least one item" });
    }

    let totalAmount = 0;
    const validatedItems = [];

    for (const line of items) {
      const dbItem = await Item.findById(line.item || line._id);
      if (!dbItem) continue;

      const qty = Math.max(1, Number(line.quantity || 1));
      const price = Number(dbItem.salePrice || 0);
      const lineTotal = qty * price;

      totalAmount += lineTotal;
      validatedItems.push({
        item: dbItem._id,
        name: dbItem.name,
        quantity: qty,
        unitPrice: price,
        lineTotal
      });
    }

    if (!validatedItems.length) {
      return res.status(400).json({ message: "No valid items selected for order" });
    }

    const orderNumber = generateOrderNumber();
    const order = await StoreOrder.create({
      orderNumber,
      customerName,
      customerPhone,
      deliveryAddress: deliveryAddress || "",
      notes: notes || "",
      items: validatedItems,
      totalAmount,
      status: "pending"
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function getStoreOrders(req, res) {
  try {
    const orders = await StoreOrder.find().sort({ createdAt: -1 }).limit(100);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateStoreOrderStatus(req, res) {
  try {
    const { status } = req.body;
    const order = await StoreOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
