import { Router } from "express";
import {
  getBusinessReport,
  getDashboardReport,
  getDaybookReport,
  getGstSummary,
  getPartyLedger,
  getPaymentReminders
} from "../controllers/report.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/dashboard", getDashboardReport);
router.get("/business", getBusinessReport);
router.get("/payment-reminders", getPaymentReminders);
router.get("/ledger/:name", getPartyLedger);
router.get("/gst-summary", getGstSummary);
router.get("/daybook", getDaybookReport);

export default router;
