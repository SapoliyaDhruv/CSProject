import { Router } from "express";
import {
  createItem,
  deleteItem,
  getItemByBarcode,
  getItems,
  updateItem
} from "../controllers/item.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getItems);
router.get("/lookup/barcode/:code", getItemByBarcode);
router.post("/", createItem);
router.patch("/:id", updateItem);
router.delete("/:id", deleteItem);

export default router;
