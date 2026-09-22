let products = [];
let cart = JSON.parse(localStorage.getItem("gaming_cart") || "[]");
let token = localStorage.getItem("gaming_token") || localStorage.getItem("gaming_admin_token") || "";
let currentUser = null;
let currentCat = "all";
let settings = {};

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ";
const fmt = n => Number(n) >= 1000 ? (Number(n) / 1000).toFixed(Number(n) >= 10000 ? 0 : 1) + "k" : String(n || 0);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function toast(msg){const el=$("#toast");if(!el)return;el.textContent=msg;el.className="toast show";clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.className="toast",2600)}
async function api(url, opts={}){opts.headers={...(opts.headers||{}),"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}: {})};const r=await fetch(url,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Có lỗi xảy ra");return d}
function safeHref(url){const v=String(url||"").trim();return /^(https?:|mailto:|https?:\/\/)/i.test(v)?v:"#"}
function cssImage(url){return url?`background-image:linear-gradient(90deg,rgba(9,12,18,.55),rgba(9,12,18,.1)),url("${String(url).replace(/"/g,'\\"')}")`:""}
function currentFont(name,fallback){const allowed=["DM Sans","Inter","Manrope","Poppins","Space Grotesk"];return allowed.includes(name)?name:fallback}

async function boot(){
  try{
    settings=await fetch("/api/config").then(r=>r.json());
    applySettings();
    products=await fetch("/api/products").then(r=>r.json());
    const params=new URLSearchParams(location.search);
    if(params.get("q")){const search=$("#search");if(search)search.value=params.get("q")}
    if(token){try{currentUser=await api("/api/me")}catch{logout(false)}}
    updateAccount();updateCartCount();renderCategories();renderProducts();renderBestsellers();renderRecent();
  }catch(e){toast("Không tải được dữ liệu: "+e.message)}
}

