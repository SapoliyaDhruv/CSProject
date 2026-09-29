import { Router } from "express";
import {
  createExpense,
  deleteExpense,
  getExpenses
} from "../controllers/expense.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getExpenses);
router.post("/", createExpense);
router.delete("/:id", deleteExpense);

export default router;
