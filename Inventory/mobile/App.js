import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.162.33.124:5000/api";

const primaryTabs = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "billing", label: "Billing", icon: "⚡" },
  { id: "stock", label: "Stock", icon: "📦" },
  { id: "more", label: "More", icon: "☰" }
];

const emptyItemForm = {
  name: "",
  category: "Dairy",
  sku: "",
  quantity: "0",
  salePrice: "0",
  expiryDate: "",
  isColdStorage: true
};

const emptyPartyForm = {
  name: "",
  type: "customer",
  phone: "",
  openingBalance: "0"
};

const emptySaleForm = {
  customerName: "Walk-in Customer",
  customerPhone: "",
  paymentMethod: "cash",
  paidAmount: "0",
  itemId: "",
  quantity: "1",
  unitPrice: "0"
};

const emptyPurchaseForm = {
  supplierName: "",
  paymentMethod: "cash",
  paidAmount: "0",
  itemId: "",
  quantity: "1",
  unitCost: "0"
};

const emptyAuthForm = {
  name: "",
  email: "",
  password: "",
  role: "staff"
};

function calcGstPreview(quantity, unitPrice, taxRate, discount = 0) {
  const taxableAmount = Math.max(Number(quantity || 0) * Number(unitPrice || 0) - discount, 0);
  const taxTotal = (taxableAmount * Number(taxRate || 0)) / 100;

  return {
    subtotal: taxableAmount,
    taxTotal,
    cgst: taxTotal / 2,
    sgst: taxTotal / 2,
    grandTotal: taxableAmount + taxTotal
  };
}

function isAdmin(session) {
  return session?.user?.role === "admin";
}

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

let mobileAuthToken = null;
let globalMobileLogout = null;

