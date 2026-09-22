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
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const QR_BASE = "https://quickchart.io/qr";

const DEFAULT_SETTINGS = {
  shopName: DEFAULT_SHOP_NAME,
  shopTagline: "Gaming Marketplace",
  metaDescription: "Gaming marketplace — items, currency and services.",
  logo: "",
  favicon: "",
  heroEyebrow: "GAMING MARKETPLACE",
  heroTitle: "Chọn món bạn cần.\nMua nhanh, dùng ngay.",
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
  fontBody: "DM Sans",
  fontHeading: "Space Grotesk",
  supportEmail: "support@yourshop.com",
  supportPhone: "09xx xxx xxx",
  discord: "",
  facebook: "",
  telegram: "",
  floatingSocial1Type: "zalo",
  floatingSocial1Label: "Zalo",
  floatingSocial1Url: "",
  floatingSocial2Type: "messenger",
  floatingSocial2Label: "Messenger",
  floatingSocial2Url: "",
  categories: ["Scripts", "Executors", "Externals", "Cloud Phone", "Services"],
  sections: { hero: true, bestsellers: true, products: true, recent: true, trust: true },
  homeOrder: ["hero", "bestsellers", "products", "recent", "trust"]
};

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, "public");
const HAS_PUBLIC_APP = fs.existsSync(path.join(PUBLIC_DIR, "index.html"));
if (HAS_PUBLIC_APP) {
  app.use(express.static(PUBLIC_DIR));
} else {
  const rootFile = (name) => (req, res) => res.sendFile(path.join(__dirname, name));
  const rootAssets = [
    "styles.css", "customer-pages.css", "app.js", "cart.js", "account.js",
    "admin.css", "admin.js"
  ];
  for (const asset of rootAssets) app.get("/" + asset, rootFile(asset));
  for (const page of ["index.html", "cart.html", "account.html", "admin.html"]) app.get("/" + page, rootFile(page));
}

const fileOf = (name) => HAS_PUBLIC_APP ? path.join(PUBLIC_DIR, name) : path.join(__dirname, name);
app.get(["/admin", "/admin/"], (req, res) => {
  const file = fileOf("admin.html");
  return fs.existsSync(file) ? res.sendFile(file) : res.status(404).send("Admin panel not found.");
});

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { users: [], products: [], orders: [], topups: [], settings: { ...DEFAULT_SETTINGS } }; }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8"); }

function normalizeSettings(raw = {}) {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  if (!Array.isArray(s.categories)) s.categories = [...DEFAULT_SETTINGS.categories];
  s.categories = s.categories.map(v => String(v).trim()).filter(Boolean).slice(0, 50);
  const secKeys = Object.keys(DEFAULT_SETTINGS.sections);
  const incoming = s.sections && typeof s.sections === "object" ? s.sections : {};
  s.sections = Object.fromEntries(secKeys.map(k => [k, incoming[k] !== false]));
  const allowedOrder = ["hero", "bestsellers", "products", "recent", "trust"];
  const rawOrder = Array.isArray(s.homeOrder) ? s.homeOrder : [];
  s.homeOrder = [...new Set(rawOrder.filter(x => allowedOrder.includes(x)))];
  for (const key of allowedOrder) if (!s.homeOrder.includes(key)) s.homeOrder.push(key);
  return s;
}
function getSettings(db) { return normalizeSettings(db.settings); }
function sanitizeColor(value, fallback) {
  const v = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}