function applySettings(){
  const s=settings||{};document.title=s.shopName||"Gaming Shop";
  const md=$("#metaDescription");if(md)md.setAttribute("content",s.metaDescription||"");
  const root=document.documentElement;
  for(const [k,v] of Object.entries({primary:s.primary,accent:s.accent,pageBg:s.pageBg,cardBg:s.cardBg,text:s.text,muted:s.muted,footerBg:s.footerBg}))if(v)root.style.setProperty("--"+k.replace(/[A-Z]/g,m=>"-"+m.toLowerCase()),v);
  root.style.setProperty("--font-body",`"${currentFont(s.fontBody,"DM Sans")}",system-ui,sans-serif`);
  root.style.setProperty("--font-heading",`"${currentFont(s.fontHeading,"Space Grotesk")}",system-ui,sans-serif`);
  ["#shopName","#footerShopName","#copyrightName"].forEach(sel=>{if($(sel))$(sel).textContent=s.shopName||"Gaming Shop"});
  ["#shopTagline","#footerShopTagline"].forEach(sel=>{if($(sel))$(sel).textContent=s.shopTagline||"Marketplace"});
  if($("#heroEyebrow"))$("#heroEyebrow").textContent=s.heroEyebrow||"";
  if($("#heroSubtitle"))$("#heroSubtitle").textContent=s.heroSubtitle||"";
  if($("#heroButton"))$("#heroButton").textContent=s.heroButtonText||"Xem sản phẩm";
  if($("#heroSecondary"))$("#heroSecondary").textContent=s.heroSecondaryText||"Nạp tiền vào ví";
  if($("#supportEmail"))$("#supportEmail").textContent=s.supportEmail||"";
  if($("#supportPhone"))$("#supportPhone").textContent=s.supportPhone||"";
  if($("#footerDescription"))$("#footerDescription").textContent=s.metaDescription||"";
  if($("#socialLinks"))$("#socialLinks").innerHTML=[["Discord",s.discord],["Facebook",s.facebook],["Telegram",s.telegram]].filter(x=>x[1]).map(([n,u])=>`<a href="${esc(safeHref(u))}" target="_blank" rel="noopener">${esc(n)}</a>`).join(" · ");
  const logoHtml=s.logo?`<img src="${s.logo}" alt="logo">`:esc((s.shopName||"G").slice(0,1).toUpperCase());if($("#brandBadge"))$("#brandBadge").innerHTML=logoHtml;if($("#footerBrandBadge"))$("#footerBrandBadge").innerHTML=logoHtml;
  const favicon=$("#favicon");if(favicon)favicon.href=s.favicon||s.logo||"data:,";
  const titleLines=String(s.heroTitle||"").split("\\n");if($("#heroTitle"))$("#heroTitle").innerHTML=titleLines.map((line,i)=>i===titleLines.length-1?`<span>${esc(line)}</span>`:esc(line)).join("<br>");
  if($("#heroSection")){if(s.heroBanner){$("#heroSection").style.backgroundImage=cssImage(s.heroBanner);$("#heroSection").classList.add("hero-has-image")}else{$("#heroSection").style.backgroundImage="";$("#heroSection").classList.remove("hero-has-image")}}
  renderFloatingSocials();applyHomeLayout();renderCategories();
}
function applyHomeLayout(){
  const sections=settings.sections||{};const nodes={hero:$("#heroSection"),bestsellers:$("#bestsellersSection"),products:$("#products"),recent:$("#recentSection"),trust:$("#trustSection")};
  for(const [key,node] of Object.entries(nodes)){if(!node)continue;if(currentCat!=="all" && key!=="products"){node.style.display="none"}else{node.style.display=sections[key]===false?"none":""}}
  const order=Array.isArray(settings.homeOrder)?settings.homeOrder:["hero","bestsellers","products","recent","trust"];const main=$("#homeMain");if(main)for(const key of order)if(nodes[key])main.appendChild(nodes[key]);
}
function renderCategories(){
  const cats = (settings.categories || []).filter(Boolean);
  const nav = $("#categoryNav");
  if (nav) {
    nav.innerHTML = [`<button type="button" class="nav-link ${currentCat === "all" ? "active" : ""}" data-category="all">Tất cả</button>`, ...cats.map(c => `<button type="button" class="nav-link ${currentCat === c ? "active" : ""}" data-category="${esc(String(c))}">${esc(c)}</button>`)].join("");
  }
  const feature = $("#featureList");
  if (feature) {
    const featured = cats.slice(0,3);
    feature.innerHTML = (featured.length ? featured : ["Sản phẩm"]).map((c,i) => `<button type="button" data-category="${esc(String(c))}"><span class="feature-icon">${esc(String(c).slice(0,1).toUpperCase())}</span><span><b>${esc(c)}</b><small>${i===0?"Gọn, dễ chọn":i===1?"PC & Mobile":"Theo yêu cầu"}</small></span><i>→</i></button>`).join("");
  }
}
function updateAccount(){
  if(currentUser){$("#accountName").textContent=currentUser.name;$("#accountBalance").textContent=money(currentUser.balance);$("#avatarLetter").textContent=(currentUser.name||"U").slice(0,1).toUpperCase();if($("#adminPanelBtn"))$("#adminPanelBtn").classList.toggle("hidden",currentUser.role!=="admin")}
  else{$("#accountName").textContent="Khách";$("#accountBalance").textContent="Đăng nhập";$("#avatarLetter").textContent="U";if($("#adminPanelBtn"))$("#adminPanelBtn").classList.add("hidden")}
}
function updateCartCount(){const el=$("#cartCount");if(el)el.textContent=cart.reduce((s,i)=>s+i.qty,0)}
function getVariants(p){return Array.isArray(p.variants)&&p.variants.length?p.variants:[{id:"default",name:p.name,price:Number(p.price)||0,oldPrice:Number(p.oldPrice)||0,delivery:p.delivery||"Giao ngay",badge:p.badge||"",image:p.image||"",stock:null,sold:p.sold||0}]}
function variantById(p,id){const vs=getVariants(p);return vs.find(v=>String(v.id)===String(id))||vs[0]||null}
function displayPrice(p){return Math.min(...getVariants(p).map(v=>Number(v.price)||0))}
function productImage(p,cls="thumb"){
  const img=p.image?`<img src="${p.image}" alt="${esc(p.name)}" loading="lazy">`:`<div class="thumb-placeholder">Chưa có ảnh</div>`;return `<div class="${cls}">${img}${p.badge?`<span class="badge">${esc(p.badge)}</span>`:""}</div>`
}
function matchesProduct(p,q){return !q||`${p.name} ${p.category} ${p.description} ${(p.variants||[]).map(v=>v.name).join(" ")}`.toLowerCase().includes(q)}
function renderProducts(){
  const q=($("#search")?.value||"").trim().toLowerCase();let list=products.filter(p=>(currentCat==="all"||p.category===currentCat)&&matchesProduct(p,q));const sort=$("#sortSelect")?.value||"default";
  if(sort==="price-asc")list.sort((a,b)=>displayPrice(a)-displayPrice(b));if(sort==="price-desc")list.sort((a,b)=>displayPrice(b)-displayPrice(a));if(sort==="sold")list.sort((a,b)=>(b.sold||0)-(a.sold||0));
  const meta=$("#resultMeta");if(meta)meta.textContent=`${list.length} sản phẩm • Nhóm: ${currentCat==="all"?"Tất cả":currentCat}`;
  const grid=$("#productGrid");if(grid)grid.innerHTML=list.length?list.map(card).join(""):`<div class="empty"><h3>Không tìm thấy sản phẩm</h3><p>Hãy thử từ khóa hoặc nhóm khác.</p></div>`;if($("#searchClear"))$("#searchClear").classList.toggle("hidden",!$("#search").value)
}
function card(p){return `<article class="card" onclick="openProduct(${p.id})">${productImage(p,"thumb")}<div class="card-body"><button class="card-category category-button" onclick="event.stopPropagation();filterCategory(${JSON.stringify(p.category)})">${esc(p.category)}</button><h3>${esc(p.name)}</h3><div class="price-row"><span class="price">${getVariants(p).length>1?`Từ ${money(displayPrice(p))}`:money(getVariants(p)[0].price)}</span>${getVariants(p).length===1&&getVariants(p)[0].oldPrice?`<span class="old">${money(getVariants(p)[0].oldPrice)}</span>`:""}</div><div class="card-meta"><span>Đã bán ${fmt(p.sold)}</span><span class="delivery">${esc(p.delivery||"Giao ngay")}</span></div><div class="card-footer"><button class="card-buy" onclick="event.stopPropagation();openProduct(${p.id})">Xem chi tiết</button><button class="card-cart" title="Thêm vào giỏ" onclick="event.stopPropagation();addCart(${p.id})">＋</button></div></div></article>`}
function compactCard(p){return `<article class="card compact-card" onclick="openProduct(${p.id})">${productImage(p,"thumb") }<div class="card-body"><div class="card-category">${esc(p.category)}</div><h3>${esc(p.name)}</h3><div class="price-row"><span class="price">${getVariants(p).length>1?`Từ ${money(displayPrice(p))}`:money(getVariants(p)[0].price)}</span></div><div class="card-meta"><span>Đã bán ${fmt(p.sold)}</span><span class="delivery">${esc(p.delivery||"Giao ngay")}</span></div></div></article>`}
function renderBestsellers(){const grid=$("#bestsellersGrid");if(!grid)return;const list=[...products].sort((a,b)=>(b.sold||0)-(a.sold||0)).slice(0,6);grid.innerHTML=list.map(compactCard).join("")||`<div class="empty"><h3>Chưa có dữ liệu</h3><p>Khi có lượt bán, sản phẩm bán chạy sẽ xuất hiện ở đây.</p></div>`}
function recentIds(){try{return JSON.parse(localStorage.getItem("gaming_recent")||"[]")}catch{return[]}}
function saveRecent(id){let ids=recentIds().filter(x=>Number(x)!==Number(id));ids.unshift(Number(id));localStorage.setItem("gaming_recent",JSON.stringify(ids.slice(0,8)))}
function renderRecent(){const sec=$("#recentSection"),grid=$("#recentGrid");if(!sec||!grid)return;const ids=recentIds();const list=ids.map(id=>products.find(p=>p.id===Number(id))).filter(Boolean);sec.classList.toggle("hidden",list.length===0);grid.innerHTML=list.map(compactCard).join("")}
function clearRecentViewed(){localStorage.removeItem("gaming_recent");renderRecent();toast("Đã xóa lịch sử xem")}
function showBestsellersAll(){currentCat="all";if($("#sortSelect"))$("#sortSelect").value="sold";renderCategories();renderProducts();scrollToProducts()}
let detailState={productId:null,variantId:null,qty:1};
function openProduct(id){
  const p=products.find(x=>x.id===id);if(!p)return;saveRecent(id);renderRecent();const variants=getVariants(p),first=variants[0];detailState={productId:p.id,variantId:first.id,qty:1};
  const image=p.image?`<img src="${p.image}" alt="${esc(p.name)}">`:`<div class="thumb-placeholder">Chưa có ảnh sản phẩm</div>`;
  const variantRows=variants.map((v,i)=>`<button type="button" class="variant-row ${i===0?"selected":""}" data-variant-id="${esc(v.id)}" onclick="selectProductVariant('${esc(String(v.id))}')"><span class="variant-radio"></span><span class="variant-thumb">${v.image?`<img src="${v.image}" alt="">`:`<span>IMG</span>`}</span><span class="variant-info"><b>${esc(v.name)}</b><small>↗ ${esc(v.delivery||"Giao ngay")}</small></span><span class="variant-price"><b>${money(v.price)}</b>${v.oldPrice?`<del>${money(v.oldPrice)}</del>`:""}</span></button>`).join("");
  openModal(`<div class="modal-head"><div><span class="pill">${esc(p.category)}</span><h2 style="margin-top:8px">${esc(p.name)}</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><div class="detail-grid"><div class="detail-image">${image}</div><div class="detail-copy"><p>${esc(p.description||"Sản phẩm đang được cập nhật thông tin.")}</p><div id="detailSelectedPrice" class="detail-price">${money(first.price)}</div><p><b>Đã bán:</b> ${fmt(p.sold)}</p><div class="detail-qty"><span>Số lượng</span><div><button type="button" class="qty-btn" onclick="changeDetailQty(-1)">−</button><b id="detailQty">1</b><button type="button" class="qty-btn" onclick="changeDetailQty(1)">＋</button></div></div><div class="row"><button class="action-btn primary" onclick="addSelectedToCart()">Thêm vào giỏ</button><button class="action-btn secondary" onclick="buySelectedNow()">Mua ngay</button></div></div></div><section class="variant-picker"><div class="variant-picker-head"><h3>Chọn gói / thời hạn</h3><span>${variants.length} lựa chọn</span></div><div class="variant-list">${variantRows}</div></section><section class="product-description"><h3>Thông tin sản phẩm</h3><p>${esc(p.description||"Đang cập nhật...")}</p></section>`);
}
function selectProductVariant(variantId){const p=products.find(x=>x.id===detailState.productId);if(!p)return;const v=variantById(p,variantId);if(!v)return;detailState.variantId=v.id;document.querySelectorAll(".variant-row").forEach(el=>el.classList.toggle("selected",String(el.dataset.variantId)===String(v.id)));if($("#detailSelectedPrice"))$("#detailSelectedPrice").textContent=money(v.price)}
function changeDetailQty(delta){detailState.qty=Math.max(1,Math.min(99,detailState.qty+delta));if($("#detailQty"))$("#detailQty").textContent=detailState.qty}
function addSelectedToCart(){const p=products.find(x=>x.id===detailState.productId);if(!p)return;addCart(p.id,detailState.variantId,detailState.qty);closeModal()}
function buySelectedNow(){const p=products.find(x=>x.id===detailState.productId);if(!p)return;addCart(p.id,detailState.variantId,detailState.qty);closeModal();openCart()}
function addCart(id,variantId=null,qty=1){const p=products.find(x=>x.id===id);if(!p)return;const v=variantById(p,variantId);if(!v)return;const key=String(v.id),x=cart.find(i=>i.id===id&&String(i.variantId||"default")===key);x?x.qty=Math.min(99,x.qty+qty):cart.push({id,variantId:key,qty});saveCart();updateCartCount();toast("Đã thêm vào giỏ hàng")}
function saveCart(){localStorage.setItem("gaming_cart",JSON.stringify(cart))}
function openCart(){window.location.href="/cart"}
function openAccountPage(){window.location.href="/account"}
function showAccount(){if(!currentUser){openAuth("login");return}openAccountPage()}
function openAdminPanel(){if(currentUser?.role!=="admin")return toast("Bạn không có quyền admin");window.location.href="/admin"}
function logout(show=true){token="";currentUser=null;localStorage.removeItem("gaming_token");localStorage.removeItem("gaming_admin_token");updateAccount();if(show){closeModal();toast("Đã đăng xuất")}}
function openTopup(){if(!currentUser){openAuth("login");return}openModal(`<div class="modal-head"><h2>Nạp tiền</h2><button class="close-btn" onclick="closeModal()">×</button></div><p class="muted-note">Tạo yêu cầu nạp tiền. Bạn có thể thay sang QR/webhook tự động ở bước thanh toán ngân hàng.</p><form class="form" onsubmit="topupSubmit(event)"><input name="amount" type="number" min="1000" step="1000" placeholder="Số tiền (VND)" required><select name="method"><option value="bank">Ngân hàng</option><option value="crypto">Crypto</option><option value="card">Thẻ</option></select><button class="action-btn primary">Tạo yêu cầu nạp</button></form>`)}
async function topupSubmit(e){e.preventDefault();try{const f=new FormData(e.target);const d=await api("/api/topups",{method:"POST",body:JSON.stringify(Object.fromEntries(f))});closeModal();toast("Đã tạo yêu cầu "+d.id)}catch(err){toast(err.message)}}
async function showPage(page){if(page!=="orders"){openModal(`<div class="modal-head"><h2>${page==="blogs"?"Tin tức":"Yêu thích"}</h2><button class="close-btn" onclick="closeModal()">×</button></div><p class="muted-note">Khu vực này có thể mở rộng trong Admin.</p>`);return}if(!currentUser){openAuth("login");return}window.location.href="/account"}
function openAuth(mode="login"){
  openModal(`<div class="modal-head"><h2>${mode==="login"?"Đăng nhập":"Tạo tài khoản"}</h2><button class="close-btn" onclick="closeModal()">×</button></div><form class="form" onsubmit="authSubmit(event,'${mode}')">${mode==="register"?`<input name="name" placeholder="Tên hiển thị" required>`:""}<input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Mật khẩu" required minlength="6"><button class="action-btn primary">${mode==="login"?"Đăng nhập":"Đăng ký"}</button></form><button class="action-btn secondary" style="margin-top:10px" onclick="openAuth('${mode==="login"?"register":"login"}')">${mode==="login"?"Chưa có tài khoản? Đăng ký":"Đã có tài khoản? Đăng nhập"}</button>`)
}
async function authSubmit(e,mode){
  e.preventDefault();try{const f=new FormData(e.target);const d=await fetch("/api/"+mode,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(f))}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error||"Đăng nhập thất bại");return x});
    if(d.requires2FA){openTwoFactorLogin(d.twoFactorToken);return}
    token=d.token;localStorage.setItem("gaming_token",token);currentUser=d.user;updateAccount();closeModal();toast("Xin chào "+currentUser.name)
  }catch(err){toast(err.message)}
}
function openTwoFactorLogin(twoFactorToken){openModal(`<div class="modal-head"><div><span class="pill">2FA</span><h2 style="margin-top:8px">Xác minh đăng nhập</h2></div><button class="close-btn" onclick="closeModal()">×</button></div><p class="muted-note">Nhập mã 6 số đang hiển thị trong Google Authenticator của bạn.</p><form class="form" onsubmit="finishTwoFactorLogin(event,'${esc(twoFactorToken)}')"><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="Mã 6 số" required><button class="action-btn primary">Xác nhận</button></form>`)}
async function finishTwoFactorLogin(e,twoFactorToken){e.preventDefault();try{const code=new FormData(e.target).get("code");const d=await fetch("/api/login/2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({twoFactorToken,code})}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error||"Xác thực thất bại");return x});token=d.token;localStorage.setItem("gaming_token",token);currentUser=d.user;updateAccount();closeModal();toast("Đăng nhập thành công") }catch(err){toast(err.message)}}
function openModal(html){$("#modalCard").innerHTML=html;$("#modal").classList.remove("hidden");$("#modal").setAttribute("aria-hidden","false")}
function closeModal(){$("#modal").classList.add("hidden");$("#modal").setAttribute("aria-hidden","true")}
function clearFilters(){currentCat="all";renderCategories();$("#search").value="";$("#sortSelect").value="default";applyHomeLayout();renderProducts()}
function clearSearch(){$("#search").value="";renderProducts()}
function filterCategory(cat){
  currentCat = String(cat || "all");
  if (currentCat === "all") currentCat = "all";
  renderCategories();
  if ($("#sortSelect")) $("#sortSelect").value = "default";
  applyHomeLayout();
  renderProducts();

  // Đưa người dùng tới đúng khu vực danh sách sản phẩm sau khi DOM đã cập nhật.
  requestAnimationFrame(() => {
    setTimeout(() => {
      scrollToProducts();
    }, 60);
  });
}
function scrollToProducts(){
  const target=$("#products");
  if(!target)return;
  const header=$(".site-header");
  const offset=(header?.offsetHeight||0)+12;
  const top=Math.max(0,target.getBoundingClientRect().top+window.scrollY-offset);
  window.scrollTo({top,behavior:"smooth"});
}
function socialIcon(type){if(type==="messenger")return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.7c-5.6 0-10 3.8-10 9 0 2.8 1.3 5.3 3.7 6.9v3.2l3.4-1.9c.9.3 1.9.5 2.9.5 5.6 0 9.9-3.8 9.9-8.7 0-5.2-4.3-9-9.9-9Zm.9 11.5-2.6-2.7-4.1 2.7 4.5-4.8 2.6 2.7 4.1-2.7-4.5 4.8Z"/></svg>';if(type==="discord")return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.5 4.1a15.4 15.4 0 0 0-3.8-1.2l-.5 1.1a14.2 14.2 0 0 0-6.4 0l-.5-1.1A15.4 15.4 0 0 0 4.5 4.1C2.1 7.7 1.4 11.2 1.7 14.6a15.2 15.2 0 0 0 4.6 2.3l1.1-1.5c-.6-.2-1.2-.5-1.7-.8l.4-.3c3.2 1.5 6.7 1.5 9.9 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.5a15.2 15.2 0 0 0 4.6-2.3c.4-4-.7-7.5-2.9-10.5Zm-9 8.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm5 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>';return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5C6.2 2.5 1.5 6.4 1.5 11.3c0 2.9 1.7 5.5 4.4 7.1v3.1l3.1-1.8c.9.3 1.9.4 3 .4 5.8 0 10.5-3.9 10.5-8.8S17.8 2.5 12 2.5Zm-4.6 11.2 3-3.2 2 1.7 3.1-3.2-2.9 3.2-2-1.7-3.2 3.2Z"/></svg>'}
function renderFloatingSocials(){
  const el=$("#floatingSocials");if(!el)return;const list=[{type:settings.floatingSocial1Type,label:settings.floatingSocial1Label,url:settings.floatingSocial1Url},{type:settings.floatingSocial2Type,label:settings.floatingSocial2Label,url:settings.floatingSocial2Url}].filter(x=>x.url);
  el.innerHTML=list.map(x=>`<a class="social-float ${esc(x.type||"")}" href="${esc(safeHref(x.url))}" target="_blank" rel="noopener" title="${esc(x.label||x.type)}"><span>${socialIcon(x.type)}</span><b>${esc(x.label||x.type||"Liên hệ")}</b></a>`).join("");el.classList.toggle("hidden",list.length===0)
}
// Dùng event delegation để category luôn bấm được, kể cả khi danh mục được render lại.
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-category]");
  if (!el) return;
  event.preventDefault();
  event.stopPropagation();
  filterCategory(el.dataset.category || "all");
});

$("#search")?.addEventListener("input",renderProducts);
boot();
