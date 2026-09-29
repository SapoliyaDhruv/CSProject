import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/setting.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getSettings);
router.patch("/", requireAdmin, updateSettings);

export default router;
