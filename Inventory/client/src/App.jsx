import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const sessionKey = "inventory-session";

const navGroups = [
  {
    title: "Operate",
    items: [
      { id: "dashboard", label: "Dashboard", hint: "Executive overview", icon: "🏠", shortcut: "H" },
      { id: "sales", label: "POS Billing", hint: "Speed POS & Invoices", icon: "⚡", shortcut: "S" },
      { id: "store", label: "Online Store", hint: "Catalog & WhatsApp orders", icon: "🛒", shortcut: "O" }
    ]
  },
  {
    title: "Manage",
    items: [
      { id: "stock", label: "Items & Stock", hint: "Products, batches, expiry", icon: "📦", shortcut: "I" },
      { id: "purchases", label: "Purchases", hint: "Supplier bills & restock", icon: "📥", shortcut: "P" },
      { id: "returns", label: "Credit/Debit Notes", hint: "Sales & purchase returns", icon: "🔄", shortcut: "T" },
      { id: "parties", label: "Parties & Dues", hint: "Customers, ledger & dues", icon: "👥", shortcut: "C" }
    ]
  },
  {
    title: "Finance",
    items: [
      { id: "daybook", label: "Cash & Daybook", hint: "Daily register & digital trail", icon: "📒", shortcut: "D" },
      { id: "expenses", label: "Expenses", hint: "Track business spends", icon: "💸", shortcut: "E" },
      { id: "gst", label: "GST Summary", hint: "GSTR-1 & 3B tax reports", icon: "📑", shortcut: "G" },
      { id: "reports", label: "Analytics & P&L", hint: "Sales, profits & trends", icon: "📊", shortcut: "R" }
    ]
  },
  {
    title: "System",
    items: [
      { id: "auth", label: "Admin & Backups", hint: "Users, DB backup/restore", icon: "⚙️", shortcut: "A" }
    ]
  }
];

const tabs = navGroups.flatMap((g) => g.items);

const emptyItemForm = {
  name: "",
  category: "Dairy",
  sku: "",
  barcode: "",
  unit: "pcs",
  quantity: 0,
  lowStockLevel: 5,
  purchasePrice: 0,
  salePrice: 0,
  taxRate: 5,
  supplierName: "",
  batchNumber: "",
  manufacturingDate: "",
  expiryDate: "",
  storageLocation: "Main Store",
  isColdStorage: true,
  active: true
};

const emptyPartyForm = {
  name: "",
  type: "customer",
  phone: "",
  email: "",
  address: "",
  openingBalance: 0
};

const emptyPaymentForm = {
  partyName: "",
  partyType: "customer",
  type: "payment_in",
  amount: "",
  paymentMethod: "cash",
  referenceNote: "",
  paymentDate: new Date().toISOString().split("T")[0]
};

const emptyReturnForm = {
  type: "sales_return",
  partyName: "",
  itemId: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 5,
  refundMethod: "cash",
  reason: "Customer Return / Damaged"
};

const emptySaleDraft = {
  customerName: "Walk-in Customer",
  customerPhone: "",
  paymentMethod: "cash",
  paidAmount: 0,
  itemId: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 5
};

const emptyExpenseForm = {
  title: "",
  category: "Rent",
  amount: "",
  paymentMethod: "cash",
  note: ""
};

const emptyPurchaseDraft = {
  supplierName: "",
  paymentMethod: "cash",
  paidAmount: 0,
  itemId: "",
  quantity: 1,
  unitCost: 0,
  taxRate: 5
};

const emptyAuthForm = {
  name: "",
  email: "",
  password: "",
  role: "admin"
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN");
}

function calcSalePreview(lines) {
  let subtotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const taxableAmount = Math.max(
      Number(line.quantity || 0) * Number(line.unitPrice || 0) -
        Number(line.discount || 0),
      0
    );
    const taxAmount = (taxableAmount * Number(line.taxRate || 0)) / 100;
    subtotal += taxableAmount;
    taxTotal += taxAmount;
  }

  return {
    subtotal,
    taxTotal,
    cgst: taxTotal / 2,
    sgst: taxTotal / 2,
    grandTotal: subtotal + taxTotal
  };
}

function isAdmin(session) {
  return session?.user?.role === "admin";
}

