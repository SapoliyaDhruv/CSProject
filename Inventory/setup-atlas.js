#!/usr/bin/env node
/**
 * FreshMart - MongoDB Atlas Auto-Setup Script
 *
 * This script automatically:
 *   1. Creates a free MongoDB Atlas cluster (M0)
 *   2. Creates a database user
 *   3. Whitelists all IPs (0.0.0.0/0) for access
 *   4. Returns your connection string (MONGO_URI)
 *
 * HOW TO GET YOUR API KEYS (3 quick steps):
 *   1. Go to https://cloud.mongodb.com → sign up (free)
 *   2. Top-left menu → "Access Manager" → "API Keys" → "Create API Key"
 *   3. Give it "Organization Owner" role → copy Public Key & Private Key
 *   4. Go to "Projects" → copy your Project ID from the URL:
 *      https://cloud.mongodb.com/v2/PROJECT_ID_HERE#/...
 *
 * FILL IN the four values below, then run:
 *   node setup-atlas.js
 */

// ─── FILL IN THESE FOUR VALUES ───────────────────────────────────────────────
const PUBLIC_KEY = "YOUR_PUBLIC_KEY_HERE";        // e.g. "abcdefgh"
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE";      // e.g. "abc12345-xxxx-xxxx-xxxx-abcdef123456"
const PROJECT_ID = "YOUR_PROJECT_ID_HERE";        // e.g. "6512a3b4c5d6e7f8a9b0c1d2"
const DB_PASSWORD = "FreshMart2026@Secure";       // password for the DB user (change if you like)
// ─────────────────────────────────────────────────────────────────────────────

const CLUSTER_NAME = "freshmart-cluster";
const DB_USER = "freshmart_admin";

const BASE = "https://cloud.mongodb.com/api/atlas/v2";
const DIGEST_HEADER = { Accept: "application/vnd.atlas.2023-01-01+json", "Content-Type": "application/json" };

// ── HTTP Digest Auth helper (MongoDB Atlas uses this) ────────────────────────
import crypto from "crypto";

function digestAuth(username, password) {
  return async function (method, url, body) {
    // First request without auth to get the www-authenticate header
    const res1 = await fetch(url, { method, headers: DIGEST_HEADER, body });
    if (res1.status !== 401) return res1;

    const wwwAuth = res1.headers.get("www-authenticate") || "";
    const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1] || "";
    const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1] || "";
    const qop = wwwAuth.match(/qop="([^"]+)"/)?.[1] || "";
    const nc = "00000001";
    const cnonce = crypto.randomBytes(8).toString("hex");

    const parsed = new URL(url);
    const uri = parsed.pathname + parsed.search;

    const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
    const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");
    const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");

    const authHeader =
      `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", ` +
      `qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;

    const res2 = await fetch(url, {
      method,
      headers: { ...DIGEST_HEADER, Authorization: authHeader },
      body
    });

    return res2;
  };
}

async function setup() {
  if (PUBLIC_KEY === "YOUR_PUBLIC_KEY_HERE") {
    console.error("\n❌ ERROR: Please open setup-atlas.js and fill in your API keys first.\n");
    console.log("   Follow the instructions at the top of the file.");
    process.exit(1);
  }

  const request = digestAuth(PUBLIC_KEY, PRIVATE_KEY);

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   FreshMart Atlas Auto-Setup - Starting...      ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── Step 1: Create the free cluster ──────────────────────────────────────
  console.log("🔷 Step 1/3 · Creating M0 Free Cluster...");
  const clusterRes = await request(
    "POST",
    `${BASE}/groups/${PROJECT_ID}/clusters`,
    JSON.stringify({
      name: CLUSTER_NAME,
      clusterType: "REPLICASET",
      replicationFactor: 3,
      providerSettings: {
        providerName: "TENANT",
        backingProviderName: "AWS",
        regionName: "AP_SOUTH_1",
        instanceSizeName: "M0"
      }
    })
  );

  const clusterData = await clusterRes.json();
  if (!clusterRes.ok) {
    if (clusterData.errorCode === "DUPLICATE_CLUSTER_NAME") {
      console.log("   ✅ Cluster already exists — skipping creation.");
    } else {
      console.error("   ❌ Cluster creation failed:", JSON.stringify(clusterData, null, 2));
      process.exit(1);
    }
  } else {
    console.log("   ✅ Cluster created successfully:", clusterData.name);
  }

  // ── Step 2: Create DB user ────────────────────────────────────────────────
  console.log("\n🔷 Step 2/3 · Creating Database User...");
  const userRes = await request(
    "POST",
    `${BASE}/groups/${PROJECT_ID}/databaseUsers`,
    JSON.stringify({
      groupId: PROJECT_ID,
      username: DB_USER,
      password: DB_PASSWORD,
      databaseName: "admin",
      roles: [{ roleName: "atlasAdmin", databaseName: "admin" }]
    })
  );

  const userData = await userRes.json();
  if (!userRes.ok) {
    if (userData.errorCode === "USER_ALREADY_EXISTS") {
      console.log("   ✅ DB user already exists — skipping.");
    } else {
      console.error("   ❌ User creation failed:", JSON.stringify(userData, null, 2));
      process.exit(1);
    }
  } else {
    console.log("   ✅ DB user created:", DB_USER);
  }

  // ── Step 3: Whitelist all IPs ─────────────────────────────────────────────
  console.log("\n🔷 Step 3/3 · Whitelisting All IPs (0.0.0.0/0)...");
  const ipRes = await request(
    "POST",
    `${BASE}/groups/${PROJECT_ID}/accessList`,
    JSON.stringify([{ cidrBlock: "0.0.0.0/0", comment: "Allow from anywhere (dev/demo)" }])
  );

  const ipData = await ipRes.json();
  if (!ipRes.ok) {
    console.log("   ⚠️  IP whitelist:", ipData.detail || JSON.stringify(ipData));
  } else {
    console.log("   ✅ All IPs whitelisted.");
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  const encodedPass = encodeURIComponent(DB_PASSWORD);
  const mongoUri = `mongodb+srv://${DB_USER}:${encodedPass}@${CLUSTER_NAME}.mongodb.net/inventory?retryWrites=true&w=majority`;

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  ✅ SETUP COMPLETE!                                              ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");
  console.log("⚠️  IMPORTANT: The cluster takes 2–3 minutes to become ready after creation.\n");
  console.log("Your MONGO_URI connection string:");
  console.log("────────────────────────────────────────────────────────────────────");
  console.log(mongoUri);
  console.log("────────────────────────────────────────────────────────────────────");
  console.log("\n📋 NEXT STEPS:");
  console.log("   1. Wait 2–3 minutes for the cluster to initialize.");
  console.log("   2. Set this MONGO_URI in your Render.com environment variables.");
  console.log("   3. Run the seed script to populate demo data:");
  console.log(`      MONGO_URI="${mongoUri}" npm run seed`);
  console.log("   4. Deploy the frontend to Vercel with VITE_API_URL set to your Render URL.\n");
}

setup().catch((err) => {
  console.error("\n❌ Script failed:", err.message);
  process.exit(1);
});