function sanitizeImage(value) {
  const v = String(value || "");
  if (!v || v.length > 5_500_000) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return "";
}
function normalizeVariants(raw, fallback = {}) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.slice(0, 100).map((v, index) => ({
    id: String(v?.id || crypto.randomUUID()),
    name: String(v?.name ?? `Gói ${index + 1}`).trim().slice(0, 160) || `Gói ${index + 1}`,
    price: Math.max(1, Number(v?.price) || Number(fallback.price) || 1),
    oldPrice: Math.max(0, Number(v?.oldPrice) || 0),
    delivery: String(v?.delivery ?? fallback.delivery ?? "Giao ngay").trim().slice(0, 120),
    badge: String(v?.badge ?? "").trim().slice(0, 60),
    image: sanitizeImage(v?.image ?? ""),
    stock: v?.stock === "" || v?.stock === null || v?.stock === undefined ? null : Math.max(0, Number(v.stock) || 0),
    sold: Math.max(0, Number(v?.sold) || 0)
  }));
}
function productVariants(product) {
  const list = normalizeVariants(product?.variants, product);
  if (list.length) return list;
  return [{
    id: "default", name: product?.name || "Gói mặc định", price: Math.max(1, Number(product?.price) || 1),
    oldPrice: Math.max(0, Number(product?.oldPrice) || 0), delivery: product?.delivery || "Giao ngay",
    badge: product?.badge || "", image: product?.image || "", stock: null, sold: Number(product?.sold) || 0
  }];
}
function sanitizeSettings(body, existing) {
  const next = { ...existing };
  const stringKeys = [
    "shopName", "shopTagline", "metaDescription", "heroEyebrow", "heroTitle", "heroSubtitle",
    "heroButtonText", "heroSecondaryText", "supportEmail", "supportPhone", "discord", "facebook",
    "telegram", "fontBody", "fontHeading", "floatingSocial1Type", "floatingSocial1Label", "floatingSocial1Url",
    "floatingSocial2Type", "floatingSocial2Label", "floatingSocial2Url"
  ];
  for (const key of stringKeys) if (body[key] !== undefined) next[key] = String(body[key]).trim().slice(0, 500);
  for (const key of ["logo", "favicon", "heroBanner"]) if (body[key] !== undefined) next[key] = sanitizeImage(body[key]);
  next.primary = sanitizeColor(body.primary, existing.primary);
  next.accent = sanitizeColor(body.accent, existing.accent);
  next.pageBg = sanitizeColor(body.pageBg, existing.pageBg);
  next.cardBg = sanitizeColor(body.cardBg, existing.cardBg);
  next.text = sanitizeColor(body.text, existing.text);
  next.muted = sanitizeColor(body.muted, existing.muted);
  next.footerBg = sanitizeColor(body.footerBg, existing.footerBg);
  if (body.categories !== undefined) {
    const categories = Array.isArray(body.categories) ? body.categories : String(body.categories).split(",");
    next.categories = categories.map(v => String(v).trim()).filter(Boolean).slice(0, 50);
  }
  if (body.sections && typeof body.sections === "object") next.sections = { ...(existing.sections || DEFAULT_SETTINGS.sections), ...body.sections };
  if (body.homeOrder !== undefined) next.homeOrder = Array.isArray(body.homeOrder) ? body.homeOrder : [];
  return normalizeSettings(next);
}

function hashPassword(password) { return crypto.createHash("sha256").update(String(password)).digest("hex"); }
function hmac(value, secret = SESSION_SECRET) { return crypto.createHmac("sha256", secret).update(String(value)).digest("hex"); }
function issuePayload(payload, secret = SESSION_SECRET) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}
function readPayload(token, secret = SESSION_SECRET) {
  if (!token) return null;
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig || sig !== hmac(body, secret)) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch { return null; }
}
function tokenFor(user) {
  return issuePayload({ id: user.id, role: user.role, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 });
}
function userFromToken(token) {
  const data = readPayload(token);
  if (data?.id && data?.role && data.exp >= Date.now()) {
    const db = loadDB();
    return db.users.find(u => u.id === data.id && u.role === data.role) || null;
  }
  // Accept legacy tokens created by the earlier MVP so existing browser sessions are not abruptly invalidated.
  try {
    const [payload, signature] = String(token || "").split(".");
    const oldData = JSON.parse(Buffer.from(payload, "base64url").toString());
    const expected = crypto.createHash("sha256").update(SESSION_SECRET + oldData.id).digest("hex");
    if (oldData?.id && oldData?.role && oldData.exp >= Date.now() && signature === expected) {
      const db = loadDB();
      return db.users.find(u => u.id === oldData.id && u.role === oldData.role) || null;
    }
  } catch {}
  return null;
}
function auth(req, res, next) {
  const u = userFromToken((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  if (!u) return res.status(401).json({ error: "Bạn cần đăng nhập." });
  req.user = u; next();
}
function admin(req, res, next) { if (req.user?.role !== "admin") return res.status(403).json({ error: "Không có quyền admin." }); next(); }
function publicUser(u) {
  return {
    id: u.id, email: u.email, name: u.name, fullName: u.fullName || "", phone: u.phone || "", telegram: u.telegram || "",
    role: u.role, balance: Number(u.balance || 0), discountPercent: Number(u.discountPercent || 0),
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null, twoFactorEnabled: Boolean(u.twoFactorEnabled),
    loginAlerts: u.loginAlerts !== false, orderProtection: u.orderProtection === true
  };
}

function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(str || "").toUpperCase().replace(/=+$/g, "");
  let bits = 0, value = 0, bytes = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch); if (idx < 0) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}
