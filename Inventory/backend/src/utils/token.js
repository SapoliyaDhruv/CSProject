import crypto from "crypto";

const SECRET = process.env.JWT_SECRET || "freshmart-enterprise-secret-key-2026-auth";

export function generateToken(user) {
  const payload = {
    id: user._id ? user._id.toString() : user.id,
    role: user.role || "staff",
    email: user.email,
    name: user.name,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000 // 14 days valid
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [data, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  if (signature !== expectedSig) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