async function fetchJson(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(mobileAuthToken ? { Authorization: `Bearer ${mobileAuthToken}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login")) {
      mobileAuthToken = null;
      if (globalMobileLogout) {
        globalMobileLogout();
      }
    }
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState("home");
  const [items, setItems] = useState([]);
  const [parties, setParties] = useState([]);
  const [report, setReport] = useState(null);
  const [businessReport, setBusinessReport] = useState(null);
  const [paymentReminders, setPaymentReminders] = useState(null);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedLedgerParty, setSelectedLedgerParty] = useState("");
  const [ledgerData, setLedgerData] = useState(null);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [status, setStatus] = useState("Please log in to continue");
  const [session, setSession] = useState(null);
  const [mobileEmail, setMobileEmail] = useState("");
  const [mobilePassword, setMobilePassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [billingMode, setBillingMode] = useState("sale");

  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [partyForm, setPartyForm] = useState(emptyPartyForm);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [authForm, setAuthForm] = useState(emptyAuthForm);

  const [expenses, setExpenses] = useState([]);
  const [storeCatalog, setStoreCatalog] = useState(null);
  const [storeOrders, setStoreOrders] = useState([]);
  const [thermalModalData, setThermalModalData] = useState(null);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Rent");

  const [mobileCart, setMobileCart] = useState([]);
  const [billingScanActive, setBillingScanActive] = useState(false);
  const [autoBackupInfo, setAutoBackupInfo] = useState(null);

  const [payments, setPayments] = useState([]);
  const [returns, setReturns] = useState([]);
  const [daybookData, setDaybookData] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    partyName: "",
    partyType: "customer",
    type: "payment_in",
    amount: "",
    paymentMethod: "cash",
    referenceNote: ""
  });
  const [returnForm, setReturnForm] = useState({
    type: "sales_return",
    partyName: "",
    itemId: "",
    quantity: "1",
    unitPrice: "0",
    refundMethod: "cash",
    reason: "Customer Return"
  });

  async function submitPayment() {
    if (!paymentForm.partyName || !Number(paymentForm.amount)) {
      Alert.alert("Missing details", "Please select a party and enter an amount");
      return;
    }
    setStatus("Recording payment...");
    try {
      await fetchJson("/payments", {
        method: "POST",
        body: JSON.stringify(paymentForm)
      });
      setShowPaymentModal(false);
      setPaymentForm({
        partyName: "",
        partyType: "customer",
        type: "payment_in",
        amount: "",
        paymentMethod: "cash",
        referenceNote: ""
      });
      setStatus("Payment recorded!");
      Alert.alert("Success", "Payment voucher recorded and settled successfully!");
      await loadAll();
      if (selectedLedgerParty) {
        await loadPartyLedger(selectedLedgerParty);
      }
    } catch (err) {
      Alert.alert("Error", err.message);
      setStatus(err.message);
    }
  }

  function openPaymentModal(partyName = "", partyType = "customer", amount = "") {
    setPaymentForm({
      partyName,
      partyType,
      type: partyType === "supplier" ? "payment_out" : "payment_in",
      amount: Number(amount) > 0 ? String(amount) : "",
      paymentMethod: "cash",
      referenceNote: ""
    });
    setShowPaymentModal(true);
  }

  async function submitReturn() {
    if (!returnForm.partyName || !returnForm.itemId || !Number(returnForm.quantity)) {
      Alert.alert("Missing details", "Please select party, item, and valid quantity");
      return;
    }
    const item = items.find((i) => i._id === returnForm.itemId);
    if (!item) {
      Alert.alert("Error", "Invalid item selected");
      return;
    }
    setStatus("Recording return...");
    try {
      const unitPrice =
        Number(returnForm.unitPrice) ||
        (returnForm.type === "sales_return" ? Number(item.salePrice) : Number(item.purchasePrice)) ||
        0;
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
              taxRate: Number(item.taxRate || 5)
            }
          ]
        })
      });
      setReturnForm({
        type: "sales_return",
        partyName: "",
        itemId: "",
        quantity: "1",
        unitPrice: "0",
        refundMethod: "cash",
        reason: "Customer Return"
      });
      setStatus("Return recorded & inventory adjusted!");
      Alert.alert("Success", "Return order recorded and stock restocked/deducted!");
      await loadAll();
    } catch (err) {
      Alert.alert("Error", err.message);
      setStatus(err.message);
    }
  }

  function addToMobileCart(item, qty = 1) {
    if (!item) return;
    setMobileCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.item === item._id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + qty
        };
        return next;
      }
      return [
        ...prev,
        {
          item: item._id,
          name: item.name,
          sku: item.sku,
          unitPrice: Number(item.salePrice || 0),
          taxRate: Number(item.taxRate || 5),
          quantity: qty,
          discount: 0
        }
      ];
    });
  }

  function updateMobileCartQty(itemId, delta) {
    setMobileCart((prev) =>
      prev
        .map((c) => {
          if (c.item === itemId) {
            const nextQty = c.quantity + delta;
            return nextQty > 0 ? { ...c, quantity: nextQty } : null;
          }
          return c;
        })
        .filter(Boolean)
    );
  }

  function removeFromMobileCart(itemId) {
    setMobileCart((prev) => prev.filter((c) => c.item !== itemId));
  }

  function clearMobileCart() {
    setMobileCart([]);
  }

  const mobileCartSummary = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    for (const line of mobileCart) {
      const taxable = Math.max(
        0,
        Number(line.quantity || 0) * Number(line.unitPrice || 0) - Number(line.discount || 0)
      );
      const tax = (taxable * Number(line.taxRate || 0)) / 100;
      subtotal += taxable;
      taxTotal += tax;
    }
    const grandTotal = subtotal + taxTotal;
    return {
      subtotal,
      taxTotal,
      cgst: taxTotal / 2,
      sgst: taxTotal / 2,
      grandTotal,
      itemCount: mobileCart.reduce((s, c) => s + Number(c.quantity || 0), 0)
    };
  }, [mobileCart]);

  const selectedSaleItem = useMemo(
    () => items.find((item) => item._id === saleForm.itemId),
    [items, saleForm.itemId]
  );
  const selectedPurchaseItem = useMemo(
    () => items.find((item) => item._id === purchaseForm.itemId),
    [items, purchaseForm.itemId]
  );
  const totals = report?.totals || {};
  const saleGstPreview = useMemo(() => {
    if (!selectedSaleItem) {
      return null;
    }

    return calcGstPreview(
      saleForm.quantity,
      saleForm.unitPrice || selectedSaleItem.salePrice,
      selectedSaleItem.taxRate || 0
    );
  }, [selectedSaleItem, saleForm.quantity, saleForm.unitPrice]);
  const isAdminUser = isAdmin(session);
  const lowStockItems = report?.lowStockItems || [];
  const expiringItems = report?.expiringItems || [];
  const expiredItems = report?.expiredItems || [];
  const customers = parties.filter((party) => party.type === "customer");
  const suppliers = parties.filter((party) => party.type === "supplier");

  async function loadAll() {
    setStatus("Syncing...");

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
        ordersData,
        autoBackupData,
        paymentsData,
        returnsData,
        daybookDataRes,
        gstDataRes
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
        fetchJson("/returns").catch(() => []),
        fetchJson("/reports/daybook").catch(() => null),
        fetchJson("/reports/gst-summary").catch(() => null)
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
      setStoreOrders(ordersData || []);
      setAutoBackupInfo(autoBackupData);
      setPayments(paymentsData || []);
      setReturns(returnsData || []);
      setDaybookData(daybookDataRes || null);
      setGstData(gstDataRes || null);
      setStatus("Synced");
    } catch (error) {
      setStatus(error.message);
    }
  }

  const [refreshing, setRefreshing] = useState(false);

  async function onPullToRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  useEffect(() => {
    globalMobileLogout = () => {
      setSession(null);
      mobileAuthToken = null;
      setStatus("Session expired. Please log in.");
    };
    return () => {
      globalMobileLogout = null;
    };
  }, []);

  useEffect(() => {
    if (session?.token) {
      mobileAuthToken = session.token;
      loadAll();
      const interval = setInterval(() => {
        loadAll();
      }, 25000);
      return () => clearInterval(interval);
    } else {
      mobileAuthToken = null;
    }
  }, [session?.token]);

  async function handleMobileLogin(email, pass) {
    const targetEmail = (email || mobileEmail).trim();
    const targetPassword = pass || mobilePassword;
    if (!targetEmail || !targetPassword) {
      setLoginError("Please enter email and password");
      return;
    }
    setIsLoggingIn(true);
    setLoginError("");
    setStatus("Authenticating...");

    try {
      const data = await fetchJson("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: targetEmail, password: targetPassword })
      });
      mobileAuthToken = data.token;
      setSession(data);
      setStatus("Welcome, " + (data.user?.name || "User"));
    } catch (err) {
      setLoginError(err.message || "Invalid credentials");
      setStatus("Login failed: " + (err.message || "Invalid credentials"));
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleMobileLogout() {
    mobileAuthToken = null;
    setSession(null);
    setStatus("Logged out");
  }

  function updateForm(setter, field, value) {
    setter((current) => ({ ...current, [field]: value }));
  }

  function goTo(screenId) {
    setActiveScreen(screenId);
  }

  async function submitItem() {
    if (!itemForm.name.trim() || !itemForm.sku.trim()) {
      Alert.alert("Missing details", "Item name and SKU are required.");
      return;
    }

    setStatus("Saving item...");

    try {
      await fetchJson("/items", {
        method: "POST",
        body: JSON.stringify({
          name: itemForm.name,
          category: itemForm.category,
          sku: itemForm.sku,
          quantity: Number(itemForm.quantity),
          salePrice: Number(itemForm.salePrice),
          price: Number(itemForm.salePrice),
          expiryDate: itemForm.expiryDate || undefined,
          isColdStorage: itemForm.isColdStorage
        })
      });

      setItemForm(emptyItemForm);
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function submitParty() {
    if (!partyForm.name.trim()) {
      Alert.alert("Missing details", "Party name is required.");
      return;
    }

    setStatus("Saving party...");

    try {
      await fetchJson("/parties", {
        method: "POST",
        body: JSON.stringify({
          name: partyForm.name,
          type: partyForm.type,
          phone: partyForm.phone,
          openingBalance: Number(partyForm.openingBalance)
        })
      });

      setPartyForm(emptyPartyForm);
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function submitSale() {
    let saleItems = [];
    let grandTotal = 0;

    if (mobileCart.length > 0) {
      saleItems = mobileCart.map((c) => ({
        item: c.item,
        quantity: Number(c.quantity),
        unitPrice: Number(c.unitPrice),
        taxRate: Number(c.taxRate || 0),
        discount: Number(c.discount || 0)
      }));
      grandTotal = mobileCartSummary.grandTotal;
    } else if (selectedSaleItem) {
      saleItems = [
        {
          item: selectedSaleItem._id,
          quantity: Number(saleForm.quantity || 1),
          unitPrice: Number(saleForm.unitPrice || selectedSaleItem.salePrice),
          taxRate: Number(selectedSaleItem.taxRate || 0),
          discount: 0
        }
      ];
      grandTotal = saleGstPreview ? saleGstPreview.grandTotal : 0;
    } else {
      Alert.alert("No Items", "Add products to the cart or select an item first.");
      return;
    }

    setStatus("Saving sale...");

    const paidAmt =
      saleForm.paidAmount !== "" && saleForm.paidAmount !== undefined
        ? Number(saleForm.paidAmount)
        : saleForm.paymentMethod === "credit"
        ? 0
        : grandTotal;

    try {
      const created = await fetchJson("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerName: saleForm.customerName || "Walk-in Customer",
          customerPhone: saleForm.customerPhone || "",
          paymentMethod: saleForm.paymentMethod || "cash",
          paidAmount: paidAmt,
          items: saleItems
        })
      });

      setSaleForm(emptySaleForm);
      setMobileCart([]);
      setStatus("Sale saved!");
      await loadAll();
      Alert.alert(
        "Invoice Saved",
        `Invoice ${created.invoiceNumber || ""} created for ${formatMoney(created.grandTotal)}.`
      );
    } catch (error) {
      setStatus(error.message);
      Alert.alert("Sale Error", error.message);
    }
  }

  async function submitPurchase() {
    if (!selectedPurchaseItem) {
      Alert.alert("Choose item", "Select a stock item for the purchase.");
      return;
    }

    if (!purchaseForm.supplierName.trim()) {
      Alert.alert("Missing details", "Supplier name is required.");
      return;
    }

    setStatus("Saving purchase...");

    try {
      await fetchJson("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierName: purchaseForm.supplierName,
          paymentMethod: purchaseForm.paymentMethod,
          paidAmount: Number(purchaseForm.paidAmount),
          items: [
            {
              item: selectedPurchaseItem._id,
              quantity: Number(purchaseForm.quantity),
              unitCost: Number(
                purchaseForm.unitCost || selectedPurchaseItem.purchasePrice || 0
              ),
              taxRate: Number(selectedPurchaseItem.taxRate || 0)
            }
          ]
        })
      });

      setPurchaseForm(emptyPurchaseForm);
      await loadAll();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function lookupBarcode(code = barcodeQuery) {
    const value = String(code || "").trim();

    if (!value) {
      Alert.alert("Barcode", "Enter or scan a barcode first.");
      return;
    }

    setStatus("Looking up barcode...");

    try {
      const item = await fetchJson(`/items/lookup/barcode/${encodeURIComponent(value)}`);
      setBarcodeResult(item);
      setBarcodeQuery(value);
      setShowScanner(false);
      setStatus(`Found ${item.name}`);
    } catch (error) {
      setBarcodeResult(null);
      setStatus(error.message);
      Alert.alert("Barcode", error.message);
    }
  }

  async function loadPartyLedger(partyName) {
    if (!partyName) {
      setLedgerData(null);
      setSelectedLedgerParty("");
      return;
    }

    setSelectedLedgerParty(partyName);
    setStatus("Loading ledger...");

    try {
      const data = await fetchJson(`/reports/ledger/${encodeURIComponent(partyName)}`);
      setLedgerData(data);
      setStatus("Ledger loaded");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function openInvoicePdf(sale) {
    const url = `${API_URL}/sales/${sale._id}/pdf`;

    try {
      if (Platform.OS === "web") {
        Linking.openURL(url);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}${sale.invoiceNumber.replace(/\//g, "-")}.pdf`;
      const download = await FileSystem.downloadAsync(url, fileUri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(download.uri);
      } else {
        Linking.openURL(download.uri);
      }
    } catch (error) {
      Alert.alert("PDF", error.message);
    }
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

    const phoneParam = cleanPhone
      ? cleanPhone.length === 10
        ? `91${cleanPhone}`
        : cleanPhone
      : "";
    const waUrl = phoneParam
      ? `whatsapp://send?phone=${phoneParam}&text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`;

    Linking.openURL(waUrl).catch(() => {
      Linking.openURL(`https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`);
    });
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

    const phoneParam = cleanPhone
      ? cleanPhone.length === 10
        ? `91${cleanPhone}`
        : cleanPhone
      : "";
    const waUrl = phoneParam
      ? `whatsapp://send?phone=${phoneParam}&text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`;

    Linking.openURL(waUrl).catch(() => {
      Linking.openURL(`https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`);
    });
  }

  async function openThermalReceipt(sale) {
    try {
      setStatus("Loading thermal receipt...");
      const data = await fetchJson(`/sales/${sale._id}/thermal?width=58`);
      setThermalModalData({
        sale,
        receiptText: data.receiptText
      });
      setStatus("Receipt ready");
    } catch {
      setThermalModalData({
        sale,
        receiptText:
          `RECEIPT - ${sale.invoiceNumber}\n` +
          `Date: ${new Date(sale.createdAt || Date.now()).toLocaleDateString("en-IN")}\n` +
          `Customer: ${sale.customerName}\n` +
          `Total: Rs.${sale.grandTotal}`
      });
    }
  }

  async function shareThermalReceiptText(receiptText) {
    try {
      await Share.share({ message: receiptText });
    } catch (e) {
      Alert.alert("Share", e.message);
    }
  }

  async function submitExpense() {
    if (!expenseTitle.trim() || !expenseAmount) {
      Alert.alert("Required", "Expense title and amount are required.");
      return;
    }
    setStatus("Saving expense...");
    try {
      await fetchJson("/expenses", {
        method: "POST",
        body: JSON.stringify({
          title: expenseTitle.trim(),
          amount: Number(expenseAmount),
          category: expenseCategory,
          paymentMethod: "cash"
        })
      });
      setExpenseTitle("");
      setExpenseAmount("");
      await loadAll();
    } catch (err) {
      Alert.alert("Expense error", err.message);
    }
  }

  async function deleteExpenseItem(id) {
    try {
      await fetchJson(`/expenses/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      Alert.alert("Delete error", err.message);
    }
  }

  async function exportBackupData() {
    if (!isAdminUser) {
      Alert.alert("Backup", "Only admin can export backup.");
      return;
    }

    setStatus("Exporting backup...");

    try {
      const data = await fetchJson("/backup/export");
      const fileUri = `${FileSystem.cacheDirectory}inventory-backup.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert("Backup", "Backup file saved in app cache.");
      }

      setStatus("Backup exported");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function registerUser() {
    if (!authForm.email.trim() || !authForm.password.trim()) {
      Alert.alert("Missing details", "Email and password are required.");
      return;
    }

    if (session && !isAdminUser) {
      Alert.alert("Roles", "Only admin can register new users.");
      return;
    }

    setStatus("Creating user...");

    try {
      const user = await fetchJson("/auth/register", {
        method: "POST",
        body: JSON.stringify(authForm)
      });
      setSession({ user });
      setAuthForm(emptyAuthForm);
      setStatus("Admin created");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function loginUser() {
    setStatus("Logging in...");

    try {
      const data = await fetchJson("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password
        })
      });
      setSession(data);
      setStatus("Logged in");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleBillingBarcodeScanned(code) {
    const val = String(code || "").trim();
    if (!val) return;
    setStatus(`Scanning ${val}...`);
    try {
      const found = await fetchJson(`/items/lookup/barcode/${encodeURIComponent(val)}`);
      addToMobileCart(found, 1);
      setBillingScanActive(false);
      setStatus(`Added ${found.name} to cart`);
      Alert.alert(
        "Item Added to Cart",
        `Added 1x ${found.name} (${formatMoney(found.salePrice)}) to the POS cart.`
      );
    } catch (err) {
      Alert.alert("Barcode Not Found", `No stock item found matching barcode: ${val}`);
      setStatus("Barcode not found");
    }
  }

  function autoGenerateLowStockPO() {
    if (!lowStockItems.length) {
      Alert.alert("Stock Healthy", "No items are currently below low-stock threshold.");
      return;
    }
    const targetItem = lowStockItems[0];
    const restockQty = Math.max(5, (targetItem.lowStockLevel || 5) * 2 - (targetItem.quantity || 0));
    setPurchaseForm({
      supplierName: targetItem.supplierName || (suppliers[0]?.name || "Local Supplier"),
      paymentMethod: "cash",
      paidAmount: String(restockQty * (targetItem.purchasePrice || 0)),
      itemId: targetItem._id,
      quantity: String(restockQty),
      unitCost: String(targetItem.purchasePrice || 0)
    });
    setBillingMode("purchase");
    setActiveScreen("billing");
    Alert.alert(
      "⚡ Restock PO Drafted",
      `Auto-filled PO for ${targetItem.name} (${restockQty} units at ${formatMoney(targetItem.purchasePrice)}). Found ${lowStockItems.length} low stock items.`
    );
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
              `• ${new Date(e.date || Date.now()).toLocaleDateString("en-IN")}: ${e.description || e.type} - Rs.${Number(e.amount || 0).toFixed(2)}`
          )
          .join("\n") +
        "\n";
    }

    const message =
      `*ACCOUNT STATEMENT - ${bizName.toUpperCase()}*\n\n` +
      `*Party:* ${selectedLedgerParty}\n` +
      (phone ? `*Phone:* ${phone}\n` : "") +
      `*Date:* ${new Date().toLocaleDateString("en-IN")}\n` +
      `--------------------------------\n` +
      `*Opening Balance:* Rs.${Number(totals.openingBalance || 0).toFixed(2)}\n` +
      `*Total Invoiced / Receivable:* Rs.${Number(totals.receivable || 0).toFixed(2)}\n` +
      `*Total Paid / Received:* Rs.${Number(totals.payable || 0).toFixed(2)}\n` +
      `--------------------------------\n` +
      `*NET BALANCE DUE: Rs.${Number(totals.netBalance || 0).toFixed(2)}*\n` +
      (Number(totals.netBalance) > 0
        ? `*(Kindly arrange payment of this pending amount)*\n`
        : `*(Account is settled. Thank you!)*\n`) +
      txList +
      (settings?.upiId ? `\n*Pay via UPI:* ${settings.upiId}\n` : "") +
      `\nThank you for your business!`;

    const phoneParam = cleanPhone
      ? cleanPhone.length === 10
        ? `91${cleanPhone}`
        : cleanPhone
      : "";
    const waUrl = phoneParam
      ? `whatsapp://send?phone=${phoneParam}&text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`;

    Linking.openURL(waUrl).catch(() => {
      Linking.openURL(`https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`);
    });
  }

  async function triggerServerBackup() {
    setStatus("Running server backup...");
    try {
      const res = await fetchJson("/backup/trigger", { method: "POST" });
      setAutoBackupInfo(res);
      setStatus("Server backup created!");
      Alert.alert("Backup Complete", "Automated database snapshot successfully saved on server.");
    } catch (err) {
      Alert.alert("Backup Failed", err.message);
    }
  }

  const screenContext = {
    activeScreen,
    authForm,
    barcodeQuery,
    barcodeResult,
    billingMode,
    businessReport,
    customers,
    expiredItems,
    expiringItems,
    exportBackupData,
    goTo,
    isAdminUser,
    itemForm,
    items,
    ledgerData,
    loadPartyLedger,
    lookupBarcode,
    lowStockItems,
    loadAll,
    nextInvoiceNumber,
    openInvoicePdf,
    parties,
    partyForm,
    paymentReminders,
    purchaseForm,
    purchases,
    saleGstPreview,
    sales,
    saleForm,
    selectedLedgerParty,
    selectedPurchaseItem,
    selectedSaleItem,
    session,
    setAuthForm,
    setBarcodeQuery,
    setBillingMode,
    setItemForm,
    setPartyForm,
    setPurchaseForm,
    setSaleForm,
    setShowScanner,
    settings,
    showScanner,
    status,
    submitItem,
    submitParty,
    submitPurchase,
    submitSale,
    registerUser,
    loginUser,
    suppliers,
    totals,
    updateForm,
    users,
    expenses,
    storeCatalog,
    storeOrders,
    thermalModalData,
    setThermalModalData,
    expenseTitle,
    setExpenseTitle,
    expenseAmount,
    setExpenseAmount,
    expenseCategory,
    setExpenseCategory,
    shareInvoiceWhatsApp,
    shareDueReminderWhatsApp,
    openThermalReceipt,
    shareThermalReceiptText,
    submitExpense,
    deleteExpenseItem,
    mobileCart,
    addToMobileCart,
    updateMobileCartQty,
    removeFromMobileCart,
    clearMobileCart,
    mobileCartSummary,
    billingScanActive,
    setBillingScanActive,
    handleBillingBarcodeScanned,
    autoGenerateLowStockPO,
    shareDetailedLedgerWhatsApp,
    triggerServerBackup,
    autoBackupInfo,
    payments,
    returns,
    daybookData,
    gstData,
    openPaymentModal,
    submitPayment,
    paymentForm,
    setPaymentForm,
    showPaymentModal,
    setShowPaymentModal,
    returnForm,
    setReturnForm,
    submitReturn
  };

  if (!session?.token) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.loginBrandWrapper}>
            <View style={styles.loginLogoBadge}>
              <Text style={styles.loginLogoText}>FM</Text>
            </View>
            <Text style={styles.loginTitle}>FreshMart Mobile Suite</Text>
            <Text style={styles.loginSubtitle}>
              Sign in with your authorized credentials to access inventory, POS billing, and business accounts.
            </Text>
          </View>

          {loginError ? (
            <View style={styles.loginErrorBanner}>
              <Text style={styles.loginErrorText}>⚠️ {loginError}</Text>
            </View>
          ) : null}

          <View style={styles.loginCard}>
            <Text style={styles.loginInputLabel}>Email Address</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="admin@freshmart.in"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              value={mobileEmail}
              onChangeText={setMobileEmail}
            />

            <Text style={styles.loginInputLabel}>Password</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={mobilePassword}
              onChangeText={setMobilePassword}
            />

            <Pressable
              style={[styles.loginPrimaryBtn, isLoggingIn && { opacity: 0.7 }]}
              onPress={() => handleMobileLogin(mobileEmail, mobilePassword)}
              disabled={isLoggingIn}
            >
              <Text style={styles.loginPrimaryBtnText}>
                {isLoggingIn ? "Verifying Credentials..." : "Sign In to Suite →"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.demoSection}>
            <Text style={styles.demoSectionTitle}>ONE-CLICK DEMO LOGINS</Text>

            <Pressable
              style={styles.demoCard}
              onPress={() => {
                setMobileEmail("admin@freshmart.in");
                setMobilePassword("admin123");
                handleMobileLogin("admin@freshmart.in", "admin123");
              }}
            >
              <Text style={styles.demoCardIcon}>👑</Text>
              <View style={styles.demoCardBody}>
                <Text style={styles.demoCardTitle}>Admin (Owner)</Text>
                <Text style={styles.demoCardDesc}>Full access: POS, GST, Backups, Ledger</Text>
              </View>
              <Text style={styles.demoCardAction}>Tap</Text>
            </Pressable>

            <Pressable
              style={styles.demoCard}
              onPress={() => {
                setMobileEmail("staff@freshmart.in");
                setMobilePassword("staff123");
                handleMobileLogin("staff@freshmart.in", "staff123");
              }}
            >
              <Text style={styles.demoCardIcon}>👤</Text>
              <View style={styles.demoCardBody}>
                <Text style={styles.demoCardTitle}>Staff (Cashier)</Text>
                <Text style={styles.demoCardDesc}>POS Counter, Scan barcodes, Stock</Text>
              </View>
              <Text style={styles.demoCardAction}>Tap</Text>
            </Pressable>
          </View>

          <Text style={styles.loginSecurityNotice}>
            🔒 Protected by cryptographic token authentication. Unauthorized editing is strictly blocked.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.appFrame}>
        <AppHeader status={status} onSync={loadAll} session={session} onLogout={handleMobileLogout} />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullToRefresh}
              colors={["#0f766e"]}
              tintColor="#0f766e"
            />
          }
        >
          {activeScreen === "home" ? <HomeScreen {...screenContext} /> : null}
          {activeScreen === "stock" ? <StockScreen {...screenContext} /> : null}
          {activeScreen === "billing" ? <BillingScreen {...screenContext} /> : null}
          {activeScreen === "more" ? <HubScreen {...screenContext} /> : null}
          {activeScreen === "parties" ? <PartiesScreen {...screenContext} /> : null}
          {activeScreen === "store" ? <StoreScreen {...screenContext} /> : null}
          {activeScreen === "reports" ? <ReportsScreen {...screenContext} /> : null}
          {activeScreen === "admin" ? <AdminScreen {...screenContext} /> : null}
        </ScrollView>
        <BottomNav activeScreen={activeScreen} onChange={setActiveScreen} />
      </View>

      {thermalModalData ? (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setThermalModalData(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Thermal POS Receipt</Text>
                <Pressable onPress={() => setThermalModalData(null)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.receiptScroll}>
                <Text style={styles.receiptMonoText}>{thermalModalData.receiptText}</Text>
              </ScrollView>
              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.modalButtonPrimary}
                  onPress={() => shareThermalReceiptText(thermalModalData.receiptText)}
                >
                  <Text style={styles.modalButtonPrimaryText}>Share / Print Text</Text>
                </Pressable>
                <Pressable
                  style={styles.modalButtonSecondary}
                  onPress={() => setThermalModalData(null)}
                >
                  <Text style={styles.modalButtonSecondaryText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {showPaymentModal ? (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPaymentModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {paymentForm.type === "payment_in" ? "📥 Record Payment In" : "📤 Record Payment Out"}
                </Text>
                <Pressable onPress={() => setShowPaymentModal(false)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView style={{ padding: 16 }}>
                <View style={styles.segment}>
                  <SegmentButton
                    active={paymentForm.type === "payment_in"}
                    label="Payment In (Customer)"
                    onPress={() =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        type: "payment_in",
                        partyType: "customer"
                      }))
                    }
                  />
                  <SegmentButton
                    active={paymentForm.type === "payment_out"}
                    label="Payment Out (Vendor)"
                    onPress={() =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        type: "payment_out",
                        partyType: "supplier"
                      }))
                    }
                  />
                </View>

                <Field label={paymentForm.type === "payment_in" ? "Customer Name" : "Supplier Name"}>
                  <TextInput
                    style={styles.input}
                    value={paymentForm.partyName}
                    onChangeText={(val) => setPaymentForm((prev) => ({ ...prev, partyName: val }))}
                    placeholder="Enter or select party name"
                  />
                </Field>

                <Field label="Amount (₹)">
                  <TextInput
                    style={styles.input}
                    value={paymentForm.amount}
                    onChangeText={(val) => setPaymentForm((prev) => ({ ...prev, amount: val }))}
                    keyboardType="decimal-pad"
                    placeholder="Enter payment amount"
                  />
                </Field>

                <Field label="Payment Method">
                  <View style={styles.segment}>
                    {["cash", "upi", "bank"].map((m) => (
                      <SegmentButton
                        key={m}
                        active={paymentForm.paymentMethod === m}
                        label={m.toUpperCase()}
                        onPress={() => setPaymentForm((prev) => ({ ...prev, paymentMethod: m }))}
                      />
                    ))}
                  </View>
                </Field>

                <Field label="Reference Note / UTR">
                  <TextInput
                    style={styles.input}
                    value={paymentForm.referenceNote}
                    onChangeText={(val) => setPaymentForm((prev) => ({ ...prev, referenceNote: val }))}
                    placeholder="UTR / Cheque / Settlement note"
                  />
                </Field>

                <PrimaryButton label="Confirm & Settle Dues" onPress={submitPayment} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