function generateTotp(secret, timeMs = Date.now()) {
  const key = base32Decode(secret);
  const counter = Math.floor(timeMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const bin = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}
function verifyTotp(secret, code) {
  const clean = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  for (const offset of [-30000, 0, 30000]) if (generateTotp(secret, Date.now() + offset) === clean) return true;
  return false;
}
function otpauthUri(u, secret) {
  const issuer = getSettings(loadDB()).shopName || "Gaming Shop";
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(u.email)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}
function qrUrl(text) { return `${QR_BASE}?size=240&margin=2&ecLevel=M&text=${encodeURIComponent(text)}`; }
function createActivity(db, userId, action, ip = "") {
  if (!Array.isArray(db.activities)) db.activities = [];
  db.activities.push({ id: crypto.randomUUID(), userId, action, ip: ip || "unknown", createdAt: new Date().toISOString() });
  if (db.activities.length > 5000) db.activities.splice(0, db.activities.length - 5000);
}

let db = loadDB();
if (!Array.isArray(db.users)) db.users = [];
if (!Array.isArray(db.products)) db.products = [];
if (!Array.isArray(db.orders)) db.orders = [];
if (!Array.isArray(db.topups)) db.topups = [];
if (!Array.isArray(db.activities)) db.activities = [];
db.settings = normalizeSettings(db.settings);
if (!db.users.some(u => String(u.email).toLowerCase() === String(ADMIN_EMAIL).toLowerCase())) {
  db.users.push({ id: crypto.randomUUID(), email: ADMIN_EMAIL, name: "Admin", password: hashPassword(ADMIN_PASSWORD), role: "admin", balance: 0, createdAt: new Date().toISOString() });
  saveDB(db);
}

app.get("/api/config", (req, res) => res.json(getSettings(loadDB())));
app.get("/api/products", (req, res) => res.json(loadDB().products));
app.get("/api/me", auth, (req, res) => res.json(publicUser(req.user)));

app.post("/api/register", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({ error: "Email và mật khẩu (tối thiểu 6 ký tự) là bắt buộc." });
  const db = loadDB();
  if (db.users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(409).json({ error: "Email đã tồn tại." });
  const u = { id: crypto.randomUUID(), email: String(email).toLowerCase(), name: name || email.split("@")[0], password: hashPassword(password), role: "user", balance: 0, createdAt: new Date().toISOString(), loginAlerts: true, orderProtection: false, twoFactorEnabled: false };
  db.users.push(u); createActivity(db, u.id, "Đăng ký tài khoản", req.ip); saveDB(db);
  res.json({ token: tokenFor(u), user: publicUser(u) });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body; const db = loadDB();
  const u = db.users.find(x => x.email.toLowerCase() === String(email || "").toLowerCase() && x.password === hashPassword(password || ""));
  if (!u) return res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
  u.lastLoginAt = new Date().toISOString(); createActivity(db, u.id, "Đăng nhập vào website", req.ip); saveDB(db);
  if (u.twoFactorEnabled && u.twoFactorSecret) {
    return res.json({ requires2FA: true, twoFactorToken: issuePayload({ type: "2fa", id: u.id, exp: Date.now() + 1000 * 60 * 5 }) });
  }
  res.json({ token: tokenFor(u), user: publicUser(u) });
});

app.post("/api/login/2fa", (req, res) => {
  const data = readPayload(req.body.twoFactorToken);
  if (!data || data.type !== "2fa" || data.exp < Date.now()) return res.status(401).json({ error: "Phiên xác thực 2FA đã hết hạn. Hãy đăng nhập lại." });
  const db = loadDB(); const u = db.users.find(x => x.id === data.id);
  if (!u || !u.twoFactorEnabled || !u.twoFactorSecret) return res.status(401).json({ error: "2FA chưa sẵn sàng." });
  if (!verifyTotp(u.twoFactorSecret, req.body.code)) return res.status(401).json({ error: "Mã Google Authenticator không đúng." });
  createActivity(db, u.id, "Xác thực Google Authenticator khi đăng nhập", req.ip); saveDB(db);
  res.json({ token: tokenFor(u), user: publicUser(u) });
});

app.get("/api/orders", auth, (req, res) => { const db = loadDB(); res.json(db.orders.filter(o => o.userId === req.user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))); });

