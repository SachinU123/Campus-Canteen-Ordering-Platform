require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();

// ---------------- Middleware ----------------
app.use(bodyParser.json());

// Build the CORS allow-list (include Live Server origins!)
const allow = [
  process.env.CORS_ORIGIN_1,
  process.env.CORS_ORIGIN_2,
  process.env.CORS_ORIGIN_3,
  process.env.CORS_ORIGIN_4,
].filter(Boolean);

// In dev you can also just allow everything by setting ALLOW_ALL=1 in .env
const allowAll = process.env.ALLOW_ALL === "1";
app.use(cors({
  origin: allowAll ? true : function (origin, cb) {
    // allow same-origin/no-origin (like curl, Postman) and allow-listed origins
    if (!origin || allow.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  }
}));

// ---------------- Health & Root ----------------
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) => res.send("VPP Canteen API is running"));

// Serve a static frontend folder if you want (optional)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ---------------- Payments ----------------
const USE_DUMMY = process.env.USE_DUMMY === "1";

if (USE_DUMMY) {
  // ------- Dummy Gateway -------
  app.post("/api/create-order", (req, res) => {
    const rupees = Number(req.body.amount || 50);
    res.json({
      orderId: "dummy_order_" + Date.now(),
      amount: Math.round(rupees * 100),
      currency: "INR",
      keyId: "dummy_key"
    });
  });

  app.post("/api/verify", (req, res) => {
    // Always succeed in dummy mode
    res.json({ verified: true });
  });

} else {
  // ------- Real Razorpay -------
  const Razorpay = require("razorpay");
  const crypto = require("crypto");

  const razor = new Razorpay({
    key_id: process.env.RZP_KEY_ID,
    key_secret: process.env.RZP_KEY_SECRET,
  });

  app.post("/api/create-order", async (req, res) => {
    try {
      const rupees = Number(req.body.amount || 50);
      const amount = Math.round(rupees * 100);
      const order = await razor.orders.create({
        amount,
        currency: "INR",
        receipt: "rcpt_" + Date.now(),
      });
      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RZP_KEY_ID,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- Time endpoint (authoritative clock) ----------------
  app.get("/api/now", (_req, res) => {
    const nowUtcMs = Date.now();
    // Create a formatted IST string (just for human readability/logs)
    const istString = new Date(nowUtcMs).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    res.json({
      nowUtcMs,
      istString,
      tz: "Asia/Kolkata"
    });
  });

  app.post("/api/verify", (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ verified: false, error: "missing fields" });
    }
    const expected = crypto
      .createHmac("sha256", process.env.RZP_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    res.json({ verified: expected === razorpay_signature });
  });
}

// ---------------- Listen ----------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Backend running at http://localhost:${PORT}`));