function AppHeader({ status, onSync, session, onLogout }) {
  const isSyncing = status === "Syncing...";
  const isError =
    status &&
    status !== "Synced" &&
    status !== "Syncing..." &&
    !status.includes("ready") &&
    !status.includes("saved") &&
    !status.includes("Loaded");

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>INVENTORY POS</Text>
          <Text style={styles.headerTitle}>Food Stock Manager</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pressable
            style={isError ? styles.statusBadgeError : styles.statusBadge}
            onPress={onSync}
          >
            <Text style={isError ? styles.statusTextError : styles.statusText}>
              {isSyncing ? "🔄 Syncing" : isError ? "⚠️ Retry" : "🟢 Live"}
            </Text>
          </Pressable>
          {session?.user ? (
            <Pressable
              style={styles.mobileLogoutBtn}
              onPress={onLogout}
            >
              <Text style={styles.mobileLogoutText}>🔒 Exit</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {session?.user ? (
        <View style={styles.headerUserRow}>
          <Text style={styles.headerUserName}>👤 {session.user.name}</Text>
          <View style={styles.headerRoleBadge}>
            <Text style={styles.headerRoleText}>{(session.user.role || "Staff").toUpperCase()}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function HomeScreen({
  expiredItems,
  expiringItems,
  goTo,
  items,
  lowStockItems,
  paymentReminders,
  purchases,
  sales,
  totals
}) {
  return (
    <View style={styles.screenStack}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Home dashboard</Text>
        <Text style={styles.title}>Dairy, sauce, and packed food control</Text>
        <Text style={styles.lead}>
          Track stock health, sales, purchases, parties, and expiry from one
          mobile workspace.
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <Stat label="Items" value={totals.items ?? items.length} />
        <Stat label="Low stock" value={totals.lowStock ?? lowStockItems.length} />
        <Stat label="Expiring" value={totals.expiringSoon ?? expiringItems.length} />
        <Stat label="Stock value" value={formatMoney(totals.totalStockValue)} />
      </View>

      {lowStockItems.length > 0 && (
        <Pressable style={styles.actionBanner} onPress={() => goTo("stock")}>
          <Text style={styles.actionBannerIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionBannerTitle}>Low Stock Warning</Text>
            <Text style={styles.actionBannerDesc}>{lowStockItems.length} items running low.</Text>
          </View>
          <Text style={styles.actionBannerArrow}>→</Text>
        </Pressable>
      )}

      {(paymentReminders?.receivables?.length || 0) > 0 && (
        <Pressable style={styles.actionBannerInfo} onPress={() => goTo("parties")}>
          <Text style={styles.actionBannerIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionBannerTitleInfo}>Customer Dues</Text>
            <Text style={styles.actionBannerDescInfo}>Outstanding balances found. Send WhatsApp reminder.</Text>
          </View>
          <Text style={styles.actionBannerArrowInfo}>→</Text>
        </Pressable>
      )}

      <Section title="Quick actions">
        <View style={styles.actionGrid}>
          <ActionButton label="⚡ POS Billing" onPress={() => goTo("billing")} />
          <ActionButton label="📦 Add Stock" onPress={() => goTo("stock")} />
          <ActionButton label="🛍️ Online Store" onPress={() => goTo("store")} />
          <ActionButton label="👥 Parties / Dues" onPress={() => goTo("parties")} />
          <ActionButton label="💸 Log Expense" onPress={() => goTo("reports")} />
          <ActionButton label="📊 Reports & P&L" onPress={() => goTo("reports")} />
        </View>
      </Section>

      <Section title="Payment reminders" subtitle="Customer dues and supplier payables">
        <AlertList
          emptyText="No payment dues right now."
          items={[
            ...(paymentReminders?.receivables || []).map((entry) => ({
              _id: entry.id,
              name: `${entry.partyName} (receive)`,
              metaAmount: entry.dueAmount
            })),
            ...(paymentReminders?.payables || []).map((entry) => ({
              _id: entry.id,
              name: `${entry.partyName} (pay)`,
              metaAmount: entry.dueAmount
            }))
          ]}
          renderMeta={(item) => formatMoney(item.metaAmount)}
        />
      </Section>

      <Section title="Stock alerts" subtitle="Low stock and food safety">
        <AlertList
          emptyText="No stock alerts right now."
          items={[...expiredItems, ...expiringItems, ...lowStockItems].slice(0, 6)}
          renderMeta={(item) =>
            item.expiryDate
              ? `Expiry ${new Date(item.expiryDate).toLocaleDateString("en-IN")}`
              : `${item.quantity} / ${item.lowStockLevel}`
          }
        />
      </Section>

      <Section title="Recent movement">
        <View style={styles.twoColumn}>
          <View style={styles.movementPanel}>
            <Text style={styles.movementTitle}>Sales</Text>
            {sales.slice(0, 3).map((sale) => (
              <RowCard
                key={sale._id}
                title={sale.customerName}
                meta={formatMoney(sale.grandTotal)}
              />
            ))}
          </View>
          <View style={styles.movementPanel}>
            <Text style={styles.movementTitle}>Purchases</Text>
            {purchases.slice(0, 3).map((purchase) => (
              <RowCard
                key={purchase._id}
                title={purchase.supplierName}
                meta={formatMoney(purchase.grandTotal)}
              />
            ))}
          </View>
        </View>
      </Section>
    </View>
  );
}

function StockScreen({
  barcodeQuery,
  barcodeResult,
  itemForm,
  items,
  lookupBarcode,
  setBarcodeQuery,
  setItemForm,
  setShowScanner,
  showScanner,
  submitItem,
  updateForm,
  autoGenerateLowStockPO,
  lowStockItems
}) {
  return (
    <View style={styles.screenStack}>
      <ScreenTitle
        title="Items & Stock"
        subtitle="Add food items, scan barcodes, and check expiry."
      />

      {lowStockItems && lowStockItems.length > 0 ? (
        <Pressable
          style={[styles.actionBanner, { marginBottom: 4 }]}
          onPress={autoGenerateLowStockPO}
        >
          <Text style={styles.actionBannerIcon}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionBannerTitle}>
              {lowStockItems.length} Low Stock Alert
            </Text>
            <Text style={styles.actionBannerDesc}>
              Tap to auto-draft Purchase Restock Order
            </Text>
          </View>
          <Text style={styles.actionBannerArrow}>→</Text>
        </Pressable>
      ) : null}

      <Section title="Barcode scanner">
        <Field label="Barcode or SKU">
          <TextInput
            style={styles.input}
            value={barcodeQuery}
            onChangeText={setBarcodeQuery}
            placeholder="8901234567890"
          />
        </Field>
        <View style={styles.buttonRow}>
          <SecondaryButton label="Find item" onPress={() => lookupBarcode()} />
          <SecondaryButton label="Scan camera" onPress={() => setShowScanner(true)} />
        </View>
        {showScanner ? (
          <BarcodeScanner
            onClose={() => setShowScanner(false)}
            onScan={(value) => lookupBarcode(value)}
          />
        ) : null}
        {barcodeResult ? (
          <RowCard
            title={barcodeResult.name}
            meta={`${barcodeResult.sku} · Qty ${barcodeResult.quantity} · ${formatMoney(barcodeResult.salePrice)}`}
          />
        ) : null}
      </Section>

      <Section title="Add item">
        <Field label="Name">
          <TextInput
            style={styles.input}
            value={itemForm.name}
            onChangeText={(value) => updateForm(setItemForm, "name", value)}
            placeholder="Paneer block"
          />
        </Field>
        <Field label="Category">
          <TextInput
            style={styles.input}
            value={itemForm.category}
            onChangeText={(value) => updateForm(setItemForm, "category", value)}
            placeholder="Dairy"
          />
        </Field>
        <Field label="SKU">
          <TextInput
            style={styles.input}
            value={itemForm.sku}
            onChangeText={(value) => updateForm(setItemForm, "sku", value)}
            placeholder="PANEER-001"
            autoCapitalize="characters"
          />
        </Field>
        <View style={styles.fieldRow}>
          <Field label="Quantity" compact>
            <TextInput
              style={styles.input}
              value={itemForm.quantity}
              onChangeText={(value) => updateForm(setItemForm, "quantity", value)}
              keyboardType="numeric"
            />
          </Field>
          <Field label="Sale price" compact>
            <TextInput
              style={styles.input}
              value={itemForm.salePrice}
              onChangeText={(value) => updateForm(setItemForm, "salePrice", value)}
              keyboardType="decimal-pad"
            />
          </Field>
        </View>
        <Field label="Expiry date">
          <TextInput
            style={styles.input}
            value={itemForm.expiryDate}
            onChangeText={(value) => updateForm(setItemForm, "expiryDate", value)}
            placeholder="YYYY-MM-DD"
          />
        </Field>
        <Pressable
          style={itemForm.isColdStorage ? styles.toggleActive : styles.toggle}
          onPress={() =>
            setItemForm((current) => ({
              ...current,
              isColdStorage: !current.isColdStorage
            }))
          }
        >
          <Text
            style={
              itemForm.isColdStorage ? styles.toggleTextActive : styles.toggleText
            }
          >
            {itemForm.isColdStorage ? "Cold storage item" : "Not cold storage"}
          </Text>
        </Pressable>
        <PrimaryButton label="Save stock item" onPress={submitItem} />
      </Section>

      <Section title="Current stock">
        {items.slice(0, 12).map((item) => (
          <RowCard
            key={item._id}
            title={item.name}
            meta={`${item.quantity} in stock - ${item.sku}`}
          />
        ))}
      </Section>
    </View>
  );
}

function BillingScreen({
  billingMode,
  items,
  nextInvoiceNumber,
  openInvoicePdf,
  openThermalReceipt,
  purchaseForm,
  saleForm,
  saleGstPreview,
  sales,
  selectedPurchaseItem,
  selectedSaleItem,
  setBillingMode,
  setPurchaseForm,
  setSaleForm,
  shareInvoiceWhatsApp,
  submitPurchase,
  submitSale,
  updateForm,
  settings,
  mobileCart,
  addToMobileCart,
  updateMobileCartQty,
  removeFromMobileCart,
  clearMobileCart,
  mobileCartSummary,
  billingScanActive,
  setBillingScanActive,
  handleBillingBarcodeScanned,
  autoGenerateLowStockPO,
  lowStockItems,
  returnForm,
  setReturnForm,
  submitReturn
}) {
  const isSale = billingMode === "sale";
  const activeGrandTotal =
    mobileCart.length > 0 ? mobileCartSummary.grandTotal : saleGstPreview?.grandTotal || 0;

  return (
    <View style={styles.screenStack}>
      <ScreenTitle
        title="Speed Billing & POS"
        subtitle="Multi-item GST sales, camera barcode scan, and purchase restock."
      />

      <View style={styles.segment}>
        <SegmentButton
          active={billingMode === "sale"}
          label={`POS Sale ${mobileCart.length ? `(${mobileCart.length})` : ""}`}
          onPress={() => setBillingMode("sale")}
        />
        <SegmentButton
          active={billingMode === "purchase"}
          label="Purchase"
          onPress={() => setBillingMode("purchase")}
        />
        <SegmentButton
          active={billingMode === "return"}
          label="Returns"
          onPress={() => setBillingMode("return")}
        />
      </View>

      {isSale ? (
        <Section title="New GST Sale Invoice">
          <HelperText>Invoice Number: {nextInvoiceNumber || "Draft"}</HelperText>

          <Field label="Customer Details">
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={saleForm.customerName}
                  onChangeText={(value) => updateForm(setSaleForm, "customerName", value)}
                  placeholder="Customer Name"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={saleForm.customerPhone || ""}
                  onChangeText={(value) => updateForm(setSaleForm, "customerPhone", value)}
                  keyboardType="phone-pad"
                  placeholder="WhatsApp Phone"
                />
              </View>
            </View>
          </Field>

          {/* Product selector & barcode scan */}
          <Field label="Quick Add Products">
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <Pressable
                style={[
                  styles.primaryButton,
                  { flex: 1, backgroundColor: billingScanActive ? "#dc2626" : "#0f766e" }
                ]}
                onPress={() => setBillingScanActive(!billingScanActive)}
              >
                <Text style={styles.primaryButtonText}>
                  {billingScanActive ? "✕ Close Camera" : "📷 Scan Barcode to Cart"}
                </Text>
              </Pressable>
            </View>

            {billingScanActive ? (
              <View style={{ marginBottom: 12 }}>
                <BarcodeScanner
                  onClose={() => setBillingScanActive(false)}
                  onScan={handleBillingBarcodeScanned}
                />
              </View>
            ) : null}

            <Text style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
              Tap any item to add to cart:
            </Text>
            <View style={styles.pickerGrid}>
              {items.slice(0, 12).map((item) => (
                <Pressable
                  key={item._id}
                  style={styles.pickerChip}
                  onPress={() => addToMobileCart(item, 1)}
                >
                  <Text style={styles.pickerChipText}>
                    + {item.name} ({formatMoney(item.salePrice)})
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          {/* Cart items */}
          <View style={{ marginTop: 10 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "900", color: "#172033" }}>
                Cart Items ({mobileCartSummary.itemCount})
              </Text>
              {mobileCart.length > 0 ? (
                <Pressable onPress={clearMobileCart}>
                  <Text style={{ fontSize: 12, color: "#dc2626", fontWeight: "700" }}>
                    Clear All
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {mobileCart.length === 0 ? (
              <View
                style={{
                  padding: 16,
                  borderRadius: 8,
                  backgroundColor: "#f8fafc",
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                  alignItems: "center"
                }}
              >
                <Text style={{ fontSize: 13, color: "#64748b" }}>
                  Cart is empty. Tap items above or scan barcodes to begin.
                </Text>
              </View>
            ) : (
              mobileCart.map((cartLine) => {
                const lineTotal =
                  Number(cartLine.quantity || 1) * Number(cartLine.unitPrice || 0);
                return (
                  <View key={cartLine.item} style={styles.cartItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartItemName}>{cartLine.name}</Text>
                      <Text style={styles.cartItemMeta}>
                        {formatMoney(cartLine.unitPrice)} each · {cartLine.sku}
                      </Text>
                    </View>
                    <View style={styles.cartStepperRow}>
                      <Pressable
                        style={styles.cartStepBtn}
                        onPress={() => updateMobileCartQty(cartLine.item, -1)}
                      >
                        <Text style={styles.cartStepBtnText}>-</Text>
                      </Pressable>
                      <Text style={styles.cartStepQty}>{cartLine.quantity}</Text>
                      <Pressable
                        style={styles.cartStepBtn}
                        onPress={() => updateMobileCartQty(cartLine.item, 1)}
                      >
                        <Text style={styles.cartStepBtnText}>+</Text>
                      </Pressable>
                      <Text style={styles.cartLineTotal}>{formatMoney(lineTotal)}</Text>
                      <Pressable
                        onPress={() => removeFromMobileCart(cartLine.item)}
                        style={{ paddingHorizontal: 4 }}
                      >
                        <Text style={{ color: "#dc2626", fontWeight: "900", fontSize: 15 }}>
                          ✕
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Bill Summary */}
          {activeGrandTotal > 0 ? (
            <View style={[styles.summaryCard, { marginTop: 12 }]}>
              <Text style={styles.summaryLine}>
                Subtotal:{" "}
                {formatMoney(
                  mobileCart.length > 0 ? mobileCartSummary.subtotal : saleGstPreview?.subtotal
                )}
              </Text>
              <Text style={styles.summaryLine}>
                CGST:{" "}
                {formatMoney(
                  mobileCart.length > 0 ? mobileCartSummary.cgst : saleGstPreview?.cgst
                )}{" "}
                · SGST:{" "}
                {formatMoney(
                  mobileCart.length > 0 ? mobileCartSummary.sgst : saleGstPreview?.sgst
                )}
              </Text>
              <Text style={styles.summaryTotal}>
                Grand Total: {formatMoney(activeGrandTotal)}
              </Text>
            </View>
          ) : null}

          {/* Payment Method */}
          <Field label="Payment Method">
            <View style={styles.pickerGrid}>
              {["cash", "upi", "card", "credit"].map((m) => (
                <Pressable
                  key={m}
                  style={
                    saleForm.paymentMethod === m
                      ? [styles.pickerChip, styles.pickerChipActive]
                      : styles.pickerChip
                  }
                  onPress={() => updateForm(setSaleForm, "paymentMethod", m)}
                >
                  <Text
                    style={
                      saleForm.paymentMethod === m
                        ? styles.pickerChipTextActive
                        : styles.pickerChipText
                    }
                  >
                    {m.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          {/* Paid Amount */}
          <Field label="Paid Amount (Optional if full)">
            <TextInput
              style={styles.input}
              value={saleForm.paidAmount}
              onChangeText={(val) => updateForm(setSaleForm, "paidAmount", val)}
              placeholder={`Full amount: ${activeGrandTotal ? activeGrandTotal.toFixed(0) : "0"}`}
              keyboardType="decimal-pad"
            />
          </Field>

          {/* Dynamic UPI QR Code */}
          {saleForm.paymentMethod === "upi" && activeGrandTotal > 0 ? (
            <View
              style={{
                alignItems: "center",
                padding: 14,
                backgroundColor: "#f8fafc",
                borderRadius: 10,
                marginVertical: 10,
                borderWidth: 1,
                borderColor: "#e2e8f0"
              }}
            >
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                    `upi://pay?pa=${settings?.upiId || "store@upi"}&pn=${encodeURIComponent(
                      settings?.businessName || "Store"
                    )}&am=${activeGrandTotal.toFixed(2)}&cu=INR`
                  )}`
                }}
                style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: "#ffffff" }}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "bold",
                  marginTop: 8,
                  color: "#0f172a"
                }}
              >
                Scan to Pay {formatMoney(activeGrandTotal)}
              </Text>
              <Text style={{ fontSize: 11, color: "#64748b" }}>
                UPI: {settings?.upiId || "store@upi"}
              </Text>
            </View>
          ) : null}

          <PrimaryButton
            label={`Save & Charge ${activeGrandTotal > 0 ? formatMoney(activeGrandTotal) : "Bill"}`}
            onPress={submitSale}
          />
        </Section>
      ) : null}

      {billingMode === "purchase" ? (
        <Section title="New Purchase Bill">
          {lowStockItems && lowStockItems.length > 0 ? (
            <Pressable
              style={[styles.actionBanner, { marginBottom: 12 }]}
              onPress={autoGenerateLowStockPO}
            >
              <Text style={styles.actionBannerIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBannerTitle}>Auto-Fill Restock PO</Text>
                <Text style={styles.actionBannerDesc}>
                  {lowStockItems.length} items low. Tap to fill draft purchase order.
                </Text>
              </View>
              <Text style={styles.actionBannerArrow}>→</Text>
            </Pressable>
          ) : null}

          <Field label="Supplier">
            <TextInput
              style={styles.input}
              value={purchaseForm.supplierName}
              onChangeText={(value) => updateForm(setPurchaseForm, "supplierName", value)}
              placeholder="e.g. Fresh Foods Supplier"
            />
          </Field>
          <ItemPicker
            items={items}
            selectedId={purchaseForm.itemId}
            onSelect={(item) =>
              setPurchaseForm((current) => ({
                ...current,
                itemId: item._id,
                unitCost: String(item.purchasePrice || 0)
              }))
            }
          />
          <View style={styles.fieldRow}>
            <Field label="Qty" compact>
              <TextInput
                style={styles.input}
                value={purchaseForm.quantity}
                onChangeText={(value) => updateForm(setPurchaseForm, "quantity", value)}
                keyboardType="numeric"
              />
            </Field>
            <Field label="Paid" compact>
              <TextInput
                style={styles.input}
                value={purchaseForm.paidAmount}
                onChangeText={(value) => updateForm(setPurchaseForm, "paidAmount", value)}
                keyboardType="decimal-pad"
              />
            </Field>
          </View>
          <HelperText>
            {selectedPurchaseItem
              ? `Selected ${selectedPurchaseItem.name}`
              : "Select an item to receive stock."}
          </HelperText>
          <PrimaryButton label="Save purchase" onPress={submitPurchase} />
        </Section>
      ) : null}

      {billingMode === "return" ? (
        <Section title="Credit / Debit Return Note">
          <HelperText>Restocks inventory automatically & issues credit/debit adjustment</HelperText>
          <View style={styles.segment}>
            <SegmentButton
              active={returnForm.type === "sales_return"}
              label="Sales Return (Credit)"
              onPress={() => setReturnForm((prev) => ({ ...prev, type: "sales_return" }))}
            />
            <SegmentButton
              active={returnForm.type === "purchase_return"}
              label="Purchase Return (Debit)"
              onPress={() => setReturnForm((prev) => ({ ...prev, type: "purchase_return" }))}
            />
          </View>

          <Field label={returnForm.type === "sales_return" ? "Customer Name" : "Supplier Name"}>
            <TextInput
              style={styles.input}
              value={returnForm.partyName}
              onChangeText={(val) => setReturnForm((prev) => ({ ...prev, partyName: val }))}
              placeholder="Party name"
            />
          </Field>

          <Field label="Item Returned">
            <View style={styles.pickerGrid}>
              {items.slice(0, 10).map((it) => {
                const active = returnForm.itemId === it._id;
                return (
                  <Pressable
                    key={it._id}
                    style={active ? [styles.pickerChip, styles.pickerChipActive] : styles.pickerChip}
                    onPress={() =>
                      setReturnForm((prev) => ({
                        ...prev,
                        itemId: it._id,
                        unitPrice: String(
                          prev.type === "sales_return" ? it.salePrice || 0 : it.purchasePrice || 0
                        )
                      }))
                    }
                  >
                    <Text style={active ? styles.pickerChipTextActive : styles.pickerChipText}>
                      {it.name} ({it.quantity})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <View style={styles.fieldRow}>
            <Field label="Qty" compact>
              <TextInput
                style={styles.input}
                value={String(returnForm.quantity)}
                onChangeText={(val) => setReturnForm((prev) => ({ ...prev, quantity: val }))}
                keyboardType="numeric"
              />
            </Field>
            <Field label="Price (₹)" compact>
              <TextInput
                style={styles.input}
                value={String(returnForm.unitPrice)}
                onChangeText={(val) => setReturnForm((prev) => ({ ...prev, unitPrice: val }))}
                keyboardType="decimal-pad"
              />
            </Field>
          </View>

          <Field label="Refund Mode">
            <View style={styles.segment}>
              {["cash", "upi", "bank"].map((m) => (
                <SegmentButton
                  key={m}
                  active={returnForm.refundMethod === m}
                  label={m.toUpperCase()}
                  onPress={() => setReturnForm((prev) => ({ ...prev, refundMethod: m }))}
                />
              ))}
            </View>
          </Field>

          <Field label="Reason">
            <TextInput
              style={styles.input}
              value={returnForm.reason}
              onChangeText={(val) => setReturnForm((prev) => ({ ...prev, reason: val }))}
              placeholder="Damaged / Defective / Customer Return"
            />
          </Field>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLine}>
              Item: {items.find((i) => i._id === returnForm.itemId)?.name || "Select an item"}
            </Text>
            <Text style={styles.summaryTotal}>
              Refund Amount:{" "}
              {formatMoney((Number(returnForm.quantity) || 0) * (Number(returnForm.unitPrice) || 0))}
            </Text>
          </View>

          <PrimaryButton
            label={returnForm.type === "sales_return" ? "Issue Credit Note & Restock" : "Issue Debit Note & Deduct Stock"}
            onPress={submitReturn}
          />
        </Section>
      ) : null}

      <Section title="Recent sales">
        {sales.slice(0, 8).map((sale) => (
          <View key={sale._id} style={styles.saleItemCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {sale.invoiceNumber} · {sale.customerName}
              </Text>
              <Text style={styles.rowMeta}>
                {formatMoney(sale.grandTotal)} · {sale.status}
              </Text>
            </View>
            <View style={styles.actionPillRow}>
              <Pressable style={styles.pillButton} onPress={() => openInvoicePdf(sale)}>
                <Text style={styles.pillButtonText}>PDF</Text>
              </Pressable>
              <Pressable
                style={[styles.pillButton, styles.waPillButton]}
                onPress={() => shareInvoiceWhatsApp(sale)}
              >
                <Text style={styles.waPillText}>WA</Text>
              </Pressable>
              <Pressable
                style={[styles.pillButton, styles.thermalPillButton]}
                onPress={() => openThermalReceipt(sale)}
              >
                <Text style={styles.thermalPillText}>POS</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </Section>
    </View>
  );
}

function PartiesScreen({
  customers,
  ledgerData,
  loadPartyLedger,
  partyForm,
  parties,
  selectedLedgerParty,
  setPartyForm,
  submitParty,
  updateForm,
  goTo,
  shareDueReminderWhatsApp,
  shareDetailedLedgerWhatsApp,
  openPaymentModal,
  payments
}) {
  return (
    <View style={styles.screenStack}>
      <Pressable style={styles.backButton} onPress={() => goTo("more")}>
        <Text style={styles.backButtonText}>← Back to Hub</Text>
      </Pressable>
      <ScreenTitle
        title="Parties & Accounting Ledger"
        subtitle="Customer dues, vendor payables, and payment vouchers."
      />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <Pressable
          style={[styles.primaryButton, { flex: 1, backgroundColor: "#059669" }]}
          onPress={() => openPaymentModal("", "customer")}
        >
          <Text style={styles.primaryButtonText}>📥 + Payment In</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, { flex: 1, backgroundColor: "#d97706" }]}
          onPress={() => openPaymentModal("", "supplier")}
        >
          <Text style={styles.primaryButtonText}>📤 + Payment Out</Text>
        </Pressable>
      </View>

      <Section title="Add party">
        <View style={styles.segment}>
          <SegmentButton
            active={partyForm.type === "customer"}
            label="Customer"
            onPress={() => updateForm(setPartyForm, "type", "customer")}
          />
          <SegmentButton
            active={partyForm.type === "supplier"}
            label="Supplier"
            onPress={() => updateForm(setPartyForm, "type", "supplier")}
          />
        </View>
        <Field label="Name">
          <TextInput
            style={styles.input}
            value={partyForm.name}
            onChangeText={(value) => updateForm(setPartyForm, "name", value)}
          />
        </Field>
        <Field label="Phone">
          <TextInput
            style={styles.input}
            value={partyForm.phone}
            onChangeText={(value) => updateForm(setPartyForm, "phone", value)}
            keyboardType="phone-pad"
          />
        </Field>
        <Field label="Opening balance">
          <TextInput
            style={styles.input}
            value={partyForm.openingBalance}
            onChangeText={(value) =>
              updateForm(setPartyForm, "openingBalance", value)
            }
            keyboardType="decimal-pad"
          />
        </Field>
        <PrimaryButton label="Save party" onPress={submitParty} />
      </Section>

      <Section title="Party ledger">
        <View style={styles.pickerGrid}>
          {parties.slice(0, 10).map((party) => {
            const active = selectedLedgerParty === party.name;
            return (
              <Pressable
                key={party._id}
                style={active ? [styles.pickerChip, styles.pickerChipActive] : styles.pickerChip}
                onPress={() => loadPartyLedger(party.name)}
              >
                <Text style={active ? styles.pickerChipTextActive : styles.pickerChipText}>
                  {party.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {ledgerData ? (
          <View style={styles.summaryCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={styles.summaryLine}>
                Opening: {formatMoney(ledgerData.totals?.openingBalance)}
              </Text>
              <Pressable
                style={[styles.pillButton, { backgroundColor: "#0f766e" }]}
                onPress={() => {
                  const p = parties.find((x) => x.name === selectedLedgerParty);
                  openPaymentModal(selectedLedgerParty, p?.type || "customer", ledgerData.totals?.netBalance || 0);
                }}
              >
                <Text style={[styles.pillButtonText, { color: "#ffffff" }]}>+ Record Payment</Text>
              </Pressable>
            </View>
            <Text style={styles.summaryLine}>
              Total Invoiced: {formatMoney(ledgerData.totals?.totalSales || ledgerData.totals?.receivable)}
            </Text>
            <Text style={styles.summaryLine}>
              Total Paid: {formatMoney(ledgerData.totals?.totalPaymentsIn || ledgerData.totals?.totalPaymentsOut || ledgerData.totals?.payable)}
            </Text>
            <Text style={styles.summaryTotal}>
              Net balance: {formatMoney(ledgerData.totals?.netBalance)}
            </Text>

            {ledgerData.entries && ledgerData.entries.length > 0 ? (
              <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#64748b", marginBottom: 6 }}>
                  Recent Transactions:
                </Text>
                {ledgerData.entries.slice(-5).map((e, idx) => (
                  <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, color: "#334155" }}>
                      {e.description || e.type} ({e.reference})
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "bold", color: e.debit > 0 ? "#dc2626" : "#16a34a" }}>
                      {e.debit > 0 ? `+${formatMoney(e.debit)}` : `-${formatMoney(e.credit)}`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryButton, { marginTop: 10, backgroundColor: "#0f766e" }]}
              onPress={shareDetailedLedgerWhatsApp}
            >
              <Text style={styles.primaryButtonText}>📲 Share Full Statement on WhatsApp</Text>
            </Pressable>
            {Number(ledgerData.totals?.receivable) > 0 ? (
              <Pressable
                style={[styles.primaryButton, styles.waButton, { marginTop: 8 }]}
                onPress={() =>
                  shareDueReminderWhatsApp(
                    selectedLedgerParty,
                    ledgerData.totals.receivable,
                    parties.find((p) => p.name === selectedLedgerParty)?.phone
                  )
                }
              >
                <Text style={styles.primaryButtonText}>WhatsApp Due Reminder</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Section>

      <Section title="Customers">
        {customers.slice(0, 8).map((party) => (
          <View key={party._id} style={styles.partyItemRow}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => loadPartyLedger(party.name)}
            >
              <Text style={styles.rowTitle}>{party.name}</Text>
              <Text style={styles.rowMeta}>
                {party.phone || "No phone"} · Bal: {formatMoney(party.openingBalance)}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Pressable
                style={[styles.pillButton, { backgroundColor: "#dcfce7" }]}
                onPress={() => openPaymentModal(party.name, "customer", party.openingBalance)}
              >
                <Text style={[styles.pillButtonText, { color: "#166534" }]}>+ Recv</Text>
              </Pressable>
              {Number(party.openingBalance) > 0 ? (
                <Pressable
                  style={[styles.pillButton, styles.waPillButton]}
                  onPress={() =>
                    shareDueReminderWhatsApp(
                      party.name,
                      party.openingBalance,
                      party.phone
                    )
                  }
                >
                  <Text style={styles.waPillText}>WA Due</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </Section>

      <Section title="Suppliers">
        {suppliers.slice(0, 6).map((party) => (
          <View key={party._id} style={styles.partyItemRow}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => loadPartyLedger(party.name)}
            >
              <Text style={styles.rowTitle}>{party.name}</Text>
              <Text style={styles.rowMeta}>
                {party.phone || "No phone"} · Bal: {formatMoney(party.openingBalance)}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.pillButton, { backgroundColor: "#fef3c7" }]}
              onPress={() => openPaymentModal(party.name, "supplier", party.openingBalance)}
            >
              <Text style={[styles.pillButtonText, { color: "#92400e" }]}>+ Pay</Text>
            </Pressable>
          </View>
        ))}
      </Section>

      {payments && payments.length > 0 ? (
        <Section title={`Recent Payment Vouchers (${payments.length})`}>
          {payments.slice(0, 5).map((pay) => (
            <RowCard
              key={pay._id}
              title={`${pay.voucherNumber} · ${pay.partyName}`}
              meta={`${pay.type === "payment_in" ? "Received" : "Paid"} ${formatMoney(pay.amount)} · ${pay.paymentMethod}`}
            />
          ))}
        </Section>
      ) : null}
    </View>
  );
}

function StoreScreen({ items, settings, storeOrders, goTo }) {
  const activeItems = items.filter((i) => i.active !== false);

  function shareStore() {
    const bizPhone = settings?.phone || "";
    const msg = `Visit our store catalog: fresh batches, cold storage & dairy!\nOrder on WhatsApp: ${bizPhone}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() => {
      Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
    });
  }

  return (
    <View style={styles.screenStack}>
      <Pressable style={styles.backButton} onPress={() => goTo("more")}>
        <Text style={styles.backButtonText}>← Back to Hub</Text>
      </Pressable>
      <ScreenTitle
        title="Online Store"
        subtitle="Catalog & incoming WhatsApp customer orders."
      />

      <Section title="Digital Storefront">
        <RowCard
          title={settings?.businessName || "Inventory Online Store"}
          meta={`${settings?.address || "Main Outlet"} · ${settings?.phone || "No phone"}`}
        />
        <Pressable
          style={[styles.primaryButton, styles.waButton, { marginTop: 10 }]}
          onPress={shareStore}
        >
          <Text style={styles.primaryButtonText}>Share Store on WhatsApp</Text>
        </Pressable>
      </Section>

      <Section title={`Catalog Items (${activeItems.length})`}>
        {activeItems.map((prod) => (
          <RowCard
            key={prod._id}
            title={`${prod.name} (${prod.category})`}
            meta={`${formatMoney(prod.salePrice)} / ${prod.unit} · ${prod.quantity > 0 ? `Stock: ${prod.quantity}` : "Out of stock"}`}
          />
        ))}
      </Section>

      <Section title={`Online Orders (${storeOrders.length})`}>
        {!storeOrders.length ? (
          <Text style={styles.emptyText}>No orders received yet.</Text>
        ) : (
          storeOrders.map((ord) => (
            <RowCard
              key={ord._id}
              title={`${ord.orderNumber} · ${ord.customerName} (${ord.customerPhone})`}
              meta={`${formatMoney(ord.totalAmount)} · ${ord.status}`}
            />
          ))
        )}
      </Section>
    </View>
  );
}

function ReportsScreen({
  businessReport,
  deleteExpenseItem,
  expenseAmount,
  expenseCategory,
  expenseTitle,
  expenses,
  expiredItems,
  expiringItems,
  lowStockItems,
  paymentReminders,
  setExpenseAmount,
  setExpenseCategory,
  setExpenseTitle,
  submitExpense,
  totals,
  goTo,
  daybookData,
  gstData
}) {
  return (
    <View style={styles.screenStack}>
      <Pressable style={styles.backButton} onPress={() => goTo("more")}>
        <Text style={styles.backButtonText}>← Back to Hub</Text>
      </Pressable>
      <ScreenTitle
        title="Reports & P&L"
        subtitle="Sales, purchase, expenses, profit/loss, expiry, and stock."
      />

      <View style={styles.statsGrid}>
        <Stat label="Sales" value={formatMoney(businessReport?.totals?.salesTotal)} />
        <Stat label="Purchase" value={formatMoney(businessReport?.totals?.purchaseTotal)} />
        <Stat label="Expenses" value={formatMoney(businessReport?.totals?.expenseTotal)} />
        <Stat label="Profit/Loss" value={formatMoney(businessReport?.totals?.profitLoss)} />
      </View>

      {daybookData ? (
        <Section title={`Daybook Register (${daybookData.date})`}>
          <View style={styles.statsGrid}>
            <Stat label="Cash Inflow" value={`+${formatMoney(daybookData.summary?.cashInflow)}`} />
            <Stat label="Digital Inflow" value={`+${formatMoney(daybookData.summary?.digitalInflow)}`} />
            <Stat label="Cash Outflow" value={`-${formatMoney(daybookData.summary?.cashOutflow)}`} />
            <Stat label="Net Cashflow" value={formatMoney(daybookData.summary?.netCashflow)} />
          </View>
        </Section>
      ) : null}

      {gstData ? (
        <Section title={`GST Summary (${gstData.period})`}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLine}>
              Outward Turnover: {formatMoney(gstData.outwardSales?.totalTaxableTurnover)}
            </Text>
            <Text style={styles.summaryLine}>
              Output GST (Collected): {formatMoney(gstData.outwardSales?.totalTax)}
            </Text>
            <Text style={styles.summaryLine}>
              Inward Purchases: {formatMoney(gstData.inwardPurchases?.totalTaxableTurnover)}
            </Text>
            <Text style={styles.summaryLine}>
              Input Tax Credit (ITC): {formatMoney(gstData.inwardPurchases?.totalTax)}
            </Text>
            <View style={{ borderTopWidth: 1, borderTopColor: "#e2e8f0", marginTop: 8, paddingTop: 8 }}>
              <Text style={[styles.summaryTotal, { color: gstData.netGstPayable > 0 ? "#dc2626" : "#0f766e" }]}>
                Net GST: {formatMoney(Math.abs(gstData.netGstPayable))}
                {gstData.netGstPayable > 0 ? " (Payable to Govt)" : " (ITC Carry Forward)"}
              </Text>
            </View>
          </View>
        </Section>
      ) : null}

      <Section title="Record business expense">
        <Field label="Expense title">
          <TextInput
            style={styles.input}
            value={expenseTitle}
            onChangeText={setExpenseTitle}
            placeholder="Shop rent / Electricity"
          />
        </Field>
        <View style={styles.fieldRow}>
          <Field label="Category" compact>
            <TextInput
              style={styles.input}
              value={expenseCategory}
              onChangeText={setExpenseCategory}
              placeholder="Rent"
            />
          </Field>
          <Field label="Amount" compact>
            <TextInput
              style={styles.input}
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </Field>
        </View>
        <PrimaryButton label="Save expense" onPress={submitExpense} />
      </Section>

      <Section title={`Recent expenses (${expenses.length})`}>
        {expenses.slice(0, 6).map((exp) => (
          <View key={exp._id} style={styles.partyItemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{exp.title} ({exp.category})</Text>
              <Text style={styles.rowMeta}>{formatMoney(exp.amount)} · {exp.paymentMethod}</Text>
            </View>
            <Pressable
              style={styles.pillButton}
              onPress={() => deleteExpenseItem(exp._id)}
            >
              <Text style={styles.pillButtonText}>Del</Text>
            </Pressable>
          </View>
        ))}
        {!expenses.length ? (
          <Text style={styles.emptyText}>No expenses recorded yet.</Text>
        ) : null}
      </Section>

      <Section title="Low stock report">
        <AlertList
          emptyText="No low stock items."
          items={lowStockItems}
          renderMeta={(item) => `${item.quantity} / ${item.lowStockLevel}`}
        />
      </Section>

      <Section title="Expiry report">
        <AlertList
          emptyText="No expiry alerts."
          items={[...expiredItems, ...expiringItems]}
          renderMeta={(item) =>
            item.expiryDate
              ? new Date(item.expiryDate).toLocaleDateString("en-IN")
              : "-"
          }
        />
      </Section>

      <Section title="Payment due report">
        <AlertList
          emptyText="No payment dues."
          items={[
            ...(paymentReminders?.receivables || []).map((entry) => ({
              _id: entry.id,
              name: `${entry.partyName} receivable`,
              metaAmount: entry.dueAmount
            })),
            ...(paymentReminders?.payables || []).map((entry) => ({
              _id: entry.id,
              name: `${entry.partyName} payable`,
              metaAmount: entry.dueAmount
            }))
          ]}
          renderMeta={(item) => formatMoney(item.metaAmount)}
        />
      </Section>

      <Section title="Summary">
        <RowCard
          title="Stock value"
          meta={formatMoney(businessReport?.totals?.stockValue)}
        />
      </Section>
    </View>
  );
}

function AdminScreen({
  authForm,
  exportBackupData,
  isAdminUser,
  loginUser,
  registerUser,
  session,
  setAuthForm,
  settings,
  updateForm,
  users,
  goTo,
  triggerServerBackup,
  autoBackupInfo
}) {
  return (
    <View style={styles.screenStack}>
      <Pressable style={styles.backButton} onPress={() => goTo("more")}>
        <Text style={styles.backButtonText}>← Back to Hub</Text>
      </Pressable>
      <ScreenTitle
        title="Settings & Admin"
        subtitle="Staff accounts, system settings, and database backup."
      />

      <Section title="Account access">
        <Field label="Name">
          <TextInput
            style={styles.input}
            value={authForm.name}
            onChangeText={(value) => updateForm(setAuthForm, "name", value)}
          />
        </Field>
        <Field label="Email">
          <TextInput
            style={styles.input}
            value={authForm.email}
            onChangeText={(value) => updateForm(setAuthForm, "email", value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>
        <Field label="Password">
          <TextInput
            style={styles.input}
            value={authForm.password}
            onChangeText={(value) => updateForm(setAuthForm, "password", value)}
            secureTextEntry
          />
        </Field>
        <Field label="Role">
          <View style={styles.segment}>
            <SegmentButton
              active={authForm.role === "admin"}
              label="Admin"
              onPress={() => updateForm(setAuthForm, "role", "admin")}
            />
            <SegmentButton
              active={authForm.role === "staff"}
              label="Staff"
              onPress={() => updateForm(setAuthForm, "role", "staff")}
            />
          </View>
        </Field>
        <View style={styles.buttonRow}>
          <SecondaryButton label="Register" onPress={registerUser} />
          <SecondaryButton label="Login" onPress={loginUser} />
        </View>
      </Section>

      <Section title="Session">
        <RowCard
          title={session?.user?.name || "No user signed in"}
          meta={`${session?.user?.role || "Role pending"} · ${session?.user?.email || "-"}`}
        />
      </Section>

      <Section title="Users">
        {users.slice(0, 8).map((user) => (
          <RowCard
            key={user._id || user.id}
            title={user.name}
            meta={`${user.email} · ${user.role}`}
          />
        ))}
      </Section>

      <Section title="Automated Server Backups">
        <HelperText>
          Automatic full snapshots saved on the backend server every 12 hours (last 7 days retained).
        </HelperText>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLine}>
            Schedule: 🟢 Active (Every 12h)
          </Text>
          <Text style={styles.summaryLine}>
            Last Snapshot:{" "}
            {autoBackupInfo?.lastAutoBackupTime
              ? new Date(autoBackupInfo.lastAutoBackupTime).toLocaleString("en-IN")
              : "Running scheduled cycle"}
          </Text>
          <Text style={styles.summaryLine}>
            Saved snapshots: {autoBackupInfo?.availableBackups?.length || 0}
          </Text>
          <Pressable
            style={[styles.primaryButton, { marginTop: 10, backgroundColor: "#0f766e" }]}
            onPress={triggerServerBackup}
          >
            <Text style={styles.primaryButtonText}>⚡ Trigger Server Backup Now</Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Manual Export & Share">
        <HelperText>
          {isAdminUser
            ? "Export complete business dataset as JSON and share via WhatsApp or Drive."
            : "Only admin can export backup."}
        </HelperText>
        <PrimaryButton
          label="Export & Share JSON"
          onPress={exportBackupData}
        />
      </Section>

      {settings?.gstNumber ? (
        <Section title="Business GST">
          <RowCard title={settings.businessName || "Business"} meta={settings.gstNumber} />
        </Section>
      ) : null}
    </View>
  );
}

function BarcodeScanner({ onScan, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  if (!permission) {
    return <Text style={styles.helperText}>Checking camera permission...</Text>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.scannerBox}>
        <Text style={styles.helperText}>Camera permission is required for barcode scan.</Text>
        <PrimaryButton label="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.scannerBox}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "code128", "qr"]
        }}
        onBarcodeScanned={({ data }) => {
          if (locked) {
            return;
          }

          setLocked(true);
          onScan(data);
          setTimeout(() => setLocked(false), 1200);
        }}
      />
      <SecondaryButton label="Close scanner" onPress={onClose} />
    </View>
  );
}

function HubScreen({ goTo }) {
  return (
    <View style={styles.screenStack}>
      <ScreenTitle
        title="Operations Hub"
        subtitle="Customer ledger, online catalog, expenses & reports"
      />

      <View style={styles.hubGrid}>
        <Pressable style={styles.hubCard} onPress={() => goTo("parties")}>
          <Text style={styles.hubCardIcon}>👥</Text>
          <Text style={styles.hubCardTitle}>Parties & Ledger</Text>
          <Text style={styles.hubCardDesc}>Customers, suppliers & WhatsApp payment reminders</Text>
        </Pressable>

        <Pressable style={styles.hubCard} onPress={() => goTo("store")}>
          <Text style={styles.hubCardIcon}>🛍️</Text>
          <Text style={styles.hubCardTitle}>Online Store & Orders</Text>
          <Text style={styles.hubCardDesc}>Manage public catalog & incoming customer orders</Text>
        </Pressable>

        <Pressable style={styles.hubCard} onPress={() => goTo("reports")}>
          <Text style={styles.hubCardIcon}>📊</Text>
          <Text style={styles.hubCardTitle}>Reports & P&L</Text>
          <Text style={styles.hubCardDesc}>Expense logging, profit & loss, and daily sales trends</Text>
        </Pressable>

        <Pressable style={styles.hubCard} onPress={() => goTo("admin")}>
          <Text style={styles.hubCardIcon}>⚙️</Text>
          <Text style={styles.hubCardTitle}>Settings & Backups</Text>
          <Text style={styles.hubCardDesc}>Staff accounts, database backup & business configuration</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BottomNav({ activeScreen, onChange }) {
  const isMoreActive = ["more", "parties", "store", "reports", "admin"].includes(activeScreen);

  return (
    <View style={styles.bottomNav}>
      {primaryTabs.map((screen) => {
        const active = screen.id === "more" ? isMoreActive : activeScreen === screen.id;
        return (
          <Pressable
            key={screen.id}
            style={active ? styles.navItemActive : styles.navItem}
            onPress={() => onChange(screen.id)}
          >
            <Text style={active ? styles.navIconActive : styles.navIcon}>
              {screen.icon}
            </Text>
            <Text style={active ? styles.navLabelActive : styles.navLabel}>
              {screen.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScreenTitle({ title, subtitle }) {
  return (
    <View style={styles.screenTitle}>
      <Text style={styles.screenTitleText}>{title}</Text>
      <Text style={styles.screenSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({ label, children, compact }) {
  return (
    <View style={compact ? styles.fieldCompact : styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ItemPicker({ items, selectedId, onSelect }) {
  return (
    <View style={styles.pickerGrid}>
      {items.slice(0, 8).map((item) => {
        const active = selectedId === item._id;
        return (
          <Pressable
            key={item._id}
            style={active ? [styles.pickerChip, styles.pickerChipActive] : styles.pickerChip}
            onPress={() => onSelect(item)}
          >
            <Text style={active ? styles.pickerChipTextActive : styles.pickerChipText}>
              {item.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AlertList({ emptyText, items, renderMeta }) {
  if (!items.length) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return items.map((item) => (
    <RowCard key={item._id} title={item.name} meta={renderMeta(item)} />
  ));
}

function RowCard({ title, meta }) {
  return (
    <View style={styles.rowCard}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowMeta}>{meta}</Text>
    </View>
  );
}

function ActionButton({ label, onPress }) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SegmentButton({ active, label, onPress }) {
  return (
    <Pressable style={active ? styles.segmentActive : styles.segmentButton} onPress={onPress}>
      <Text style={active ? styles.segmentTextActive : styles.segmentText}>
        {label}
      </Text>
    </Pressable>
  );
}

function HelperText({ children }) {
  return <Text style={styles.helperText}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f6f8fb"
  },
  appFrame: {
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 36) + 12 : 14,
    paddingBottom: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#dfe5ec"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  headerTitle: {
    marginTop: 2,
    color: "#172033",
    fontSize: 20,
    fontWeight: "900"
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0"
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#065f46"
  },
  statusBadgeError: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca"
  },
  statusTextError: {
    fontSize: 12,
    fontWeight: "800",
    color: "#991b1b"
  },
  content: {
    padding: 16,
    paddingBottom: 112,
    gap: 14
  },
  screenStack: {
    gap: 14
  },
  hero: {
    padding: 18,
    borderRadius: 8,
    backgroundColor: "#172033"
  },
  heroKicker: {
    marginBottom: 8,
    color: "#99f6e4",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: "#f8fafc",
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 33
  },
  lead: {
    marginTop: 10,
    color: "#dbe4ee",
    fontSize: 15,
    lineHeight: 22
  },
  screenTitle: {
    gap: 5
  },
  screenTitleText: {
    color: "#172033",
    fontSize: 25,
    fontWeight: "900"
  },
  screenSubtitle: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statCard: {
    width: "48%",
    minHeight: 82,
    padding: 13,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5ec"
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700"
  },
  statValue: {
    marginTop: 8,
    color: "#172033",
    fontSize: 21,
    fontWeight: "900"
  },
  section: {
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe5ec",
    overflow: "hidden"
  },
  sectionHead: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f5"
  },
  sectionBody: {
    padding: 15,
    gap: 12
  },
  sectionTitle: {
    color: "#172033",
    fontSize: 17,
    fontWeight: "900"
  },
  sectionSubtitle: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  actionButton: {
    width: "48%",
    minHeight: 60,
    justifyContent: "center",
    padding: 13,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0"
  },
  actionButtonText: {
    color: "#064e3b",
    fontWeight: "900"
  },
  twoColumn: {
    gap: 12
  },
  movementPanel: {
    gap: 8
  },
  movementTitle: {
    color: "#172033",
    fontSize: 15,
    fontWeight: "900"
  },
  field: {
    gap: 8
  },
  fieldCompact: {
    flex: 1,
    gap: 8
  },
  fieldRow: {
    flexDirection: "row",
    gap: 10
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 13,
    color: "#172033",
    backgroundColor: "#ffffff"
  },
  toggle: {
    alignSelf: "flex-start",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e2e8f0"
  },
  toggleActive: {
    alignSelf: "flex-start",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#172033"
  },
  toggleText: {
    color: "#172033",
    fontWeight: "800"
  },
  toggleTextActive: {
    color: "#ffffff",
    fontWeight: "800"
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    paddingVertical: 14,
    backgroundColor: "#172033"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: "#e0f2fe"
  },
  secondaryButtonText: {
    color: "#0369a1",
    fontWeight: "900"
  },
  segment: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#e2e8f0"
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 7
  },
  segmentActive: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 7,
    backgroundColor: "#ffffff"
  },
  segmentText: {
    color: "#64748b",
    fontWeight: "900"
  },
  segmentTextActive: {
    color: "#172033",
    fontWeight: "900"
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#e2e8f0"
  },
  pickerChipActive: {
    backgroundColor: "#172033"
  },
  pickerChipText: {
    color: "#172033",
    fontWeight: "800"
  },
  pickerChipTextActive: {
    color: "#ffffff",
    fontWeight: "800"
  },
  helperText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14
  },
  rowCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f5"
  },
  rowTitle: {
    flex: 1,
    color: "#172033",
    fontWeight: "800"
  },
  rowMeta: {
    flexShrink: 1,
    color: "#64748b",
    textAlign: "right"
  },
  bottomNav: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
    padding: 7,
    borderRadius: 12,
    backgroundColor: "#172033",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 7,
    borderRadius: 8
  },
  navItemActive: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#ffffff"
  },
  navIcon: {
    color: "#99f6e4",
    fontSize: 12,
    fontWeight: "900"
  },
  navIconActive: {
    color: "#172033",
    fontSize: 12,
    fontWeight: "900"
  },
  navLabel: {
    color: "#dbeafe",
    fontSize: 10,
    fontWeight: "800"
  },
  navLabelActive: {
    color: "#172033",
    fontSize: 10,
    fontWeight: "900"
  },
  summaryCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  summaryLine: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 4
  },
  summaryTotal: {
    color: "#172033",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4
  },
  scannerBox: {
    marginTop: 10,
    gap: 10
  },
  camera: {
    width: "100%",
    height: 220,
    borderRadius: 8,
    overflow: "hidden"
  },
  saleItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f5",
    gap: 8
  },
  partyItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f5",
    gap: 8
  },
  actionPillRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center"
  },
  pillButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#e2e8f0"
  },
  pillButtonText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#172033"
  },
  waPillButton: {
    backgroundColor: "#dcfce7"
  },
  waPillText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#15803d"
  },
  thermalPillButton: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1"
  },
  thermalPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155"
  },
  waButton: {
    backgroundColor: "#25d366"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    padding: 16
  },
  modalBox: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    maxHeight: "85%",
    overflow: "hidden"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0"
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#172033"
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#64748b"
  },
  receiptScroll: {
    padding: 16,
    backgroundColor: "#f8fafc"
  },
  receiptMonoText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    color: "#0f172a",
    lineHeight: 18
  },
  modalFooter: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0"
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: "#172033",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center"
  },
  modalButtonPrimaryText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13
  },
  modalButtonSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    alignItems: "center"
  },
  modalButtonSecondaryText: {
    color: "#172033",
    fontWeight: "800",
    fontSize: 13
  },
  hubGrid: {
    gap: 12
  },
  hubCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  hubCardIcon: {
    fontSize: 26,
    marginBottom: 6
  },
  hubCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4
  },
  hubCardDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18
  },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    marginBottom: 8
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155"
  },
  actionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca"
  },
  actionBannerIcon: {
    fontSize: 20
  },
  actionBannerTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#991b1b"
  },
  actionBannerDesc: {
    fontSize: 12,
    color: "#b91c1c",
    marginTop: 2
  },
  actionBannerArrow: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#991b1b"
  },
  actionBannerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe"
  },
  actionBannerTitleInfo: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1e40af"
  },
  actionBannerDescInfo: {
    fontSize: 12,
    color: "#1d4ed8",
    marginTop: 2
  },
  actionBannerArrowInfo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e40af"
  },
  cartItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginVertical: 3
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  cartItemMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2
  },
  cartStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cartStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center"
  },
  cartStepBtnText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a"
  },
  cartStepQty: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
    minWidth: 20,
    textAlign: "center"
  },
  cartLineTotal: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0f766e",
    minWidth: 50,
    textAlign: "right"
  },
  loginContainer: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#f8fafc"
  },
  loginBrandWrapper: {
    alignItems: "center",
    marginBottom: 20
  },
  loginLogoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#0f766e",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#0f766e",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  loginLogoText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900"
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center"
  },
  loginSubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18
  },
  loginErrorBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14
  },
  loginErrorText: {
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "700"
  },
  loginCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20
  },
  loginInputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
    marginTop: 10
  },
  loginInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc"
  },
  loginPrimaryBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
    shadowColor: "#0f766e",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3
  },
  loginPrimaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800"
  },
  demoSection: {
    marginBottom: 20
  },
  demoSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: "center"
  },
  demoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8
  },
  demoCardIcon: {
    fontSize: 22,
    marginRight: 12
  },
  demoCardBody: {
    flex: 1
  },
  demoCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a"
  },
  demoCardDesc: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2
  },
  demoCardAction: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  loginSecurityNotice: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4
  },
  mobileLogoutBtn: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  mobileLogoutText: {
    color: "#991b1b",
    fontSize: 11,
    fontWeight: "800"
  },
  headerUserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0"
  },
  headerUserName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  headerRoleBadge: {
    backgroundColor: "#ccfbf1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  headerRoleText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0f766e"
  }
});
