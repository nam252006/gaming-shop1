const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data.json");
const DEFAULT_SHOP_NAME = process.env.SHOP_NAME || "Gaming Shop";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

const DEFAULT_SETTINGS = {
  shopName: DEFAULT_SHOP_NAME,
  shopTagline: "Gaming Marketplace",
  metaDescription: "Gaming marketplace — items, currency and services.",
  logo: "",
  favicon: "",
  heroEyebrow: "GAMING MARKETPLACE",
  heroTitle: "Chọn món bạn cần.\\nMua nhanh, dùng ngay.",
  heroSubtitle: "Một marketplace sạch, dễ nhìn và tập trung vào sản phẩm. Bạn có thể thay ảnh, màu sắc, nội dung và thương hiệu ngay trong trang Admin.",
  heroButtonText: "Xem sản phẩm",
  heroSecondaryText: "Nạp tiền vào ví",
  heroBanner: "",
  primary: "#111827",
  accent: "#6d5dfc",
  pageBg: "#f4f6fa",
  cardBg: "#ffffff",
  text: "#111827",
  muted: "#667085",
  footerBg: "#182433",
  supportEmail: "support@yourshop.com",
  supportPhone: "09xx xxx xxx",
  discord: "",
  facebook: "",
  telegram: "",
  categories: ["Scripts", "Executors", "Externals", "Cloud Phone", "Services"],
  sections: { hero: true, products: true, trust: true },
  homeOrder: ["hero", "products", "trust"]
};

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, "public");
const HAS_PUBLIC_APP = fs.existsSync(path.join(PUBLIC_DIR, "index.html"));
if (HAS_PUBLIC_APP) {
  app.use(express.static(PUBLIC_DIR));
} else {
  // Graceful fallback for repositories where frontend files were uploaded to repo root.
  app.get("/styles.css", (req, res) => res.sendFile(path.join(__dirname, "styles.css")));
  app.get("/app.js", (req, res) => res.sendFile(path.join(__dirname, "app.js")));
  app.get("/index.html", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { users: [], products: [], orders: [], topups: [], settings: { ...DEFAULT_SETTINGS } };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

function normalizeSettings(raw = {}) {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  if (!Array.isArray(s.categories)) s.categories = [...DEFAULT_SETTINGS.categories];
  s.categories = s.categories.map(v => String(v).trim()).filter(Boolean).slice(0, 30);
  const defaultSections = { ...DEFAULT_SETTINGS.sections };
  const incomingSections = (s.sections && typeof s.sections === "object") ? s.sections : {};
  s.sections = Object.fromEntries(Object.keys(defaultSections).map(k => [k, incomingSections[k] !== false]));
  const allowedOrder = ["hero", "products", "trust"];
  const rawOrder = Array.isArray(s.homeOrder) ? s.homeOrder : [];
  s.homeOrder = [...new Set(rawOrder.filter(x => allowedOrder.includes(x)))];
  for (const key of allowedOrder) if (!s.homeOrder.includes(key)) s.homeOrder.push(key);
  return s;
}

function getSettings(db) {
  return normalizeSettings(db.settings);
}

function sanitizeColor(value, fallback) {
  const v = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function sanitizeImage(value) {
  const v = String(value || "");
  if (!v) return "";
  // Keep data URLs or normal image URLs, but cap their stored length.
  if (v.length > 5_500_000) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return "";
}

function sanitizeSettings(body, existing) {
  const next = { ...existing };
  const stringKeys = [
    "shopName", "shopTagline", "metaDescription", "heroEyebrow", "heroTitle",
    "heroSubtitle", "heroButtonText", "heroSecondaryText", "supportEmail",
    "supportPhone", "discord", "facebook", "telegram"
  ];
  for (const key of stringKeys) {
    if (body[key] !== undefined) next[key] = String(body[key]).trim().slice(0, 500);
  }
  for (const key of ["logo", "favicon", "heroBanner"]) {
    if (body[key] !== undefined) next[key] = sanitizeImage(body[key]);
  }
  next.primary = sanitizeColor(body.primary, existing.primary);
  next.accent = sanitizeColor(body.accent, existing.accent);
  next.pageBg = sanitizeColor(body.pageBg, existing.pageBg);
  next.cardBg = sanitizeColor(body.cardBg, existing.cardBg);
  next.text = sanitizeColor(body.text, existing.text);
  next.muted = sanitizeColor(body.muted, existing.muted);
  next.footerBg = sanitizeColor(body.footerBg, existing.footerBg);
  if (body.categories !== undefined) {
    const categories = Array.isArray(body.categories)
      ? body.categories
      : String(body.categories).split(",");
    next.categories = categories.map(v => String(v).trim()).filter(Boolean).slice(0, 30);
  }
  if (body.sections && typeof body.sections === "object") {
    next.sections = { ...(existing.sections || DEFAULT_SETTINGS.sections), ...body.sections };
  }
  if (body.homeOrder !== undefined) next.homeOrder = Array.isArray(body.homeOrder) ? body.homeOrder : [];
  return normalizeSettings(next);
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function tokenFor(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  })).toString("base64url");
  const signature = crypto
    .createHash("sha256")
    .update((process.env.SESSION_SECRET || "dev-secret") + user.id)
    .digest("hex");
  return `${payload}.${signature}`;
}

function userFromToken(token) {
  if (!token) return null;
  try {
    const [payload, signature] = token.split(".");
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data?.id || !data?.role || data.exp < Date.now()) return null;
    const expected = crypto
      .createHash("sha256")
      .update((process.env.SESSION_SECRET || "dev-secret") + data.id)
      .digest("hex");
    if (signature !== expected) return null;
    const db = loadDB();
    return db.users.find(u => u.id === data.id && u.role === data.role) || null;
  } catch {
    return null;
  }
}

