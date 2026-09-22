let adminToken = localStorage.getItem("gaming_admin_token") || localStorage.getItem("gaming_token") || "";
let adminUser = null;
let products = [];
let settings = {};
let cache = { orders: [], topups: [] };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const money = (n) => new Intl.NumberFormat("vi-VN").format(Number(n)||0) + "đ";
const fmtDate = (s) => { try{return new Date(s).toLocaleString("vi-VN")}catch{return s||""} };
function toast(msg){const el=$("#toast");el.textContent=msg;el.className="toast show";clearTimeout(window.__tt);window.__tt=setTimeout(()=>el.className="toast",2600)}
async function api(url, opts={}){
  opts.headers={...(opts.headers||{}),"Content-Type":"application/json",...(adminToken?{Authorization:"Bearer "+adminToken}:{})};
  const r=await fetch(url,opts); const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||"Có lỗi xảy ra"); return d;
}
function fileToData(file){return new Promise((resolve,reject)=>{if(!file)return resolve("");if(file.size>4*1024*1024)return reject(new Error("Ảnh tối đa 4MB"));const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}

async function boot(){
  try{
    settings=await fetch("/api/config").then(r=>r.json());
    applyBrand();
    if(adminToken){try{adminUser=await api("/api/me"); if(adminUser.role!=="admin") throw new Error("Tài khoản không có quyền admin"); localStorage.setItem("gaming_admin_token",adminToken); showAdmin(); return;}catch(e){localStorage.removeItem("gaming_admin_token");adminToken="";}}
    showLogin();
  }catch(e){toast(e.message);showLogin()}
}
function applyBrand(){
  $("#sideShopName").textContent=settings.shopName||"Gaming Shop";
  const logo=settings.logo||""; $("#sideLogo").innerHTML=logo?`<img src="${logo}" style="width:100%;height:100%;object-fit:cover;border-radius:13px" alt="">`:(settings.shopName||"G").slice(0,1).toUpperCase();
  $("#adminFavicon").href=settings.favicon||settings.logo||"data:,";
  document.title=`Admin — ${settings.shopName||"Gaming Shop"}`;
}
function showLogin(){$("#loginView").classList.remove("hidden");$("#adminView").classList.add("hidden")}
function showAdmin(){$("#loginView").classList.add("hidden");$("#adminView").classList.remove("hidden");$("#adminName").textContent=adminUser.name||adminUser.email;$("#adminAvatar").textContent=(adminUser.name||"A").slice(0,1).toUpperCase();go("dashboard")}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);try{const x=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(f))}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Đăng nhập thất bại");return d});if(x.requires2FA){openAdmin2FA(x.twoFactorToken);return}if(x.user?.role!=="admin")throw new Error("Tài khoản này không phải Admin");adminToken=x.token;localStorage.setItem("gaming_admin_token",adminToken);adminUser=x.user;showAdmin()}catch(err){toast(err.message)}});
function openAdmin2FA(twoFactorToken){$("#loginView").innerHTML=`<div class="login-card"><div class="login-mark">2FA</div><span class="eyebrow">GOOGLE AUTHENTICATOR</span><h1>Xác minh Admin</h1><p>Nhập mã 6 số từ Google Authenticator để tiếp tục.</p><form id="admin2faForm" class="stack-form"><label>Mã 6 số<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="123456" required></label><button class="btn primary" type="submit">Xác nhận</button></form><a class="back-link" href="/admin">Quay lại đăng nhập</a></div>`;$("#admin2faForm").addEventListener("submit",async e=>{e.preventDefault();try{const code=new FormData(e.target).get("code");const r=await fetch("/api/login/2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({twoFactorToken,code})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Xác thực thất bại");if(d.user?.role!=="admin")throw new Error("Tài khoản này không phải Admin");adminToken=d.token;localStorage.setItem("gaming_admin_token",adminToken);adminUser=d.user;showAdmin()}catch(err){toast(err.message)}})}

