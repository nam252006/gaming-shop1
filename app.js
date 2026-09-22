let products = [];
let cart = JSON.parse(localStorage.getItem("gaming_cart") || "[]");
let token = localStorage.getItem("gaming_token") || "";
let currentUser = null;
let currentCat = "all";
let settings = {};

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ";
const fmt = n => Number(n) >= 1000 ? (Number(n) / 1000).toFixed(Number(n) >= 10000 ? 0 : 1) + "k" : String(n || 0);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function toast(msg){const el=$("#toast");el.textContent=msg;el.className="toast show";setTimeout(()=>el.className="toast",2600)}
async function api(url, opts={}){opts.headers={...(opts.headers||{}),"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})};const r=await fetch(url,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Có lỗi xảy ra");return d}
function cssImage(url){return url ? `background-image:linear-gradient(90deg, rgba(9,12,18,.55), rgba(9,12,18,.1)),url("${String(url).replace(/"/g,'\\"')}")` : ""}

async function boot(){
  try{
    settings=await fetch("/api/config").then(r=>r.json());
    applySettings();
    products=await fetch("/api/products").then(r=>r.json());
    if(token){try{currentUser=await api("/api/me")}catch{logout(false)}}
    updateAccount();updateCartCount();renderProducts();renderCategories();
  }catch(e){toast("Không tải được dữ liệu: "+e.message)}
}

