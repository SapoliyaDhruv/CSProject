import { Router } from "express";
import { createReturn, getReturns } from "../controllers/return.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getReturns);
router.post("/", createReturn);

export default router;
