import { Router } from "express";
import { createPayment, getPayments } from "../controllers/payment.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getPayments);
router.post("/", createPayment);

export default router;
