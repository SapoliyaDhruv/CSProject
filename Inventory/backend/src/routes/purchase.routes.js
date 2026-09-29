import { Router } from "express";
import {
  createPurchase,
  getNextBillNumber,
  getPurchases
} from "../controllers/purchase.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getPurchases);
router.get("/next-number", getNextBillNumber);
router.post("/", createPurchase);

export default router;
