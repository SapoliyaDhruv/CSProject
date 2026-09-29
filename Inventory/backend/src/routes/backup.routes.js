import { Router } from "express";
import { exportBackup, restoreBackup } from "../controllers/backup.controller.js";
import { getLastAutoBackupStatus, runAutomatedBackup } from "../utils/autoBackup.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get("/export", exportBackup);
router.post("/restore", restoreBackup);
router.get("/auto-status", (req, res) => res.json(getLastAutoBackupStatus()));
router.post("/trigger", async (req, res) => {
  await runAutomatedBackup();
  res.json({ message: "Automated backup triggered", ...getLastAutoBackupStatus() });
});

export default router;
