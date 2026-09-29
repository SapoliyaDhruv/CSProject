import { Expense } from "../models/Expense.js";
import { Item } from "../models/Item.js";
import { Party } from "../models/Party.js";
import { PaymentRecord } from "../models/PaymentRecord.js";
import { Purchase } from "../models/Purchase.js";
import { Sale } from "../models/Sale.js";

export async function getDashboardReport(req, res) {
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  const [
    items,
    customers,
    suppliers,
    salesTotalAgg,
    purchaseTotalAgg,
    expenseTotalAgg,
    sales,
    purchases,
    expenses
  ] = await Promise.all([
    Item.find(),
    Party.countDocuments({ type: "customer" }),
    Party.countDocuments({ type: "supplier" }),
    Sale.aggregate([{ $group: { _id: null, total: { $sum: "$grandTotal" } } }]),
    Purchase.aggregate([{ $group: { _id: null, total: { $sum: "$grandTotal" } } }]),
    Expense.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
    Sale.find().sort({ createdAt: -1 }).limit(10),
    Purchase.find().sort({ createdAt: -1 }).limit(10),
    Expense.find().sort({ expenseDate: -1 }).limit(10)
  ]);

  const lowStockItems = items.filter(
    (item) => Number(item.quantity) <= Number(item.lowStockLevel)
  );
  const expiringItems = items.filter(
    (item) =>
      item.expiryDate &&
      new Date(item.expiryDate) >= today &&
      new Date(item.expiryDate) <= nextWeek
  );
  const expiredItems = items.filter(
    (item) => item.expiryDate && new Date(item.expiryDate) < today
  );
  const totalStockValue = items.reduce(
    (total, item) =>
      total + Number(item.quantity || 0) * Number(item.purchasePrice || 0),
    0
  );
  const salesTotal = salesTotalAgg[0]?.total || 0;
  const purchaseTotal = purchaseTotalAgg[0]?.total || 0;
  const expenseTotal = expenseTotalAgg[0]?.total || 0;
  const profitLoss = salesTotal - purchaseTotal - expenseTotal;
  const receivables = sales.reduce(
    (total, sale) => total + Number(sale.dueAmount || 0),
    0
  );
  const payables = purchases.reduce(
    (total, purchase) => total + Number(purchase.dueAmount || 0),
    0
  );

  res.json({
    totals: {
      items: items.length,
      customers,
      suppliers,
      totalStockValue,
      salesTotal,
      purchaseTotal,
      expenseTotal,
      profitLoss,
      receivables,
      payables,
      lowStock: lowStockItems.length,
      expiringSoon: expiringItems.length,
      expired: expiredItems.length
    },
    lowStockItems,
    expiringItems,
    expiredItems,
    recentSales: sales,
    recentPurchases: purchases,
    recentExpenses: expenses
  });
}

export async function getBusinessReport(req, res) {
  const [sales, purchases, expenses, items] = await Promise.all([
    Sale.find().sort({ createdAt: -1 }),
    Purchase.find().sort({ createdAt: -1 }),
    Expense.find().sort({ expenseDate: -1 }),
    Item.find().sort({ quantity: 1 })
  ]);

  const salesTotal = sales.reduce(
    (total, sale) => total + Number(sale.grandTotal || 0),
    0
  );
  const purchaseTotal = purchases.reduce(
    (total, purchase) => total + Number(purchase.grandTotal || 0),
    0
  );
  const expenseTotal = expenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0
  );
  const receivables = sales.reduce(
    (total, sale) => total + Number(sale.dueAmount || 0),
    0
  );
  const payables = purchases.reduce(
    (total, purchase) => total + Number(purchase.dueAmount || 0),
    0
  );
  const stockValue = items.reduce(
    (total, item) =>
      total + Number(item.quantity || 0) * Number(item.purchasePrice || 0),
    0
  );

  res.json({
    totals: {
      salesTotal,
      purchaseTotal,
      expenseTotal,
      profitLoss: salesTotal - purchaseTotal - expenseTotal,
      receivables,
      payables,
      stockValue
    },
    dueSales: sales.filter((sale) => Number(sale.dueAmount || 0) > 0),
    duePurchases: purchases.filter(
      (purchase) => Number(purchase.dueAmount || 0) > 0
    ),
    slowStock: items.slice(0, 10),
    expenses,
    sales,
    purchases
  });
}

