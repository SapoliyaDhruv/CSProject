import { Expense } from "../models/Expense.js";

export async function getExpenses(req, res) {
  const expenses = await Expense.find().sort({ expenseDate: -1 }).limit(200);
  res.json(expenses);
}

export async function createExpense(req, res) {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function deleteExpense(req, res) {
  const expense = await Expense.findByIdAndDelete(req.params.id);

  if (!expense) {
    return res.status(404).json({ message: "Expense not found" });
  }

  res.json({ message: "Expense deleted" });
}
