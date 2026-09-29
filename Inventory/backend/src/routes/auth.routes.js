import { Router } from "express";
import { login, register, getUsers, getMe } from "../controllers/auth.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getMe);
router.get("/users", requireAuth, requireAdmin, getUsers);

export default router;