export async function getPartyLedger(req, res) {
  const { name } = req.params;
  const [sales, purchases, party, payments] = await Promise.all([
    Sale.find({ customerName: name }).sort({ createdAt: -1 }),
    Purchase.find({ supplierName: name }).sort({ createdAt: -1 }),
    Party.findOne({ name }),
    PaymentRecord.find({ partyName: name }).sort({ paymentDate: -1 })
  ]);

  const saleTotal = sales.reduce(
    (total, sale) => total + Number(sale.grandTotal || 0),
    0
  );
  const purchaseTotal = purchases.reduce(
    (total, purchase) => total + Number(purchase.grandTotal || 0),
    0
  );
  const receivable = sales.reduce(
    (total, sale) => total + Number(sale.dueAmount || 0),
    0
  );
  const payable = purchases.reduce(
    (total, purchase) => total + Number(purchase.dueAmount || 0),
    0
  );
  const openingBalance = Number(party?.openingBalance || 0);

  // Combine chronological entries
  const entries = [
    ...sales.map((s) => ({
      _id: s._id,
      date: s.createdAt,
      type: "sale",
      description: `Invoice ${s.invoiceNumber}`,
      amount: s.grandTotal,
      paid: s.paidAmount,
      due: s.dueAmount,
      status: s.status
    })),
    ...purchases.map((p) => ({
      _id: p._id,
      date: p.createdAt,
      type: "purchase",
      description: `Purchase Bill ${p.billNumber}`,
      amount: p.grandTotal,
      paid: p.paidAmount,
      due: p.dueAmount,
      status: p.status
    })),
    ...payments.map((pm) => ({
      _id: pm._id,
      date: pm.paymentDate,
      type: pm.type,
      description: `${pm.type === "payment_in" ? "Receipt" : "Payment"} (${pm.voucherNumber}) - ${pm.paymentMethod.toUpperCase()}`,
      amount: pm.amount,
      paid: pm.amount,
      due: 0,
      status: "paid"
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({
    party,
    totals: {
      saleTotal,
      purchaseTotal,
      receivable,
      payable,
      openingBalance,
      netBalance: openingBalance + receivable - payable
    },
    sales,
    purchases,
    payments,
    entries
  });
}

export async function getPaymentReminders(req, res) {
  const [dueSales, duePurchases] = await Promise.all([
    Sale.find({ dueAmount: { $gt: 0 } }).sort({ createdAt: -1 }),
    Purchase.find({ dueAmount: { $gt: 0 } }).sort({ createdAt: -1 })
  ]);

  res.json({
    receivables: dueSales.map((sale) => ({
      id: sale._id,
      partyName: sale.customerName,
      documentNumber: sale.invoiceNumber,
      type: "customer",
      dueAmount: sale.dueAmount,
      grandTotal: sale.grandTotal,
      paidAmount: sale.paidAmount,
      createdAt: sale.createdAt
    })),
    payables: duePurchases.map((purchase) => ({
      id: purchase._id,
      partyName: purchase.supplierName,
      documentNumber: purchase.billNumber,
      type: "supplier",
      dueAmount: purchase.dueAmount,
      grandTotal: purchase.grandTotal,
      paidAmount: purchase.paidAmount,
      createdAt: purchase.createdAt
    }))
  });
}

export async function getGstSummary(req, res) {
  try {
    const { month } = req.query;
    let dateFilter = {};
    if (month && month !== "all") {
      const [year, m] = month.split("-").map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    const [sales, purchases] = await Promise.all([
      Sale.find(dateFilter),
      Purchase.find(dateFilter)
    ]);

    let outputTaxable = 0;
    let outputTotalTax = 0;
    let outputGrandTotal = 0;
    const salesByRate = {};

    for (const sale of sales) {
      outputTaxable += Number(sale.subtotal || 0);
      outputTotalTax += Number(sale.taxTotal || 0);
      outputGrandTotal += Number(sale.grandTotal || 0);

      for (const item of sale.items || []) {
        const rate = Number(item.taxRate || 0);
        if (!salesByRate[rate]) {
          salesByRate[rate] = { rate, taxable: 0, tax: 0 };
        }
        const itemTaxable = Math.max(0, Number(item.quantity || 1) * Number(item.unitPrice || 0) - Number(item.discount || 0));
        const itemTax = (itemTaxable * rate) / 100;
        salesByRate[rate].taxable += itemTaxable;
        salesByRate[rate].tax += itemTax;
      }
    }

    let inputTaxable = 0;
    let inputTotalTax = 0;
    let inputGrandTotal = 0;
    const purchasesByRate = {};

    for (const pur of purchases) {
      inputTaxable += Number(pur.subtotal || 0);
      inputTotalTax += Number(pur.taxTotal || 0);
      inputGrandTotal += Number(pur.grandTotal || 0);

      for (const item of pur.items || []) {
        const rate = Number(item.taxRate || 0);
        if (!purchasesByRate[rate]) {
          purchasesByRate[rate] = { rate, taxable: 0, tax: 0 };
        }
        const itemTaxable = Number(item.quantity || 1) * Number(item.unitCost || 0);
        const itemTax = (itemTaxable * rate) / 100;
        purchasesByRate[rate].taxable += itemTaxable;
        purchasesByRate[rate].tax += itemTax;
      }
    }

    const netTaxPayable = outputTotalTax - inputTotalTax;

    const slabBreakdown = {};
    for (const [rate, s] of Object.entries(salesByRate)) {
      if (!slabBreakdown[rate]) slabBreakdown[rate] = { rate, outwardTaxable: 0, outputTax: 0, inwardTaxable: 0, inputTax: 0, netTax: 0 };
      slabBreakdown[rate].outwardTaxable = s.taxable;
      slabBreakdown[rate].outputTax = s.tax;
    }
    for (const [rate, p] of Object.entries(purchasesByRate)) {
      if (!slabBreakdown[rate]) slabBreakdown[rate] = { rate, outwardTaxable: 0, outputTax: 0, inwardTaxable: 0, inputTax: 0, netTax: 0 };
      slabBreakdown[rate].inwardTaxable = p.taxable;
      slabBreakdown[rate].inputTax = p.tax;
    }
    for (const slab of Object.values(slabBreakdown)) {
      slab.netTax = slab.outputTax - slab.inputTax;
    }

    res.json({
      month: month || "all",
      period: month || "All time",
      outwardSales: {
        invoiceCount: sales.length,
        totalTaxableTurnover: outputTaxable,
        cgst: outputTotalTax / 2,
        sgst: outputTotalTax / 2,
        totalTax: outputTotalTax,
        grandTotal: outputGrandTotal,
        byRate: Object.values(salesByRate)
      },
      inwardPurchases: {
        billCount: purchases.length,
        totalTaxableTurnover: inputTaxable,
        cgst: inputTotalTax / 2,
        sgst: inputTotalTax / 2,
        totalTax: inputTotalTax,
        grandTotal: inputGrandTotal,
        byRate: Object.values(purchasesByRate)
      },
      slabBreakdown,
      netGstPayable: netTaxPayable,
      output: {
        invoiceCount: sales.length,
        taxable: outputTaxable,
        cgst: outputTotalTax / 2,
        sgst: outputTotalTax / 2,
        totalTax: outputTotalTax,
        grandTotal: outputGrandTotal,
        byRate: Object.values(salesByRate)
      },
      input: {
        billCount: purchases.length,
        taxable: inputTaxable,
        cgst: inputTotalTax / 2,
        sgst: inputTotalTax / 2,
        totalTax: inputTotalTax,
        grandTotal: inputGrandTotal,
        byRate: Object.values(purchasesByRate)
      },
      netTaxPayable,
      status: netTaxPayable > 0 ? "Tax Payable" : "ITC Carry Forward / No Tax Due"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getDaybookReport(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(`${dateParam}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateParam}T23:59:59.999Z`);

    const [sales, purchases, expenses, payments] = await Promise.all([
      Sale.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Purchase.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Expense.find({ expenseDate: { $gte: startOfDay, $lte: endOfDay } }),
      PaymentRecord.find({ paymentDate: { $gte: startOfDay, $lte: endOfDay } })
    ]);

    let cashInflow = 0;
    let cashOutflow = 0;
    let digitalInflow = 0;
    let digitalOutflow = 0;

    const auditEntries = [];

    for (const sale of sales) {
      const paid = Number(sale.paidAmount || 0);
      if (paid > 0) {
        if (sale.paymentMethod === "cash") {
          cashInflow += paid;
        } else {
          digitalInflow += paid;
        }
        auditEntries.push({
          time: sale.createdAt,
          type: "Sale Invoice",
          reference: sale.invoiceNumber,
          party: sale.customerName,
          direction: "in",
          method: sale.paymentMethod,
          amount: paid
        });
      }
    }

    for (const pay of payments.filter((p) => p.type === "payment_in")) {
      const amt = Number(pay.amount || 0);
      if (pay.paymentMethod === "cash") {
        cashInflow += amt;
      } else {
        digitalInflow += amt;
      }
      auditEntries.push({
        time: pay.paymentDate,
        type: "Payment In (Receipt)",
        reference: pay.voucherNumber,
        party: pay.partyName,
        direction: "in",
        method: pay.paymentMethod,
        amount: amt
      });
    }

    for (const pur of purchases) {
      const paid = Number(pur.paidAmount || 0);
      if (paid > 0) {
        if (pur.paymentMethod === "cash") {
          cashOutflow += paid;
        } else {
          digitalOutflow += paid;
        }
        auditEntries.push({
          time: pur.createdAt,
          type: "Purchase Bill",
          reference: pur.billNumber,
          party: pur.supplierName,
          direction: "out",
          method: pur.paymentMethod,
          amount: paid
        });
      }
    }

    for (const pay of payments.filter((p) => p.type === "payment_out")) {
      const amt = Number(pay.amount || 0);
      if (pay.paymentMethod === "cash") {
        cashOutflow += amt;
      } else {
        digitalOutflow += amt;
      }
      auditEntries.push({
        time: pay.paymentDate,
        type: "Payment Out",
        reference: pay.voucherNumber,
        party: pay.partyName,
        direction: "out",
        method: pay.paymentMethod,
        amount: amt
      });
    }

    for (const exp of expenses) {
      const amt = Number(exp.amount || 0);
      if (exp.paymentMethod === "cash") {
        cashOutflow += amt;
      } else {
        digitalOutflow += amt;
      }
      auditEntries.push({
        time: exp.expenseDate,
        type: `Expense (${exp.category})`,
        reference: exp.title,
        party: "Business Expense",
        direction: "out",
        method: exp.paymentMethod,
        amount: amt
      });
    }

    auditEntries.sort((a, b) => new Date(b.time) - new Date(a.time));

    const totalSales = sales.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
    const netCashflow = cashInflow + digitalInflow - cashOutflow - digitalOutflow;

    res.json({
      date: dateParam,
      summary: {
        cashInflow,
        digitalInflow,
        cashOutflow,
        digitalOutflow,
        netCashflow,
        netCashChange: cashInflow - cashOutflow,
        netDigitalChange: digitalInflow - digitalOutflow
      },
      totals: {
        totalSales,
        cashInflow,
        cashOutflow,
        digitalInflow,
        digitalOutflow
      },
      transactions: auditEntries.map((e) => ({
        date: e.time,
        type: e.type,
        reference: e.reference,
        party: e.party,
        mode: e.method,
        inflow: e.direction === "in" ? e.amount : 0,
        outflow: e.direction === "out" ? e.amount : 0
      })),
      cashSummary: {
        inflow: cashInflow,
        outflow: cashOutflow,
        netChange: cashInflow - cashOutflow
      },
      digitalSummary: {
        inflow: digitalInflow,
        outflow: digitalOutflow,
        netChange: digitalInflow - digitalOutflow
      },
      netDayTotal: netCashflow,
      entries: auditEntries
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