function applySettings(){
  const s=settings;
  document.title=s.shopName||"Gaming Shop";
  const md=$("#metaDescription"); if(md)md.setAttribute("content",s.metaDescription||"");
  document.documentElement.style.setProperty("--primary",s.primary||"#111827");
  document.documentElement.style.setProperty("--accent",s.accent||"#6d5dfc");
  document.documentElement.style.setProperty("--page-bg",s.pageBg||"#f4f6fa");
  document.documentElement.style.setProperty("--card-bg",s.cardBg||"#fff");
  document.documentElement.style.setProperty("--text",s.text||"#111827");
  document.documentElement.style.setProperty("--muted",s.muted||"#667085");
  document.documentElement.style.setProperty("--footer-bg",s.footerBg||"#182433");
  ["#shopName","#footerShopName","#copyrightName"].forEach(sel=>{if($(sel))$(sel).textContent=s.shopName||"Gaming Shop"});
  ["#shopTagline","#footerShopTagline"].forEach(sel=>{if($(sel))$(sel).textContent=s.shopTagline||"Marketplace"});
  $("#heroEyebrow").textContent=s.heroEyebrow||"";
  $("#heroSubtitle").textContent=s.heroSubtitle||"";
  $("#heroButton").textContent=s.heroButtonText||"Xem sản phẩm";
  $("#heroSecondary").textContent=s.heroSecondaryText||"Nạp tiền vào ví";
  $("#supportEmail").textContent=s.supportEmail||"";
  $("#supportPhone").textContent=s.supportPhone||"";
  $("#footerDescription").textContent=s.metaDescription||"";
  $("#socialLinks").innerHTML=[["Discord",s.discord],["Facebook",s.facebook],["Telegram",s.telegram]].filter(x=>x[1]).map(([n,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join(" · ");
  const logoHtml=s.logo?`<img src="${s.logo}" alt="logo">`:"G";
  $("#brandBadge").innerHTML=logoHtml;$("#footerBrandBadge").innerHTML=logoHtml;
  const favicon=$("#favicon"); if(favicon)favicon.href=s.favicon||s.logo||"data:,";
  const titleLines=String(s.heroTitle||"").split("\\n");
  $("#heroTitle").innerHTML=titleLines.map((line,i)=>i===titleLines.length-1?`<span>${esc(line)}</span>`:esc(line)).join("<br>");
  if(s.heroBanner){$("#heroSection").style.backgroundImage=cssImage(s.heroBanner);$("#heroSection").classList.add("hero-has-image")}else{$("#heroSection").style.backgroundImage="";$("#heroSection").classList.remove("hero-has-image")}
  applyHomeLayout();
}

function applyHomeLayout(){
  const sections = settings.sections || {};
  const nodes = { hero: $("#heroSection"), products: $("#products"), trust: document.querySelector(".trust-section") };
  Object.entries(nodes).forEach(([key,node])=>{ if(node) node.style.display = sections[key] === false ? "none" : ""; });
  const order = Array.isArray(settings.homeOrder) ? settings.homeOrder : ["hero","products","trust"];
  const main = document.querySelector("main");
  if(main){ for(const key of order){ if(nodes[key]) main.appendChild(nodes[key]); } }
}

function renderCategories(){
  const cats=(settings.categories||[]).filter(Boolean);
  $("#categoryNav").innerHTML=[`<button class="nav-link ${currentCat==="all"?"active":""}" data-filter="all" onclick="filterCategory('all')">Tất cả</button>`,...cats.map(c=>`<button class="nav-link ${currentCat===c?"active":""}" data-filter="${esc(c)}" onclick="filterCategory(${JSON.stringify(c)})">${esc(c)}</button>`)].join("");
  const featured=cats.slice(0,3);
  $("#featureList").innerHTML=(featured.length?featured:["Sản phẩm"]).map((c,i)=>`<button onclick="filterCategory(${JSON.stringify(c)})"><span class="feature-icon">${esc(String(c).slice(0,1).toUpperCase())}</span><span><b>${esc(c)}</b><small>${i===0?"Gọn, dễ chọn":i===1?"PC & Mobile":"Theo yêu cầu"}</small></span><i>→</i></button>`).join("");
}

function updateAccount(){if(currentUser){$("#accountName").textContent=currentUser.name;$("#accountBalance").textContent=money(currentUser.balance);$("#avatarLetter").textContent=(currentUser.name||"U").slice(0,1).toUpperCase()}else{$("#accountName").textContent="Khách";$("#accountBalance").textContent="Đăng nhập";$("#avatarLetter").textContent="U"}}
function updateCartCount(){$("#cartCount").textContent=cart.reduce((s,i)=>s+i.qty,0)}
function getVariants(p){
  if(Array.isArray(p.variants) && p.variants.length) return p.variants;
  return [{id:"default",name:p.name,price:Number(p.price)||0,oldPrice:Number(p.oldPrice)||0,delivery:p.delivery||"Giao ngay",badge:p.badge||"",image:p.image||"",stock:null,sold:p.sold||0}];
}
function getDefaultVariant(p){return getVariants(p)[0]||null}
function variantById(p,variantId){const vs=getVariants(p);return vs.find(v=>String(v.id)===String(variantId))||vs[0]||null}
function displayPrice(p){const vs=getVariants(p);return Math.min(...vs.map(v=>Number(v.price)||0));}
function productImage(p,cls="thumb"){
  return p.image?`<div class="${cls}"><img src="${p.image}" alt="${esc(p.name)}" loading="lazy">${p.badge?`<span class="badge">${esc(p.badge)}</span>`:""}</div>`:`<div class="${cls}"><div class="thumb-placeholder">Chưa có ảnh</div>${p.badge?`<span class="badge">${esc(p.badge)}</span>`:""}</div>`
}
function renderProducts(){
  const q=($( "#search")?.value||"").trim().toLowerCase();
  let list=products.filter(p=>(currentCat==="all"||p.category===currentCat)&&(!q||`${p.name} ${p.category} ${p.description} ${(p.variants||[]).map(v=>v.name).join(" ")}`.toLowerCase().includes(q)));
  const sort=$("#sortSelect")?.value||"default";
  if(sort==="price-asc")list.sort((a,b)=>a.price-b.price);
  if(sort==="price-desc")list.sort((a,b)=>b.price-a.price);
  if(sort==="sold")list.sort((a,b)=>(b.sold||0)-(a.sold||0));
  $("#resultMeta").textContent=`${list.length} sản phẩm • Danh mục: ${currentCat==="all"?"Tất cả":currentCat}`;
  $("#productGrid").innerHTML=list.length?list.map(card).join(""):`<div class="empty"><h3>Không tìm thấy sản phẩm</h3><p>Hãy thử từ khóa hoặc danh mục khác.</p></div>`;
  $("#searchClear").classList.toggle("hidden",!$("#search").value);
}
function card(p){
  return `<article class="card">${productImage(p,"thumb")}<div class="card-body"><div class="card-category">${esc(p.category)}</div><h3>${esc(p.name)}</h3><div class="price-row"><span class="price">${getVariants(p).length>1?`Từ ${money(displayPrice(p))}`:money(getDefaultVariant(p)?.price||p.price)}</span>${(getVariants(p).length===1?(getDefaultVariant(p)?.oldPrice||p.oldPrice):0)?`<span class="old">${money(getDefaultVariant(p)?.oldPrice||p.oldPrice)}</span>`:""}</div><div class="card-meta"><span>Đã bán ${fmt(p.sold)}</span><span class="delivery">${esc(p.delivery||"Giao ngay")}</span></div><div class="card-footer"><button class="card-buy" onclick="openProduct(${p.id})">Xem chi tiết</button><button class="card-cart" title="Thêm vào giỏ" onclick="event.stopPropagation();addCart(${p.id})">＋</button></div></div></article>`
}
let detailState={productId:null,variantId:null,qty:1};
function openProduct(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  const variants=getVariants(p);
  const first=variants[0];
  detailState={productId:p.id,variantId:first.id,qty:1};
  const image=p.image?`<img src="${p.image}" alt="${esc(p.name)}">`:`<div class="thumb-placeholder">Chưa có ảnh sản phẩm</div>`;
  const variantRows=variants.map((v,i)=>`<button type="button" class="variant-row ${i===0?"selected":""}" data-variant-id="${esc(v.id)}" onclick="selectProductVariant('${esc(String(v.id))}')"><span class="variant-radio"></span><span class="variant-thumb">${v.image?`<img src="${v.image}" alt="">`:`<span>IMG</span>`}</span><span class="variant-info"><b>${esc(v.name)}</b><small>↗ ${esc(v.delivery||"Giao ngay")}</small></span><span class="variant-price"><b>${money(v.price)}</b>${v.oldPrice?`<del>${money(v.oldPrice)}</del>`:""}</span></button>`).join("");
  openModal(`<div class="modal-head"><div><span class="pill">${esc(p.category)}</span><h2 style="margin-top:8px">${esc(p.name)}</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><div class="detail-grid"><div class="detail-image">${image}</div><div class="detail-copy"><p>${esc(p.description||"Sản phẩm đang được cập nhật thông tin.")}</p><div id="detailSelectedPrice" class="detail-price">${money(first.price)}</div><p><b>Đã bán:</b> ${fmt(p.sold)}</p><div class="detail-qty"><span>Số lượng</span><div><button type="button" class="qty-btn" onclick="changeDetailQty(-1)">−</button><b id="detailQty">1</b><button type="button" class="qty-btn" onclick="changeDetailQty(1)">＋</button></div></div><div class="row"><button class="action-btn primary" onclick="addSelectedToCart()">Thêm vào giỏ</button><button class="action-btn secondary" onclick="buySelectedNow()">Mua ngay</button></div></div></div>${variants.length>0?`<section class="variant-picker"><div class="variant-picker-head"><h3>Chọn gói / thời hạn</h3><span>${variants.length} lựa chọn</span></div><div class="variant-list">${variantRows}</div></section>`:""}<section class="product-description"><h3>Thông tin sản phẩm</h3><p>${esc(p.description||"Đang cập nhật...")}</p></section>`);
}
function selectProductVariant(variantId){
  const p=products.find(x=>x.id===detailState.productId);if(!p)return;const v=variantById(p,variantId);if(!v)return;
  detailState.variantId=v.id;
  document.querySelectorAll(".variant-row").forEach(el=>el.classList.toggle("selected",String(el.dataset.variantId)===String(v.id)));
  const price=$("#detailSelectedPrice");if(price)price.textContent=money(v.price);
}
function changeDetailQty(delta){detailState.qty=Math.max(1,Math.min(99,detailState.qty+delta));const el=$("#detailQty");if(el)el.textContent=detailState.qty}
function addSelectedToCart(){const p=products.find(x=>x.id===detailState.productId);if(!p)return;addCart(p.id,detailState.variantId,detailState.qty);closeModal()}
function buySelectedNow(){const p=products.find(x=>x.id===detailState.productId);if(!p)return;addCart(p.id,detailState.variantId,detailState.qty);closeModal();openCart()}
function addCart(id,variantId=null,qty=1){const p=products.find(x=>x.id===id);if(!p)return;const v=variantById(p,variantId);if(!v)return;const key=String(v.id);const x=cart.find(i=>i.id===id&&String(i.variantId||"default")===key);x?x.qty=Math.min(99,x.qty+qty):cart.push({id,variantId:key,qty});saveCart();updateCartCount();toast("Đã thêm vào giỏ hàng")}
function removeCart(id,variantId="default"){cart=cart.filter(i=>!(i.id===id&&String(i.variantId||"default")===String(variantId)));saveCart();openCart()}
function changeQty(id,variantId,delta){const x=cart.find(i=>i.id===id&&String(i.variantId||"default")===String(variantId));if(!x)return;x.qty+=delta;if(x.qty<=0)cart=cart.filter(i=>i!==x);saveCart();updateCartCount();openCart()}
function buyNow(id,variantId=null){addCart(id,variantId,1);openCart()}
function saveCart(){localStorage.setItem("gaming_cart",JSON.stringify(cart))}
function openCart(){
  const rows=cart.map(i=>{const p=products.find(x=>x.id===i.id);if(!p)return"";const v=variantById(p,i.variantId);if(!v)return"";return `<div class="cart-row"><div class="cart-row-info"><b>${esc(p.name)}</b><small>${esc(v.name)} · ${money(v.price)} / món</small></div><div class="cart-qty"><button class="qty-btn" onclick="changeQty(${p.id},'${esc(String(v.id))}',-1)">−</button><span>${i.qty}</span><button class="qty-btn" onclick="changeQty(${p.id},'${esc(String(v.id))}',1)">＋</button><button class="qty-btn" onclick="removeCart(${p.id},'${esc(String(v.id))}')">×</button></div></div>`}).join("");
  const total=cart.reduce((s,i)=>{const p=products.find(x=>x.id===i.id);const v=p?variantById(p,i.variantId):null;return s+(v?v.price*i.qty:0)},0);
  openModal(`<div class="modal-head"><h2>Giỏ hàng</h2><button class="close-btn" onclick="closeModal()">×</button></div>${rows||"<p class='muted-note'>Giỏ hàng đang trống.</p>"}<div class="checkout-bar"><div class="checkout-total"><small>TỔNG CỘNG</small><strong>${money(total)}</strong></div><button class="action-btn primary" ${!cart.length?"disabled":""} onclick="checkout()">Thanh toán</button></div>`)
}
async function checkout(){if(!currentUser){closeModal();openAuth("login");return}if(!cart.length)return;try{const d=await api("/api/orders",{method:"POST",body:JSON.stringify({items:cart.map(i=>({id:i.id,variantId:i.variantId,qty:i.qty}))})});currentUser=d.user;cart=[];saveCart();updateAccount();updateCartCount();closeModal();toast("Đặt hàng thành công: "+d.order.id)}catch(e){toast(e.message)}}
function openAuth(mode="login"){openModal(`<div class="modal-head"><h2>${mode==="login"?"Đăng nhập":"Tạo tài khoản"}</h2><button class="close-btn" onclick="closeModal()">×</button></div><form class="form" onsubmit="authSubmit(event,'${mode}')">${mode==="register"?`<input name="name" placeholder="Tên hiển thị" required>`:""}<input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Mật khẩu" required minlength="6"><button class="action-btn primary">${mode==="login"?"Đăng nhập":"Đăng ký"}</button></form><button class="action-btn secondary" style="margin-top:10px" onclick="openAuth('${mode==="login"?"register":"login"}')">${mode==="login"?"Chưa có tài khoản? Đăng ký":"Đã có tài khoản? Đăng nhập"}</button>`)}
async function authSubmit(e,mode){e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/"+mode,{method:"POST",body:JSON.stringify(Object.fromEntries(f))});token=d.token;localStorage.setItem("gaming_token",token);currentUser=d.user;updateAccount();closeModal();toast("Xin chào "+currentUser.name)}catch(err){toast(err.message)}}
function showAccount(){
  if(!currentUser)return openAuth("login");
  openModal(`<div class="modal-head"><div><span class="pill">Tài khoản</span><h2 style="margin-top:8px">${esc(currentUser.name)}</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><p class="muted-note">${esc(currentUser.email)}</p><div class="stat-box" style="margin-top:14px"><small>SỐ DƯ VÍ</small><strong style="font-size:22px">${money(currentUser.balance)}</strong></div><div class="row" style="margin-top:14px"><button class="action-btn primary" onclick="openTopup()">Nạp tiền</button><button class="action-btn secondary" onclick="showPage('orders')">Đơn hàng</button>${currentUser.role==="admin"?`<button class="action-btn secondary" onclick="window.location.href='/admin'">Admin</button>`:""}</div><button class="action-btn secondary" style="margin-top:12px;width:100%" onclick="logout()">Đăng xuất</button>`)
}
function logout(show=true){token="";currentUser=null;localStorage.removeItem("gaming_token");updateAccount();if(show){closeModal();toast("Đã đăng xuất")}}
function openTopup(){if(!currentUser){openAuth("login");return}openModal(`<div class="modal-head"><h2>Nạp tiền</h2><button class="close-btn" onclick="closeModal()">×</button></div><p class="muted-note">Tạo yêu cầu nạp tiền để admin xác nhận và cộng số dư.</p><form class="form" onsubmit="topupSubmit(event)"><input name="amount" type="number" min="1000" step="1000" placeholder="Số tiền (VND)" required><select name="method"><option value="bank">Ngân hàng</option><option value="crypto">Crypto</option><option value="card">Thẻ</option></select><button class="action-btn primary">Tạo yêu cầu nạp</button></form>`)}
async function topupSubmit(e){e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/topups",{method:"POST",body:JSON.stringify(Object.fromEntries(f))});closeModal();toast("Đã tạo yêu cầu "+d.id)}catch(err){toast(err.message)}}
async function showPage(page){if(page!=="orders"){openModal(`<div class="modal-head"><h2>${page==="blogs"?"Tin tức":"Yêu thích"}</h2><button class="close-btn" onclick="closeModal()">×</button></div><p class="muted-note">Khu vực này có thể mở rộng thêm nội dung ở phiên bản sau.</p>`);return}if(!currentUser){openAuth("login");return}try{const orders=await api("/api/orders");openModal(`<div class="modal-head"><h2>Đơn hàng của tôi</h2><button class="close-btn" onclick="closeModal()">×</button></div>${orders.length?orders.map(o=>`<div class="order-card"><div><b>${esc(o.id)}</b><small>${new Date(o.createdAt).toLocaleString("vi-VN")}</small></div><div><strong>${money(o.total)}</strong><span class="status-pill ${o.status}">${esc(o.status)}</span></div></div>`).join(""):"<p class='muted-note'>Bạn chưa có đơn hàng.</p>"}`)}catch(e){toast(e.message)}}

async function openAdmin(){
  if(currentUser?.role!=="admin")return toast("Bạn không có quyền admin");
  try{
    const [stats,orders,topups]=await Promise.all([api("/api/admin/stats"),api("/api/admin/orders"),api("/api/admin/topups")]);
    openModal(`<div class="modal-head"><div><span class="pill">ADMIN</span><h2 style="margin-top:8px">Quản trị shop</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><div class="admin-nav"><button class="admin-tab active">Tổng quan</button><button class="admin-tab" onclick="openAdminDesign()">🎨 Giao diện shop</button><button class="admin-tab" onclick="openAdminProducts()">📦 Sản phẩm</button></div><div class="admin-grid"><div class="stat-box"><small>USER</small><strong>${stats.users}</strong></div><div class="stat-box"><small>SẢN PHẨM</small><strong>${stats.products}</strong></div><div class="stat-box"><small>ĐƠN HÀNG</small><strong>${stats.orders}</strong></div><div class="stat-box"><small>DOANH THU</small><strong>${money(stats.revenue)}</strong></div></div><div class="admin-section"><div class="admin-section-head"><h3>Yêu cầu nạp gần đây</h3><button class="mini-btn" onclick="openAdminTopups()">Xem tất cả</button></div>${topups.slice(0,5).map(t=>`<div class="admin-line"><div><b>${esc(t.id)}</b><small>${money(t.amount)} · ${esc(t.method)} · ${esc(t.status)}</small></div>${t.status==="pending"?`<button class="mini-btn" onclick="approveTopup('${esc(t.id)}')">Duyệt</button>`:""}</div>`).join("")||"<p class='muted-note'>Chưa có yêu cầu.</p>"}</div><div class="admin-section"><div class="admin-section-head"><h3>Đơn hàng gần đây</h3><button class="mini-btn" onclick="openAdminOrders()">Xem tất cả</button></div>${orders.slice(0,5).map(o=>`<div class="admin-line"><div><b>${esc(o.id)}</b><small>${money(o.total)} · ${esc(o.status)}</small></div><button class="mini-btn" onclick="changeOrderStatus('${esc(o.id)}')">Đổi trạng thái</button></div>`).join("")||"<p class='muted-note'>Chưa có đơn hàng.</p>"}</div>`);
  }catch(e){toast(e.message)}
}
async function openAdminProducts(){
  openModal(`<div class="modal-head"><h2>Sản phẩm</h2><button class="close-btn" onclick="closeModal()">×</button></div><div class="row"><button class="action-btn primary" onclick="openProductForm()">＋ Thêm sản phẩm</button><button class="action-btn secondary" onclick="openAdmin()">← Quay lại</button></div><div class="admin-products">${products.map(p=>`<div class="admin-product"><div class="admin-product-main">${p.image?`<div class="admin-product-thumb"><img src="${p.image}" alt=""></div>`:`<div class="admin-product-thumb"></div>`}<div><b>${esc(p.name)}</b><small>${esc(p.category)} · ${money(p.price)}</small></div></div><div class="admin-actions"><button class="mini-btn" onclick="openProductForm(${p.id})">Sửa</button><button class="mini-btn danger" onclick="deleteProduct(${p.id})">Xóa</button></div></div>`).join("")||"<p class='muted-note'>Chưa có sản phẩm.</p>"}</div>`)
}
async function openAdminOrders(){const orders=await api("/api/admin/orders");openModal(`<div class="modal-head"><h2>Tất cả đơn hàng</h2><button class="close-btn" onclick="closeModal()">×</button></div>${orders.map(o=>`<div class="admin-line"><div><b>${esc(o.id)}</b><small>${new Date(o.createdAt).toLocaleString("vi-VN")} · ${money(o.total)}</small></div><button class="mini-btn" onclick="changeOrderStatus('${esc(o.id)}')">${esc(o.status)}</button></div>`).join("")||"<p class='muted-note'>Chưa có đơn.</p>"}`)}
async function openAdminTopups(){const topups=await api("/api/admin/topups");openModal(`<div class="modal-head"><h2>Yêu cầu nạp tiền</h2><button class="close-btn" onclick="closeModal()">×</button></div>${topups.map(t=>`<div class="admin-line"><div><b>${esc(t.id)}</b><small>${money(t.amount)} · ${esc(t.method)} · ${esc(t.status)}</small></div>${t.status==="pending"?`<button class="mini-btn" onclick="approveTopup('${esc(t.id)}')">Duyệt</button>`:""}</div>`).join("")||"<p class='muted-note'>Chưa có yêu cầu.</p>"}`)}
async function approveTopup(id){try{await api("/api/admin/topups/"+id+"/approve",{method:"POST"});toast("Đã duyệt nạp tiền");openAdminTopups()}catch(e){toast(e.message)}}
async function changeOrderStatus(id){const status=prompt("Nhập trạng thái: paid / processing / completed / cancelled","processing");if(!status)return;try{await api("/api/admin/orders/"+id,{method:"PATCH",body:JSON.stringify({status})});toast("Đã cập nhật đơn");openAdminOrders()}catch(e){toast(e.message)}}

function openProductForm(id=null){
  const p=id?products.find(x=>x.id===id):null;
  openModal(`<div class="modal-head"><h2>${p?"Sửa sản phẩm":"Thêm sản phẩm"}</h2><button class="close-btn" onclick="closeModal()">×</button></div><form class="form" onsubmit="saveProduct(event,${id||"null"})"><input name="name" placeholder="Tên sản phẩm" value="${esc(p?.name||"")}" required><input name="category" placeholder="Danh mục" value="${esc(p?.category||"")}" list="categoryOptions" required><datalist id="categoryOptions">${(settings.categories||[]).map(c=>`<option value="${esc(c)}">`).join("")}</datalist><div class="two-col"><input name="price" type="number" min="1" placeholder="Giá VND" value="${p?.price||""}" required><input name="oldPrice" type="number" min="0" placeholder="Giá cũ" value="${p?.oldPrice||""}"></div><div class="two-col"><input name="badge" placeholder="Nhãn: Hot / Mới" value="${esc(p?.badge||"")}"><input name="delivery" placeholder="Ví dụ: Giao ngay" value="${esc(p?.delivery||"Giao ngay")}"></div><textarea name="description" placeholder="Mô tả sản phẩm">${esc(p?.description||"")}</textarea><label class="field-label">Ảnh sản phẩm</label><div class="upload-row"><input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="imagePreview(this,'#imagePreview')"><button type="button" class="mini-btn" onclick="clearProductImage()">Xóa ảnh</button></div><div id="imagePreview" class="image-preview" data-image="${esc(p?.image||"")}">${p?.image?`<img src="${p.image}" alt="preview">`:`Chọn ảnh để xem trước`}</div><button class="action-btn primary">${p?"Lưu thay đổi":"Tạo sản phẩm"}</button></form>`)
}
function imagePreview(input,selector){const file=input.files?.[0];const el=$(selector);if(!file)return;if(file.size>4*1024*1024){toast("Ảnh tối đa 4MB");input.value="";return}const r=new FileReader();r.onload=()=>{el.dataset.image=r.result;el.innerHTML=`<img src="${r.result}" alt="preview">`};r.readAsDataURL(file)}
function clearProductImage(){const el=$("#imagePreview");el.dataset.image="";el.innerHTML="Chọn ảnh để xem trước";const file=$("input[name=imageFile]");if(file)file.value=""}
async function saveProduct(e,id){e.preventDefault();const f=e.target;const image=$("#imagePreview")?.dataset.image||"";const body={name:f.name.value,category:f.category.value,price:Number(f.price.value),oldPrice:Number(f.oldPrice.value)||0,badge:f.badge.value,delivery:f.delivery.value,description:f.description.value,image};try{const p=id?await api("/api/admin/products/"+id,{method:"PUT",body:JSON.stringify(body)}):await api("/api/admin/products",{method:"POST",body:JSON.stringify(body)});if(id){const ix=products.findIndex(x=>x.id===id);if(ix>=0)products[ix]=p}else products.unshift(p);renderProducts();closeModal();toast(id?"Đã cập nhật sản phẩm":"Đã thêm sản phẩm")}catch(err){toast(err.message)}}
async function deleteProduct(id){if(!confirm("Xóa sản phẩm này?"))return;try{await api("/api/admin/products/"+id,{method:"DELETE"});products=products.filter(p=>p.id!==id);renderProducts();toast("Đã xóa");openAdminProducts()}catch(e){toast(e.message)}}

async function openAdminDesign(){
  try{
    const s=await api("/api/admin/settings");settings=s;
    openModal(`<div class="modal-head"><div><span class="pill">SHOP CUSTOMIZER</span><h2 style="margin-top:8px">Tùy chỉnh giao diện</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><form class="form" onsubmit="saveDesign(event)">
      <div class="design-section"><div class="design-title">Thương hiệu</div><div class="two-col"><input name="shopName" placeholder="Tên shop" value="${esc(s.shopName)}"><input name="shopTagline" placeholder="Tagline" value="${esc(s.shopTagline)}"></div><textarea name="metaDescription" placeholder="Mô tả shop">${esc(s.metaDescription)}</textarea>
      <div class="two-col"><div><label class="field-label">Logo</label><input name="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="imagePreview(this,'#logoPreview')"></div><div><label class="field-label">Favicon</label><input name="faviconFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="imagePreview(this,'#faviconPreview')"></div></div><div class="two-col"><div id="logoPreview" class="image-preview small" data-image="${esc(s.logo||"")}">${s.logo?`<img src="${s.logo}" alt="logo">`:`Chọn logo`}</div><div id="faviconPreview" class="image-preview small" data-image="${esc(s.favicon||"")}">${s.favicon?`<img src="${s.favicon}" alt="favicon">`:`Chọn favicon`}</div></div></div>
      <div class="design-section"><div class="design-title">Trang chủ</div><input name="heroEyebrow" placeholder="Eyebrow" value="${esc(s.heroEyebrow)}"><input name="heroTitle" placeholder="Tiêu đề (dùng \\n để xuống dòng)" value="${esc(s.heroTitle)}"><textarea name="heroSubtitle" placeholder="Mô tả ngắn">${esc(s.heroSubtitle)}</textarea><div class="two-col"><input name="heroButtonText" placeholder="Nút chính" value="${esc(s.heroButtonText)}"><input name="heroSecondaryText" placeholder="Nút phụ" value="${esc(s.heroSecondaryText)}"></div><label class="field-label">Ảnh banner / hero</label><input name="heroFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="imagePreview(this,'#heroPreview')"><div id="heroPreview" class="image-preview hero-preview" data-image="${esc(s.heroBanner||"")}">${s.heroBanner?`<img src="${s.heroBanner}" alt="hero">`:`Chọn ảnh banner`}</div></div>
      <div class="design-section"><div class="design-title">Màu giao diện</div><div class="color-grid">${colorField("primary","Màu chính",s.primary)}${colorField("accent","Màu nhấn",s.accent)}${colorField("pageBg","Nền trang",s.pageBg)}${colorField("cardBg","Nền card",s.cardBg)}${colorField("text","Màu chữ",s.text)}${colorField("muted","Chữ phụ",s.muted)}${colorField("footerBg","Nền footer",s.footerBg)}</div></div>
      <div class="design-section"><div class="design-title">Danh mục</div><textarea name="categories" placeholder="Mỗi danh mục cách nhau bằng dấu phẩy">${esc((s.categories||[]).join(", "))}</textarea><small class="helper">Ví dụ: Roblox, Currency, Items, Services, Accounts</small></div>
      <div class="design-section"><div class="design-title">Liên hệ</div><div class="two-col"><input name="supportEmail" placeholder="Email hỗ trợ" value="${esc(s.supportEmail)}"><input name="supportPhone" placeholder="Số điện thoại" value="${esc(s.supportPhone)}"></div><div class="two-col"><input name="discord" placeholder="Link Discord" value="${esc(s.discord)}"><input name="facebook" placeholder="Link Facebook" value="${esc(s.facebook)}"></div><input name="telegram" placeholder="Link Telegram" value="${esc(s.telegram)}"></div>
      <div class="row sticky-actions"><button type="button" class="action-btn secondary" onclick="openAdmin()">← Quay lại</button><button class="action-btn primary">Lưu giao diện</button></div>
    </form>`);
  }catch(e){toast(e.message)}
}
function colorField(name,label,value){return `<label class="color-field"><span>${label}</span><input name="${name}" type="color" value="${esc(value||"#ffffff")}"><code>${esc(value||"")}</code></label>`}
async function saveDesign(e){
  e.preventDefault();const f=e.target;const body={};
  ["shopName","shopTagline","metaDescription","heroEyebrow","heroTitle","heroSubtitle","heroButtonText","heroSecondaryText","supportEmail","supportPhone","discord","facebook","telegram","primary","accent","pageBg","cardBg","text","muted","footerBg"].forEach(k=>body[k]=f[k]?.value||"");
  body.categories=f.categories.value.split(",").map(x=>x.trim()).filter(Boolean);
  for(const [fileName,previewSel,key] of [["logoFile","#logoPreview","logo"],["faviconFile","#faviconPreview","favicon"],["heroFile","#heroPreview","heroBanner"]]){
    if(f[fileName]?.files?.[0]){try{body[key]=await fileToDataUrl(f[fileName].files[0])}catch{toast("Không đọc được ảnh");return}}else{body[key]=$(previewSel)?.dataset.image||""}
  }
  try{settings=await api("/api/admin/settings",{method:"PUT",body:JSON.stringify(body)});applySettings();renderCategories();renderProducts();closeModal();toast("Đã lưu giao diện shop")}catch(err){toast(err.message)}
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{if(file.size>4*1024*1024)return reject(new Error("too-large"));const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}

function openModal(html){$("#modalCard").innerHTML=html;$("#modal").classList.remove("hidden");$("#modal").setAttribute("aria-hidden","false")}
function closeModal(){$("#modal").classList.add("hidden");$("#modal").setAttribute("aria-hidden","true")}
function clearFilters(){currentCat="all";renderCategories();$("#search").value="";$("#sortSelect").value="default";renderProducts()}
function clearSearch(){$("#search").value="";renderProducts()}
function filterCategory(cat){currentCat=cat;renderCategories();renderProducts();scrollToProducts()}
function scrollToProducts(){$("#products").scrollIntoView({behavior:"smooth"})}
$("#search").addEventListener("input",renderProducts);
boot();