function auth(req, res, next) {
  const u = userFromToken((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  if (!u) return res.status(401).json({ error: "Bạn cần đăng nhập." });
  req.user = u;
  next();
}

function admin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Không có quyền admin." });
  next();
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    balance: u.balance,
    createdAt: u.createdAt
  };
}

let db = loadDB();
if (!Array.isArray(db.users)) db.users = [];
if (!Array.isArray(db.products)) db.products = [];
if (!Array.isArray(db.orders)) db.orders = [];
if (!Array.isArray(db.topups)) db.topups = [];
if (!db.settings) db.settings = { ...DEFAULT_SETTINGS };
db.settings = normalizeSettings(db.settings);
if (!db.users.some(u => u.email === ADMIN_EMAIL)) {
  db.users.push({
    id: crypto.randomUUID(),
    email: ADMIN_EMAIL,
    name: "Admin",
    password: hashPassword(ADMIN_PASSWORD),
    role: "admin",
    balance: 0,
    createdAt: new Date().toISOString()
  });
  saveDB(db);
}

app.get("/api/config", (req, res) => {
  const current = getSettings(loadDB());
  res.json(current);
});

app.get("/api/products", (req, res) => res.json(loadDB().products));
app.get("/api/me", auth, (req, res) => res.json(publicUser(req.user)));

app.post("/api/register", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: "Email và mật khẩu (tối thiểu 6 ký tự) là bắt buộc." });
  }
  const db = loadDB();
  if (db.users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: "Email đã tồn tại." });
  }
  const u = {
    id: crypto.randomUUID(),
    email: String(email).toLowerCase(),
    name: name || email.split("@")[0],
    password: hashPassword(password),
    role: "user",
    balance: 0,
    createdAt: new Date().toISOString()
  };
  db.users.push(u);
  saveDB(db);
  res.json({ token: tokenFor(u), user: publicUser(u) });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const u = loadDB().users.find(
    x => x.email.toLowerCase() === String(email || "").toLowerCase() && x.password === hashPassword(password || "")
  );
  if (!u) return res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
  res.json({ token: tokenFor(u), user: publicUser(u) });
});