async function fetchJson(path, options = {}) {
  let token = null;
  try {
    const raw = localStorage.getItem(sessionKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      token = parsed?.token;
    }
  } catch {}

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login")) {
      localStorage.removeItem(sessionKey);
      window.dispatchEvent(new CustomEvent("inventory:unauthorized"));
    }
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [items, setItems] = useState([]);
  const [parties, setParties] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [report, setReport] = useState(null);
  const [businessReport, setBusinessReport] = useState(null);
  const [paymentReminders, setPaymentReminders] = useState(null);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [selectedLedgerParty, setSelectedLedgerParty] = useState("");
  const [ledgerData, setLedgerData] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [status, setStatus] = useState("Loading business data...");
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || "null");
    } catch {
      return null;
    }
  });

  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [partyForm, setPartyForm] = useState(emptyPartyForm);
  const [saleDraft, setSaleDraft] = useState(emptySaleDraft);
  const [purchaseDraft, setPurchaseDraft] = useState(emptyPurchaseDraft);
  const [saleLines, setSaleLines] = useState([]);
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [storeCatalog, setStoreCatalog] = useState(null);
  const [storeOrders, setStoreOrders] = useState([]);
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [storeOrderForm, setStoreOrderForm] = useState({
    customerName: "",
    customerPhone: "",
    deliveryAddress: "",
    notes: ""
  });
  const [storeViewMode, setStoreViewMode] = useState("storefront");
  const [thermalModalSale, setThermalModalSale] = useState(null);
  const [thermalReceiptText, setThermalReceiptText] = useState("");
  const [thermalWidth, setThermalWidth] = useState("58mm");
  const [whatsappPromptSale, setWhatsappPromptSale] = useState(null);
  const [customPhone, setCustomPhone] = useState("");
  const [autoBackupStatus, setAutoBackupStatus] = useState(null);

  const [payments, setPayments] = useState([]);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [returns, setReturns] = useState([]);
  const [returnForm, setReturnForm] = useState(emptyReturnForm);

  const [daybookDate, setDaybookDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [daybookData, setDaybookData] = useState(null);

  const [gstMonth, setGstMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [gstData, setGstData] = useState(null);

  function autoGenerateLowStockPO() {
    if (!lowStockItems.length) {
      alert("No items are currently below low stock threshold.");
      return;
    }

    const restockLines = lowStockItems.map((item) => {
      const suggestedQty = Math.max(1, (Number(item.lowStockLevel) || 5) * 2 - (Number(item.quantity) || 0));
      const unitCost = Number(item.purchasePrice) || 0;
      return {
        item: item._id,
        name: item.name,
        sku: item.sku || "",
        quantity: suggestedQty,
        unitCost: unitCost,
        taxRate: Number(item.taxRate) || 5,
        lineTotal: suggestedQty * unitCost
      };
    });

    setPurchaseLines(restockLines);
    const firstSupplier = lowStockItems[0]?.supplierName || (parties.find((p) => p.type === "supplier")?.name || "");
    if (firstSupplier) {
      setPurchaseDraft((prev) => ({ ...prev, supplierName: firstSupplier }));
    }
    setActiveTab("purchases");
    setStatus(`Drafted Restock Purchase Order for ${lowStockItems.length} items`);
  }

  function shareDetailedLedgerWhatsApp() {
    if (!ledgerData || !selectedLedgerParty) return;
    const party = parties.find((p) => p.name === selectedLedgerParty);
    const phone = party?.phone || "";
    const cleanPhone = String(phone).replace(/[^0-9]/g, "");
    const bizName = settings?.businessName || "Inventory Food Business";
    const totals = ledgerData.totals || {};
    const entries = (ledgerData.entries || []).slice(-5);

    let txList = "";
    if (entries.length > 0) {
      txList =
        "\n*Recent Transactions:*\n" +
        entries
          .map(
            (e) =>
              `• ${new Date(e.date || Date.now()).toLocaleDateString("en-IN")}: ${e.description || e.type} - Rs.${Number(e.amount || 0).toFixed(2)} (${e.type})`
          )
          .join("\n") +
        "\n";
    }

    const message =
      `*ACCOUNT STATEMENT - ${bizName.toUpperCase()}*\n\n` +
      `*Party Name:* ${selectedLedgerParty}\n` +
      (phone ? `*Phone:* ${phone}\n` : "") +
      `*Statement Date:* ${new Date().toLocaleDateString("en-IN")}\n` +
      `--------------------------------\n` +
      `*Opening Balance:* Rs.${Number(totals.openingBalance || 0).toFixed(2)}\n` +
      `*Total Invoiced / Sales:* Rs.${Number(totals.receivable || 0).toFixed(2)}\n` +
      `*Total Payments Received:* Rs.${Number(totals.payable || 0).toFixed(2)}\n` +
      `--------------------------------\n` +
      `*NET BALANCE DUE: Rs.${Number(totals.netBalance || 0).toFixed(2)}*\n` +
      (Number(totals.netBalance) > 0
        ? `*(Kindly arrange clearance of this pending balance)*\n`
        : `*(Account is settled in full. Thank you!)*\n`) +
      txList +
      (settings?.upiId ? `\n*Pay via UPI:* ${settings.upiId}\n` : "") +
      `\nThank you for your valued business!`;

    const phoneParam = cleanPhone
      ? cleanPhone.length === 10
        ? `91${cleanPhone}`
        : cleanPhone
      : "";
    const waUrl = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, "_blank");
  }

  async function triggerServerBackup() {
    setStatus("Running server-side backup...");
    try {
      const res = await fetchJson("/backup/trigger", { method: "POST" });
      setAutoBackupStatus(res);
      setStatus("Server backup snapshot generated successfully!");
      alert("Automated backup created on server!");
    } catch (err) {
      alert("Backup error: " + err.message);
    }
  }

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("inventory-theme") === "dark");
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [posViewMode, setPosViewMode] = useState("touch");
  const [posCategory, setPosCategory] = useState("all");
  const [posSearch, setPosSearch] = useState("");

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCmdPalette((prev) => !prev);
      } else if (e.key === "Escape") {
        setShowCmdPalette(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("theme-dark");
      localStorage.setItem("inventory-theme", "dark");
    } else {
      document.documentElement.classList.remove("theme-dark");
      localStorage.setItem("inventory-theme", "light");
    }
  }, [isDarkMode]);

  function addPosItemToCart(item) {
    setSaleLines((prev) => {
      const existingIndex = prev.findIndex((l) => l.item === item._id);
      if (existingIndex >= 0) {
        return prev.map((l, idx) =>
          idx === existingIndex
            ? {
                ...l,
                quantity: l.quantity + 1,
                lineTotal: (l.quantity + 1) * l.unitPrice
              }
            : l
        );
      } else {
        return [
          ...prev,
          {
            item: item._id,
            name: item.name,
            sku: item.sku || "",
            quantity: 1,
            unitPrice: item.salePrice || 0,
            discount: 0,
            taxRate: item.taxRate || 5,
            lineTotal: item.salePrice || 0
          }
        ];
      }
    });
  }

  function updatePosCartQty(index, delta) {
    setSaleLines((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, idx) => idx !== index);
      }
      updated[index] = {
        ...target,
        quantity: newQty,
        lineTotal: newQty * target.unitPrice
      };
      return updated;
    });
  }

  const posCategories = useMemo(() => {
    const set = new Set(items.map((i) => i.category || "General"));
    return ["all", ...Array.from(set)];
  }, [items]);

  const filteredPosItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = posCategory === "all" || (item.category || "General") === posCategory;
      const matchSearch =
        !posSearch ||
        item.name.toLowerCase().includes(posSearch.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(posSearch.toLowerCase())) ||
        (item.barcode && item.barcode.includes(posSearch));
      return matchCat && matchSearch;
    });
  }, [items, posCategory, posSearch]);

  const selectedSaleItem = useMemo(
    () => items.find((item) => item._id === saleDraft.itemId),
    [items, saleDraft.itemId]
  );
  const selectedPurchaseItem = useMemo(
    () => items.find((item) => item._id === purchaseDraft.itemId),
    [items, purchaseDraft.itemId]
  );
  const salePreview = useMemo(() => calcSalePreview(saleLines), [saleLines]);
  const isAdminUser = isAdmin(session);

  const metrics = report?.totals || {
    items: items.length,
    customers: parties.filter((party) => party.type === "customer").length,
    suppliers: parties.filter((party) => party.type === "supplier").length,
    totalStockValue: 0,
    salesTotal: 0,
    purchaseTotal: 0,
    lowStock: 0,
    expiringSoon: 0,
    expired: 0
  };

  async function loadAll() {
    setStatus("Syncing dashboard...");

    try {
      const [
        reportData,
        businessData,
        remindersData,
        settingsData,
        usersData,
        invoicePreview,
        itemsData,
        partiesData,
        salesData,
        purchasesData,
        expensesData,
        catalogData,
        storeOrdersData,
        autoBackupData,
        paymentsData,
        returnsData
      ] = await Promise.all([
        fetchJson("/reports/dashboard"),
        fetchJson("/reports/business"),
        fetchJson("/reports/payment-reminders"),
        fetchJson("/settings"),
        fetchJson("/auth/users").catch(() => []),
        fetchJson("/sales/next-number").catch(() => ({ invoiceNumber: "" })),
        fetchJson("/items"),
        fetchJson("/parties"),
        fetchJson("/sales"),
        fetchJson("/purchases"),
        fetchJson("/expenses").catch(() => []),
        fetchJson("/store/catalog").catch(() => null),
        fetchJson("/store/orders").catch(() => []),
        fetchJson("/backup/auto-status").catch(() => null),
        fetchJson("/payments").catch(() => []),
        fetchJson("/returns").catch(() => [])
      ]);

      setReport(reportData);
      setBusinessReport(businessData);
      setPaymentReminders(remindersData);
      setSettings(settingsData);
      setUsers(usersData);
      setNextInvoiceNumber(invoicePreview.invoiceNumber || "");
      setItems(itemsData);
      setParties(partiesData);
      setSales(salesData);
      setPurchases(purchasesData);
      setExpenses(expensesData || []);
      setStoreCatalog(catalogData || null);
      setStoreOrders(storeOrdersData || []);
      setAutoBackupStatus(autoBackupData);
      setPayments(paymentsData || []);
      setReturns(returnsData || []);
      await Promise.all([
        loadDaybook(daybookDate),
        loadGstSummary(gstMonth)
      ]).catch(() => {});
      setStatus("Data synced");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function loadDaybook(date = daybookDate) {
    try {
      const data = await fetchJson(`/reports/daybook?date=${date}`);
      setDaybookData(data);
    } catch (err) {
      console.error("Daybook error:", err);
    }
  }

  async function loadGstSummary(month = gstMonth) {
    try {
      const data = await fetchJson(`/reports/gst-summary?month=${month}`);
      setGstData(data);
    } catch (err) {
      console.error("GST error:", err);
    }
  }

  async function submitPayment(event) {
    event?.preventDefault();
    if (!paymentForm.partyName || !Number(paymentForm.amount)) {
      alert("Please select a party and enter an amount");
      return;
    }
    setStatus("Recording payment voucher...");
    try {
      await fetchJson("/payments", {
        method: "POST",
        body: JSON.stringify(paymentForm)
      });
      setShowPaymentModal(false);
      setPaymentForm(emptyPaymentForm);
      setStatus("Payment recorded & settled!");
      await loadAll();
      if (selectedLedgerParty) {
        await loadPartyLedger(selectedLedgerParty);
      }
    } catch (err) {
      alert("Payment error: " + err.message);
      setStatus("Payment failed: " + err.message);
    }
  }

  function openPaymentModal(partyName = "", partyType = "customer", amount = "") {
    setPaymentForm({
      partyName: partyName,
      partyType: partyType,
      type: partyType === "supplier" ? "payment_out" : "payment_in",
      amount: Number(amount) > 0 ? String(amount) : "",
      paymentMethod: "cash",
      referenceNote: "",
      paymentDate: new Date().toISOString().split("T")[0]
    });
    setShowPaymentModal(true);
  }

  function updatePaymentForm(event) {
    const { name, value } = event.target;
    setPaymentForm((prev) => ({
      ...prev,
      [name]: name === "amount" ? Number(value) : value
    }));
  }

  async function submitReturn(event) {
    event?.preventDefault();
    if (!returnForm.partyName || !returnForm.itemId || !Number(returnForm.quantity)) {
      alert("Please select a party, item, and valid quantity");
      return;
    }
    const item = items.find((i) => i._id === returnForm.itemId);
    if (!item) {
      alert("Please select an item from stock");
      return;
    }
    setStatus("Recording return note...");
    try {
      const unitPrice =
        Number(returnForm.unitPrice) ||
        (returnForm.type === "sales_return" ? Number(item.salePrice) : Number(item.purchasePrice)) ||
        0;
      const taxRate = Number(returnForm.taxRate) || Number(item.taxRate) || 0;
      await fetchJson("/returns", {
        method: "POST",
        body: JSON.stringify({
          type: returnForm.type,
          partyName: returnForm.partyName,
          refundMethod: returnForm.refundMethod,
          reason: returnForm.reason,
          items: [
            {
              item: item._id,
              name: item.name,
              sku: item.sku || "",
              quantity: Number(returnForm.quantity),
              unitPrice: unitPrice,
              taxRate: taxRate
            }
          ]
        })
      });
      setReturnForm(emptyReturnForm);
      setStatus("Return recorded & inventory adjusted!");
      await loadAll();
    } catch (err) {
      alert("Return error: " + err.message);
      setStatus("Return failed: " + err.message);
    }
  }

  function updateReturnForm(event) {
    const { name, value } = event.target;
    setReturnForm((prev) => {
      const next = { ...prev, [name]: name === "quantity" || name === "unitPrice" || name === "taxRate" ? Number(value) : value };
      if (name === "itemId") {
        const sel = items.find((i) => i._id === value);
        if (sel) {
          next.unitPrice = prev.type === "sales_return" ? Number(sel.salePrice) : Number(sel.purchasePrice);
          next.taxRate = Number(sel.taxRate) || 5;
        }
      }
      return next;
    });
  }

  function exportGstCsv() {
    if (!gstData) return;
    const rows = [
      ["GST Tax Summary", gstData.period || ""],
      [],
      ["Outward Sales (Turnover)", gstData.outwardSales?.totalTaxableTurnover || 0],
      ["Output CGST", gstData.outwardSales?.cgst || 0],
      ["Output SGST", gstData.outwardSales?.sgst || 0],
      ["Total Output GST", gstData.outwardSales?.totalTax || 0],
      [],
      ["Inward Purchases (Eligible ITC)", gstData.inwardPurchases?.totalTaxableTurnover || 0],
      ["ITC CGST", gstData.inwardPurchases?.cgst || 0],
      ["ITC SGST", gstData.inwardPurchases?.sgst || 0],
      ["Total Input Tax Credit", gstData.inwardPurchases?.totalTax || 0],
      [],
      ["Net GST Payable", gstData.netGstPayable || 0],
      [],
      ["Slab Rate (%)", "Outward Taxable", "Output Tax", "Inward Taxable", "ITC", "Net Tax"]
    ];

    if (gstData.slabBreakdown) {
      for (const [rate, slab] of Object.entries(gstData.slabBreakdown)) {
        rows.push([
          `${rate}%`,
          slab.outwardTaxable || 0,
          slab.outputTax || 0,
          slab.inwardTaxable || 0,
          slab.inputTax || 0,
          slab.netTax || 0
        ]);
      }
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GST_Report_${gstMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  useEffect(() => {
    function handleUnauthorized() {
      setSession(null);
      localStorage.removeItem(sessionKey);
      setStatus("Session expired. Please log in.");
    }
    window.addEventListener("inventory:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("inventory:unauthorized", handleUnauthorized);
  }, []);

  // Session is saved synchronously in loginUser/quickLogin before loadAll() runs.
  // On logout, it's removed directly. Nothing needed here.

  function updateItemForm(event) {
    const { name, value, type, checked } = event.target;
    setItemForm((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : name === "quantity" ||
              name === "lowStockLevel" ||
              name === "purchasePrice" ||
              name === "salePrice" ||
              name === "taxRate"
            ? Number(value)
            : value
    }));
  }

  function updatePartyForm(event) {
    const { name, value } = event.target;
    setPartyForm((current) => ({
      ...current,
      [name]: name === "openingBalance" ? Number(value) : value
    }));
  }

  function updateSaleDraft(event) {
    const { name, value } = event.target;
    setSaleDraft((current) => ({
      ...current,
      [name]:
        name === "quantity" ||
        name === "unitPrice" ||
        name === "discount" ||
        name === "taxRate" ||
        name === "paidAmount"
          ? Number(value)
          : value
    }));
  }

  function updatePurchaseDraft(event) {
    const { name, value } = event.target;
    setPurchaseDraft((current) => ({
      ...current,
      [name]:
        name === "quantity" ||
        name === "unitCost" ||
        name === "taxRate" ||
        name === "paidAmount"
          ? Number(value)
          : value
    }));
  }

  function updateAuthForm(event) {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value }));
  }

  async function submitItem(event) {
    event.preventDefault();
    setStatus("Saving item...");

    try {
      await fetchJson("/items", {
        method: "POST",
        body: JSON.stringify({
          ...itemForm,
          price: itemForm.salePrice
        })
      });

      setItemForm(emptyItemForm);
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function deleteItem(id) {
    setStatus("Deleting item...");

    try {
      await fetchJson(`/items/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function submitParty(event) {
    event.preventDefault();
    setStatus("Saving party...");

    try {
      await fetchJson("/parties", {
        method: "POST",
        body: JSON.stringify(partyForm)
      });

      setPartyForm(emptyPartyForm);
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  function addSaleLine() {
    if (!selectedSaleItem) {
      setStatus("Choose a stock item for the sale");
      return;
    }

    const quantity = Number(saleDraft.quantity || 0);
    const unitPrice = Number(
      saleDraft.unitPrice || selectedSaleItem.salePrice || selectedSaleItem.price
    );
    const discount = Number(saleDraft.discount || 0);
    const taxRate = Number(saleDraft.taxRate || selectedSaleItem.taxRate || 0);
    const taxableAmount = Math.max(quantity * unitPrice - discount, 0);
    const taxAmount = (taxableAmount * taxRate) / 100;

    setSaleLines((current) => [
      ...current,
      {
        item: selectedSaleItem._id,
        name: selectedSaleItem.name,
        sku: selectedSaleItem.sku,
        quantity,
        unitPrice,
        discount,
        taxRate,
        lineTotal: taxableAmount + taxAmount
      }
    ]);
    setSaleDraft((current) => ({
      ...current,
      quantity: 1,
      unitPrice: Number(selectedSaleItem.salePrice || selectedSaleItem.price || 0),
      discount: 0
    }));
    setStatus("Sale line added");
  }

  function addPurchaseLine() {
    if (!selectedPurchaseItem) {
      setStatus("Choose a stock item for the purchase");
      return;
    }

    const quantity = Number(purchaseDraft.quantity || 0);
    const unitCost = Number(
      purchaseDraft.unitCost ||
        selectedPurchaseItem.purchasePrice ||
        selectedPurchaseItem.salePrice ||
        0
    );
    const taxRate = Number(
      purchaseDraft.taxRate || selectedPurchaseItem.taxRate || 0
    );
    const taxableAmount = quantity * unitCost;
    const taxAmount = (taxableAmount * taxRate) / 100;

    setPurchaseLines((current) => [
      ...current,
      {
        item: selectedPurchaseItem._id,
        name: selectedPurchaseItem.name,
        sku: selectedPurchaseItem.sku,
        quantity,
        unitCost,
        taxRate,
        lineTotal: taxableAmount + taxAmount
      }
    ]);
    setPurchaseDraft((current) => ({
      ...current,
      quantity: 1,
      unitCost: Number(
        selectedPurchaseItem.purchasePrice || selectedPurchaseItem.salePrice || 0
      )
    }));
    setStatus("Purchase line added");
  }

  async function submitSale(event) {
    event.preventDefault();

    if (!saleLines.length) {
      setStatus("Add at least one sale line");
      return;
    }

    setStatus("Saving sale invoice...");

    try {
      const created = await fetchJson("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerName: saleDraft.customerName,
          customerPhone: saleDraft.customerPhone || "",
          paymentMethod: saleDraft.paymentMethod,
          paidAmount: Number(saleDraft.paidAmount || 0),
          items: saleLines
        })
      });

      setSaleLines([]);
      setSaleDraft(emptySaleDraft);
      setSelectedSale(created);
      setStatus("Sale invoice created!");
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function submitPurchase(event) {
    event.preventDefault();

    if (!purchaseLines.length) {
      setStatus("Add at least one purchase line");
      return;
    }

    setStatus("Saving purchase bill...");

    try {
      await fetchJson("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierName: purchaseDraft.supplierName,
          paymentMethod: purchaseDraft.paymentMethod,
          paidAmount: Number(purchaseDraft.paidAmount || 0),
          items: purchaseLines
        })
      });

      setPurchaseLines([]);
      setPurchaseDraft(emptyPurchaseDraft);
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function registerUser(event) {
    event.preventDefault();

    if (session && !isAdminUser) {
      setStatus("Only admin can register new users");
      return;
    }

    setStatus("Creating user...");

    try {
      const data = await fetchJson("/auth/register", {
        method: "POST",
        body: JSON.stringify(authForm)
      });
      setSession({ user: data, token: "" });
      setStatus("User created");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function loginUser(event) {
    event?.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    setStatus("Signing in...");

    try {
      const data = await fetchJson("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password
        })
      });
      // Save to localStorage synchronously BEFORE setSession so fetchJson
      // can read the token immediately when loadAll() runs
      localStorage.setItem(sessionKey, JSON.stringify(data));
      setSession(data);
      setStatus("Logged in as " + (data.user?.name || "User"));
      await loadAll();
    } catch (error) {
      setLoginError(error.message);
      setStatus("Login failed: " + error.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function quickLogin(email, password) {
    setLoginError("");
    setIsLoggingIn(true);
    setStatus("Signing in...");

    try {
      const data = await fetchJson("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      // Save to localStorage synchronously BEFORE setSession so fetchJson
      // can read the token immediately when loadAll() runs
      localStorage.setItem(sessionKey, JSON.stringify(data));
      setSession(data);
      setStatus("Logged in as " + (data.user?.name || "User"));
      await loadAll();
    } catch (error) {
      setLoginError(error.message);
      setStatus("Login failed: " + error.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function lookupBarcode(event) {
    event?.preventDefault();
    if (!barcodeQuery.trim()) {
      setStatus("Enter a barcode or SKU");
      return;
    }

    setStatus("Looking up barcode...");

    try {
      const item = await fetchJson(
        `/items/lookup/barcode/${encodeURIComponent(barcodeQuery.trim())}`
      );
      setBarcodeResult(item);
      setStatus(`Found ${item.name}`);
    } catch (error) {
      setBarcodeResult(null);
      setStatus(error.message);
    }
  }

  async function loadPartyLedger(partyName) {
    if (!partyName) {
      setLedgerData(null);
      return;
    }

    setSelectedLedgerParty(partyName);
    setStatus("Loading party ledger...");

    try {
      const data = await fetchJson(`/reports/ledger/${encodeURIComponent(partyName)}`);
      setLedgerData(data);
      setStatus("Ledger loaded");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function viewSaleInvoice(saleId) {
    setStatus("Loading invoice...");

    try {
      const data = await fetchJson(`/sales/${saleId}`);
      setSelectedSale(data);
      setStatus("Invoice loaded");
    } catch (error) {
      setStatus(error.message);
    }
  }

  function downloadInvoicePdf(saleId, invoiceNumber) {
    const link = document.createElement("a");
    link.href = `${API_URL}/sales/${saleId}/pdf`;
    link.download = `${(invoiceNumber || "invoice").replace(/\//g, "-")}.pdf`;
    link.target = "_blank";
    link.click();
    setStatus("Opening PDF download...");
  }

  function shareInvoiceWhatsApp(sale) {
    if (!sale) return;
    const phone = sale.customerPhone || "";
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const dateStr = new Date(sale.createdAt || Date.now()).toLocaleDateString("en-IN");
    const bizName = settings?.businessName || "Inventory Food Business";

    const itemsText = (sale.items || [])
      .map(
        (it) =>
          `• ${it.name} (${it.quantity} x Rs.${Number(it.unitPrice).toFixed(2)}) = Rs.${Number(it.lineTotal).toFixed(2)}`
      )
      .join("\n");

    const message =
      `*INVOICE: ${sale.invoiceNumber}*\n` +
      `*From:* ${bizName}\n` +
      `*Date:* ${dateStr}\n` +
      `*Customer:* ${sale.customerName}\n` +
      `--------------------------------\n` +
      `*Items:*\n${itemsText}\n` +
      `--------------------------------\n` +
      `Subtotal: Rs.${Number(sale.subtotal).toFixed(2)}\n` +
      `Tax (GST): Rs.${Number(sale.taxTotal).toFixed(2)}\n` +
      `*Grand Total: Rs.${Number(sale.grandTotal).toFixed(2)}*\n` +
      `Paid: Rs.${Number(sale.paidAmount || 0).toFixed(2)}\n` +
      (Number(sale.dueAmount) > 0
        ? `*Balance Due: Rs.${Number(sale.dueAmount).toFixed(2)}*\n`
        : `Status: Fully Paid\n`) +
      (settings?.upiId ? `Pay via UPI: ${settings.upiId}\n` : "") +
      `Thank you for your business!`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
  }

  function shareDueReminderWhatsApp(partyName, dueAmount, phone = "") {
    const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
    const bizName = settings?.businessName || "Inventory Food Business";
    const message =
      `*Payment Reminder from ${bizName}*\n\n` +
      `Dear ${partyName},\n` +
      `This is a gentle reminder that an outstanding payment of *Rs.${Number(dueAmount).toFixed(2)}* is pending on your account.\n\n` +
      (settings?.upiId ? `You can pay online via UPI: *${settings.upiId}*\n\n` : "") +
      `Kindly clear the due amount at your earliest convenience.\n` +
      `Thank you!`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
  }

  async function openThermalReceipt(sale, width = "58mm") {
    setThermalModalSale(sale);
    setThermalWidth(width);
    setStatus("Loading thermal receipt...");
    try {
      const data = await fetchJson(
        `/sales/${sale._id}/thermal?width=${width === "80mm" ? "80" : "58"}`
      );
      setThermalReceiptText(data.receiptText);
      setStatus("Thermal receipt ready");
    } catch {
      setThermalReceiptText(
        `RECEIPT - ${sale.invoiceNumber}\n` +
          `Date: ${new Date(sale.createdAt || Date.now()).toLocaleDateString("en-IN")}\n` +
          `Customer: ${sale.customerName}\n` +
          `Total: Rs.${sale.grandTotal}`
      );
    }
  }

  function printThermalReceipt() {
    window.print();
  }

  function copyThermalReceipt() {
    if (navigator.clipboard && thermalReceiptText) {
      navigator.clipboard.writeText(thermalReceiptText);
      setStatus("Thermal receipt copied to clipboard!");
    }
  }

  async function submitExpense(event) {
    event.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) {
      setStatus("Please enter expense title and amount");
      return;
    }
    setStatus("Saving expense...");
    try {
      await fetchJson("/expenses", {
        method: "POST",
        body: JSON.stringify({
          ...expenseForm,
          amount: Number(expenseForm.amount)
        })
      });
      setExpenseForm(emptyExpenseForm);
      setStatus("Expense recorded");
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function deleteExpenseItem(id) {
    if (!window.confirm("Delete this expense entry?")) return;
    setStatus("Deleting expense...");
    try {
      await fetchJson(`/expenses/${id}`, { method: "DELETE" });
      setStatus("Expense deleted");
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  function addToCart(item) {
    setCart((prev) => {
      const exists = prev.find((i) => i._id === item._id);
      if (exists) {
        return prev.map((i) =>
          i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setStatus(`Added ${item.name} to cart`);
  }

  function updateCartQty(itemId, delta) {
    setCart((prev) =>
      prev
        .map((i) => (i._id === itemId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  async function submitStoreOrder(isWhatsApp = false) {
    if (!cart.length) {
      setStatus("Your cart is empty");
      return;
    }
    if (!storeOrderForm.customerName || !storeOrderForm.customerPhone) {
      setStatus("Customer name and phone are required");
      return;
    }

    const cartTotal = cart.reduce(
      (sum, item) => sum + item.quantity * Number(item.salePrice || 0),
      0
    );

    if (isWhatsApp) {
      const bizPhone = (settings?.phone || "").replace(/[^0-9]/g, "");
      const lines = cart
        .map(
          (c) =>
            `• ${c.name} x ${c.quantity} ${c.unit} = Rs.${(c.quantity * c.salePrice).toFixed(2)}`
        )
        .join("\n");
      const msg =
        `*New Online Order from ${storeOrderForm.customerName}*\n` +
        `Phone: ${storeOrderForm.customerPhone}\n` +
        (storeOrderForm.deliveryAddress ? `Address: ${storeOrderForm.deliveryAddress}\n` : "") +
        (storeOrderForm.notes ? `Note: ${storeOrderForm.notes}\n` : "") +
        `--------------------------------\n` +
        `*Items Ordered:*\n${lines}\n` +
        `--------------------------------\n` +
        `*Total: Rs.${cartTotal.toFixed(2)}*`;

      const waUrl = bizPhone
        ? `https://wa.me/${bizPhone.length === 10 ? "91" + bizPhone : bizPhone}?text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
    }

    setStatus("Placing store order...");
    try {
      await fetchJson("/store/orders", {
        method: "POST",
        body: JSON.stringify({
          ...storeOrderForm,
          items: cart.map((c) => ({
            item: c._id,
            name: c.name,
            quantity: c.quantity,
            unitPrice: c.salePrice,
            lineTotal: c.quantity * c.salePrice
          })),
          totalAmount: cartTotal
        })
      });
      setCart([]);
      setStoreOrderForm({
        customerName: "",
        customerPhone: "",
        deliveryAddress: "",
        notes: ""
      });
      setStatus("Order submitted successfully!");
      const ords = await fetchJson("/store/orders").catch(() => []);
      setStoreOrders(ords);
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function updateOrderStatus(orderId, newStatus) {
    try {
      await fetchJson(`/store/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      const ords = await fetchJson("/store/orders").catch(() => []);
      setStoreOrders(ords);
      setStatus(`Order marked as ${newStatus}`);
    } catch (err) {
      setStatus(err.message);
    }
  }

  function convertOrderToSale(order) {
    setSaleDraft({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      paymentMethod: "cash",
      paidAmount: order.totalAmount,
      itemId: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: 5
    });

    const lines = (order.items || []).map((ordItem) => ({
      item: ordItem.item || items.find((i) => i.name === ordItem.name)?._id,
      name: ordItem.name,
      sku: "",
      quantity: ordItem.quantity,
      unitPrice: ordItem.unitPrice,
      discount: 0,
      taxRate: 5,
      lineTotal: ordItem.lineTotal
    }));

    setSaleLines(lines);
    setActiveTab("sales");
    setStatus(`Converted Order ${order.orderNumber} to Sale draft`);
  }

  async function restoreBackupData(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Restoring this backup will replace current collections. Proceed?")) {
      event.target.value = "";
      return;
    }

    setStatus("Restoring backup data...");
    try {
      const text = await file.text();
      const backupJson = JSON.parse(text);
      await fetchJson("/backup/restore", {
        method: "POST",
        body: JSON.stringify(backupJson)
      });
      setStatus("Backup restored successfully!");
      await loadAll();
    } catch (err) {
      setStatus("Failed to restore backup: " + err.message);
    } finally {
      event.target.value = "";
    }
  }

  async function exportBackupData() {
    if (!isAdminUser) {
      setStatus("Only admin can export backup");
      return;
    }

    setStatus("Exporting backup...");

    try {
      const data = await fetchJson("/backup/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Backup downloaded");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    if (!isAdminUser) {
      setStatus("Only admin can update settings");
      return;
    }

    setStatus("Saving settings...");

    try {
      const updated = await fetchJson("/settings", {
        method: "PATCH",
        body: JSON.stringify(settings)
      });
      setSettings(updated);
      setStatus("Settings saved");
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  function logoutUser() {
    localStorage.removeItem(sessionKey);
    setSession(null);
    setStatus("Logged out. Please sign in to continue.");
  }

  const lowStockItems = report?.lowStockItems || [];
  const expiringItems = report?.expiringItems || [];
  const expiredItems = report?.expiredItems || [];
  const customerParties = parties.filter((party) => party.type === "customer");
  const supplierParties = parties.filter((party) => party.type === "supplier");

  const cmdResults = useMemo(() => {
    if (!cmdQuery.trim()) {
      return [
        { type: "action", label: "Quick POS Billing", icon: "⚡", action: () => { setPosViewMode("touch"); setActiveTab("sales"); setShowCmdPalette(false); } },
        { type: "action", label: "Record Payment In / Out", icon: "💰", action: () => { openPaymentModal(); setShowCmdPalette(false); } },
        { type: "action", label: "Add Stock Item", icon: "📦", action: () => { setActiveTab("stock"); setShowCmdPalette(false); } },
        { type: "action", label: "Record Expense", icon: "💸", action: () => { setActiveTab("expenses"); setShowCmdPalette(false); } },
        { type: "tab", label: "Cash & Bank Daybook", icon: "📒", action: () => { setActiveTab("daybook"); setShowCmdPalette(false); } },
        { type: "tab", label: "GST Tax Report (GSTR-1/3B)", icon: "📑", action: () => { setActiveTab("gst"); setShowCmdPalette(false); } },
        { type: "tab", label: "Returns (Credit / Debit Notes)", icon: "🔄", action: () => { setActiveTab("returns"); setShowCmdPalette(false); } },
        { type: "tab", label: "Go to Dashboard", icon: "🏠", action: () => { setActiveTab("dashboard"); setShowCmdPalette(false); } },
        { type: "tab", label: "Go to Online Store", icon: "🛒", action: () => { setActiveTab("store"); setShowCmdPalette(false); } },
        { type: "tab", label: "Go to Reports & P&L", icon: "📊", action: () => { setActiveTab("reports"); setShowCmdPalette(false); } },
      ];
    }
    const q = cmdQuery.toLowerCase();
    const results = [];

    for (const it of items) {
      if (it.name.toLowerCase().includes(q) || (it.sku && it.sku.toLowerCase().includes(q))) {
        results.push({
          type: "product",
          label: `${it.name} (${it.quantity} in stock) - ${formatMoney(it.salePrice)}`,
          icon: "📦",
          action: () => {
            setActiveTab("sales");
            addPosItemToCart(it);
            setShowCmdPalette(false);
          }
        });
      }
    }

    for (const p of parties) {
      if (p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q))) {
        results.push({
          type: "party",
          label: `${p.name} (${p.type}) - ${p.phone || "No phone"}`,
          icon: "👥",
          action: () => {
            setSelectedLedgerParty(p._id);
            setActiveTab("parties");
            setShowCmdPalette(false);
          }
        });
      }
    }

    for (const s of sales) {
      if (s.invoiceNumber.toLowerCase().includes(q) || (s.customerName && s.customerName.toLowerCase().includes(q))) {
        results.push({
          type: "invoice",
          label: `${s.invoiceNumber} - ${s.customerName} (${formatMoney(s.grandTotal)})`,
          icon: "📄",
          action: () => {
            setSelectedSale(s);
            setShowCmdPalette(false);
          }
        });
      }
    }

    return results.slice(0, 8);
  }, [cmdQuery, items, parties, sales]);
  const activeTabInfo = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  if (!session?.token) {
    return (
      <div className="login-screen-wrapper">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">FM</div>
            <h2>FreshMart Commercial Suite</h2>
            <p className="login-sub">
              Sign in with your authorized credentials to access inventory, POS billing, and business accounts.
            </p>
          </div>

          {loginError ? (
            <div className="login-alert-error">
              <span>⚠️</span>
              <p>{loginError}</p>
            </div>
          ) : null}

          <form onSubmit={loginUser} className="login-form">
            <label className="login-label">
              <span>Email Address</span>
              <input
                type="email"
                name="email"
                value={authForm.email}
                onChange={updateAuthForm}
                placeholder="admin@freshmart.in"
                required
                autoFocus
              />
            </label>

            <label className="login-label">
              <span>Password</span>
              <input
                type="password"
                name="password"
                value={authForm.password}
                onChange={updateAuthForm}
                placeholder="••••••••"
                required
              />
            </label>

            <button type="submit" className="login-submit-btn" disabled={isLoggingIn}>
              {isLoggingIn ? "Verifying Credentials..." : "Sign In to Business Suite →"}
            </button>
          </form>

          <div className="login-quick-demo">
            <div className="demo-divider">
              <span>ONE-CLICK DEMO ACCOUNTS</span>
            </div>
            <div className="demo-chips-grid">
              <button
                type="button"
                className="demo-chip-card admin-demo"
                onClick={() => {
                  setAuthForm((p) => ({ ...p, email: "admin@freshmart.in", password: "admin123" }));
                  quickLogin("admin@freshmart.in", "admin123");
                }}
              >
                <div className="demo-chip-icon">👑</div>
                <div className="demo-chip-info">
                  <strong>Admin (Owner)</strong>
                  <span>Full access: POS, GST, Daybook, DB Backups</span>
                </div>
                <span className="demo-chip-action">Demo Login</span>
              </button>

              <button
                type="button"
                className="demo-chip-card staff-demo"
                onClick={() => {
                  setAuthForm((p) => ({ ...p, email: "staff@freshmart.in", password: "staff123" }));
                  quickLogin("staff@freshmart.in", "staff123");
                }}
              >
                <div className="demo-chip-icon">👤</div>
                <div className="demo-chip-info">
                  <strong>Staff (Cashier)</strong>
                  <span>POS Counter, Catalog items, Customer balances</span>
                </div>
                <span className="demo-chip-action">Demo Login</span>
              </button>
            </div>
          </div>

          <div className="login-footer-security">
            <span>🔒 Protected with cryptographic Bearer token authentication. Unauthorized editing is strictly blocked.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isSidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <div className="brand-logo-icon">IN</div>
            <div className="brand-titles">
              <h1>Inventory</h1>
              <p className="tagline">{settings?.businessName || "Store Suite"}</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          >
            {isSidebarCollapsed ? "▶" : "◀"}
          </button>
        </div>

        <nav className="side-menu" aria-label="Main Navigation">
          {navGroups.map((group) => (
            <div key={group.title} className="nav-group-section">
              <span className="nav-group-label">{group.title}</span>
              {group.items.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? "nav-btn is-active" : "nav-btn"}
                  onClick={() => setActiveTab(tab.id)}
                  title={`${tab.label} (${tab.hint})`}
                >
                  <span className="nav-icon">{tab.icon}</span>
                  <span className="nav-label-text">{tab.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="session-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Signed in as</span>
            <button
              type="button"
              onClick={logoutUser}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
          <strong>{session?.user?.name || "Store Staff"}</strong>
          <small>{(session?.user?.role || "Staff").toUpperCase()}</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar-modern">
          <div
            className="topbar-search-trigger"
            onClick={() => setShowCmdPalette(true)}
            role="button"
            tabIndex={0}
          >
            <span>🔍 Search items, parties, bills...</span>
            <span className="topbar-kbd">Ctrl + K</span>
          </div>

          <div className="topbar-actions">
            {metrics.lowStock > 0 && (
              <button
                type="button"
                className="topbar-btn ghost"
                style={{ color: "#b91c1c", borderColor: "#fecaca" }}
                onClick={() => setActiveTab("stock")}
              >
                ⚠️ {metrics.lowStock} Low Stock
              </button>
            )}

            <button
              type="button"
              className="topbar-btn primary"
              onClick={() => {
                setPosViewMode("touch");
                setActiveTab("sales");
              }}
            >
              ⚡ Quick POS
            </button>

            <button
              type="button"
              className="topbar-btn ghost"
              onClick={() => setIsDarkMode((prev) => !prev)}
              title="Toggle Dark / Light Theme"
            >
              {isDarkMode ? "☀️ Light" : "🌙 Dark"}
            </button>

            <div className="topbar-user-badge">
              <span className="user-avatar-circle">{session?.user?.name?.[0]?.toUpperCase() || "U"}</span>
              <div className="user-details">
                <span className="user-name">{session?.user?.name || "User"}</span>
                <span className="user-role-tag">{session?.user?.role?.toUpperCase() || "STAFF"}</span>
              </div>
              <button
                type="button"
                className="topbar-logout-btn"
                onClick={logoutUser}
                title="Lock Application & Log Out"
              >
                🔒 Sign Out
              </button>
            </div>
          </div>
        </header>

        <section className="hero-panel">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{activeTabInfo.label}</h2>
            <p className="hero-copy">{activeTabInfo.hint}</p>
          </div>
          <div className="hero-actions">
            <span className="hero-stat">
              {metrics.items} items
              <small>{metrics.lowStock} low stock</small>
            </span>
            <button type="button" className="secondary-button" onClick={loadAll}>
              Sync all data
            </button>
          </div>
        </section>

        <section className="kpi-grid">
          <article className="kpi-card">
            <span>Stock value</span>
            <strong>{formatMoney(metrics.totalStockValue)}</strong>
          </article>
          <article className="kpi-card">
            <span>Sales total</span>
            <strong>{formatMoney(metrics.salesTotal)}</strong>
          </article>
          <article className="kpi-card">
            <span>Purchase total</span>
            <strong>{formatMoney(metrics.purchaseTotal)}</strong>
          </article>
          <article className="kpi-card">
            <span>Customers / suppliers</span>
            <strong>
              {metrics.customers} / {metrics.suppliers}
            </strong>
          </article>
        </section>

        <section className="status-row">
          <span className="status-pill">{status}</span>
          <span className="status-pill muted">
            {items.length} items, {sales.length} sales, {purchases.length} purchases
          </span>
        </section>

        {activeTab === "dashboard" && (
          <>
            {(lowStockItems.length > 0 || customerParties.some((p) => (p.closingBalance || 0) > 0)) && (
              <div className="action-banner-row">
                {lowStockItems.length > 0 && (
                  <div className="action-banner warning">
                    <span>
                      <strong>⚠️ Attention:</strong> {lowStockItems.length} items are running below minimum stock level.
                    </span>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: "4px 12px", fontSize: "12px" }}
                      onClick={() => setActiveTab("stock")}
                    >
                      Restock Now →
                    </button>
                  </div>
                )}
                {customerParties.some((p) => (p.closingBalance || 0) > 0) && (
                  <div className="action-banner info">
                    <span>
                      <strong>🔔 Customer Dues:</strong> Outstanding balances pending from customer accounts.
                    </span>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: "4px 12px", fontSize: "12px" }}
                      onClick={() => setActiveTab("parties")}
                    >
                      Send WhatsApp Reminders →
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-head">
                <h3>Stock alerts</h3>
                <span className="muted">Low stock and expiry</span>
              </div>
              <div className="alert-grid">
                <div className="alert-box">
                  <strong>{lowStockItems.length}</strong>
                  <span>Low stock items</span>
                </div>
                <div className="alert-box">
                  <strong>{expiringItems.length}</strong>
                  <span>Expiring soon</span>
                </div>
                <div className="alert-box">
                  <strong>{expiredItems.length}</strong>
                  <span>Expired stock</span>
                </div>
              </div>
              <div className="list-stack">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item._id} className="mini-row">
                    <span>{item.name}</span>
                    <strong>
                      {item.quantity} / {item.lowStockLevel}
                    </strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h3>Recent activity</h3>
                <span className="muted">Latest invoices and bills</span>
              </div>
              <div className="activity-grid">
                <div>
                  <h4>Recent sales</h4>
                  {sales.slice(0, 5).map((sale) => (
                    <div key={sale._id} className="mini-row">
                      <span>{sale.customerName}</span>
                      <strong>{formatMoney(sale.grandTotal)}</strong>
                    </div>
                  ))}
                </div>
                <div>
                  <h4>Recent purchases</h4>
                  {purchases.slice(0, 5).map((purchase) => (
                    <div key={purchase._id} className="mini-row">
                      <span>{purchase.supplierName}</span>
                      <strong>{formatMoney(purchase.grandTotal)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h3>Payment reminders</h3>
                <span className="muted">Customer dues and supplier payables</span>
              </div>
              <div className="two-column-list">
                <div>
                  <h4>Receivables</h4>
                  {(paymentReminders?.receivables || []).slice(0, 5).map((entry) => (
                    <div key={entry.id} className="mini-row">
                      <span>{entry.partyName}</span>
                      <strong>{formatMoney(entry.dueAmount)}</strong>
                    </div>
                  ))}
                  {!paymentReminders?.receivables?.length ? (
                    <div className="empty-state">No customer dues.</div>
                  ) : null}
                </div>
                <div>
                  <h4>Payables</h4>
                  {(paymentReminders?.payables || []).slice(0, 5).map((entry) => (
                    <div key={entry.id} className="mini-row">
                      <span>{entry.partyName}</span>
                      <strong>{formatMoney(entry.dueAmount)}</strong>
                    </div>
                  ))}
                  {!paymentReminders?.payables?.length ? (
                    <div className="empty-state">No supplier dues.</div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="panel focus-panel">
              <div className="panel-head">
                <h3>Today focus</h3>
                <span className="muted">Fast entry points</span>
              </div>
              <div className="focus-grid">
                <button type="button" onClick={() => setActiveTab("stock")}>
                  Add cheese, paneer, sauce, or batch stock
                </button>
                <button type="button" onClick={() => setActiveTab("sales")}>
                  Create sale invoice and reduce stock
                </button>
                <button type="button" onClick={() => setActiveTab("purchases")}>
                  Record supplier purchase and increase stock
                </button>
                <button type="button" onClick={() => setActiveTab("parties")}>
                  Add customer or supplier details
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h3>Expiry watch</h3>
                <span className="muted">Food safety view</span>
              </div>
              <div className="list-stack">
                {[...expiredItems, ...expiringItems].slice(0, 6).map((item) => (
                  <div key={item._id} className="mini-row">
                    <span>{item.name}</span>
                    <strong>{formatDate(item.expiryDate)}</strong>
                  </div>
                ))}
                {!expiredItems.length && !expiringItems.length ? (
                  <div className="empty-state">No expiry alerts right now.</div>
                ) : null}
              </div>
            </section>
          </div>
        </>
      )}

        {activeTab === "stock" && (
          <section className="panel split">
            <form className="form-card" onSubmit={submitItem}>
              <div className="panel-head">
                <h3>Add Food Item</h3>
                <span className="muted">Cheese, paneer, sauces, dairy</span>
              </div>

              <div className="field-grid">
                <label>
                  Name
                  <input
                    name="name"
                    value={itemForm.name}
                    onChange={updateItemForm}
                    placeholder="Mozzarella cheese"
                    required
                  />
                </label>
                <label>
                  Category
                  <input
                    name="category"
                    value={itemForm.category}
                    onChange={updateItemForm}
                    placeholder="Dairy"
                    required
                  />
                </label>
                <label>
                  SKU
                  <input
                    name="sku"
                    value={itemForm.sku}
                    onChange={updateItemForm}
                    placeholder="CHEESE-001"
                    required
                  />
                </label>
                <label>
                  Barcode
                  <input
                    name="barcode"
                    value={itemForm.barcode}
                    onChange={updateItemForm}
                    placeholder="890..."
                  />
                </label>
                <label>
                  Unit
                  <select name="unit" value={itemForm.unit} onChange={updateItemForm}>
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="ltr">ltr</option>
                    <option value="ml">ml</option>
                    <option value="box">box</option>
                  </select>
                </label>
                <label>
                  Storage
                  <input
                    name="storageLocation"
                    value={itemForm.storageLocation}
                    onChange={updateItemForm}
                    placeholder="Cold room A"
                  />
                </label>
                <label>
                  Quantity
                  <input
                    type="number"
                    name="quantity"
                    value={itemForm.quantity}
                    onChange={updateItemForm}
                    min="0"
                  />
                </label>
                <label>
                  Low stock
                  <input
                    type="number"
                    name="lowStockLevel"
                    value={itemForm.lowStockLevel}
                    onChange={updateItemForm}
                    min="0"
                  />
                </label>
                <label>
                  Purchase price
                  <input
                    type="number"
                    name="purchasePrice"
                    value={itemForm.purchasePrice}
                    onChange={updateItemForm}
                    min="0"
                    step="0.01"
                  />
                </label>
                <label>
                  Sale price
                  <input
                    type="number"
                    name="salePrice"
                    value={itemForm.salePrice}
                    onChange={updateItemForm}
                    min="0"
                    step="0.01"
                  />
                </label>
                <label>
                  Tax %
                  <input
                    type="number"
                    name="taxRate"
                    value={itemForm.taxRate}
                    onChange={updateItemForm}
                    min="0"
                    step="0.1"
                  />
                </label>
                <label>
                  Supplier
                  <input
                    name="supplierName"
                    value={itemForm.supplierName}
                    onChange={updateItemForm}
                    placeholder="Fresh Dairy Co."
                  />
                </label>
                <label>
                  Batch number
                  <input
                    name="batchNumber"
                    value={itemForm.batchNumber}
                    onChange={updateItemForm}
                    placeholder="BATCH-2401"
                  />
                </label>
                <label>
                  Manufacturing date
                  <input
                    type="date"
                    name="manufacturingDate"
                    value={itemForm.manufacturingDate}
                    onChange={updateItemForm}
                  />
                </label>
                <label>
                  Expiry date
                  <input
                    type="date"
                    name="expiryDate"
                    value={itemForm.expiryDate}
                    onChange={updateItemForm}
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    name="isColdStorage"
                    checked={itemForm.isColdStorage}
                    onChange={updateItemForm}
                  />
                  Cold storage item
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    name="active"
                    checked={itemForm.active}
                    onChange={updateItemForm}
                  />
                  Active item
                </label>
              </div>

              <button type="submit">Add stock item</button>
            </form>

            <div className="table-card">
              <div className="panel-head">
                <h3>Barcode lookup</h3>
                <span className="muted">Scan or type barcode / SKU</span>
              </div>
              <form className="barcode-row" onSubmit={lookupBarcode}>
                <input
                  value={barcodeQuery}
                  onChange={(event) => setBarcodeQuery(event.target.value)}
                  placeholder="8901234567890 or CHEESE-001"
                />
                <button type="submit">Find item</button>
              </form>
              {barcodeResult ? (
                <div className="barcode-result">
                  <strong>{barcodeResult.name}</strong>
                  <span>
                    {barcodeResult.sku} · Qty {barcodeResult.quantity} ·{" "}
                    {formatMoney(barcodeResult.salePrice)}
                  </span>
                  <span>
                    Expiry {formatDate(barcodeResult.expiryDate)} ·{" "}
                    {barcodeResult.isColdStorage ? "Cold storage" : "Ambient"}
                  </span>
                </div>
              ) : null}
            </div>

            {lowStockItems.length > 0 ? (
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "16px"
                }}
              >
                <div>
                  <strong style={{ color: "#ef4444", fontSize: "14px" }}>
                    ⚠️ {lowStockItems.length} Products Running Low on Stock
                  </strong>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Inventory is below minimum reorder thresholds. Auto-generate a purchase bill to restock.
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  style={{
                    borderColor: "#ef4444",
                    color: "#ef4444",
                    fontWeight: "bold",
                    padding: "8px 16px"
                  }}
                  onClick={autoGenerateLowStockPO}
                >
                  ⚡ 1-Click Restock Purchase Order
                </button>
              </div>
            ) : null}

            <div className="table-card">
              <div className="panel-head">
                <h3>Stock list</h3>
                <span className="muted">Delete, scan, and restock from here</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Expiry</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const lowStock = Number(item.quantity) <= Number(item.lowStockLevel);
                      const expired =
                        item.expiryDate && new Date(item.expiryDate) < new Date();

                      return (
                        <tr key={item._id}>
                          <td>
                            <strong>{item.name}</strong>
                            <div className="subtext">
                              {item.category} - {item.unit}
                            </div>
                          </td>
                          <td>{item.sku}</td>
                          <td>{item.quantity}</td>
                          <td>{formatDate(item.expiryDate)}</td>
                          <td>
                            <span className={lowStock || expired ? "badge danger" : "badge"}>
                              {expired ? "Expired" : lowStock ? "Low stock" : "OK"}
                            </span>
                          </td>
                          <td>
                            {isAdminUser ? (
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => deleteItem(item._id)}
                              >
                                Delete
                              </button>
                            ) : (
                              <span className="muted">Staff view</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "sales" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="pos-mode-toggle">
              <button
                type="button"
                className={posViewMode === "touch" ? "pos-mode-btn is-active" : "pos-mode-btn"}
                onClick={() => setPosViewMode("touch")}
              >
                ⚡ Speed Touch POS
              </button>
              <button
                type="button"
                className={posViewMode === "detailed" ? "pos-mode-btn is-active" : "pos-mode-btn"}
                onClick={() => setPosViewMode("detailed")}
              >
                📄 Detailed GST Form
              </button>
            </div>

            {posViewMode === "touch" ? (
              <div className="pos-layout">
                {/* Catalog & Search */}
                <div className="pos-catalog-pane">
                  <div className="pos-search-bar">
                    <input
                      type="text"
                      placeholder="Search items by name, SKU, or barcode..."
                      value={posSearch}
                      onChange={(e) => setPosSearch(e.target.value)}
                    />
                  </div>

                  <div className="category-filter-bar" style={{ marginTop: 0 }}>
                    {posCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={posCategory === cat ? "cat-pill is-active" : "cat-pill"}
                        onClick={() => setPosCategory(cat)}
                      >
                        {cat === "all" ? "All Items" : cat}
                      </button>
                    ))}
                  </div>

                  <div className="pos-product-grid">
                    {filteredPosItems.map((item) => {
                      const isLow = Number(item.quantity) <= Number(item.lowStockLevel);
                      return (
                        <div
                          key={item._id}
                          className="pos-item-card"
                          onClick={() => addPosItemToCart(item)}
                        >
                          <div className="pos-item-header">
                            <span className="pos-item-cat">{item.category}</span>
                            <span className={isLow ? "pos-item-stock low" : "pos-item-stock"}>
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                          <div className="pos-item-name">{item.name}</div>
                          <div className="pos-item-footer">
                            <span className="pos-item-price">{formatMoney(item.salePrice)}</span>
                            <button
                              type="button"
                              className="pos-item-add-btn"
                              title="Add to cart"
                              onClick={(e) => {
                                e.stopPropagation();
                                addPosItemToCart(item);
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Sticky Live Checkout Cart */}
                <div className="pos-cart-panel">
                  <div className="pos-cart-header">
                    <div>
                      <h3 style={{ fontSize: "16px" }}>Current Order</h3>
                      <span className="muted" style={{ fontSize: "12px" }}>
                        Invoice #{nextInvoiceNumber || "Draft"}
                      </span>
                    </div>
                    {saleLines.length > 0 && (
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ fontSize: "12px", padding: "2px 8px" }}
                        onClick={() => setSaleLines([])}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <input
                      style={{ padding: "8px 10px", fontSize: "13px" }}
                      placeholder="Customer Name"
                      name="customerName"
                      value={saleDraft.customerName}
                      onChange={updateSaleDraft}
                    />
                    <input
                      style={{ padding: "8px 10px", fontSize: "13px" }}
                      placeholder="Phone (WhatsApp)"
                      name="customerPhone"
                      value={saleDraft.customerPhone || ""}
                      onChange={updateSaleDraft}
                    />
                  </div>

                  <div className="pos-cart-items-list">
                    {saleLines.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: "13px" }}>
                        Cart is empty. Tap any product on the left to add.
                      </div>
                    ) : (
                      saleLines.map((line, idx) => (
                        <div key={`${line.item}-${idx}`} className="pos-cart-row">
                          <div style={{ flex: 1, minWidth: 0, paddingRight: "8px" }}>
                            <div style={{ fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {line.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {formatMoney(line.unitPrice)} each
                            </div>
                          </div>
                          <div className="qty-controls">
                            <button type="button" onClick={() => updatePosCartQty(idx, -1)}>-</button>
                            <span style={{ fontSize: "13px", fontWeight: 700, minWidth: "20px", textAlign: "center" }}>
                              {line.quantity}
                            </span>
                            <button type="button" onClick={() => updatePosCartQty(idx, 1)}>+</button>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: "13px", marginLeft: "10px", minWidth: "55px", textAlign: "right" }}>
                            {formatMoney(line.lineTotal)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px", display: "block" }}>
                      Payment Method
                    </label>
                    <div className="pos-pay-methods">
                      {["cash", "upi", "card", "credit"].map((method) => (
                        <div
                          key={method}
                          className={saleDraft.paymentMethod === method ? "pos-pay-chip is-active" : "pos-pay-chip"}
                          onClick={() => {
                            setSaleDraft((prev) => ({
                              ...prev,
                              paymentMethod: method,
                              paidAmount: method === "credit" ? 0 : salePreview.grandTotal
                            }));
                          }}
                        >
                          {method.toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>

                  {saleDraft.paymentMethod === "upi" && salePreview.grandTotal > 0 && (
                    <div className="pos-upi-box">
                      <img
                        className="pos-upi-qr-img"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                          `upi://pay?pa=${settings?.upiId || "store@upi"}&pn=${encodeURIComponent(
                            settings?.businessName || "Store"
                          )}&am=${salePreview.grandTotal.toFixed(2)}&cu=INR`
                        )}`}
                        alt="UPI QR"
                      />
                      <div style={{ fontSize: "12px" }}>
                        <strong>Scan to Pay {formatMoney(salePreview.grandTotal)}</strong>
                        <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                          UPI: {settings?.upiId || "store@upi"}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                      <span>Subtotal</span>
                      <span>{formatMoney(salePreview.subtotal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                      <span>GST (CGST + SGST)</span>
                      <span>{formatMoney(salePreview.taxTotal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 900, color: "var(--text-main)", marginTop: "4px" }}>
                      <span>Total</span>
                      <span>{formatMoney(salePreview.grandTotal)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="pos-charge-button"
                    disabled={saleLines.length === 0}
                    onClick={submitSale}
                  >
                    Charge {formatMoney(salePreview.grandTotal)}
                  </button>
                </div>
              </div>
            ) : null}

            <section className="panel split" style={{ display: posViewMode === "touch" ? "none" : undefined }}>
            <form className="form-card" onSubmit={submitSale}>
              <div className="panel-head">
                <h3>GST sales invoice</h3>
                <span className="muted">
                  Next invoice: {nextInvoiceNumber || "Loading..."}
                </span>
              </div>

              {settings?.gstNumber ? (
                <p className="invoice-meta">GSTIN: {settings.gstNumber}</p>
              ) : null}

              <div className="field-grid">
                <label>
                  Customer name
                  <input
                    name="customerName"
                    value={saleDraft.customerName}
                    onChange={updateSaleDraft}
                    required
                  />
                </label>
                <label>
                  Customer phone (WhatsApp)
                  <input
                    name="customerPhone"
                    placeholder="9876543210"
                    value={saleDraft.customerPhone || ""}
                    onChange={updateSaleDraft}
                  />
                </label>
                <label>
                  Payment method
                  <select
                    name="paymentMethod"
                    value={saleDraft.paymentMethod}
                    onChange={updateSaleDraft}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank</option>
                    <option value="credit">Credit</option>
                  </select>
                </label>
                <label>
                  Paid amount
                  <input
                    type="number"
                    name="paidAmount"
                    min="0"
                    step="0.01"
                    value={saleDraft.paidAmount}
                    onChange={updateSaleDraft}
                  />
                </label>
                <label>
                  Item
                  <select
                    name="itemId"
                    value={saleDraft.itemId}
                    onChange={(event) =>
                      setSaleDraft((current) => ({
                        ...current,
                        itemId: event.target.value,
                        unitPrice:
                          items.find((item) => item._id === event.target.value)
                            ?.salePrice || 0
                      }))
                    }
                  >
                    <option value="">Choose item</option>
                    {items.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    value={saleDraft.quantity}
                    onChange={updateSaleDraft}
                  />
                </label>
                <label>
                  Unit price
                  <input
                    type="number"
                    name="unitPrice"
                    min="0"
                    step="0.01"
                    value={saleDraft.unitPrice}
                    onChange={updateSaleDraft}
                  />
                </label>
                <label>
                  Discount
                  <input
                    type="number"
                    name="discount"
                    min="0"
                    step="0.01"
                    value={saleDraft.discount}
                    onChange={updateSaleDraft}
                  />
                </label>
                <label>
                  Tax %
                  <input
                    type="number"
                    name="taxRate"
                    min="0"
                    step="0.1"
                    value={saleDraft.taxRate}
                    onChange={updateSaleDraft}
                  />
                </label>
              </div>

              <div className="button-row">
                <button type="button" className="secondary-button" onClick={addSaleLine}>
                  Add line
                </button>
                <button type="submit">Save invoice</button>
              </div>

              <div className="invoice-summary">
                <div className="mini-row">
                  <span>Subtotal</span>
                  <strong>{formatMoney(salePreview.subtotal)}</strong>
                </div>
                <div className="mini-row">
                  <span>CGST</span>
                  <strong>{formatMoney(salePreview.cgst)}</strong>
                </div>
                <div className="mini-row">
                  <span>SGST</span>
                  <strong>{formatMoney(salePreview.sgst)}</strong>
                </div>
                <div className="mini-row">
                  <span>Grand total</span>
                  <strong>{formatMoney(salePreview.grandTotal)}</strong>
                </div>
              </div>

              <div className="line-list">
                {saleLines.map((line, index) => (
                  <div key={`${line.item}-${index}`} className="mini-row">
                    <span>
                      {line.name} - {line.quantity} pcs
                    </span>
                    <strong>{formatMoney(line.lineTotal)}</strong>
                  </div>
                ))}
              </div>
            </form>

            <div className="table-card">
              <div className="panel-head">
                <h3>Recent sales</h3>
                <span className="muted">Invoices and payment status</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale._id}>
                        <td>{sale.invoiceNumber}</td>
                        <td>{sale.customerName}</td>
                        <td>{formatMoney(sale.grandTotal)}</td>
                        <td>
                          <span className="badge">{sale.status}</span>
                        </td>
                        <td>
                          <div className="button-row compact">
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => viewSaleInvoice(sale._id)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                downloadInvoicePdf(sale._id, sale.invoiceNumber)
                              }
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              className="whatsapp-button ghost-button"
                              onClick={() => shareInvoiceWhatsApp(sale)}
                              title="Share invoice via WhatsApp"
                            >
                              WA
                            </button>
                            <button
                              type="button"
                              className="thermal-button ghost-button"
                              onClick={() => openThermalReceipt(sale, "58mm")}
                              title="Print 58mm/80mm POS receipt"
                            >
                              POS
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedSale ? (
                <div className="invoice-preview">
                  <div className="panel-head">
                    <h3>Invoice preview</h3>
                    <span className="muted">{selectedSale.invoiceNumber}</span>
                  </div>
                  <div className="mini-row">
                    <span>Customer</span>
                    <strong>{selectedSale.customerName}</strong>
                  </div>
                  {selectedSale.customerPhone ? (
                    <div className="mini-row">
                      <span>Phone</span>
                      <strong>{selectedSale.customerPhone}</strong>
                    </div>
                  ) : null}
                  <div className="mini-row">
                    <span>Subtotal</span>
                    <strong>{formatMoney(selectedSale.subtotal)}</strong>
                  </div>
                  <div className="mini-row">
                    <span>CGST / SGST</span>
                    <strong>
                      {formatMoney(selectedSale.gst?.cgst)} /{" "}
                      {formatMoney(selectedSale.gst?.sgst)}
                    </strong>
                  </div>
                  <div className="mini-row">
                    <span>Grand total</span>
                    <strong>{formatMoney(selectedSale.grandTotal)}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Due</span>
                    <strong>{formatMoney(selectedSale.dueAmount)}</strong>
                  </div>
                  <div className="button-row" style={{ marginTop: "12px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        downloadInvoicePdf(
                          selectedSale._id,
                          selectedSale.invoiceNumber
                        )
                      }
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      className="whatsapp-button"
                      onClick={() => shareInvoiceWhatsApp(selectedSale)}
                    >
                      Share WhatsApp
                    </button>
                    <button
                      type="button"
                      className="thermal-button"
                      onClick={() => openThermalReceipt(selectedSale, "58mm")}
                    >
                      Thermal POS
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* In Touch POS mode, also display Recent Sales below */}
          {posViewMode === "touch" && (
            <div className="table-card">
              <div className="panel-head">
                <h3>Recent Sales Invoices</h3>
                <span className="muted">Latest bills, WhatsApp links & Thermal POS receipts</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.slice(0, 10).map((sale) => (
                      <tr key={sale._id}>
                        <td>
                          <strong>{sale.invoiceNumber}</strong>
                          <div className="subtext">{formatDate(sale.createdAt)}</div>
                        </td>
                        <td>
                          {sale.customerName}
                          {sale.customerPhone ? <div className="subtext">{sale.customerPhone}</div> : null}
                        </td>
                        <td>
                          <strong>{formatMoney(sale.grandTotal)}</strong>
                        </td>
                        <td>
                          <span className="badge">{sale.paymentMethod?.toUpperCase()}</span>
                        </td>
                        <td>
                          <div className="button-row" style={{ margin: 0, gap: "6px" }}>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => downloadInvoicePdf(sale._id, sale.invoiceNumber)}
                              title="Download PDF Invoice"
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              className="whatsapp-button ghost-button"
                              onClick={() => shareInvoiceWhatsApp(sale)}
                              title="Send bill via WhatsApp"
                            >
                              WhatsApp
                            </button>
                            <button
                              type="button"
                              className="thermal-button ghost-button"
                              onClick={() => openThermalReceipt(sale, "58mm")}
                              title="Print POS Receipt"
                            >
                              POS
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

        {activeTab === "purchases" && (
          <section className="panel split">
            <form className="form-card" onSubmit={submitPurchase}>
              <div className="panel-head">
                <h3>Purchase bill</h3>
                <span className="muted">Adds stock automatically</span>
              </div>

              <div className="field-grid">
                <label>
                  Supplier name
                  <input
                    name="supplierName"
                    value={purchaseDraft.supplierName}
                    onChange={updatePurchaseDraft}
                    required
                  />
                </label>
                <label>
                  Payment method
                  <select
                    name="paymentMethod"
                    value={purchaseDraft.paymentMethod}
                    onChange={updatePurchaseDraft}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank</option>
                    <option value="credit">Credit</option>
                  </select>
                </label>
                <label>
                  Paid amount
                  <input
                    type="number"
                    name="paidAmount"
                    min="0"
                    step="0.01"
                    value={purchaseDraft.paidAmount}
                    onChange={updatePurchaseDraft}
                  />
                </label>
                <label>
                  Item
                  <select
                    name="itemId"
                    value={purchaseDraft.itemId}
                    onChange={(event) =>
                      setPurchaseDraft((current) => ({
                        ...current,
                        itemId: event.target.value,
                        unitCost:
                          items.find((item) => item._id === event.target.value)
                            ?.purchasePrice || 0
                      }))
                    }
                  >
                    <option value="">Choose item</option>
                    {items.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    value={purchaseDraft.quantity}
                    onChange={updatePurchaseDraft}
                  />
                </label>
                <label>
                  Unit cost
                  <input
                    type="number"
                    name="unitCost"
                    min="0"
                    step="0.01"
                    value={purchaseDraft.unitCost}
                    onChange={updatePurchaseDraft}
                  />
                </label>
                <label>
                  Tax %
                  <input
                    type="number"
                    name="taxRate"
                    min="0"
                    step="0.1"
                    value={purchaseDraft.taxRate}
                    onChange={updatePurchaseDraft}
                  />
                </label>
              </div>

              <div className="button-row">
                <button type="button" className="secondary-button" onClick={addPurchaseLine}>
                  Add line
                </button>
                <button type="submit">Save bill</button>
              </div>

              <div className="line-list">
                {purchaseLines.map((line, index) => (
                  <div key={`${line.item}-${index}`} className="mini-row">
                    <span>
                      {line.name} - {line.quantity} units
                    </span>
                    <strong>{formatMoney(line.lineTotal)}</strong>
                  </div>
                ))}
              </div>
            </form>

            <div className="table-card">
              <div className="panel-head">
                <h3>Recent purchases</h3>
                <span className="muted">Bills and supplier payments</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Supplier</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((purchase) => (
                      <tr key={purchase._id}>
                        <td>{purchase.billNumber}</td>
                        <td>{purchase.supplierName}</td>
                        <td>{formatMoney(purchase.grandTotal)}</td>
                        <td>
                          <span className="badge">{purchase.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "parties" && (
          <section className="panel split">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => openPaymentModal("", "customer")}
                  style={{ flex: 1, background: "#059669", color: "#ffffff", fontWeight: "bold" }}
                >
                  📥 + Payment In (Receive Dues)
                </button>
                <button
                  type="button"
                  onClick={() => openPaymentModal("", "supplier")}
                  style={{ flex: 1, background: "#d97706", color: "#ffffff", fontWeight: "bold" }}
                >
                  📤 + Payment Out (Pay Supplier)
                </button>
              </div>

              <form className="form-card" onSubmit={submitParty}>
                <div className="panel-head">
                  <h3>Add Party</h3>
                  <span className="muted">Create customer or supplier profile</span>
                </div>

                <div className="field-grid">
                  <label>
                    Type
                    <select name="type" value={partyForm.type} onChange={updatePartyForm}>
                      <option value="customer">Customer</option>
                      <option value="supplier">Supplier</option>
                    </select>
                  </label>
                  <label>
                    Name
                    <input
                      name="name"
                      value={partyForm.name}
                      onChange={updatePartyForm}
                      required
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      name="phone"
                      value={partyForm.phone}
                      onChange={updatePartyForm}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      name="email"
                      value={partyForm.email}
                      onChange={updatePartyForm}
                    />
                  </label>
                  <label className="wide">
                    Address
                    <input
                      name="address"
                      value={partyForm.address}
                      onChange={updatePartyForm}
                    />
                  </label>
                  <label>
                    Opening balance (₹)
                    <input
                      type="number"
                      name="openingBalance"
                      value={partyForm.openingBalance}
                      onChange={updatePartyForm}
                    />
                  </label>
                </div>

                <button type="submit">Save Party</button>
              </form>

              <div className="table-card">
                <div className="panel-head">
                  <h3>Recent Payment Vouchers</h3>
                  <span className="muted">Receipts & payment settlements</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Voucher #</th>
                        <th>Type</th>
                        <th>Party</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "16px" }} className="muted">
                            No payment vouchers recorded yet.
                          </td>
                        </tr>
                      ) : (
                        payments.slice(0, 8).map((pay) => (
                          <tr key={pay._id}>
                            <td><strong>{pay.voucherNumber}</strong></td>
                            <td>
                              <span className={pay.type === "payment_in" ? "badge success" : "badge warning"}>
                                {pay.type === "payment_in" ? "Payment In" : "Payment Out"}
                              </span>
                            </td>
                            <td>{pay.partyName}</td>
                            <td><strong>{formatMoney(pay.amount)}</strong></td>
                            <td><span className="badge">{pay.paymentMethod}</span></td>
                            <td>{formatDate(pay.paymentDate || pay.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="table-card">
              <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3>Party Statement & Ledger</h3>
                  <span className="muted">Double-entry chronological history</span>
                </div>
                {selectedLedgerParty && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      const p = parties.find((x) => x.name === selectedLedgerParty);
                      openPaymentModal(selectedLedgerParty, p?.type || "customer", ledgerData?.totals?.netBalance || 0);
                    }}
                  >
                    + Record Payment
                  </button>
                )}
              </div>

              <label className="wide" style={{ marginBottom: "12px" }}>
                Select party
                <select
                  value={selectedLedgerParty}
                  onChange={(event) => loadPartyLedger(event.target.value)}
                >
                  <option value="">Choose customer or supplier...</option>
                  {parties.map((party) => (
                    <option key={party._id} value={party.name}>
                      {party.name} ({party.type})
                    </option>
                  ))}
                </select>
              </label>

              {ledgerData ? (
                <div className="ledger-panel">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "12px", background: "var(--bg-card)", padding: "10px", borderRadius: "6px" }}>
                    <div>
                      <small className="muted">Opening Bal</small>
                      <div><strong>{formatMoney(ledgerData.totals?.openingBalance)}</strong></div>
                    </div>
                    <div>
                      <small className="muted">Total Sales</small>
                      <div style={{ color: "#dc2626" }}><strong>{formatMoney(ledgerData.totals?.totalSales)}</strong></div>
                    </div>
                    <div>
                      <small className="muted">Total Payments</small>
                      <div style={{ color: "#16a34a" }}><strong>{formatMoney(ledgerData.totals?.totalPaymentsIn || ledgerData.totals?.totalPaymentsOut)}</strong></div>
                    </div>
                    <div>
                      <small className="muted">Net Balance Due</small>
                      <div style={{ color: Number(ledgerData.totals?.netBalance) > 0 ? "#dc2626" : "#16a34a", fontSize: "15px", fontWeight: "bold" }}>
                        {formatMoney(ledgerData.totals?.netBalance)}
                      </div>
                    </div>
                  </div>

                  {ledgerData.entries && ledgerData.entries.length > 0 ? (
                    <div className="table-wrap" style={{ maxHeight: "280px", overflowY: "auto", marginBottom: "10px" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Ref #</th>
                            <th>Debit (Dr)</th>
                            <th>Credit (Cr)</th>
                            <th>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerData.entries.map((entry, idx) => (
                            <tr key={`${entry.reference}-${idx}`}>
                              <td>{formatDate(entry.date)}</td>
                              <td>
                                <span className={
                                  entry.type === "sale" ? "badge" :
                                  entry.type === "payment_in" ? "badge success" :
                                  entry.type === "purchase" ? "badge warning" : "badge danger"
                                }>
                                  {entry.type === "sale" ? "Sale Inv" :
                                   entry.type === "payment_in" ? "Payment Recd" :
                                   entry.type === "purchase" ? "Purchase Bill" : "Payment Made"}
                                </span>
                              </td>
                              <td><small>{entry.reference}</small></td>
                              <td style={{ color: entry.debit > 0 ? "#dc2626" : "inherit" }}>
                                {entry.debit > 0 ? formatMoney(entry.debit) : "-"}
                              </td>
                              <td style={{ color: entry.credit > 0 ? "#16a34a" : "inherit" }}>
                                {entry.credit > 0 ? formatMoney(entry.credit) : "-"}
                              </td>
                              <td><strong>{formatMoney(entry.balance)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {Number(ledgerData.totals.receivable) > 0 ? (
                    <button
                      type="button"
                      className="whatsapp-button"
                      style={{ marginTop: "10px", width: "100%" }}
                      onClick={() =>
                        shareDueReminderWhatsApp(
                          selectedLedgerParty,
                          ledgerData.totals.receivable,
                          parties.find((p) => p.name === selectedLedgerParty)?.phone
                        )
                      }
                    >
                      Send WhatsApp Due Reminder
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ marginTop: "8px", width: "100%", borderColor: "#0f766e", color: "#0f766e", fontWeight: "bold" }}
                    onClick={shareDetailedLedgerWhatsApp}
                  >
                    📲 Share Detailed Ledger Statement on WhatsApp
                  </button>
                </div>
              ) : null}

              <div className="two-column-list" style={{ marginTop: "16px" }}>
                <div>
                  <h4>Customers ({customerParties.length})</h4>
                  {customerParties.map((party) => (
                    <div key={party._id} className="mini-row" style={{ alignItems: "center" }}>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => loadPartyLedger(party.name)}
                      >
                        {party.name}
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong>{formatMoney(party.openingBalance)}</strong>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ padding: "2px 6px", fontSize: "11px" }}
                          onClick={() => openPaymentModal(party.name, "customer", party.openingBalance)}
                          title="Record Payment In"
                        >
                          + Recv
                        </button>
                        {Number(party.openingBalance) > 0 ? (
                          <button
                            type="button"
                            className="whatsapp-button ghost-button"
                            style={{ padding: "2px 6px", fontSize: "10px" }}
                            onClick={() =>
                              shareDueReminderWhatsApp(
                                party.name,
                                party.openingBalance,
                                party.phone
                              )
                            }
                            title="Send WhatsApp reminder"
                          >
                            WA
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <h4>Suppliers ({supplierParties.length})</h4>
                  {supplierParties.map((party) => (
                    <div key={party._id} className="mini-row" style={{ alignItems: "center" }}>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => loadPartyLedger(party.name)}
                      >
                        {party.name}
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong>{formatMoney(party.openingBalance)}</strong>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ padding: "2px 6px", fontSize: "11px" }}
                          onClick={() => openPaymentModal(party.name, "supplier", party.openingBalance)}
                          title="Record Payment Out"
                        >
                          + Pay
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "returns" && (
          <section className="panel split">
            <form className="form-card" onSubmit={submitReturn}>
              <div className="panel-head">
                <h3>Create Credit / Debit Note</h3>
                <span className="muted">Sales returns & supplier returns with auto-restock</span>
              </div>

              <div className="field-grid">
                <label>
                  Return Type
                  <select
                    name="type"
                    value={returnForm.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setReturnForm((prev) => ({
                        ...prev,
                        type: newType,
                        partyName: ""
                      }));
                    }}
                  >
                    <option value="sales_return">Sales Return (Credit Note to Customer)</option>
                    <option value="purchase_return">Purchase Return (Debit Note to Supplier)</option>
                  </select>
                </label>

                <label>
                  {returnForm.type === "sales_return" ? "Customer Name" : "Supplier Name"}
                  <input
                    name="partyName"
                    list="partyList"
                    value={returnForm.partyName}
                    onChange={updateReturnForm}
                    placeholder="Enter or select party name"
                    required
                  />
                  <datalist id="partyList">
                    {parties
                      .filter((p) => p.type === (returnForm.type === "sales_return" ? "customer" : "supplier"))
                      .map((p) => (
                        <option key={p._id} value={p.name} />
                      ))}
                  </datalist>
                </label>

                <label>
                  Stock Item
                  <select name="itemId" value={returnForm.itemId} onChange={updateReturnForm} required>
                    <option value="">Choose item...</option>
                    {items.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name} (Stock: {item.quantity} {item.unit})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Quantity Returned
                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    value={returnForm.quantity}
                    onChange={updateReturnForm}
                    required
                  />
                </label>

                <label>
                  Unit Price (₹)
                  <input
                    type="number"
                    name="unitPrice"
                    value={returnForm.unitPrice}
                    onChange={updateReturnForm}
                  />
                </label>

                <label>
                  GST Rate (%)
                  <select name="taxRate" value={returnForm.taxRate} onChange={updateReturnForm}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </label>

                <label>
                  Refund / Settlement Method
                  <select name="refundMethod" value={returnForm.refundMethod} onChange={updateReturnForm}>
                    <option value="cash">Cash Refund</option>
                    <option value="upi">UPI / Online Refund</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="ledger_credit">Adjust Against Dues / Credit Balance</option>
                  </select>
                </label>

                <label className="wide">
                  Return Reason
                  <select name="reason" value={returnForm.reason} onChange={updateReturnForm}>
                    <option value="Customer Return / Exchange">Customer Return / Exchange</option>
                    <option value="Damaged / Defective Quality">Damaged / Defective Quality</option>
                    <option value="Expired / Near Expiry Goods">Expired / Near Expiry Goods</option>
                    <option value="Incorrect Item Dispatched">Incorrect Item Dispatched</option>
                    <option value="Excess Quantity Returned">Excess Quantity Returned</option>
                  </select>
                </label>
              </div>

              <div className="ledger-panel" style={{ marginTop: "14px" }}>
                <div className="mini-row">
                  <span>Estimated Refund / Credit:</span>
                  <strong style={{ fontSize: "16px", color: "var(--accent)" }}>
                    {formatMoney(
                      (Number(returnForm.quantity) || 0) *
                        (Number(returnForm.unitPrice) || 0) *
                        (1 + (Number(returnForm.taxRate) || 0) / 100)
                    )}
                  </strong>
                </div>
                <small className="muted">
                  {returnForm.type === "sales_return"
                    ? "✓ Item quantity will automatically be restocked into inventory."
                    : "✓ Item quantity will automatically be deducted from inventory."}
                </small>
              </div>

              <button type="submit" style={{ marginTop: "12px", width: "100%" }}>
                {returnForm.type === "sales_return" ? "Issue Credit Note & Restock" : "Issue Debit Note & Return Stock"}
              </button>
            </form>

            <div className="table-card">
              <div className="panel-head">
                <h3>Return Orders & Notes</h3>
                <span className="muted">Chronological audit trail of credit & debit notes</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Note #</th>
                      <th>Type</th>
                      <th>Party</th>
                      <th>Items Returned</th>
                      <th>Total Amount</th>
                      <th>Refund Mode</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "20px" }} className="muted">
                          No returns recorded yet.
                        </td>
                      </tr>
                    ) : (
                      returns.map((ret) => (
                        <tr key={ret._id}>
                          <td><strong>{ret.returnNumber}</strong></td>
                          <td>
                            <span className={ret.type === "sales_return" ? "badge purple" : "badge warning"}>
                              {ret.type === "sales_return" ? "Credit Note" : "Debit Note"}
                            </span>
                          </td>
                          <td>{ret.partyName}</td>
                          <td>
                            {(ret.items || []).map((it) => `${it.name} (x${it.quantity})`).join(", ")}
                          </td>
                          <td><strong>{formatMoney(ret.grandTotal)}</strong></td>
                          <td><span className="badge">{ret.refundMethod}</span></td>
                          <td>{formatDate(ret.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "daybook" && (
          <section className="panel">
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3>Cash & Bank Daybook</h3>
                <span className="muted">Daily cash register, digital collection audit, and reconciliation</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ margin: 0, fontWeight: "bold", fontSize: "13px" }}>
                  Register Date:
                  <input
                    type="date"
                    value={daybookDate}
                    onChange={(e) => {
                      setDaybookDate(e.target.value);
                      loadDaybook(e.target.value);
                    }}
                    style={{ marginLeft: "8px", padding: "6px 10px" }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => loadDaybook(daybookDate)}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            {daybookData ? (
              <>
                <div className="kpi-grid">
                  <article className="kpi-card">
                    <span>Cash In Hand Inflow</span>
                    <strong style={{ color: "#16a34a" }}>+{formatMoney(daybookData.summary?.cashInflow)}</strong>
                    <small className="muted">Cash sales & customer receipts</small>
                  </article>
                  <article className="kpi-card">
                    <span>Digital / UPI / Bank Inflow</span>
                    <strong style={{ color: "#0284c7" }}>+{formatMoney(daybookData.summary?.digitalInflow)}</strong>
                    <small className="muted">UPI, card & netbanking</small>
                  </article>
                  <article className="kpi-card">
                    <span>Cash Outflow</span>
                    <strong style={{ color: "#dc2626" }}>-{formatMoney(daybookData.summary?.cashOutflow)}</strong>
                    <small className="muted">Cash purchases, vendor pays & exp</small>
                  </article>
                  <article className="kpi-card">
                    <span>Digital Outflow</span>
                    <strong style={{ color: "#dc2626" }}>-{formatMoney(daybookData.summary?.digitalOutflow)}</strong>
                    <small className="muted">Bank purchases & expenses</small>
                  </article>
                  <article className="kpi-card" style={{ borderColor: "var(--accent)" }}>
                    <span>Net Cash Flow (Today)</span>
                    <strong style={{ color: daybookData.summary?.netCashflow >= 0 ? "var(--accent)" : "#dc2626" }}>
                      {formatMoney(daybookData.summary?.netCashflow)}
                    </strong>
                    <small className="muted">Inflows minus Outflows</small>
                  </article>
                  <article className="kpi-card">
                    <span>Net Cash in Hand Change</span>
                    <strong>{formatMoney(daybookData.summary?.netCashChange)}</strong>
                    <small className="muted">Cash drawer movement</small>
                  </article>
                  <article className="kpi-card">
                    <span>Net Digital Bank Change</span>
                    <strong>{formatMoney(daybookData.summary?.netDigitalChange)}</strong>
                    <small className="muted">Bank / UPI balance movement</small>
                  </article>
                  <article className="kpi-card">
                    <span>Total Day's Turnover</span>
                    <strong>{formatMoney(daybookData.totals?.totalSales)}</strong>
                    <small className="muted">Gross sales invoiced</small>
                  </article>
                </div>

                <div className="table-card" style={{ marginTop: "16px" }}>
                  <div className="panel-head">
                    <h3>Daybook Register Transactions</h3>
                    <span className="muted">
                      {daybookData.transactions?.length || 0} entries on {daybookDate}
                    </span>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Type</th>
                          <th>Ref #</th>
                          <th>Party / Category</th>
                          <th>Payment Mode</th>
                          <th>Inflow (+)</th>
                          <th>Outflow (-)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!daybookData.transactions || daybookData.transactions.length === 0 ? (
                          <tr>
                            <td colSpan="7" style={{ textAlign: "center", padding: "20px" }} className="muted">
                              No transactions recorded on {daybookDate}.
                            </td>
                          </tr>
                        ) : (
                          daybookData.transactions.map((tx, idx) => (
                            <tr key={`${tx.reference}-${idx}`}>
                              <td>{new Date(tx.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                              <td>
                                <span className={
                                  tx.type === "Sale" ? "badge" :
                                  tx.type === "Customer Payment (In)" ? "badge success" :
                                  tx.type === "Purchase" ? "badge warning" :
                                  tx.type === "Supplier Payment (Out)" ? "badge danger" :
                                  tx.type === "Sales Return Refund" ? "badge purple" : "badge info"
                                }>
                                  {tx.type}
                                </span>
                              </td>
                              <td><strong>{tx.reference}</strong></td>
                              <td>{tx.party}</td>
                              <td>
                                <span style={{ textTransform: "uppercase", fontSize: "11px", fontWeight: "bold" }}>
                                  {tx.mode}
                                </span>
                              </td>
                              <td style={{ color: tx.inflow > 0 ? "#16a34a" : "inherit", fontWeight: tx.inflow > 0 ? "bold" : "normal" }}>
                                {tx.inflow > 0 ? `+${formatMoney(tx.inflow)}` : "-"}
                              </td>
                              <td style={{ color: tx.outflow > 0 ? "#dc2626" : "inherit", fontWeight: tx.outflow > 0 ? "bold" : "normal" }}>
                                {tx.outflow > 0 ? `-${formatMoney(tx.outflow)}` : "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <p className="muted">Loading daybook...</p>
            )}
          </section>
        )}

        {activeTab === "gst" && (
          <section className="panel">
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3>GST Filing & Tax Summary (GSTR-1 & GSTR-3B)</h3>
                <span className="muted">Output GST from sales, Input Tax Credit (ITC) from purchases, and Net GST payable</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ margin: 0, fontWeight: "bold", fontSize: "13px" }}>
                  Filing Month:
                  <input
                    type="month"
                    value={gstMonth}
                    onChange={(e) => {
                      setGstMonth(e.target.value);
                      loadGstSummary(e.target.value);
                    }}
                    style={{ marginLeft: "8px", padding: "6px 10px" }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={exportGstCsv}
                  title="Export official CSV report"
                >
                  📥 Download CSV Report
                </button>
              </div>
            </div>

            {gstData ? (
              <>
                <div className="kpi-grid">
                  <article className="kpi-card">
                    <span>Taxable Sales Turnover</span>
                    <strong>{formatMoney(gstData.outwardSales?.totalTaxableTurnover)}</strong>
                    <small className="muted">{gstData.outwardSales?.invoiceCount || 0} sales outward</small>
                  </article>
                  <article className="kpi-card">
                    <span>Output GST (Sales Tax)</span>
                    <strong style={{ color: "#dc2626" }}>{formatMoney(gstData.outwardSales?.totalTax)}</strong>
                    <small className="muted">CGST: {formatMoney(gstData.outwardSales?.cgst)} | SGST: {formatMoney(gstData.outwardSales?.sgst)}</small>
                  </article>
                  <article className="kpi-card">
                    <span>Taxable Purchases</span>
                    <strong>{formatMoney(gstData.inwardPurchases?.totalTaxableTurnover)}</strong>
                    <small className="muted">{gstData.inwardPurchases?.billCount || 0} purchase bills</small>
                  </article>
                  <article className="kpi-card">
                    <span>Input Tax Credit (ITC)</span>
                    <strong style={{ color: "#16a34a" }}>{formatMoney(gstData.inwardPurchases?.totalTax)}</strong>
                    <small className="muted">Eligible ITC from vendors</small>
                  </article>
                  <article className="kpi-card" style={{ gridColumn: "span 2", borderColor: "var(--accent)", background: "var(--accent-light)" }}>
                    <span style={{ color: "var(--accent-dark)", fontWeight: "bold" }}>Net GST Status ({gstMonth})</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "4px" }}>
                      <strong style={{ fontSize: "24px", color: gstData.netGstPayable > 0 ? "#dc2626" : "#0f766e" }}>
                        {formatMoney(Math.abs(gstData.netGstPayable))}
                      </strong>
                      <span className={gstData.netGstPayable > 0 ? "badge danger" : "badge success"}>
                        {gstData.netGstPayable > 0 ? "Tax Payable to Govt" : "ITC Carry Forward / Zero Due"}
                      </span>
                    </div>
                    <small className="muted" style={{ color: "var(--accent-dark)" }}>
                      Formula: Output GST ({formatMoney(gstData.outwardSales?.totalTax)}) - Eligible ITC ({formatMoney(gstData.inwardPurchases?.totalTax)})
                    </small>
                  </article>
                </div>

                <div className="table-card" style={{ marginTop: "16px" }}>
                  <div className="panel-head">
                    <h3>GST Rate Slab Breakdown (GSTR-3B Table 3.1)</h3>
                    <span className="muted">Tax collection and ITC split by standard tax rate</span>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>GST Rate</th>
                          <th>Outward Taxable Value</th>
                          <th>Output CGST</th>
                          <th>Output SGST</th>
                          <th>Inward Taxable Value</th>
                          <th>ITC Available</th>
                          <th>Net Tax Payable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(gstData.slabBreakdown || {}).map(([rate, slab]) => (
                          <tr key={rate}>
                            <td><strong>{rate}% GST</strong></td>
                            <td>{formatMoney(slab.outwardTaxable)}</td>
                            <td>{formatMoney(slab.outputTax / 2)}</td>
                            <td>{formatMoney(slab.outputTax / 2)}</td>
                            <td>{formatMoney(slab.inwardTaxable)}</td>
                            <td>{formatMoney(slab.inputTax)}</td>
                            <td>
                              <strong style={{ color: slab.netTax > 0 ? "#dc2626" : "#16a34a" }}>
                                {formatMoney(slab.netTax)}
                              </strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <p className="muted">Loading GST Summary...</p>
            )}
          </section>
        )}

        {activeTab === "reports" && (
          <section className="panel">
            <div className="panel-head">
              <h3>Business reports</h3>
              <span className="muted">Sales, purchase, profit/loss, stock alerts</span>
            </div>

            <div className="kpi-grid">
              <article className="kpi-card">
                <span>Sales total</span>
                <strong>{formatMoney(businessReport?.totals?.salesTotal)}</strong>
              </article>
              <article className="kpi-card">
                <span>Purchase total</span>
                <strong>{formatMoney(businessReport?.totals?.purchaseTotal)}</strong>
              </article>
              <article className="kpi-card">
                <span>Expenses</span>
                <strong>{formatMoney(businessReport?.totals?.expenseTotal)}</strong>
              </article>
              <article className="kpi-card">
                <span>Profit / loss</span>
                <strong>{formatMoney(businessReport?.totals?.profitLoss)}</strong>
              </article>
              <article className="kpi-card">
                <span>Receivables</span>
                <strong>{formatMoney(businessReport?.totals?.receivables)}</strong>
              </article>
              <article className="kpi-card">
                <span>Payables</span>
                <strong>{formatMoney(businessReport?.totals?.payables)}</strong>
              </article>
              <article className="kpi-card">
                <span>Stock value</span>
                <strong>{formatMoney(businessReport?.totals?.stockValue)}</strong>
              </article>
              <article className="kpi-card">
                <span>Low / expiring / expired</span>
                <strong>
                  {metrics.lowStock} / {metrics.expiringSoon} / {metrics.expired}
                </strong>
              </article>
            </div>

            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-head">
                  <h3>Low stock report</h3>
                </div>
                <div className="list-stack">
                  {lowStockItems.map((item) => (
                    <div key={item._id} className="mini-row">
                      <span>{item.name}</span>
                      <strong>
                        {item.quantity} / {item.lowStockLevel}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h3>Expiry report</h3>
                </div>
                <div className="list-stack">
                  {[...expiredItems, ...expiringItems].map((item) => (
                    <div key={item._id} className="mini-row">
                      <span>{item.name}</span>
                      <strong>{formatDate(item.expiryDate)}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h3>Payment due report</h3>
                </div>
                <div className="list-stack">
                  {(paymentReminders?.receivables || []).map((entry) => (
                    <div key={entry.id} className="mini-row">
                      <span>{entry.partyName} (customer)</span>
                      <strong>{formatMoney(entry.dueAmount)}</strong>
                    </div>
                  ))}
                  {(paymentReminders?.payables || []).map((entry) => (
                    <div key={entry.id} className="mini-row">
                      <span>{entry.partyName} (supplier)</span>
                      <strong>{formatMoney(entry.dueAmount)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}

        {activeTab === "expenses" && (
          <section className="panel split">
            <form className="form-card" onSubmit={submitExpense}>
              <div className="panel-head">
                <h3>Record Business Expense</h3>
                <span className="muted">Rent, electricity, wages, materials</span>
              </div>
              <div className="field-grid">
                <label>
                  Expense title
                  <input
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm((c) => ({ ...c, title: e.target.value }))}
                    placeholder="e.g. Shop Rent / Electricity Bill"
                    required
                  />
                </label>
                <label>
                  Category
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm((c) => ({ ...c, category: e.target.value }))}
                  >
                    <option value="Rent">Shop Rent</option>
                    <option value="Electricity & Utilities">Electricity & Utilities</option>
                    <option value="Salaries & Wages">Salaries & Wages</option>
                    <option value="Raw Materials">Raw Materials / Supplies</option>
                    <option value="Transport & Logistics">Transport & Logistics</option>
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </label>
                <label>
                  Amount (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((c) => ({ ...c, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </label>
                <label>
                  Payment method
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm((c) => ({ ...c, paymentMethod: e.target.value }))}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit / Payable</option>
                  </select>
                </label>
                <label className="wide">
                  Notes
                  <input
                    value={expenseForm.note}
                    onChange={(e) => setExpenseForm((c) => ({ ...c, note: e.target.value }))}
                    placeholder="Optional notes or bill reference"
                  />
                </label>
              </div>
              <button type="submit">Save Expense</button>
            </form>

            <div className="table-card">
              <div className="panel-head">
                <h3>Expense Entries</h3>
                <span className="muted">
                  Total: {formatMoney(expenses.reduce((s, x) => s + Number(x.amount || 0), 0))}
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp._id}>
                        <td>
                          <strong>{exp.title}</strong>
                          {exp.note ? <div className="subtext">{exp.note}</div> : null}
                        </td>
                        <td>
                          <span className="badge">{exp.category}</span>
                        </td>
                        <td>{exp.paymentMethod.toUpperCase()}</td>
                        <td>
                          <strong>{formatMoney(exp.amount)}</strong>
                        </td>
                        <td>{formatDate(exp.expenseDate || exp.createdAt)}</td>
                        <td>
                          {isAdminUser ? (
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() => deleteExpenseItem(exp._id)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {!expenses.length ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                          No expenses recorded yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "store" && (
          <section className="panel">
            <div className="storefront-header">
              <div>
                <span className="store-meta-badge">Customer Digital Catalog</span>
                <h3>{settings?.businessName || "Inventory Online Store"}</h3>
                <p>
                  {settings?.address || "Fresh dairy, cold storage & packaged goods"}
                  {settings?.phone ? ` · Contact: ${settings.phone}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={storeViewMode === "storefront" ? "cat-pill is-active" : "cat-pill"}
                  onClick={() => setStoreViewMode("storefront")}
                >
                  Storefront ({items.filter((i) => i.active !== false).length} items)
                </button>
                <button
                  type="button"
                  className={storeViewMode === "orders" ? "cat-pill is-active" : "cat-pill"}
                  onClick={() => setStoreViewMode("orders")}
                >
                  Online Orders ({storeOrders.length})
                </button>
                <button
                  type="button"
                  className="whatsapp-button"
                  style={{ borderRadius: "999px", padding: "6px 14px", fontSize: "13px" }}
                  onClick={() => {
                    const msg = `Check out our digital store & place your orders directly: ${window.location.origin}`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                >
                  Share Store on WhatsApp
                </button>
              </div>
            </div>

            {storeViewMode === "storefront" ? (
              <div className="split" style={{ marginTop: "16px" }}>
                <div>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                    <input
                      style={{ flex: 1 }}
                      placeholder="Search products in catalog..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                    />
                  </div>

                  <div className="category-filter-bar">
                    <button
                      type="button"
                      className={catalogCategory === "all" ? "cat-pill is-active" : "cat-pill"}
                      onClick={() => setCatalogCategory("all")}
                    >
                      All
                    </button>
                    {Array.from(new Set(items.map((i) => i.category || "General"))).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={catalogCategory === cat ? "cat-pill is-active" : "cat-pill"}
                        onClick={() => setCatalogCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="store-grid">
                    {items
                      .filter((i) => i.active !== false)
                      .filter((i) => catalogCategory === "all" || i.category === catalogCategory)
                      .filter((i) => !catalogSearch || i.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                      .map((prod) => {
                        const inStock = Number(prod.quantity || 0) > 0;
                        const cartItem = cart.find((c) => c._id === prod._id);
                        return (
                          <div key={prod._id} className="store-card">
                            <div>
                              <span className="store-card-category">{prod.category}</span>
                              <h4 className="store-card-title">{prod.name}</h4>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                                <span className={inStock ? "badge" : "badge danger"}>
                                  {inStock ? `In Stock (${prod.quantity} ${prod.unit})` : "Out of Stock"}
                                </span>
                                {prod.isColdStorage ? <span className="badge">Cold storage</span> : null}
                              </div>
                            </div>
                            <div>
                              <div className="store-card-price">
                                {formatMoney(prod.salePrice)}{" "}
                                <small style={{ fontSize: "12px", color: "#64748b" }}>/ {prod.unit}</small>
                              </div>
                              <div style={{ marginTop: "10px" }}>
                                {cartItem ? (
                                  <div className="qty-controls">
                                    <button type="button" onClick={() => updateCartQty(prod._id, -1)}>-</button>
                                    <strong style={{ minWidth: "24px", textAlign: "center" }}>{cartItem.quantity}</strong>
                                    <button type="button" onClick={() => updateCartQty(prod._id, 1)}>+</button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    style={{ width: "100%" }}
                                    disabled={!inStock}
                                    onClick={() => addToCart(prod)}
                                  >
                                    {inStock ? "+ Add to Cart" : "Out of stock"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="cart-drawer">
                  <div className="panel-head">
                    <h3>Shopping Cart ({cart.reduce((s, c) => s + c.quantity, 0)} items)</h3>
                    {cart.length ? (
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ padding: "4px 8px", fontSize: "12px" }}
                        onClick={() => setCart([])}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>

                  {!cart.length ? (
                    <div className="empty-state" style={{ padding: "30px 10px", textAlign: "center", color: "#64748b" }}>
                      Your cart is empty. Click "+ Add to Cart" on any product to start an order.
                    </div>
                  ) : (
                    <>
                      <div className="list-stack" style={{ maxHeight: "250px", overflowY: "auto" }}>
                        {cart.map((c) => (
                          <div key={c._id} className="cart-item-row">
                            <div>
                              <strong>{c.name}</strong>
                              <div className="subtext">{formatMoney(c.salePrice)} x {c.quantity} {c.unit}</div>
                            </div>
                            <div className="qty-controls">
                              <button type="button" onClick={() => updateCartQty(c._id, -1)}>-</button>
                              <span>{c.quantity}</span>
                              <button type="button" onClick={() => updateCartQty(c._id, 1)}>+</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="invoice-summary" style={{ margin: "10px 0" }}>
                        <div className="mini-row">
                          <span>Subtotal</span>
                          <strong>
                            {formatMoney(
                              cart.reduce((sum, item) => sum + item.quantity * Number(item.salePrice || 0), 0)
                            )}
                          </strong>
                        </div>
                      </div>

                      <div className="field-grid" style={{ gridTemplateColumns: "1fr" }}>
                        <label>
                          Customer Name *
                          <input
                            value={storeOrderForm.customerName}
                            onChange={(e) => setStoreOrderForm((c) => ({ ...c, customerName: e.target.value }))}
                            placeholder="Your Name"
                            required
                          />
                        </label>
                        <label>
                          WhatsApp Phone *
                          <input
                            value={storeOrderForm.customerPhone}
                            onChange={(e) => setStoreOrderForm((c) => ({ ...c, customerPhone: e.target.value }))}
                            placeholder="9876543210"
                            required
                          />
                        </label>
                        <label>
                          Delivery Address
                          <input
                            value={storeOrderForm.deliveryAddress}
                            onChange={(e) => setStoreOrderForm((c) => ({ ...c, deliveryAddress: e.target.value }))}
                            placeholder="Street, City, Pincode"
                          />
                        </label>
                        <label>
                          Notes / Instructions
                          <input
                            value={storeOrderForm.notes}
                            onChange={(e) => setStoreOrderForm((c) => ({ ...c, notes: e.target.value }))}
                            placeholder="e.g. Leave with security / Urgent delivery"
                          />
                        </label>
                      </div>

                      <div className="button-row" style={{ flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                        <button
                          type="button"
                          className="whatsapp-button"
                          style={{ width: "100%" }}
                          onClick={() => submitStoreOrder(true)}
                        >
                          Send Order on WhatsApp
                        </button>
                        <button
                          type="button"
                          style={{ width: "100%" }}
                          onClick={() => submitStoreOrder(false)}
                        >
                          Submit Online Order
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="table-card" style={{ marginTop: "16px" }}>
                <div className="panel-head">
                  <h3>Customer Online Orders</h3>
                  <span className="muted">Incoming store orders</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeOrders.map((ord) => (
                        <tr key={ord._id}>
                          <td><strong>{ord.orderNumber}</strong></td>
                          <td>
                            {ord.customerName}
                            {ord.deliveryAddress ? <div className="subtext">{ord.deliveryAddress}</div> : null}
                          </td>
                          <td>
                            <a
                              href={`https://wa.me/91${ord.customerPhone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#0f766e", fontWeight: "bold" }}
                            >
                              {ord.customerPhone}
                            </a>
                          </td>
                          <td>
                            {(ord.items || []).map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                          </td>
                          <td><strong>{formatMoney(ord.totalAmount)}</strong></td>
                          <td>
                            <span className={ord.status === "fulfilled" ? "badge" : ord.status === "cancelled" ? "badge danger" : "badge"}>
                              {ord.status}
                            </span>
                          </td>
                          <td>
                            <div className="button-row compact">
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => convertOrderToSale(ord)}
                                title="Turn into a GST Sales Invoice"
                              >
                                Invoice
                              </button>
                              {ord.status === "pending" ? (
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => updateOrderStatus(ord._id, "accepted")}
                                >
                                  Accept
                                </button>
                              ) : ord.status === "accepted" ? (
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => updateOrderStatus(ord._id, "fulfilled")}
                                >
                                  Fulfill
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!storeOrders.length ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
                            No store orders placed yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "auth" && (
          <section className="panel split">
            <form className="form-card" onSubmit={registerUser}>
              <div className="panel-head">
                <h3>User roles</h3>
                <span className="muted">
                  {isAdminUser
                    ? "Admin can create staff users"
                    : "Only admin can register new users"}
                </span>
              </div>

              <div className="field-grid">
                <label>
                  Name
                  <input
                    name="name"
                    value={authForm.name}
                    onChange={updateAuthForm}
                    placeholder="Manager"
                    required
                    disabled={!isAdminUser && session}
                  />
                </label>
                <label>
                  Role
                  <select
                    name="role"
                    value={authForm.role}
                    onChange={updateAuthForm}
                    disabled={!isAdminUser && session}
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    value={authForm.email}
                    onChange={updateAuthForm}
                    placeholder="owner@business.com"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    value={authForm.password}
                    onChange={updateAuthForm}
                    placeholder="Create a password"
                    required
                  />
                </label>
              </div>

              <div className="button-row">
                <button type="submit" disabled={!isAdminUser && session}>
                  Register user
                </button>
                <button type="button" className="secondary-button" onClick={loginUser}>
                  Login
                </button>
                {session ? (
                  <button type="button" className="ghost-button" onClick={logoutUser}>
                    Logout
                  </button>
                ) : null}
              </div>
            </form>

            <div className="table-card">
              <div className="panel-head">
                <h3>Session & backup</h3>
                <span className="muted">Admin/staff access and data export</span>
              </div>
              <div className="session-stack">
                <div className="mini-row">
                  <span>User</span>
                  <strong>{session?.user?.name || "-"}</strong>
                </div>
                <div className="mini-row">
                  <span>Email</span>
                  <strong>{session?.user?.email || "-"}</strong>
                </div>
                <div className="mini-row">
                  <span>Role</span>
                  <strong>{session?.user?.role || "-"}</strong>
                </div>
              </div>

              <div className="list-stack">
                {users.map((user) => (
                  <div key={user._id || user.id} className="mini-row">
                    <span>
                      {user.name} ({user.email})
                    </span>
                    <strong>{user.role}</strong>
                  </div>
                ))}
              </div>

              <div className="button-row" style={{ flexWrap: "wrap", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={exportBackupData}
                  disabled={!isAdminUser}
                >
                  Export backup JSON
                </button>
                <label
                  className="secondary-button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: isAdminUser ? "pointer" : "not-allowed",
                    margin: 0,
                    opacity: isAdminUser ? 1 : 0.55
                  }}
                >
                  <span>Restore backup JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: "none" }}
                    onChange={restoreBackupData}
                    disabled={!isAdminUser}
                  />
                </label>
              </div>

              <div style={{ marginTop: "16px", padding: "14px", backgroundColor: "var(--bg-elevated, #f8fafc)", borderRadius: "8px", border: "1px solid var(--border-color, #e2e8f0)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "14px", color: "var(--text-main)" }}>Automated Server Backups</strong>
                  <span className="badge" style={{ backgroundColor: "#dcfce7", color: "#15803d" }}>Active · 12h Cycle</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px" }}>
                  <div>Last Snapshot: {autoBackupStatus?.lastAutoBackupTime ? new Date(autoBackupStatus.lastAutoBackupTime).toLocaleString("en-IN") : "Running scheduled cycle"}</div>
                  <div>Snapshots Stored: {autoBackupStatus?.availableBackups?.length || 0} (Retained 7 days)</div>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ width: "100%", borderColor: "#0f766e", color: "#0f766e", fontWeight: "bold" }}
                  onClick={triggerServerBackup}
                  disabled={!isAdminUser}
                >
                  ⚡ Trigger Instant Server Backup Now
                </button>
              </div>

              {settings ? (
                <form className="settings-form" onSubmit={saveSettings}>
                  <div className="panel-head">
                    <h3>Business settings</h3>
                    <span className="muted">GST invoice and business profile</span>
                  </div>
                  <div className="field-grid">
                    <label>
                      Business name
                      <input
                        value={settings.businessName || ""}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            businessName: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      GST number
                      <input
                        value={settings.gstNumber || ""}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            gstNumber: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Invoice prefix
                      <input
                        value={settings.invoicePrefix || ""}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            invoicePrefix: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      UPI ID
                      <input
                        value={settings.upiId || ""}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            upiId: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                  <button type="submit" disabled={!isAdminUser}>
                    Save settings
                  </button>
                </form>
              ) : null}
            </div>
          </section>
        )}

        {thermalModalSale ? (
          <div className="modal-overlay" onClick={() => setThermalModalSale(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <h3 style={{ margin: 0 }}>Thermal POS Receipt</h3>
                  <small className="muted">{thermalModalSale.invoiceNumber}</small>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className={thermalWidth === "58mm" ? "cat-pill is-active" : "cat-pill"}
                    onClick={() => openThermalReceipt(thermalModalSale, "58mm")}
                  >
                    58mm (2")
                  </button>
                  <button
                    type="button"
                    className={thermalWidth === "80mm" ? "cat-pill is-active" : "cat-pill"}
                    onClick={() => openThermalReceipt(thermalModalSale, "80mm")}
                  >
                    80mm (3")
                  </button>
                </div>
              </div>

              <div className="modal-body">
                <div
                  id="thermal-receipt-area"
                  className={`thermal-receipt-preview ${thermalWidth === "80mm" ? "w-80" : "w-58"}`}
                >
                  {thermalReceiptText}
                </div>

                {thermalModalSale.grandTotal > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginTop: "14px", padding: "12px", background: "var(--bg-subtle)", borderRadius: "8px" }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                        `upi://pay?pa=${settings?.upiId || "store@upi"}&pn=${encodeURIComponent(
                          settings?.businessName || "Store"
                        )}&am=${thermalModalSale.grandTotal.toFixed(2)}&cu=INR`
                      )}`}
                      style={{ width: "64px", height: "64px", borderRadius: "6px", background: "#ffffff", padding: "4px" }}
                      alt="UPI QR Code"
                    />
                    <div style={{ fontSize: "12px", textAlign: "left" }}>
                      <strong>Scan to Pay {formatMoney(thermalModalSale.grandTotal)}</strong>
                      <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                        UPI ID: {settings?.upiId || "store@upi"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="thermal-button"
                  style={{ flex: 1 }}
                  onClick={printThermalReceipt}
                >
                  Print to Receipt Printer
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={copyThermalReceipt}
                >
                  Copy Text
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setThermalModalSale(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showPaymentModal && (
          <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
              <div className="modal-head">
                <div>
                  <h3 style={{ margin: 0 }}>Record Payment Voucher</h3>
                  <small className="muted">Settle customer dues or pay vendor bills</small>
                </div>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowPaymentModal(false)}
                  style={{ fontSize: "18px", color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={submitPayment} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <label>
                  Voucher Type
                  <select
                    name="type"
                    value={paymentForm.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setPaymentForm((prev) => ({
                        ...prev,
                        type: newType,
                        partyType: newType === "payment_in" ? "customer" : "supplier",
                        partyName: ""
                      }));
                    }}
                  >
                    <option value="payment_in">Payment In (Receipt from Customer)</option>
                    <option value="payment_out">Payment Out (Payment to Supplier)</option>
                  </select>
                </label>

                <label>
                  {paymentForm.type === "payment_in" ? "Customer Name" : "Supplier Name"}
                  <input
                    name="partyName"
                    list="partyNamesList"
                    value={paymentForm.partyName}
                    onChange={updatePaymentForm}
                    placeholder="Select party..."
                    required
                  />
                  <datalist id="partyNamesList">
                    {parties
                      .filter((p) => p.type === (paymentForm.type === "payment_in" ? "customer" : "supplier"))
                      .map((p) => (
                        <option key={p._id} value={p.name} />
                      ))}
                  </datalist>
                </label>

                <label>
                  Amount (₹)
                  <input
                    type="number"
                    name="amount"
                    min="1"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={updatePaymentForm}
                    placeholder="Enter amount"
                    required
                    autoFocus
                  />
                </label>

                <label>
                  Payment Method
                  <select name="paymentMethod" value={paymentForm.paymentMethod} onChange={updatePaymentForm}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="bank">Bank Transfer / NEFT</option>
                    <option value="card">Debit / Credit Card</option>
                  </select>
                </label>

                <label>
                  Payment Date
                  <input
                    type="date"
                    name="paymentDate"
                    value={paymentForm.paymentDate}
                    onChange={updatePaymentForm}
                  />
                </label>

                <label>
                  Reference Note / Transaction ID
                  <input
                    name="referenceNote"
                    value={paymentForm.referenceNote}
                    onChange={updatePaymentForm}
                    placeholder="e.g. UTR / Cheque # / Bill settlement"
                  />
                </label>

                <div className="modal-actions" style={{ marginTop: "12px" }}>
                  <button type="button" className="secondary-button" onClick={() => setShowPaymentModal(false)}>
                    Cancel
                  </button>
                  <button type="submit">
                    Record & Settle Dues
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCmdPalette && (
          <div className="cmd-palette-backdrop" onClick={() => setShowCmdPalette(false)}>
            <div className="cmd-palette-box" onClick={(e) => e.stopPropagation()}>
              <input
                className="cmd-search-input"
                autoFocus
                placeholder="Type to search items, customers, or actions... (ESC to exit)"
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
              />
              <div className="cmd-results">
                {cmdResults.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                    No results found for "{cmdQuery}"
                  </div>
                ) : (
                  cmdResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="cmd-item"
                      onClick={() => item.action()}
                    >
                      <span className="cmd-item-icon">{item.icon}</span>
                      <span className="cmd-item-text">{item.label}</span>
                      <span className="cmd-item-type">{item.type}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;