app.get("/api/account/summary", auth, (req, res) => {
  const db = loadDB();
  const orders = db.orders.filter(o => o.userId === req.user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const topups = db.topups.filter(t => t.userId === req.user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const approvedTopup = topups.filter(t=>t.status === "approved").reduce((sum,t)=>sum+Number(t.amount||0),0);
  const spent = orders.filter(o=>o.status!=="cancelled").reduce((sum,o)=>sum+Number(o.total||0),0);
  const transactions = [
    ...topups.map(t=>({id:t.id,type:"topup",title:"Nạp tiền vào ví",amount:Number(t.amount||0),status:t.status,createdAt:t.createdAt})),
    ...orders.map(o=>({id:o.id,type:"purchase",title:`Thanh toán đơn ${o.id}`,amount:-Number(o.total||0),status:o.status,createdAt:o.createdAt}))
  ].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const activities = (db.activities||[]).filter(a=>a.userId===req.user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);
  res.json({user:publicUser(req.user),totals:{approvedTopup,spent,orders:orders.length,transactions:transactions.length},orders,topups,transactions,activities});
});

app.get("/api/account/security", auth, (req,res) => {
  const u = loadDB().users.find(x=>x.id===req.user.id);
  res.json({ twoFactorEnabled:Boolean(u.twoFactorEnabled), loginAlerts:u.loginAlerts!==false, orderProtection:u.orderProtection===true });
});
app.put("/api/account/security", auth, (req,res) => {
  const db=loadDB(); const u=db.users.find(x=>x.id===req.user.id); if(!u)return res.status(404).json({error:"Không tìm thấy tài khoản."});
  if(req.body.loginAlerts!==undefined)u.loginAlerts=Boolean(req.body.loginAlerts);
  if(req.body.orderProtection!==undefined)u.orderProtection=Boolean(req.body.orderProtection);
  createActivity(db,u.id,"Cập nhật cài đặt bảo mật",req.ip); saveDB(db); res.json(publicUser(u));
});
app.post("/api/account/2fa/setup", auth, (req,res) => {
  const db=loadDB(); const u=db.users.find(x=>x.id===req.user.id);
  if(u.twoFactorEnabled) return res.status(400).json({error:"2FA đã được bật."});
  const secret=base32Encode(crypto.randomBytes(20)); const uri=otpauthUri(u,secret); u.twoFactorPendingSecret=secret; saveDB(db);
  res.json({secret,otpauthUri:uri,qrUrl:qrUrl(uri)});
});
app.post("/api/account/2fa/confirm", auth, (req,res) => {
  const db=loadDB(); const u=db.users.find(x=>x.id===req.user.id);
  const secret=u.twoFactorPendingSecret; if(!secret)return res.status(400).json({error:"Chưa tạo mã 2FA. Hãy bắt đầu thiết lập lại."});
  if(!verifyTotp(secret,req.body.code))return res.status(400).json({error:"Mã 6 số không đúng. Hãy quét QR rồi nhập mã đang hiển thị."});
  u.twoFactorSecret=secret;u.twoFactorPendingSecret="";u.twoFactorEnabled=true;createActivity(db,u.id,"Bật Google Authenticator (2FA)",req.ip);saveDB(db);res.json(publicUser(u));
});
app.post("/api/account/2fa/disable", auth, (req,res) => {
  const db=loadDB(); const u=db.users.find(x=>x.id===req.user.id);
  if(!u.twoFactorEnabled || !u.twoFactorSecret)return res.status(400).json({error:"2FA chưa bật."});
  if(u.password!==hashPassword(req.body.password||"") || !verifyTotp(u.twoFactorSecret,req.body.code))return res.status(400).json({error:"Mật khẩu hoặc mã Authenticator không đúng."});
  u.twoFactorEnabled=false;u.twoFactorSecret="";u.twoFactorPendingSecret="";createActivity(db,u.id,"Tắt Google Authenticator (2FA)",req.ip);saveDB(db);res.json(publicUser(u));
});

app.put("/api/account/profile", auth, (req,res)=>{const db=loadDB();const u=db.users.find(x=>x.id===req.user.id);if(!u)return res.status(404).json({error:"Không tìm thấy tài khoản."});if(req.body.name!==undefined)u.name=String(req.body.name).trim().slice(0,80)||u.name;if(req.body.fullName!==undefined)u.fullName=String(req.body.fullName).trim().slice(0,120);if(req.body.phone!==undefined)u.phone=String(req.body.phone).trim().slice(0,40);if(req.body.telegram!==undefined)u.telegram=String(req.body.telegram).trim().slice(0,100);createActivity(db,u.id,"Cập nhật thông tin cá nhân",req.ip);saveDB(db);res.json(publicUser(u));});
app.post("/api/account/password", auth, (req,res)=>{const currentPassword=String(req.body.currentPassword||"");const newPassword=String(req.body.newPassword||"");if(newPassword.length<6)return res.status(400).json({error:"Mật khẩu mới tối thiểu 6 ký tự."});const db=loadDB();const u=db.users.find(x=>x.id===req.user.id);if(!u||u.password!==hashPassword(currentPassword))return res.status(400).json({error:"Mật khẩu hiện tại không đúng."});u.password=hashPassword(newPassword);createActivity(db,u.id,"Đổi mật khẩu",req.ip);saveDB(db);res.json({ok:true});});

app.post("/api/orders", auth, (req,res)=>{
  const items=Array.isArray(req.body.items)?req.body.items:[];if(!items.length)return res.status(400).json({error:"Giỏ hàng trống."});const db=loadDB();let total=0;const normalized=[];
  for(const item of items){const p=db.products.find(x=>x.id===Number(item.id));const qty=Math.max(1,Math.min(99,Number(item.qty)||1));if(!p)return res.status(400).json({error:"Có sản phẩm không còn tồn tại."});const variants=productVariants(p);const variant=variants.find(v=>v.id===String(item.variantId))||variants[0];if(variant.stock!==null&&variant.stock<qty)return res.status(400).json({error:`Gói \"${variant.name}\" không đủ hàng.`});total+=Number(variant.price)*qty;normalized.push({productId:p.id,variantId:variant.id,name:p.name,variantName:variant.name,price:variant.price,qty});}
  const u=db.users.find(x=>x.id===req.user.id);if(u.balance<total)return res.status(400).json({error:"Số dư không đủ. Hãy nạp tiền trước."});u.balance-=total;
  const order={id:"GS-"+Date.now().toString(36).toUpperCase(),userId:u.id,items:normalized,total,status:"paid",createdAt:new Date().toISOString()};db.orders.push(order);
  normalized.forEach(i=>{const p=db.products.find(x=>x.id===i.productId);if(!p)return;p.sold=(p.sold||0)+i.qty;const v=Array.isArray(p.variants)?p.variants.find(v=>String(v.id)===String(i.variantId)):null;if(v){v.sold=(v.sold||0)+i.qty;if(v.stock!==null&&v.stock!==undefined)v.stock=Math.max(0,Number(v.stock)-i.qty);}});
  createActivity(db,u.id,`Thanh toán đơn ${order.id}`,req.ip);saveDB(db);res.json({order,user:publicUser(u)});
});

app.post("/api/topups", auth, (req,res)=>{const amount=Number(req.body.amount)||0;const method=["bank","crypto","card"].includes(req.body.method)?req.body.method:"bank";if(amount<1000)return res.status(400).json({error:"Số tiền tối thiểu là 1.000đ."});const db=loadDB();const topup={id:"TP-"+Date.now().toString(36).toUpperCase(),userId:req.user.id,amount,method,status:"pending",createdAt:new Date().toISOString()};db.topups.push(topup);createActivity(db,req.user.id,`Tạo yêu cầu nạp ${amount.toLocaleString("vi-VN")}đ`,req.ip);saveDB(db);res.json(topup);});

app.get("/api/admin/stats",auth,admin,(req,res)=>{const db=loadDB();const revenue=db.orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+Number(o.total||0),0);res.json({users:db.users.filter(u=>u.role!=="admin").length,products:db.products.length,orders:db.orders.length,revenue,pendingTopups:db.topups.filter(t=>t.status==="pending").length});});
app.get("/api/admin/orders",auth,admin,(req,res)=>res.json(loadDB().orders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))));
app.get("/api/admin/topups",auth,admin,(req,res)=>res.json(loadDB().topups.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))));
app.get("/api/admin/settings",auth,admin,(req,res)=>res.json(getSettings(loadDB())));
app.put("/api/admin/settings",auth,admin,(req,res)=>{const db=loadDB();db.settings=sanitizeSettings(req.body,getSettings(db));saveDB(db);res.json(db.settings);});
app.post("/api/admin/topups/:id/approve",auth,admin,(req,res)=>{const db=loadDB();const t=db.topups.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:"Không tìm thấy yêu cầu."});if(t.status!=="pending")return res.status(400).json({error:"Yêu cầu đã xử lý."});const u=db.users.find(x=>x.id===t.userId);if(!u)return res.status(404).json({error:"Không tìm thấy người dùng."});u.balance+=Number(t.amount||0);t.status="approved";t.approvedAt=new Date().toISOString();createActivity(db,u.id,`Nạp tiền thành công ${Number(t.amount||0).toLocaleString("vi-VN")}đ`);saveDB(db);res.json(t);});
app.patch("/api/admin/orders/:id",auth,admin,(req,res)=>{const db=loadDB();const o=db.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({error:"Không tìm thấy đơn."});if(["paid","processing","completed","cancelled"].includes(req.body.status))o.status=req.body.status;saveDB(db);res.json(o);});

