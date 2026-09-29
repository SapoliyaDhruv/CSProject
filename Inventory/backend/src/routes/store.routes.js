import { Router } from "express";
import {
  createStoreOrder,
  getStoreCatalog,
  getStoreOrders,
  updateStoreOrderStatus
} from "../controllers/store.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/catalog", getStoreCatalog);
router.post("/orders", createStoreOrder);
router.get("/orders", requireAuth, getStoreOrders);
router.patch("/orders/:id", requireAuth, updateStoreOrderStatus);

export default router;
