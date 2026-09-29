import dotenv from "dotenv";
import mongoose from "mongoose";
import { User, hashPassword } from "../models/User.js";
import { Item } from "../models/Item.js";
import { Party } from "../models/Party.js";
import { Sale } from "../models/Sale.js";
import { Purchase } from "../models/Purchase.js";
import { PaymentRecord } from "../models/PaymentRecord.js";
import { Expense } from "../models/Expense.js";
import { ReturnOrder } from "../models/ReturnOrder.js";
import { StoreOrder } from "../models/StoreOrder.js";
import { BusinessSetting } from "../models/BusinessSetting.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/inventory";

async function seed() {
  console.log("Connecting to MongoDB for seeding:", mongoUri);
  await mongoose.connect(mongoUri);

  console.log("Clearing old collections...");
  await Promise.all([
    User.deleteMany({}),
    Item.deleteMany({}),
    Party.deleteMany({}),
    Sale.deleteMany({}),
    Purchase.deleteMany({}),
    PaymentRecord.deleteMany({}),
    Expense.deleteMany({}),
    ReturnOrder.deleteMany({}),
    StoreOrder.deleteMany({}),
    BusinessSetting.deleteMany({})
  ]);

  console.log("1. Seeding Users...");
  const adminUser = await User.create({
    name: "Dhruv Sapoliya (Owner)",
    email: "admin@freshmart.in",
    passwordHash: hashPassword("admin123"),
    role: "admin"
  });

  const staffUser = await User.create({
    name: "Ramesh Kumar (Store Cashier)",
    email: "staff@freshmart.in",
    passwordHash: hashPassword("staff123"),
    role: "staff"
  });

  console.log("2. Seeding Business Settings...");
  await BusinessSetting.create({
    businessName: "FreshMart Supermarket & Dairy",
    gstin: "24AAACG1234F1Z5",
    address: "Shop 12-14, Green Avenue, SG Highway, Ahmedabad, Gujarat - 380054",
    phone: "+91 98765 43210",
    email: "contact@freshmart.in",
    upiId: "freshmart@upi",
    invoicePrefix: "FM-INV",
    currentYearSeq: 1024
  });

  console.log("3. Seeding Catalog & Stock Items...");
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000); // Near expiry demo
  const sixMonths = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  const rawItems = [
    {
      name: "Amul Taaza Homogenised Toned Milk 500ml",
      category: "Dairy",
      sku: "AMUL-TZ-500",
      barcode: "8901262010053",
      unit: "pcs",
      quantity: 48,
      lowStockLevel: 10,
      purchasePrice: 24,
      salePrice: 27,
      taxRate: 0,
      supplierName: "Amul Dairy Distributors Ltd",
      batchNumber: "B-2601",
      manufacturingDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      expiryDate: nextWeek,
      storageLocation: "Chiller-1",
      isColdStorage: true,
      active: true
    },
    {
      name: "Amul Pasteurised Salted Butter 500g",
      category: "Dairy",
      sku: "AMUL-BT-500",
      barcode: "8901262010114",
      unit: "pcs",
      quantity: 26,
      lowStockLevel: 8,
      purchasePrice: 240,
      salePrice: 275,
      taxRate: 12,
      supplierName: "Amul Dairy Distributors Ltd",
      batchNumber: "B-2608",
      manufacturingDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      expiryDate: sixMonths,
      storageLocation: "Chiller-2",
      isColdStorage: true,
      active: true
    },
    {
      name: "Fresh Malai Paneer Block 200g",
      category: "Dairy",
      sku: "PAN-200",
      barcode: "8901262010251",
      unit: "pcs",
      quantity: 18,
      lowStockLevel: 6,
      purchasePrice: 75,
      salePrice: 95,
      taxRate: 0,
      supplierName: "Amul Dairy Distributors Ltd",
      batchNumber: "PAN-99",
      manufacturingDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      expiryDate: nextWeek,
      storageLocation: "Chiller-1",
      isColdStorage: true,
      active: true
    },
    {
      name: "Britannia 100% Whole Wheat Brown Bread 400g",
      category: "Bakery",
      sku: "BRT-BREAD-400",
      barcode: "8901063102111",
      unit: "pcs",
      quantity: 15,
      lowStockLevel: 5,
      purchasePrice: 40,
      salePrice: 50,
      taxRate: 5,
      supplierName: "Britannia Regional Depot",
      batchNumber: "BRD-04",
      manufacturingDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      storageLocation: "Bakery Rack A",
      isColdStorage: false,
      active: true
    },
    {
      name: "Epigamia Greek Yogurt Blueberry 100g",
      category: "Dairy",
      sku: "EPI-YGT-100",
      barcode: "8906070430022",
      unit: "pcs",
      quantity: 3, // Low stock demo!
      lowStockLevel: 8,
      purchasePrice: 48,
      salePrice: 60,
      taxRate: 5,
      supplierName: "Amul Dairy Distributors Ltd",
      batchNumber: "EPI-11",
      manufacturingDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      expiryDate: nextMonth,
      storageLocation: "Chiller-3",
      isColdStorage: true,
      active: true
    },
    {
      name: "Mother Dairy Pure Cow Ghee 1L Jar",
      category: "Dairy",
      sku: "MD-GHEE-1L",
      barcode: "8901648001026",
      unit: "pcs",
      quantity: 20,
      lowStockLevel: 5,
      purchasePrice: 580,
      salePrice: 680,
      taxRate: 12,
      supplierName: "Amul Dairy Distributors Ltd",
      batchNumber: "GHEE-44",
      manufacturingDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000),
      storageLocation: "Shelf Ghee-1",
      isColdStorage: false,
      active: true
    },
    {
      name: "McCains Smiles Crispy Potato Snacks 400g",
      category: "Frozen",
      sku: "MCC-SMILE-400",
      barcode: "8906001020011",
      unit: "pcs",
      quantity: 24,
      lowStockLevel: 6,
      purchasePrice: 115,
      salePrice: 150,
      taxRate: 12,
      supplierName: "Amul Dairy Distributors Ltd",
      batchNumber: "MCC-81",
      manufacturingDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      expiryDate: sixMonths,
      storageLocation: "Deep Freezer -18C",
      isColdStorage: true,
      active: true
    },
    {
      name: "Kissan Mixed Fruit Jam Jar 500g",
      category: "Grocery",
      sku: "KIS-JAM-500",
      barcode: "8901030382218",
      unit: "pcs",
      quantity: 22,
      lowStockLevel: 6,
      purchasePrice: 145,
      salePrice: 180,
      taxRate: 12,
      supplierName: "Hindustan Unilever C&F",
      batchNumber: "JAM-09",
      manufacturingDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      expiryDate: sixMonths,
      storageLocation: "Aisle 2 - Spreads",
      isColdStorage: false,
      active: true
    },
    {
      name: "Tata Tea Gold Premium Blend 500g",
      category: "Beverages",
      sku: "TATA-TEA-500",
      barcode: "8901052002134",
      unit: "pcs",
      quantity: 30,
      lowStockLevel: 10,
      purchasePrice: 260,
      salePrice: 310,
      taxRate: 5,
      supplierName: "Hindustan Unilever C&F",
      batchNumber: "TTG-102",
      manufacturingDate: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      expiryDate: sixMonths,
      storageLocation: "Aisle 1 - Beverages",
      isColdStorage: false,
      active: true
    },
    {
      name: "Nescafe Classic Instant Coffee Jar 100g",
      category: "Beverages",
      sku: "NES-COF-100",
      barcode: "8901058852788",
      unit: "pcs",
      quantity: 18,
      lowStockLevel: 5,
      purchasePrice: 175,
      salePrice: 215,
      taxRate: 18,
      supplierName: "Hindustan Unilever C&F",
      batchNumber: "NES-50",
      manufacturingDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      expiryDate: sixMonths,
      storageLocation: "Aisle 1 - Beverages",
      isColdStorage: false,
      active: true
    },
    {
      name: "Tropicana 100% Orange Fruit Juice 1L",
      category: "Beverages",
      sku: "TROP-OJ-1L",
      barcode: "8902080001019",
      unit: "pcs",
      quantity: 2, // Low stock demo!
      lowStockLevel: 6,
      purchasePrice: 115,
      salePrice: 145,
      taxRate: 12,
      supplierName: "Hindustan Unilever C&F",
      batchNumber: "TROP-92",
      manufacturingDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      expiryDate: nextMonth,
      storageLocation: "Chiller-2",
      isColdStorage: true,
      active: true
    },
    {
      name: "Haldiram's Nagpur Aloo Bhujia 400g",
      category: "Snacks",
      sku: "HALD-BHUJ-400",
      barcode: "8904063200112",
      unit: "pcs",
      quantity: 36,
      lowStockLevel: 8,
      purchasePrice: 95,
      salePrice: 120,
      taxRate: 12,
      supplierName: "Britannia Regional Depot",
      batchNumber: "HAL-33",
      manufacturingDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      expiryDate: sixMonths,
      storageLocation: "Aisle 3 - Namkeen",
      isColdStorage: false,
      active: true
    },
    {
      name: "Lay's Classic Salted Potato Chips 50g",
      category: "Snacks",
      sku: "LAYS-SALT-50",
      barcode: "8901491101882",
      unit: "pcs",
      quantity: 50,
      lowStockLevel: 15,
      purchasePrice: 15,
      salePrice: 20,
      taxRate: 12,
      supplierName: "Britannia Regional Depot",
      batchNumber: "LAY-88",
      manufacturingDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      expiryDate: nextMonth,
      storageLocation: "Snack Counter Front",
      isColdStorage: false,
      active: true
    },
    {
      name: "Fortune Sunlite Refined Sunflower Oil 1L",
      category: "Grocery",
      sku: "FORT-OIL-1L",
      barcode: "8906007280017",
      unit: "pcs",
      quantity: 40,
      lowStockLevel: 10,
      purchasePrice: 125,
      salePrice: 145,
      taxRate: 5,
      supplierName: "Hindustan Unilever C&F",
      batchNumber: "FORT-02",
      manufacturingDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000),
      storageLocation: "Aisle 4 - Oils",
      isColdStorage: false,
      active: true
    },
    {
      name: "Kellogg's Corn Flakes Original 500g",
      category: "Grocery",
      sku: "KEL-CORN-500",
      barcode: "8901499008206",
      unit: "pcs",
      quantity: 24,
      lowStockLevel: 6,
      purchasePrice: 160,
      salePrice: 199,
      taxRate: 12,
      supplierName: "Hindustan Unilever C&F",
      batchNumber: "KEL-19",
      manufacturingDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      expiryDate: sixMonths,
      storageLocation: "Aisle 2 - Cereals",
      isColdStorage: false,
      active: true
    },
    {
      name: "Cadbury Dairy Milk Silk Chocolate Bar 150g",
      category: "Bakery",
      sku: "CAD-SILK-150",
      barcode: "7622201438012",
      unit: "pcs",
      quantity: 28,
      lowStockLevel: 8,
      purchasePrice: 140,
      salePrice: 180,
      taxRate: 18,
      supplierName: "Britannia Regional Depot",
      batchNumber: "CAD-55",
      manufacturingDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      expiryDate: sixMonths,
      storageLocation: "Candy Rack Front",
      isColdStorage: true,
      active: true
    }
  ];

  const createdItems = await Item.insertMany(rawItems);
  console.log(`Inserted ${createdItems.length} products with stock, barcodes, and batches.`);

  console.log("4. Seeding Customer & Supplier Parties...");
  const rawParties = [
    {
      name: "Rahul Sharma",
      type: "customer",
      phone: "+91 98251 01122",
      email: "rahul.sharma@gmail.com",
      address: "A-302, Sunrise Heights, SG Highway, Ahmedabad",
      openingBalance: 1200 // Pending due for reminder demo!
    },
    {
      name: "Priya Patel",
      type: "customer",
      phone: "+91 98980 12345",
      email: "priya.patel@outlook.com",
      address: "14, Shivalik Villa, Bodakdev, Ahmedabad",
      openingBalance: 450
    },
    {
      name: "Anand Bakery & Cafe",
      type: "customer",
      phone: "+91 97123 45678",
      email: "orders@anandcafe.in",
      address: "CG Road, Navrangpura, Ahmedabad",
      openingBalance: 3800 // High volume B2B customer due!
    },
    {
      name: "Sneha Joshi",
      type: "customer",
      phone: "+91 98791 00223",
      email: "sneha.j@gmail.com",
      address: "204, Orchid Pride, Prahlad Nagar, Ahmedabad",
      openingBalance: 0
    },
    {
      name: "Walk-in Customer",
      type: "customer",
      phone: "+91 99999 88888",
      email: "walkin@store.in",
      address: "Store Walk-in",
      openingBalance: 0
    },
    {
      name: "Amul Dairy Distributors Ltd",
      type: "supplier",
      phone: "079-26541122",
      email: "supply@amuldairy.com",
      address: "Amul Central Logistics Depot, Anand Road, Gujarat",
      openingBalance: 18500
    },
    {
      name: "Britannia Regional Depot",
      type: "supplier",
      phone: "079-22114455",
      email: "orders@britannia.co.in",
      address: "Phase II, Naroda Industrial Estate, Ahmedabad",
      openingBalance: 8200
    },
    {
      name: "Hindustan Unilever C&F",
      type: "supplier",
      phone: "079-26889900",
      email: "distributor@hul.com",
      address: "Changodar Logistics Park, Ahmedabad",
      openingBalance: 12400
    }
  ];

  const createdParties = await Party.insertMany(rawParties);
  console.log(`Inserted ${createdParties.length} parties (customers & suppliers).`);

  console.log("5. Seeding Purchases from Suppliers...");
  const butterItem = createdItems.find((i) => i.sku === "AMUL-BT-500");
  const milkItem = createdItems.find((i) => i.sku === "AMUL-TZ-500");
  const teaItem = createdItems.find((i) => i.sku === "TATA-TEA-500");
  const oilItem = createdItems.find((i) => i.sku === "FORT-OIL-1L");

  const purchase1 = await Purchase.create({
    billNumber: "BILL/26/0101",
    supplierName: "Amul Dairy Distributors Ltd",
    items: [
      {
        item: milkItem._id,
        name: milkItem.name,
        sku: milkItem.sku,
        quantity: 50,
        unitCost: 24,
        taxRate: 0,
        lineTotal: 1200
      },
      {
        item: butterItem._id,
        name: butterItem.name,
        sku: butterItem.sku,
        quantity: 30,
        unitCost: 240,
        taxRate: 12,
        lineTotal: 7200
      }
    ],
    subtotal: 8400,
    taxTotal: 864,
    grandTotal: 9264,
    paidAmount: 9264,
    dueAmount: 0,
    paymentMethod: "bank",
    status: "paid"
  });

  const purchase2 = await Purchase.create({
    billNumber: "BILL/26/0102",
    supplierName: "Hindustan Unilever C&F",
    items: [
      {
        item: teaItem._id,
        name: teaItem.name,
        sku: teaItem.sku,
        quantity: 20,
        unitCost: 260,
        taxRate: 5,
        lineTotal: 5200
      },
      {
        item: oilItem._id,
        name: oilItem.name,
        sku: oilItem.sku,
        quantity: 30,
        unitCost: 125,
        taxRate: 5,
        lineTotal: 3750
      }
    ],
    subtotal: 8950,
    taxTotal: 447.5,
    grandTotal: 9397.5,
    paidAmount: 5000,
    dueAmount: 4397.5,
    paymentMethod: "bank",
    status: "partial"
  });

  console.log("6. Seeding Sales & Invoices...");
  const paneerItem = createdItems.find((i) => i.sku === "PAN-200");
  const breadItem = createdItems.find((i) => i.sku === "BRT-BREAD-400");
  const jamItem = createdItems.find((i) => i.sku === "KIS-JAM-500");
  const chipsItem = createdItems.find((i) => i.sku === "LAYS-SALT-50");

  // Sale 1: UPI Paid Walk-in
  await Sale.create({
    invoiceNumber: "FM-INV/26/1001",
    customerName: "Walk-in Customer",
    customerPhone: "+91 99999 88888",
    paymentMethod: "upi",
    items: [
      {
        item: milkItem._id,
        name: milkItem.name,
        sku: milkItem.sku,
        quantity: 2,
        unitPrice: 27,
        discount: 0,
        taxRate: 0,
        lineTotal: 54
      },
      {
        item: butterItem._id,
        name: butterItem.name,
        sku: butterItem.sku,
        quantity: 1,
        unitPrice: 275,
        discount: 10,
        taxRate: 12,
        lineTotal: 296.8
      }
    ],
    subtotal: 319,
    taxTotal: 31.8,
    grandTotal: 350.8,
    paidAmount: 350.8,
    dueAmount: 0,
    status: "paid"
  });

  // Sale 2: Rahul Sharma (Partial cash, due balance for reminder test!)
  await Sale.create({
    invoiceNumber: "FM-INV/26/1002",
    customerName: "Rahul Sharma",
    customerPhone: "+91 98251 01122",
    paymentMethod: "cash",
    items: [
      {
        item: paneerItem._id,
        name: paneerItem.name,
        sku: paneerItem.sku,
        quantity: 3,
        unitPrice: 95,
        discount: 0,
        taxRate: 0,
        lineTotal: 285
      },
      {
        item: breadItem._id,
        name: breadItem.name,
        sku: breadItem.sku,
        quantity: 2,
        unitPrice: 50,
        discount: 0,
        taxRate: 5,
        lineTotal: 105
      },
      {
        item: jamItem._id,
        name: jamItem.name,
        sku: jamItem.sku,
        quantity: 1,
        unitPrice: 180,
        discount: 15,
        taxRate: 12,
        lineTotal: 184.8
      }
    ],
    subtotal: 550,
    taxTotal: 24.8,
    grandTotal: 574.8,
    paidAmount: 300,
    dueAmount: 274.8,
    status: "partial"
  });

  // Sale 3: Anand Bakery & Cafe (B2B Credit Sale)
  await Sale.create({
    invoiceNumber: "FM-INV/26/1003",
    customerName: "Anand Bakery & Cafe",
    customerPhone: "+91 97123 45678",
    paymentMethod: "credit",
    items: [
      {
        item: butterItem._id,
        name: butterItem.name,
        sku: butterItem.sku,
        quantity: 10,
        unitPrice: 275,
        discount: 100,
        taxRate: 12,
        lineTotal: 2968
      },
      {
        item: milkItem._id,
        name: milkItem.name,
        sku: milkItem.sku,
        quantity: 20,
        unitPrice: 27,
        discount: 0,
        taxRate: 0,
        lineTotal: 540
      }
    ],
    subtotal: 3190,
    taxTotal: 318,
    grandTotal: 3508,
    paidAmount: 1500,
    dueAmount: 2008,
    status: "partial"
  });

  // Sale 4: Priya Patel (UPI Paid)
  await Sale.create({
    invoiceNumber: "FM-INV/26/1004",
    customerName: "Priya Patel",
    customerPhone: "+91 98980 12345",
    paymentMethod: "upi",
    items: [
      {
        item: teaItem._id,
        name: teaItem.name,
        sku: teaItem.sku,
        quantity: 1,
        unitPrice: 310,
        discount: 10,
        taxRate: 5,
        lineTotal: 315
      },
      {
        item: chipsItem._id,
        name: chipsItem.name,
        sku: chipsItem.sku,
        quantity: 4,
        unitPrice: 20,
        discount: 0,
        taxRate: 12,
        lineTotal: 89.6
      }
    ],
    subtotal: 380,
    taxTotal: 24.6,
    grandTotal: 404.6,
    paidAmount: 404.6,
    dueAmount: 0,
    status: "paid"
  });

  console.log("7. Seeding Payment Vouchers (Receipts & Payments)...");
  await PaymentRecord.create({
    voucherNumber: "REC/26/0001",
    partyName: "Rahul Sharma",
    partyType: "customer",
    type: "payment_in",
    amount: 1000,
    paymentMethod: "upi",
    referenceNote: "GPay partial due settlement",
    paymentDate: new Date()
  });

  await PaymentRecord.create({
    voucherNumber: "PAY/26/0002",
    partyName: "Amul Dairy Distributors Ltd",
    partyType: "supplier",
    type: "payment_out",
    amount: 5000,
    paymentMethod: "bank",
    referenceNote: "NEFT vendor bill clearance",
    paymentDate: new Date()
  });

  console.log("8. Seeding Return Orders (Credit Note & Debit Note)...");
  await ReturnOrder.create({
    returnNumber: "CN/26/0001",
    type: "sales_return",
    partyName: "Walk-in Customer",
    items: [
      {
        item: breadItem._id,
        name: breadItem.name,
        sku: breadItem.sku,
        quantity: 1,
        unitPrice: 50,
        taxRate: 5,
        lineTotal: 52.5
      }
    ],
    subtotal: 50,
    taxTotal: 2.5,
    grandTotal: 52.5,
    refundMethod: "cash",
    reason: "Damaged packaging on purchase",
    returnDate: new Date()
  });

  await ReturnOrder.create({
    returnNumber: "DN/26/0002",
    type: "purchase_return",
    partyName: "Amul Dairy Distributors Ltd",
    items: [
      {
        item: butterItem._id,
        name: butterItem.name,
        sku: butterItem.sku,
        quantity: 2,
        unitPrice: 240,
        taxRate: 12,
        lineTotal: 537.6
      }
    ],
    subtotal: 480,
    taxTotal: 57.6,
    grandTotal: 537.6,
    refundMethod: "ledger_credit",
    reason: "Damaged outer seal received from supplier",
    returnDate: new Date()
  });

  console.log("9. Seeding Business Expenses...");
  await Expense.insertMany([
    {
      title: "Commercial Outlet Monthly Rent",
      category: "Rent",
      amount: 35000,
      paymentMethod: "bank",
      note: "October Store Rent - SG Highway Shop",
      expenseDate: new Date()
    },
    {
      title: "Torrent Power Electricity Bill",
      category: "Utilities",
      amount: 6850,
      paymentMethod: "upi",
      note: "Commercial 3-phase refrigeration unit power",
      expenseDate: new Date()
    },
    {
      title: "Eco-Friendly Biodegradable Carry Bags (1000 pcs)",
      category: "Packaging",
      amount: 1450,
      paymentMethod: "cash",
      note: "Store packaging bags stock",
      expenseDate: new Date()
    },
    {
      title: "Local Delivery Bike Fuel",
      category: "Transport",
      amount: 750,
      paymentMethod: "cash",
      note: "Customer order deliveries",
      expenseDate: new Date()
    }
  ]);

  console.log("10. Seeding Online Storefront WhatsApp Orders...");
  await StoreOrder.create({
    orderNumber: "ORD-26-8801",
    customerName: "Pooja Trivedi",
    customerPhone: "+91 98981 44556",
    deliveryAddress: "Flat 402, Iscon Platinum, Bopal, Ahmedabad",
    notes: "Please call on arrival, deliver cold milk & paneer fresh",
    items: [
      {
        item: milkItem._id,
        name: milkItem.name,
        quantity: 3,
        unitPrice: 27,
        lineTotal: 81
      },
      {
        item: paneerItem._id,
        name: paneerItem.name,
        quantity: 2,
        unitPrice: 95,
        lineTotal: 190
      },
      {
        item: butterItem._id,
        name: butterItem.name,
        quantity: 1,
        unitPrice: 275,
        lineTotal: 275
      }
    ],
    totalAmount: 546,
    status: "accepted"
  });

  await StoreOrder.create({
    orderNumber: "ORD-26-8802",
    customerName: "Vikram Desai",
    customerPhone: "+91 97240 66778",
    deliveryAddress: "Bungalow 7, Sun Villa, Thaltej, Ahmedabad",
    notes: "Leave with security guard if not answering",
    items: [
      {
        item: teaItem._id,
        name: teaItem.name,
        quantity: 2,
        unitPrice: 310,
        lineTotal: 620
      },
      {
        item: oilItem._id,
        name: oilItem.name,
        quantity: 2,
        unitPrice: 145,
        lineTotal: 290
      }
    ],
    totalAmount: 910,
    status: "pending"
  });

  console.log("\n=======================================================");
  console.log("🎉 DATABASE SEEDED WITH RICH COMMERCIAL DEMO DATA!");
  console.log("=======================================================");
  console.log("• Default Admin Login:  admin@freshmart.in / admin123");
  console.log("• Default Staff Login:  staff@freshmart.in / staff123");
  console.log("• 16 Diverse Catalog items (Milk, Butter, Paneer, Snacks, Coffee, Ghee, etc.)");
  console.log("• 8 Customer & Supplier parties with active balances");
  console.log("• Real Sales Invoices (Paid UPI, Partial with dues, B2B credit)");
  console.log("• Supplier Purchase Bills with tax credits");
  console.log("• Payment In & Out Vouchers with auto-settlement");
  console.log("• Credit & Debit Return Notes with restock");
  console.log("• Daily Business Expenses & Online Store Orders");
  console.log("=======================================================\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