app.post("/api/admin/products",auth,admin,(req,res)=>{const {name,category,price,oldPrice,description,imageClass,badge,delivery,image}=req.body;if(!name||!category)return res.status(400).json({error:"Thiếu tên hoặc danh mục."});const db=loadDB();let variants=normalizeVariants(req.body.variants);const basePrice=Number(price)>0?Number(price):Number(variants[0]?.price)||0;if(!basePrice&&!variants.length)return res.status(400).json({error:"Thêm ít nhất một dòng sản phẩm và giá hợp lệ."});const p={id:Date.now(),name:String(name).trim(),category:String(category).trim(),price:basePrice,oldPrice:Number(oldPrice)||0,rating:0,reviews:0,sold:0,badge:badge||"",delivery:delivery||"Giao ngay",description:description||"",imageClass:imageClass||"blue",image:sanitizeImage(image),variants};if(!p.variants.length)p.variants=[{id:crypto.randomUUID(),name:p.name,price:p.price,oldPrice:p.oldPrice,delivery:p.delivery,badge:p.badge,image:p.image,stock:null,sold:0}];p.price=Number(p.variants[0].price);p.oldPrice=Number(p.variants[0].oldPrice)||0;p.delivery=p.variants[0].delivery||p.delivery;db.products.unshift(p);saveDB(db);res.json(p);});
app.put("/api/admin/products/:id",auth,admin,(req,res)=>{const db=loadDB();const p=db.products.find(x=>x.id===Number(req.params.id));if(!p)return res.status(404).json({error:"Không tìm thấy sản phẩm."});Object.assign(p,{...req.body,id:p.id,name:String(req.body.name??p.name).trim(),category:String(req.body.category??p.category).trim(),oldPrice:Number(req.body.oldPrice??p.oldPrice??0),image:req.body.image===undefined?p.image||"":sanitizeImage(req.body.image)});if(req.body.variants!==undefined)p.variants=normalizeVariants(req.body.variants,p);else p.variants=productVariants(p);if(!p.variants.length)return res.status(400).json({error:"Sản phẩm phải có ít nhất một dòng."});p.price=Number(p.variants[0].price);p.oldPrice=Number(p.variants[0].oldPrice)||0;p.delivery=p.variants[0].delivery||p.delivery||"Giao ngay";saveDB(db);res.json(p);});
app.delete("/api/admin/products/:id",auth,admin,(req,res)=>{const db=loadDB();db.products=db.products.filter(x=>x.id!==Number(req.params.id));saveDB(db);res.json({ok:true});});

const INDEX_FILE=fileOf("index.html"), CART_FILE=fileOf("cart.html"), ACCOUNT_FILE=fileOf("account.html");
app.get(["/cart","/cart/"],(req,res)=>fs.existsSync(CART_FILE)?res.sendFile(CART_FILE):res.status(404).send("Cart page not found."));
app.get(["/account","/account/"],(req,res)=>fs.existsSync(ACCOUNT_FILE)?res.sendFile(ACCOUNT_FILE):res.status(404).send("Account page not found."));
app.use((req,res)=>fs.existsSync(INDEX_FILE)?res.sendFile(INDEX_FILE):res.status(500).send("Frontend files not found."));
app.listen(PORT,"0.0.0.0",()=>console.log(`Gaming Shop running at http://localhost:${PORT}`));
