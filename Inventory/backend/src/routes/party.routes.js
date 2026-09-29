import { Router } from "express";
import {
  createParty,
  deleteParty,
  getParties,
  updateParty
} from "../controllers/party.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getParties);
router.post("/", createParty);
router.patch("/:id", updateParty);
router.delete("/:id", deleteParty);

export default router;
