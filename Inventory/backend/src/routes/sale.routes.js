import { Router } from "express";
import {
  createSale,
  downloadSalePdf,
  getNextInvoiceNumber,
  getSale,
  getSales,
  getSaleThermalReceipt
} from "../controllers/sale.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getSales);
router.get("/next-number", getNextInvoiceNumber);
router.get("/:id/pdf", downloadSalePdf);
router.get("/:id/thermal", getSaleThermalReceipt);
router.get("/:id", getSale);
router.post("/", createSale);

export default router;
