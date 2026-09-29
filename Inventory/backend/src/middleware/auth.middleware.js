import { verifyToken } from "../utils/token.js";

export function requireAuth(req, res, next) {
  // Allow preflight CORS
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access Denied: Authentication required. Please log in with your email and password."
    });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      message: "Session expired or invalid token. Please log in again."
    });
  }

  req.user = payload;
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Access denied. Administrator privileges required."
    });
  }
  next();
}