$("#logoutBtn").onclick=()=>{adminToken="";adminUser=null;localStorage.removeItem("gaming_admin_token");showLogin()};
document.querySelectorAll(".side-nav button").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
async function go(page){
  document.querySelectorAll(".side-nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const meta={dashboard:["DASHBOARD","Tổng quan"],products:["CATALOG","Sản phẩm"],orders:["SALES","Đơn hàng"],topups:["WALLET","Nạp tiền"],design:["CUSTOMIZER","Giao diện shop"]}[page]||["ADMIN","Quản trị"];
  $("#pageEyebrow").textContent=meta[0];$("#pageTitle").textContent=meta[1];
  try{if(page==="dashboard")return renderDashboard();if(page==="products")return renderProductsPage();if(page==="orders")return renderOrders();if(page==="topups")return renderTopups();if(page==="design")return renderDesign()}catch(e){toast(e.message)}
}

async function renderDashboard(){
  const [stats,orders,topups]=await Promise.all([api("/api/admin/stats"),api("/api/admin/orders"),api("/api/admin/topups")]);
  cache={orders,topups};
  $("#content").innerHTML=`<div class="grid-4">
    ${stat("Người dùng",stats.users,"Tài khoản khách")} ${stat("Sản phẩm",stats.products,"Đang bán trong catalog")} ${stat("Đơn hàng",stats.orders,"Tất cả trạng thái")} ${stat("Doanh thu",money(stats.revenue),"Đơn không bị hủy")}
  </div>
  <div class="two-panels">
    <section class="panel"><div class="panel-head"><h3>Đơn hàng gần đây</h3><button class="btn small" onclick="go('orders')">Xem tất cả</button></div><div class="list">${orders.slice(0,6).map(orderLine).join("")||`<div class="empty">Chưa có đơn hàng.</div>`}</div></section>
    <section class="panel"><div class="panel-head"><h3>Yêu cầu nạp tiền</h3><button class="btn small" onclick="go('topups')">Xem tất cả</button></div><div class="list">${topups.slice(0,6).map(topupLine).join("")||`<div class="empty">Chưa có yêu cầu.</div>`}</div></section>
  </div>`;
}
function stat(a,b,c){return `<div class="stat-card"><small>${esc(a.toUpperCase())}</small><strong>${esc(b)}</strong><p>${esc(c)}</p></div>`}
function orderLine(o){return `<div class="mini-line"><div><b>${esc(o.id)}</b><small>${fmtDate(o.createdAt)} · ${money(o.total)}</small></div><span class="status ${esc(o.status)}">${esc(o.status)}</span></div>`}
function topupLine(t){return `<div class="mini-line"><div><b>${esc(t.id)}</b><small>${money(t.amount)} · ${esc(t.method)}</small></div>${t.status==="pending"?`<button class="btn small" onclick="approveTopup('${esc(t.id)}')">Duyệt</button>`:`<span class="status ${esc(t.status)}">${esc(t.status)}</span>`}</div>`}

async function loadProducts(){products=await api("/api/products");return products}
async function renderProductsPage(){await loadProducts();$("#content").innerHTML=`<div class="page-toolbar"><div><div class="muted">Quản lý ảnh, giá, danh mục, badge và mô tả từng sản phẩm.</div></div><div class="row-actions"><div class="search"><input id="productSearch" placeholder="Tìm sản phẩm..." oninput="filterProductRows()"></div><button class="btn primary" onclick="productForm()">＋ Thêm sản phẩm</button></div></div><div id="productList" class="product-list">${products.map(productRow).join("")||`<div class="panel empty">Chưa có sản phẩm.</div>`}</div>`}
function productRow(p){
  const variants=Array.isArray(p.variants)&&p.variants.length?p.variants:[];
  const variantText=variants.length?`${variants.length} gói / dòng`:"1 gói mặc định";
  return `<div class="product-row" data-search="${esc((p.name+" "+p.category+" "+variants.map(v=>v.name).join(" ")).toLowerCase())}"><div class="product-main"><div class="thumb">${p.image?`<img src="${p.image}" alt="">`:`NO IMG`}</div><div><b>${esc(p.name)}</b><small>${esc(p.category)} · ${money(p.price)}${p.oldPrice?` · Giá cũ ${money(p.oldPrice)}`:""}</small><small>${variantText}${p.delivery?` · ${esc(p.delivery)}`:""}${p.badge?` · ${esc(p.badge)}`:""}</small></div></div><div class="row-actions"><button class="btn small" onclick="productForm(${p.id})">Sửa</button><button class="btn small danger" onclick="deleteProduct(${p.id})">Xóa</button></div></div>`
}
function filterProductRows(){const q=$("#productSearch").value.toLowerCase();document.querySelectorAll("#productList .product-row").forEach(x=>x.style.display=x.dataset.search.includes(q)?"":"none")}
function variantTemplate(v={}, idx=0){
  const safeId=esc(String(v.id||(`new-${Date.now()}-${idx}`)));
  return `<div class="variant-editor" data-variant-id="${safeId}">
    <div class="variant-editor-head"><div><b>Dòng ${idx+1}</b><span class="variant-id">${v.id?esc(v.id):"Mới"}</span></div><button type="button" class="btn small danger" onclick="removeVariantRow(this)">Xóa dòng</button></div>
    <div class="field-grid">
      <div class="field"><label>Tên dòng / gói<input class="variant-name" value="${esc(v.name||"")}" placeholder="Key 1 Tháng" required></label></div>
      <div class="field"><label>Giá<input class="variant-price" type="number" min="1" value="${Number(v.price)||0}" required></label></div>
    </div>
    <div class="field-grid">
      <div class="field"><label>Giá cũ<input class="variant-old-price" type="number" min="0" value="${Number(v.oldPrice)||0}"></label></div>
      <div class="field"><label>Giao hàng<input class="variant-delivery" value="${esc(v.delivery||"Giao ngay")}" placeholder="Giao ngay"></label></div>
    </div>
    <div class="field-grid">
      <div class="field"><label>Badge<input class="variant-badge" value="${esc(v.badge||"")}" placeholder="HOT / NEW / SALE"></label></div>
      <div class="field"><label>Tồn kho <small class="helper-inline">để trống = không giới hạn</small><input class="variant-stock" type="number" min="0" value="${v.stock===null||v.stock===undefined?"":Number(v.stock)}" placeholder="Không giới hạn"></label></div>
    </div>
    <div class="variant-image-area"><div><label class="field-label">Ảnh riêng cho dòng này <small>(tùy chọn)</small></label><input class="variant-image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><div class="variant-preview" data-image="${esc(v.image||"")}">${v.image?`<img src="${v.image}" alt="">`:`Chưa có ảnh riêng`}</div></div>
  </div>`
}
function bindVariantImageInputs(){
  document.querySelectorAll(".variant-image-file").forEach(input=>{input.onchange=async()=>{try{const d=await fileToData(input.files?.[0]);if(d){const preview=input.closest(".variant-editor").querySelector(".variant-preview");preview.dataset.image=d;preview.innerHTML=`<img src="${d}" alt="">`}}catch(e){toast(e.message);input.value=""}}});
}
function addVariantRow(){
  const wrap=$("#variantBuilder");if(!wrap)return;
  const idx=wrap.querySelectorAll(".variant-editor").length;
  wrap.insertAdjacentHTML("beforeend",variantTemplate({id:"",name:"",price:0,oldPrice:0,delivery:"Giao ngay",badge:"",stock:null,image:""},idx));
  refreshVariantNumbers();bindVariantImageInputs();
  const last=wrap.lastElementChild;last?.scrollIntoView({behavior:"smooth",block:"center"});
}
function removeVariantRow(btn){
  const rows=document.querySelectorAll("#variantBuilder .variant-editor");
  if(rows.length<=1){toast("Sản phẩm phải có ít nhất 1 dòng / gói");return;}
  btn.closest(".variant-editor").remove();refreshVariantNumbers();
}
function refreshVariantNumbers(){document.querySelectorAll("#variantBuilder .variant-editor").forEach((el,i)=>{const b=el.querySelector(".variant-editor-head b");if(b)b.textContent=`Dòng ${i+1}`})}
function collectVariants(){
  return [...document.querySelectorAll("#variantBuilder .variant-editor")].map((row,i)=>({
    id:row.dataset.variantId && !row.dataset.variantId.startsWith("new-") ? row.dataset.variantId : undefined,
    name:row.querySelector(".variant-name")?.value.trim()||`Gói ${i+1}`,
    price:Number(row.querySelector(".variant-price")?.value)||0,
    oldPrice:Number(row.querySelector(".variant-old-price")?.value)||0,
    delivery:row.querySelector(".variant-delivery")?.value.trim()||"Giao ngay",
    badge:row.querySelector(".variant-badge")?.value.trim()||"",
    stock:row.querySelector(".variant-stock")?.value===""?null:Number(row.querySelector(".variant-stock")?.value),
    image:row.querySelector(".variant-preview")?.dataset.image||""
  })).filter(v=>v.name&&v.price>0)
}
function productForm(id=null){
  const p=id?products.find(x=>x.id===id):null;if(id&&!p)return;
  const variants=(Array.isArray(p?.variants)&&p.variants.length?p.variants:[{id:"",name:p?.name||"",price:Number(p?.price)||0,oldPrice:Number(p?.oldPrice)||0,delivery:p?.delivery||"Giao ngay",badge:p?.badge||"",stock:null,image:p?.image||""}]);
  const variantHtml=variants.map(variantTemplate).join("");
  $("#content").innerHTML=`<div class="page-toolbar"><div><div class="muted">${p?"Chỉnh sửa sản phẩm":"Tạo sản phẩm mới"}</div></div><button class="btn" onclick="renderProductsPage()">← Quay lại</button></div>
  <form id="productForm" class="form-grid"><section class="design-card"><h3>Thông tin sản phẩm</h3><div class="field"><label>Tên sản phẩm<input name="name" value="${esc(p?.name||"")}" required></label></div><div class="field-grid"><div class="field"><label>Danh mục<input name="category" list="cats" value="${esc(p?.category||"")}" required></label></div><div class="field"><label>Badge tổng<input name="badge" placeholder="HOT / NEW / SALE" value="${esc(p?.badge||"")}"></label></div></div><datalist id="cats">${(settings.categories||[]).map(c=>`<option value="${esc(c)}">`).join("")}</datalist><div class="field"><label>Ảnh chính của sản phẩm<input id="productImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><div id="productPreview" class="preview">${p?.image?`<img src="${p.image}" alt="preview">`:`Chưa chọn ảnh`}</div></div><div class="field"><label>Mô tả<textarea name="description">${esc(p?.description||"")}</textarea></label></div></section>
  <section class="design-card variant-builder-card"><div class="section-head"><div><h3>Các dòng / gói sản phẩm</h3><p class="muted">Ví dụ: Key 1 Tháng, Key 3 Tháng, Key 1 Năm. Mỗi dòng có thể có giá, ảnh, giao hàng và tồn kho riêng.</p></div><button type="button" class="btn primary" onclick="addVariantRow()">＋ Thêm dòng</button></div><div id="variantBuilder">${variantHtml}</div><div class="variant-note">Khách sẽ chọn một dòng trên trang sản phẩm trước khi thêm vào giỏ.</div></section><section class="design-card"><div class="form-actions"><span class="muted">${p?`ID ${p.id}`:"Sản phẩm mới"}</span><button class="btn primary">${p?"Lưu thay đổi":"Tạo sản phẩm"}</button></div></section></form>`;
  const input=$("#productImageFile"),preview=$("#productPreview");input.onchange=async()=>{try{const d=await fileToData(input.files?.[0]);if(d){preview.dataset.image=d;preview.innerHTML=`<img src="${d}" alt="preview">`}}catch(e){toast(e.message);input.value=""}};bindVariantImageInputs();
  $("#productForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const variants=collectVariants();if(!variants.length){toast("Thêm ít nhất 1 dòng / gói có giá hợp lệ");return}const image=preview.dataset.image!==undefined?preview.dataset.image:(p?.image||"");const first=variants[0];const body={name:f.get("name"),category:f.get("category"),price:first.price,oldPrice:first.oldPrice,badge:f.get("badge"),delivery:first.delivery,description:f.get("description"),image,variants};try{if(id)await api(`/api/admin/products/${id}`,{method:"PUT",body:JSON.stringify(body)});else await api("/api/admin/products",{method:"POST",body:JSON.stringify(body)});toast(p?"Đã cập nhật sản phẩm":"Đã tạo sản phẩm");go("products")}catch(err){toast(err.message)}};
}
async function renderOrders(){cache.orders=await api("/api/admin/orders");$("#content").innerHTML=`<div class="panel"><div class="page-toolbar"><div class="muted">Cập nhật trạng thái đơn hàng.</div><div class="search"><input id="orderSearch" placeholder="Tìm ID đơn..." oninput="filterRows('orderList','orderSearch')"></div></div><div id="orderList" class="order-list">${cache.orders.map(o=>`<div class="order-row" data-search="${esc((o.id+" "+o.userId).toLowerCase())}"><div><b>${esc(o.id)}</b><div class="row-sub">${fmtDate(o.createdAt)} · User ${esc(o.userId)} · ${money(o.total)}</div><div class="row-sub">${o.items.map(i=>esc(i.name)+" ×"+i.qty).join(" · ")}</div></div><div class="row-actions"><span class="status ${esc(o.status)}">${esc(o.status)}</span><button class="btn small" onclick="changeOrderStatus('${esc(o.id)}')">Trạng thái</button></div></div>`).join("")||`<div class="empty">Chưa có đơn.</div>`}</div></div>`}
async function changeOrderStatus(id){const status=prompt("Nhập trạng thái: paid / processing / completed / cancelled","processing");if(!status)return;try{await api(`/api/admin/orders/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({status})});toast("Đã cập nhật đơn");renderOrders()}catch(e){toast(e.message)}}
async function renderTopups(){cache.topups=await api("/api/admin/topups");$("#content").innerHTML=`<div class="panel"><div class="page-toolbar"><div class="muted">Duyệt yêu cầu nạp tiền và cộng số dư.</div><div class="search"><input id="topupSearch" placeholder="Tìm mã nạp..." oninput="filterRows('topupList','topupSearch')"></div></div><div id="topupList" class="order-list">${cache.topups.map(t=>`<div class="topup-row" data-search="${esc((t.id+" "+t.userId).toLowerCase())}"><div><b>${esc(t.id)}</b><div class="row-sub">${fmtDate(t.createdAt)} · User ${esc(t.userId)}</div></div><div class="row-actions"><strong>${money(t.amount)}</strong><span class="status ${esc(t.status)}">${esc(t.status)}</span>${t.status==="pending"?`<button class="btn small" onclick="approveTopup('${esc(t.id)}')">Duyệt</button>`:""}</div></div>`).join("")||`<div class="empty">Chưa có yêu cầu nạp tiền.</div>`}</div></div>`}
async function approveTopup(id){try{await api(`/api/admin/topups/${encodeURIComponent(id)}/approve`,{method:"POST"});toast("Đã duyệt nạp tiền");renderTopups()}catch(e){toast(e.message)}}
function filterRows(listId,inputId){const q=$("#"+inputId).value.toLowerCase();document.querySelectorAll("#"+listId+">*[data-search]").forEach(x=>x.style.display=x.dataset.search.includes(q)?"":"none")}

async function renderDesign(){
  settings=await api("/api/admin/settings");applyBrand();
  const cats=(settings.categories||[]).join(", ");const sec=settings.sections||{};const order=settings.homeOrder||["hero","bestsellers","products","recent","trust"];
  const fontBody=settings.fontBody||"DM Sans",fontHeading=settings.fontHeading||"Space Grotesk";
  const socialTypeOptions=(selected)=>["zalo","messenger","discord"].map(x=>`<option value="${x}" ${selected===x?"selected":""}>${x[0].toUpperCase()+x.slice(1)}</option>`).join("");
  const socialSlot=(n)=>`<div class="social-slot"><div class="field-grid"><div class="field"><label>Nút ${n} — nền tảng<select id="floatingSocial${n}Type">${socialTypeOptions(settings[`floatingSocial${n}Type`])}</select></label></div><div class="field"><label>Tên hiển thị<input id="floatingSocial${n}Label" value="${esc(settings[`floatingSocial${n}Label`]||"")}" placeholder="Zalo"></label></div></div><div class="field"><label>Link<input id="floatingSocial${n}Url" value="${esc(settings[`floatingSocial${n}Url`]||"")}" placeholder="https://..."></label></div></div>`;
  const orderLabel={hero:"Hero",bestsellers:"Sản phẩm bán chạy",products:"Catalog sản phẩm",recent:"Đã xem gần đây",trust:"Trust cards"};
  const orderHtml=order.map((k,i)=>`<div class="order-item" data-order="${k}"><div><b>${orderLabel[k]||k}</b></div><div><button type="button" onclick="moveOrder(this,-1)" ${i===0?"disabled":""}>↑</button><button type="button" onclick="moveOrder(this,1)" ${i===order.length-1?"disabled":""}>↓</button></div></div>`).join("");
  const toggle=(k,label,help)=>`<div class="toggle-row"><div><b>${label}</b><div class="row-sub">${help}</div></div><button class="toggle ${sec[k]!==false?"on":""}" data-section="${k}" onclick="toggleSection(this)"><i></i></button></div>`;
  $("#content").innerHTML=`<div class="design-layout"><div class="design-stack">
    <section class="design-card"><h3>Thương hiệu</h3><div class="field-grid"><div class="field"><label>Tên shop<input id="shopName" value="${esc(settings.shopName)}"></label></div><div class="field"><label>Tagline<input id="shopTagline" value="${esc(settings.shopTagline)}"></label></div></div><div class="field"><label>Mô tả / SEO<textarea id="metaDescription">${esc(settings.metaDescription)}</textarea></label></div></section>
    <section class="design-card"><h3>Ảnh thương hiệu</h3><div class="image-grid"><div class="image-box"><strong>Logo</strong><input id="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><div id="logoPrev" class="preview" data-image="${esc(settings.logo||"")}">${settings.logo?`<img src="${settings.logo}" alt="logo">`:`Chưa có logo`}</div></div><div class="image-box"><strong>Favicon</strong><input id="faviconFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><div id="faviconPrev" class="preview" data-image="${esc(settings.favicon||"")}">${settings.favicon?`<img src="${settings.favicon}" alt="favicon">`:`Chưa có favicon`}</div></div></div></section>
    <section class="design-card"><h3>Trang chủ</h3><div class="field"><label>Dòng nhỏ<input id="heroEyebrow" value="${esc(settings.heroEyebrow)}"></label></div><div class="field"><label>Tiêu đề<input id="heroTitle" value="${esc(settings.heroTitle)}"></label></div><div class="field"><label>Mô tả<textarea id="heroSubtitle">${esc(settings.heroSubtitle)}</textarea></label></div><div class="field-grid"><div class="field"><label>Nút chính<input id="heroButtonText" value="${esc(settings.heroButtonText)}"></label></div><div class="field"><label>Nút phụ<input id="heroSecondaryText" value="${esc(settings.heroSecondaryText)}"></label></div></div><div class="field"><label>Ảnh Hero / Banner<input id="heroFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><div id="heroPrev" class="preview" data-image="${esc(settings.heroBanner||"")}">${settings.heroBanner?`<img src="${settings.heroBanner}" alt="hero">`:`Chưa có banner`}</div></div></section>
    <section class="design-card"><h3>Màu toàn bộ shop</h3><div class="color-grid">${colorField("primary","Màu chính",settings.primary)}${colorField("accent","Màu nhấn",settings.accent)}${colorField("pageBg","Nền trang",settings.pageBg)}${colorField("cardBg","Nền card",settings.cardBg)}${colorField("text","Màu chữ",settings.text)}${colorField("muted","Chữ phụ",settings.muted)}${colorField("footerBg","Nền footer",settings.footerBg)}</div></section>
    <section class="design-card"><h3>Font chữ</h3><div class="field-grid"><div class="field"><label>Font nội dung<select id="fontBody"><option ${fontBody==='DM Sans'?'selected':''}>DM Sans</option><option ${fontBody==='Inter'?'selected':''}>Inter</option><option ${fontBody==='Manrope'?'selected':''}>Manrope</option><option ${fontBody==='Poppins'?'selected':''}>Poppins</option></select></label></div><div class="field"><label>Font tiêu đề<select id="fontHeading"><option ${fontHeading==='Space Grotesk'?'selected':''}>Space Grotesk</option><option ${fontHeading==='DM Sans'?'selected':''}>DM Sans</option><option ${fontHeading==='Inter'?'selected':''}>Inter</option><option ${fontHeading==='Manrope'?'selected':''}>Manrope</option><option ${fontHeading==='Poppins'?'selected':''}>Poppins</option></select></label></div></div><div class="font-preview">Aa — Đây là preview font của shop</div></section>
    <section class="design-card"><h3>Nhóm sản phẩm / danh mục</h3><div class="field"><label>Các nhóm, cách nhau bằng dấu phẩy<textarea id="categories">${esc(cats)}</textarea></label><div class="helper">Ví dụ: Scripts, Executors, Externals, Cloud Phone, Services. Khi một sản phẩm có category = Externals thì bấm Externals sẽ chỉ hiện nhóm đó.</div></div></section>
    <section class="design-card"><h3>Nút liên hệ nổi</h3><p class="muted">Hiển thị tối đa 2 nút ở góc màn hình. Bạn có thể chọn Zalo, Messenger hoặc Discord và thay link tùy ý.</p>${socialSlot(1)}${socialSlot(2)}</section>
    <section class="design-card"><h3>Liên hệ / footer</h3><div class="field-grid"><div class="field"><label>Email<input id="supportEmail" value="${esc(settings.supportEmail)}"></label></div><div class="field"><label>Số điện thoại<input id="supportPhone" value="${esc(settings.supportPhone)}"></label></div><div class="field"><label>Discord<input id="discord" value="${esc(settings.discord)}"></label></div><div class="field"><label>Facebook<input id="facebook" value="${esc(settings.facebook)}"></label></div></div><div class="field"><label>Telegram<input id="telegram" value="${esc(settings.telegram)}"></label></div></section>
    <section class="design-card"><h3>Các section trang chủ</h3><div class="section-toggles">${toggle("hero","Hero","Banner / giới thiệu đầu trang")}${toggle("bestsellers","Sản phẩm bán chạy","Tự lấy sản phẩm có lượt bán cao nhất")}${toggle("products","Catalog sản phẩm","Danh sách sản phẩm theo category")}${toggle("recent","Đã xem gần đây","Lưu lịch sử xem trên trình duyệt khách")}${toggle("trust","Trust cards","Các khối giới thiệu / lợi ích")}</div><div class="order-builder" style="margin-top:12px" id="orderBuilder">${orderHtml}</div></section>
    <div class="form-actions"><span class="muted">Lưu xong có thể refresh shop để xem thay đổi.</span><button class="btn primary" onclick="saveDesign(event)">Lưu toàn bộ giao diện</button></div>
  </div><aside class="preview-panel"><div class="design-card"><h3>Preview</h3><p class="muted">Màu và bố cục đang cấu hình.</p><div id="sitePreview" class="site-preview"></div></div></aside></div>`;
  bindImagePreview("logoFile","logoPrev");bindImagePreview("faviconFile","faviconPrev");bindImagePreview("heroFile","heroPrev");updatePreview();
}
function colorField(name,label,value){return `<label class="color-field"><span>${esc(label)}</span><input id="c_${name}" name="${name}" type="color" value="${esc(value||"#ffffff")}"><code>${esc(value||"")}</code></label>`}
function bindImagePreview(inputId,prevId){const input=$("#"+inputId),prev=$("#"+prevId);input.onchange=async()=>{try{const d=await fileToData(input.files?.[0]);if(d){prev.dataset.image=d;prev.innerHTML=`<img src="${d}" alt="preview">`;if(inputId==="heroFile")updatePreview()}}catch(e){toast(e.message);input.value=""}}}
function toggleSection(btn){btn.classList.toggle("on");updatePreview()}
function orderItem(k,i,len){const label={hero:"Hero",bestsellers:"Sản phẩm bán chạy",products:"Catalog sản phẩm",recent:"Đã xem gần đây",trust:"Trust cards"}[k]||k;return `<div class="order-item" data-order="${k}"><div><b>${label}</b></div><div><button type="button" onclick="moveOrder(this,-1)" ${i===0?"disabled":""}>↑</button><button type="button" onclick="moveOrder(this,1)" ${i===len-1?"disabled":""}>↓</button></div></div>`}
function moveOrder(btn,delta){const item=btn.closest(".order-item"),parent=item.parentElement,all=[...parent.children],i=all.indexOf(item),j=i+delta;if(j<0||j>=all.length)return;if(delta<0)parent.insertBefore(item,all[j]);else parent.insertBefore(all[j],item);[...parent.children].forEach((el,i)=>{const b=el.querySelectorAll("button");if(b[0])b[0].disabled=i===0;if(b[1])b[1].disabled=i===parent.children.length-1});updatePreview()}
function currentOrder(){return [...document.querySelectorAll("#orderBuilder .order-item")].map(x=>x.dataset.order)}
function updatePreview(){if(!$("#sitePreview"))return;const pv={primary:$("#c_primary")?.value||settings.primary,accent:$("#c_accent")?.value||settings.accent,card:$("#c_cardBg")?.value||settings.cardBg,bg:$("#c_pageBg")?.value||settings.pageBg};const enabled=k=>document.querySelector(`[data-section="${k}"]`)?.classList.contains("on")!==false;let html="";for(const k of currentOrder()){if(k==="hero"&&enabled("hero"))html+=`<div class="preview-hero" style="--pv-primary:${pv.primary};--pv-accent:${pv.accent}"><small>${esc($("#heroEyebrow")?.value||"")}</small><h4>${esc($("#heroTitle")?.value||"")}</h4><p>${esc($("#heroSubtitle")?.value||"")}</p></div>`;if(k==="bestsellers"&&enabled("bestsellers"))html+=`<div class="preview-products"><strong>🏆 Sản phẩm bán chạy</strong><div class="pv-cards">${products.slice(0,3).map(p=>`<div class="pv-card" style="background:${pv.card}"><div class="pv-img">${p.image?`<img src="${p.image}" alt="">`:""}</div><b>${esc(p.name)}</b><div class="pv-price" style="color:${pv.accent}">${money(p.price)}</div></div>`).join("")}</div></div>`;if(k==="products"&&enabled("products"))html+=`<div class="preview-products"><strong>Catalog sản phẩm</strong><div class="pv-cards">${products.slice(0,3).map(p=>`<div class="pv-card" style="background:${pv.card}"><div class="pv-img">${p.image?`<img src="${p.image}" alt="">`:""}</div><b>${esc(p.name)}</b></div>`).join("")}</div></div>`;if(k==="recent"&&enabled("recent"))html+=`<div class="preview-trust"><div class="pv-trust">↶ Đã xem gần đây</div></div>`;if(k==="trust"&&enabled("trust"))html+=`<div class="preview-trust"><div class="pv-trust">Ảnh rõ ràng</div><div class="pv-trust">Nhóm sản phẩm</div><div class="pv-trust">Admin tùy chỉnh</div></div>`}$("#sitePreview").innerHTML=html||`<div class="empty">Chưa bật section nào.</div>`}
async function saveDesign(e){e.preventDefault();try{const body={shopName:$("#shopName").value,shopTagline:$("#shopTagline").value,metaDescription:$("#metaDescription").value,heroEyebrow:$("#heroEyebrow").value,heroTitle:$("#heroTitle").value,heroSubtitle:$("#heroSubtitle").value,heroButtonText:$("#heroButtonText").value,heroSecondaryText:$("#heroSecondaryText").value,supportEmail:$("#supportEmail").value,supportPhone:$("#supportPhone").value,discord:$("#discord").value,facebook:$("#facebook").value,telegram:$("#telegram").value,fontBody:$("#fontBody").value,fontHeading:$("#fontHeading").value,floatingSocial1Type:$("#floatingSocial1Type").value,floatingSocial1Label:$("#floatingSocial1Label").value,floatingSocial1Url:$("#floatingSocial1Url").value,floatingSocial2Type:$("#floatingSocial2Type").value,floatingSocial2Label:$("#floatingSocial2Label").value,floatingSocial2Url:$("#floatingSocial2Url").value,categories:$("#categories").value.split(",").map(x=>x.trim()).filter(Boolean),sections:{hero:document.querySelector('[data-section="hero"]').classList.contains("on"),bestsellers:document.querySelector('[data-section="bestsellers"]').classList.contains("on"),products:document.querySelector('[data-section="products"]').classList.contains("on"),recent:document.querySelector('[data-section="recent"]').classList.contains("on"),trust:document.querySelector('[data-section="trust"]').classList.contains("on")},homeOrder:currentOrder()};for(const [input,preview,key] of [["logoFile","#logoPrev","logo"],["faviconFile","#faviconPrev","favicon"],["heroFile","#heroPrev","heroBanner"]]){const file=$("#"+input)?.files?.[0];body[key]=file?await fileToData(file):$(preview)?.dataset.image||settings[key]||""}for(const k of ["primary","accent","pageBg","cardBg","text","muted","footerBg"])body[k]=$("#c_"+k)?.value||settings[k];settings=await api("/api/admin/settings",{method:"PUT",body:JSON.stringify(body)});applyBrand();toast("Đã lưu toàn bộ giao diện");setTimeout(()=>go("design"),250)}catch(err){toast(err.message)}}

boot();