app.get("/api/orders", auth, (req, res) => {
  const db = loadDB();
  res.json(db.orders.filter(o => o.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.post("/api/orders", auth, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Giỏ hàng trống." });
  const db = loadDB();
  let total = 0;
  const normalized = [];
  for (const item of items) {
    const p = db.products.find(x => x.id === Number(item.id));
    const qty = Math.max(1, Math.min(99, Number(item.qty) || 1));
    if (!p) return res.status(400).json({ error: "Có sản phẩm không còn tồn tại." });
    total += Number(p.price) * qty;
    normalized.push({ productId: p.id, name: p.name, price: p.price, qty });
  }
  const u = db.users.find(x => x.id === req.user.id);
  if (u.balance < total) return res.status(400).json({ error: "Số dư không đủ. Hãy nạp tiền trước." });
  u.balance -= total;
  const order = {
    id: "GS-" + Date.now().toString(36).toUpperCase(),
    userId: u.id,
    items: normalized,
    total,
    status: "paid",
    createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  normalized.forEach(i => {
    const p = db.products.find(x => x.id === i.productId);
    if (p) p.sold = (p.sold || 0) + i.qty;
  });
  saveDB(db);
  res.json({ order, user: publicUser(u) });
});

app.post("/api/topups", auth, (req, res) => {
  const amount = Number(req.body.amount) || 0;
  const method = ["bank", "crypto", "card"].includes(req.body.method) ? req.body.method : "bank";
  if (amount < 1000) return res.status(400).json({ error: "Số tiền tối thiểu là 1.000đ." });
  const db = loadDB();
  const topup = {
    id: "TP-" + Date.now().toString(36).toUpperCase(),
    userId: req.user.id,
    amount,
    method,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  db.topups.push(topup);
  saveDB(db);
  res.json(topup);
});

app.get("/api/admin/stats", auth, admin, (req, res) => {
  const db = loadDB();
  const revenue = db.orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0);
  res.json({
    users: db.users.filter(u => u.role !== "admin").length,
    products: db.products.length,
    orders: db.orders.length,
    revenue,
    pendingTopups: db.topups.filter(t => t.status === "pending").length
  });
});

app.get("/api/admin/orders", auth, admin, (req, res) => res.json(loadDB().orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
app.get("/api/admin/topups", auth, admin, (req, res) => res.json(loadDB().topups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
app.get("/api/admin/settings", auth, admin, (req, res) => res.json(getSettings(loadDB())));

app.put("/api/admin/settings", auth, admin, (req, res) => {
  const db = loadDB();
  const current = getSettings(db);
  db.settings = sanitizeSettings(req.body, current);
  saveDB(db);
  res.json(db.settings);
});

app.post("/api/admin/topups/:id/approve", auth, admin, (req, res) => {
  const db = loadDB();
  const t = db.topups.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Không tìm thấy yêu cầu." });
  if (t.status !== "pending") return res.status(400).json({ error: "Yêu cầu đã xử lý." });
  const u = db.users.find(x => x.id === t.userId);
  if (!u) return res.status(404).json({ error: "Không tìm thấy người dùng." });
  u.balance += Number(t.amount || 0);
  t.status = "approved";
  t.approvedAt = new Date().toISOString();
  saveDB(db);
  res.json(t);
});

app.patch("/api/admin/orders/:id", auth, admin, (req, res) => {
  const db = loadDB();
  const o = db.orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: "Không tìm thấy đơn." });
  if (["paid", "processing", "completed", "cancelled"].includes(req.body.status)) o.status = req.body.status;
  saveDB(db);
  res.json(o);
});

app.post("/api/admin/products", auth, admin, (req, res) => {
  const { name, category, price, oldPrice, description, imageClass, badge, delivery, image } = req.body;
  if (!name || !category || Number(price) <= 0) return res.status(400).json({ error: "Thiếu tên, danh mục hoặc giá." });
  const db = loadDB();
  const p = {
    id: Date.now(),
    name: String(name).trim(),
    category: String(category).trim(),
    price: Number(price),
    oldPrice: Number(oldPrice) || 0,
    rating: 0,
    reviews: 0,
    sold: 0,
    badge: badge || "",
    delivery: delivery || "Giao ngay",
    description: description || "",
    imageClass: imageClass || "blue",
    image: sanitizeImage(image)
  };
  db.products.unshift(p);
  saveDB(db);
  res.json(p);
});

app.put("/api/admin/products/:id", auth, admin, (req, res) => {
  const db = loadDB();
  const p = db.products.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
  Object.assign(p, {
    ...req.body,
    id: p.id,
    name: String(req.body.name ?? p.name).trim(),
    category: String(req.body.category ?? p.category).trim(),
    price: Number(req.body.price ?? p.price),
    oldPrice: Number(req.body.oldPrice ?? 0),
    image: req.body.image === undefined ? p.image || "" : sanitizeImage(req.body.image)
  });
  saveDB(db);
  res.json(p);
});

app.delete("/api/admin/products/:id", auth, admin, (req, res) => {
  const db = loadDB();
  db.products = db.products.filter(x => x.id !== Number(req.params.id));
  saveDB(db);
  res.json({ ok: true });
});

const INDEX_FILE = HAS_PUBLIC_APP ? path.join(PUBLIC_DIR, "index.html") : path.join(__dirname, "index.html");
app.use((req, res) => {
  if (fs.existsSync(INDEX_FILE)) return res.sendFile(INDEX_FILE);
  res.status(500).send("Frontend files not found.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Gaming Shop running at http://localhost:${PORT}`);
});
