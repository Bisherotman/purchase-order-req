// =====================================
// 🔥 Firebase Configuration & Setup
// =====================================
const firebaseConfig = {
  apiKey: "AIzaSyCP29UC4BnT4aJ9pEc4HeV3LGEpylVaSMg",
  authDomain: "purchase-order-req.firebaseapp.com",
  projectId: "purchase-order-req",
  storageBucket: "purchase-order-req.appspot.com",
  messagingSenderId: "72898448492",
  appId: "1:72898448492:web:33a0ec622cbcae47e11c49"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();


// =====================================
// 🔄 Routing & View Handling
// =====================================
const $ = (s)=>document.querySelector(s);
const routes = { "#/login":"view-login", "#/new":"view-new", "#/my":"view-my", "#/admin":"view-admin" };
const navLinks = $("#navLinks");
const sessionBtn = $("#sessionBtn");
  // === Gregorian date formatter (Arabic UI) ===
const AR_GREG = 'ar-SA-u-ca-gregory-nu-latn';
function fmtDate(ts, { withTime = false } = {}) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  try {
    return withTime
      ? d.toLocaleString(AR_GREG, { dateStyle: 'medium', timeStyle: 'short' })
      : d.toLocaleDateString(AR_GREG, { dateStyle: 'medium' });
  } catch {
    // احتياط لو متصفح قديم ما يدعم الامتداد
    return withTime
      ? d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      : d.toLocaleDateString('en-GB', { dateStyle: 'medium' });
  }
}


function setActive(hash){ navLinks.querySelectorAll("a").forEach(a=>a.classList.toggle("active", a.getAttribute("href")==hash)); }
function showMsg(el, text, type="success"){ el.textContent=text; el.className="msg "+type; el.style.display="block"; }
function hideMsg(el){ el.style.display="none"; }
function showView(id){ document.querySelectorAll(".view").forEach(v=>v.classList.remove("active")); document.getElementById(id).classList.add("active"); window.scrollTo({top:0,behavior:"smooth"}); }

function route(){
  const h = location.hash || "#/login";
  if (!currentUser && h !== "#/login") { location.hash = "#/login"; setActive("#/login"); showView("view-login"); return; }
  if (!canSeeAdmin && h === "#/admin") { location.hash = "#/new"; }
  const target = routes[location.hash] || "view-login";
  setActive(location.hash);
  showView(target);
}
window.addEventListener("hashchange", route);
  

/* ---------- state ---------- */
const loginForm=$("#loginForm"), loginMsg=$("#loginMsg"), loginBtn=$("#loginBtn");
const whoami=$("#whoami"), whoamiMy=$("#whoamiMy"), whoamiAdmin=$("#whoamiAdmin");
let currentUser=null, userProfile=null, canSeeAdmin=false, isAdmin = false;


// =====================================
// 📧 Email & Password Input Behavior
// =====================================
const rememberCk = $("#rememberEmail");
const savedEmail = localStorage.getItem("savedEmail");
if(savedEmail){ $("#loginEmail").value = savedEmail; rememberCk.checked = true; showEmailClearIfNeeded(); }
function showEmailClearIfNeeded(){
  const v = $("#loginEmail").value.trim();
  $("#clearEmail").style.display = v ? "flex" : "none";
}
$("#loginEmail").addEventListener("input", showEmailClearIfNeeded);
$("#clearEmail").onclick = ()=>{ $("#loginEmail").value=""; $("#loginEmail").focus(); showEmailClearIfNeeded(); };

function showPwdButtonsIfNeeded(){
  const v = $("#loginPassword").value;
  const has = v && v.length>0;
  $("#togglePwd").style.display = has ? "flex" : "none";
  $("#clearPwd").style.display  = has ? "flex" : "none";
}
$("#togglePwd").onclick = ()=>{
  const f=$("#loginPassword");
  const show = (f.type==="password");
  f.type = show ? "text" : "password";
  $("#togglePwd").textContent = show ? "إخفاء" : "إظهار";
};
$("#loginPassword").addEventListener("input", showPwdButtonsIfNeeded);
$("#clearPwd").onclick = ()=>{ $("#loginPassword").value=""; $("#loginPassword").focus(); showPwdButtonsIfNeeded(); };


// =====================================
// 📄 My Orders: Filters & DOM Elements
// =====================================
const myBody = $("#myOrdersBody"),
      mySearch = $("#mySearch"),
      myFilterStatus = $("#myFilterStatus"),
      mySort = $("#mySort");


// =====================================
// 🔐 Authentication Logic
// =====================================
loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault(); hideMsg(loginMsg);
  loginBtn.classList.add("loading");
  const email=$("#loginEmail").value.trim(), pass=$("#loginPassword").value;
  try{
    await auth.signInWithEmailAndPassword(email,pass);
    if(rememberCk.checked) localStorage.setItem("savedEmail", email);
    else localStorage.removeItem("savedEmail");
    showMsg(loginMsg,"تم تسجيل الدخول.","success");
  }catch(err){
    showMsg(loginMsg,"خطأ: "+(err.message||err),"error");
  }finally{
    loginBtn.classList.remove("loading");
  }
});
sessionBtn.addEventListener("click",(e)=>{ if(currentUser){ e.preventDefault(); auth.signOut(); } });

function displayNameOrEmail(u, profile){
  return (profile && profile.name) ? profile.name : (u.displayName || u.email);
}

/* شعار → صفحة مناسبة */
document.getElementById("brandLink").addEventListener("click",(e)=>{
  e.preventDefault();
  if (currentUser) { location.hash = "#/new"; }
  else            { location.hash = "#/login"; }
});

auth.onAuthStateChanged(async (user)=>{
  currentUser = user;
  document.body.classList.toggle('auth-out', !user);
  document.body.classList.toggle('auth-in',  !!user);

  if (!user) {
    userProfile=null; canSeeAdmin=false;
    navLinks.querySelectorAll("[data-auth]").forEach(a=>a.style.display="none");
    sessionBtn.textContent="دخول"; sessionBtn.classList.remove("ghost");
    sessionBtn.setAttribute("href","#/login");
    if (myUnsub) { myUnsub(); myUnsub=null; }
    if (location.hash !== "#/login") location.hash = "#/login";
    showView("view-login"); setActive("#/login");
    return;
  }

  const snap=await db.collection("users").doc(user.uid).get();
  if(!snap.exists){ showMsg(loginMsg,"حسابك غير مهيأ. تواصل مع الإدارة لإسناد فرع لك.","error"); await auth.signOut(); return; }
  userProfile=snap.data(); canSeeAdmin=!!userProfile.isAdmin || userProfile.branch==="HQ";

  const badge=`مرحباً، ${displayNameOrEmail(user,userProfile)} — الفرع: ${userProfile.branch}${canSeeAdmin?' — إدارة':''}`;
  $("#whoami").textContent=badge; $("#whoamiMy").textContent=badge; $("#whoamiAdmin").textContent=badge;

  navLinks.querySelectorAll("[data-auth]").forEach(a=>{
    const t=a.dataset.auth; a.style.display=(t==="user")? "" : (canSeeAdmin? "" : "none");
  });
  sessionBtn.textContent="خروج"; sessionBtn.setAttribute("href","#/login");

  if (location.hash === "#/login" || !location.hash) location.hash="#/new";
  route();
  subscribeMyOrders();
  if(canSeeAdmin) loadAdminOrders();
});


// =====================================
// 🔢 Tracking Numbers & Branch Counters
// =====================================
const branchCodes={Riyadh:"RUH",Dammam:"DMM",Jeddah:"JED",Makkah:"MKK",Madina:"MED",HQ:"HQ"};
const pad5=(n)=>String(n).padStart(5,"0");


// =====================================
// 📦 Dynamic Item Input Rows (New Order)
// =====================================
const itemsWrap = $("#itemsWrap");
const addItemBtn = $("#addItemBtn");
function makeItemRow(values={}){
const row=document.createElement("div");
row.className="item-row";
row.innerHTML = `
<input type="text" class="it-code" placeholder="كود الصنف" value="${values.itemCode||""}">
<input type="number" class="it-qty" min="1" step="1" placeholder="الكمية" value="${values.quantity||""}">
<input type="number" class="it-price" min="0" step="0.01" placeholder="سعر البيع" value="${values.price||""}">
<select class="it-ship" required>
<option value="">اختر نوع الشحن</option>
<option value="Sea freight">Sea freight</option>
<option value="DHL freight">DHL freight</option>
<option value="Air freight">Air freight</option>
</select>
<button type="button" class="remove">🗑</button>`;
row.querySelector(".remove").onclick=()=> row.remove();
return row;
}
function ensureAtLeastOneRow(){ if(!itemsWrap.children.length){ itemsWrap.appendChild(makeItemRow()); } }
addItemBtn.onclick = ()=> itemsWrap.appendChild(makeItemRow());


// =====================================
// 🔗 Attachment Link Inputs (New Order)
// =====================================
const linksWrap = $("#linksWrap");
const addLinkBtn = $("#addLinkBtn");
function makeLinkRow(values={}){
const r=document.createElement("div");
r.className="link-row";
r.innerHTML=`
<input class="ln-name" placeholder="اسم المرفق (مثال: عرض سعر)" value="${values.name||""}">
<input class="ln-url" placeholder="https://example.com/file.pdf" value="${values.url||""}">
<button type="button" class="remove">🗑</button>`;
r.querySelector(".remove").onclick=()=>{ r.remove(); if(linksWrap.children.length < 3) addLinkBtn.disabled = false; };
return r;
}
addLinkBtn.onclick = ()=>{ if (linksWrap.children.length >= 3) return; linksWrap.appendChild(makeLinkRow()); if (linksWrap.children.length >= 3) addLinkBtn.disabled = true; };


// =====================================
// ✅ Submit New Order Logic
// =====================================
const newMsg=$("#newMsg");
const submitOrderBtn = $("#submitOrder");
submitOrderBtn.addEventListener("click", async ()=>{
  hideMsg(newMsg);
  if(!currentUser || !userProfile){ showMsg(newMsg,"يجب تسجيل الدخول أولاً.","error"); return; }

  const projectName = $("#projectName").value.trim();
  const customerName= $("#customerName").value.trim();

  const items = [...itemsWrap.querySelectorAll(".item-row")].map(r=>({
    itemCode: r.querySelector(".it-code").value.trim(),
    quantity: Number(r.querySelector(".it-qty").value),
    price:    Number(r.querySelector(".it-price").value),
    shippingType: r.querySelector(".it-ship")?.value || "",
    status: r.querySelector(".it-status")?.value || "created",
    deliveredQty: Number(r.querySelector(".it-delivered")?.value || 0)
  })).filter(x=>x.itemCode && x.shippingType && Number.isFinite(x.quantity) && x.quantity>0 && Number.isFinite(x.price) && x.price>=0);

  if(items.length===0){ showMsg(newMsg,"أضف صنفًا واحدًا على الأقل بشكل صحيح.","error"); return; }
  if (linksWrap.children.length > 3) { showMsg(newMsg, "مسموح بثلاث مرفقات كحد أقصى.", "error"); return; }

  const attachments = [...linksWrap.querySelectorAll(".link-row")].map(r=>{
    const name=(r.querySelector(".ln-name").value||"ملف").trim();
    const url = r.querySelector(".ln-url").value.trim();
    return url ? {name, url} : null;
  }).filter(Boolean);

  submitOrderBtn.classList.add("loading"); submitOrderBtn.disabled=true;

  try{
    const branch=userProfile.branch, code=branchCodes[branch]||"UNK";
    const counterRef=db.collection("counters").doc(branch);
    const seq=await db.runTransaction(async(tx)=>{ const s=await tx.get(counterRef); let next=1; if(s.exists) next=(s.data().next||1); tx.set(counterRef,{next:next+1},{merge:true}); return next; });
    const tracking=code+pad5(seq);

    await db.collection("orders").doc(tracking).set({
      tracking, branch, projectName, customerName,
      items, attachments, createdBy: currentUser.uid,
      createdByEmail: currentUser.email || "",
      status:"created",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showMsg(newMsg,`تم تسجيل الطلب. رقم التتبّع: ${tracking}`,"success");
    $("#projectName").value=""; $("#customerName").value="";
    itemsWrap.innerHTML=""; ensureAtLeastOneRow();
    linksWrap.innerHTML=""; addLinkBtn.disabled=false;

    subscribeMyOrders(); if(canSeeAdmin) loadAdminOrders();

  }catch(err){
    console.error(err); showMsg(newMsg,"خطأ أثناء الإرسال: "+(err.message||err),"error");
  }finally{
    submitOrderBtn.classList.remove("loading"); submitOrderBtn.disabled=false;
  }
});


// =====================================
// 📂 Admin Table Row Expansion (Toggle)
// =====================================
  // تحديث حالة الطلب عند تغييره (للأدمن فقط)
document.addEventListener("change", (e) => {
  const select = e.target.closest(".order-status-select");
  if (!select) return;

  const tr = select.closest("tr");
  const tracking = tr?.dataset?.tracking;
  const newStatus = select.value;
  
  if (!tracking || !newStatus) return;

  // تحديث محلي في adminRows (اختياري)
  const order = adminRows.find(o => o.tracking === tracking);
  if (order) order.status = newStatus;

  // عرض رسالة أو تنفيذ حفظ في قاعدة البيانات (لاحقاً)
  console.log(`تم تحديث الطلب ${tracking} إلى: ${newStatus}`);
});

document.addEventListener("click", (e) => {
const toggleBtn = e.target.closest(".toggle-items");
if (!toggleBtn) return;
const tr = toggleBtn.closest("tr");
const tracking = tr?.dataset?.tracking;
const container = tr.nextElementSibling?.classList.contains("sub-items-row") ? tr.nextElementSibling : null;


if (container) {
container.hidden = !container.hidden;
toggleBtn.textContent = container.hidden ? "🔽" : "🔼";
} else {
const newRow = document.createElement("tr");
newRow.className = "sub-items-row";
newRow.innerHTML = `<td colspan="100%"><div class="loading">جاري تحميل الأصناف...</div></td>`;
tr.parentNode.insertBefore(newRow, tr.nextSibling);
toggleBtn.textContent = "🔼";


const r = (Array.isArray(adminRows) && adminRows.find(x => x.tracking === tracking));
if (r) {
const inner = document.createElement("div");
renderOrderItemsEdit(inner, r.items || [], tracking);
newRow.innerHTML = `<td colspan="100%"></td>`;
newRow.firstElementChild.appendChild(inner);
} else {
newRow.innerHTML = `<td colspan="100%"><div class="msg error">تعذّر تحميل الأصناف.</div></td>`;
}
}
});


// =====================================
// 🧱 Admin Table Row Renderer
// =====================================
function renderTableRow(r){
const createdAtStr = r.createdAt || "-";
const userLabel = r.user || "-";
const priceFirst = r.total;
return `
<tr data-id="${r.tracking}">
<td>${r.tracking}</td>
<td>${createdAtStr}</td>
<td>${r.projectName || "-"}</td>
<td>${userLabel}</td>
<td>
<select class="status-dropdown" data-id="${r.tracking}">
<option value="created" ${r.status === 'created' ? 'selected' : ''}>جديد</option>
<option value="ordered" ${r.status === 'ordered' ? 'selected' : ''}>تم الطلب من المصنع</option>
<option value="shipped" ${r.status === 'shipped' ? 'selected' : ''}>تم الشحن</option>
<option value="partial" ${r.status === 'partial' ? 'selected' : ''}>وصلت جزئياً</option>
<option value="delivered" ${r.status === 'delivered' ? 'selected' : ''}>وصلت بالكامل</option>
</select>
</td>
<td>${(typeof priceFirst === "number") ? priceFirst.toFixed(2) : priceFirst}</td>
<td style="white-space: nowrap; text-align: left;">
<button type="button" class="toggle-items btn-sm" title="عرض التفاصيل" style="margin-inline-end: 6px;">🔽</button>
<button type="button" class="btn-details btn-sm" title="طباعة الطلب" data-id="${r.tracking}">🖨️</button>
</td>
</tr>`;
}


// =====================================
// 📈 My Orders: Realtime Sync & Rendering
// =====================================
let myUnsub=null, myRows=[];
function subscribeMyOrders(){
  if(myUnsub){ myUnsub(); myUnsub=null; }
  if(!currentUser) return;
  const q=db.collection("orders").where("createdBy","==",currentUser.uid);
  myUnsub=q.onSnapshot((snap)=>{ myRows=snap.docs.map(d=>({id:d.id,...d.data()})); renderMy(myRows); },
    (err)=>{ console.error(err); showMsg(document.getElementById("newMsg"),"تعذّر تحميل طلباتك: "+(err.message||err),"error"); });
}
const myTableBody = $("#myOrdersBody");
function renderMy(rows){
  // فلتر الحالة
  const selectedStatus = (myFilterStatus?.value || "").trim();
  if (selectedStatus) {
    rows = rows.filter(r => (r.status || "") === selectedStatus);
  }

  // البحث
  const term = (mySearch.value || "").trim().toLowerCase();
  rows = rows.filter(r=>{
    if (!term) return true;
    const inTracking = (r.tracking||"").toLowerCase().includes(term);
    const inProj     = (r.projectName||"").toLowerCase().includes(term);
    const inCust     = (r.customerName||"").toLowerCase().includes(term);
    const inItems    = (r.items||[]).some(it => (it.itemCode||"").toLowerCase().includes(term));
    return inTracking || inProj || inCust || inItems;
  });

  // الترتيب
  rows.sort((a,b)=> (mySort.value==="createdAt_desc"
    ? (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0)
    : (a.createdAt?.toMillis?.()||0) - (b.createdAt?.toMillis?.()||0)));

  // العرض
  myTableBody.innerHTML = rows.map(r=>{
    const items      = r.items || [];
    const firstCode  = items[0]?.itemCode || "";
    const extra      = items.length>1 ? ` (+${items.length-1})` : "";
    const qtySum     = items.reduce((s,x)=>s+(x.quantity||0),0);
    const priceFirst = items.length ? (items[0].price ?? "") : "";
    const createdAtStr = fmtDate(r.createdAt, { withTime: true });

    return `
      <tr>
        <td><strong>${r.tracking}</strong></td>
        <td>${firstCode}${extra}</td>
        <td>${qtySum}</td>
        <td>${(typeof priceFirst==="number") ? priceFirst.toFixed(2) : priceFirst}</td>
        <td>${r.projectName||"-"}</td>
        <td><span class="status ${statusClass(r.status)}">${statusLabel(r.status)}</span></td>
        <td>${createdAtStr}</td>
        <td><button type="button" class="btn-strong" data-open="${r.tracking}" style="padding:6px 10px;border-radius:10px">تفاصيل</button></td>
      </tr>`;
  }).join("");
}
  //document.querySelectorAll('[data-open]').forEach(btn=>{ btn.onclick = ()=> openDetails(btn.dataset.open); });
mySearch.addEventListener("input",()=>renderMy(myRows));
mySort.addEventListener("change",()=>renderMy(myRows));
myFilterStatus.addEventListener("change", ()=>renderMy(myRows));


// =====================================
// 🧠 Admin Order Filters + Detail View
// =====================================
const adminBody = $("#adminOrdersBody"),
      adminSearch = $("#adminSearch"),
      adminFilterBranch = $("#adminFilterBranch"),
      adminFilterStatus = $("#adminFilterStatus"),
      adminFilterUser   = $("#adminFilterUser"),
      adminSort         = $("#adminSort");
  let usersById = {}; // uid -> {name, email, ...}

let adminRows=[];
async function loadAdminOrders(){ // NEW
  if(!canSeeAdmin) return;

  const [ordersSnap, usersSnap] = await Promise.all([
    db.collection("orders").get(),
    db.collection("users").get()
  ]);

  usersById = {};
  usersSnap.forEach(d => usersById[d.id] = d.data() || {});

  adminRows = ordersSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  populateAdminUsers(adminRows);
  renderAdmin();
}

function populateAdminUsers(rows){ // NEW
  const map = new Map(); // uid -> label
  rows.forEach(r=>{
    const uid = (r.createdBy || "").trim();
    if (!uid) return;
    const label = (usersById[uid]?.name || usersById[uid]?.email || uid);
    map.set(uid, label);
  });

  adminFilterUser.innerHTML =
    `<option value="">كل المستخدمين</option>` +
    [...map.entries()]
      .sort((a,b)=> a[1].localeCompare(b[1], 'ar'))
      .map(([uid,label]) => `<option value="${uid}">${label}</option>`)
      .join("");
}

function renderAdmin(){ // NEW
  const term = (adminSearch.value || "").trim().toLowerCase();
  const fb   = (adminFilterBranch.value || "");
  const fs   = (adminFilterStatus.value || "");
  const fu   = (adminFilterUser.value || ""); // ← UID
  const sort = (adminSort.value || "createdAt_desc");

  let rows = adminRows.filter(r=>{
    if (fb && r.branch !== fb) return false;
    if (fs && (r.status||"") !== fs) return false;
    if (fu && (r.createdBy || "") !== fu) return false;

    if (!term) return true;
    const inTracking = (r.tracking||"").toLowerCase().includes(term);
    const inProj     = (r.projectName||"").toLowerCase().includes(term);
    const inCust     = (r.customerName||"").toLowerCase().includes(term);
    const inItems    = (r.items||[]).some(it => (it.itemCode||"").toLowerCase().includes(term));
    const inUserName = (usersById[r.createdBy]?.name || "").toLowerCase().includes(term);
    const inUserMail = (usersById[r.createdBy]?.email||"").toLowerCase().includes(term);
    return inTracking || inProj || inCust || inItems || inUserName || inUserMail;
  });

  rows.sort((a,b)=> sort==="createdAt_desc"
    ? (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0)
    : (a.createdAt?.toMillis?.()||0) - (b.createdAt?.toMillis?.()||0));

adminBody.innerHTML = rows.map(r => {
  const items        = r.items || [];
  const priceFirst   = items.length ? (items[0].price ?? "") : "";
  const createdAtStr = fmtDate(r.createdAt);
  const userLabel = usersById[r.createdBy]?.name
                 || usersById[r.createdBy]?.email
                 || r.createdBy;

  return `
    <tr data-id="${r.tracking}">
      <td>${r.tracking}</td>
      <td>${createdAtStr}</td>
      <td>${r.projectName || "-"}</td>
      <td>${userLabel}</td>
      <td>
        ${isAdmin ? `
          <select class="status-dropdown order-status-select" data-tracking="${r.tracking}">
            <option value="created" ${r.status === "created" ? "selected" : ""}>جديد</option>
            <option value="ordered" ${r.status === "ordered" ? "selected" : ""}>تم الطلب من المصنع</option>
            <option value="shipped" ${r.status === "shipped" ? "selected" : ""}>تم الشحن</option>
            <option value="partial" ${r.status === "partial" ? "selected" : ""}>وصلت جزئياً</option>
            <option value="delivered" ${r.status === "delivered" ? "selected" : ""}>وصلت بالكامل</option>
          </select>
        ` : `
          <span class="badge ${r.status === 'created' ? 'badge-new' : 'badge-ok'}">${statusLabel(r.status)}</span>
        `}
      </td>
      <td>${(typeof priceFirst === "number") ? priceFirst.toFixed(2) : priceFirst}</td>
      <td>
        <button type="button" class="toggle-items">🔽</button>
        <button type="button" class="btn-details" data-id="${r.tracking}">🖨️ طباعة</button>
      </td>
    </tr>
  `;
}).join(""); // ← مهم جداً

}

adminSearch.addEventListener("input",renderAdmin);
adminFilterBranch.addEventListener("change",renderAdmin);
adminFilterStatus.addEventListener("change", renderAdmin);
adminFilterUser.addEventListener("change", renderAdmin);
adminSort.addEventListener("change", renderAdmin);

  // ✅ تحديث الحالة مباشرة عند تغييرها
document.addEventListener("change", async (e) => {
  const select = e.target.closest(".order-status-select");
  if (!select) return;

  const tracking = select.dataset.tracking;
  const newStatus = select.value;

  if (!tracking || !newStatus) return;

  select.disabled = true;
  select.style.opacity = 0.6;

  try {
    await db.collection("orders").doc(tracking).update({ status: newStatus });

    const row = adminRows.find(r => r.tracking === tracking);
    if (row) row.status = newStatus;

    select.style.border = "2px solid #6c1d2c";
    setTimeout(() => {
      select.style.border = "";
    }, 1000);
  } catch (err) {
    alert("فشل التحديث: " + (err.message || err));
  } finally {
    select.disabled = false;
    select.style.opacity = 1;
  }
});

function statusLabel(s){ return {created:"جديد",ordered:"تم الطلب من المصنع",shipped:"تم الشحن",delivered:"وصلت"}[s] || s; }
function statusClass(s){ return {created:"s-created",ordered:"s-ordered",shipped:"s-shipped",delivered:"s-delivered"}[s] || "s-created"; }


// =====================================
// 🚀 Init + Autofill & UI Activation
// =====================================
route();
(function () {
  const emailInput   = document.getElementById('loginEmail');
  const emailWrap    = emailInput.closest('.input-wrap');
  const emailClear   = document.getElementById('clearEmail');

  const passInput    = document.getElementById('loginPassword');
  const passWrap     = passInput.closest('.input-wrap');
  const passToggle   = document.getElementById('togglePwd');
  const passClear    = document.getElementById('clearPwd');

  function bindInputState(input, wrap){
    const update = () => wrap.classList.toggle('has-value', !!input.value.trim());
    input.addEventListener('input', update);
    update(); // يدعم الـ autofill
  }

  bindInputState(emailInput, emailWrap);
  emailClear.addEventListener('click', () => {
    emailInput.value = '';
    emailInput.focus();
    emailWrap.classList.remove('has-value');
  });

  bindInputState(passInput, passWrap);
  passToggle.addEventListener('click', () => {
    const show = passInput.type === 'password';
    passInput.type = show ? 'text' : 'password';
    passToggle.textContent = show ? 'إخفاء' : 'إظهار';
    passInput.focus();
  });
  passClear.addEventListener('click', () => {
    passInput.value = '';
    passInput.type = 'password';
    passToggle.textContent = 'إظهار';
    passInput.focus();
    passWrap.classList.remove('has-value');
  });

  // 🔧 مهم: فعّل ظهور الأزرار فور التحميل (يعالج حالة الـAutofill)
  showPwdButtonsIfNeeded();
})();

// إغلاق مودال الأدمِن
(function(){
  const modal = document.getElementById('orderModal');
  modal?.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal__close')) {
      modal.hidden = true;
      document.documentElement.style.overflow = '';
    }
  });
  modal?.querySelector('[data-action="print"]')?.addEventListener('click', ()=>window.print());
})();

  // رقم التتبّع من: data-open أو data-id أو من الصف/أول خلية
  const tr = btn.closest('tr');
  const tracking =
    btn.dataset.open ||
    btn.dataset.id ||
    tr?.dataset.id ||
    tr?.cells?.[0]?.textContent?.trim();

  if (!tracking) { console.warn('Details: لا يوجد رقم تتبّع'); return; }
  openDetails(tracking);
});

// مودال واحد (detailsModal) يُستخدم للصفحتين
// مودال واحد (detailsModal) يُستخدم للصفحتين
async function openDetails(tracking) {
  try {
    // ابحث محليًا بدل window.*
    let r =
      (Array.isArray(myRows)    && myRows.find(x => x.tracking === tracking)) ||
      (Array.isArray(adminRows) && adminRows.find(x => x.tracking === tracking));

    // يلتقط زر التفاصيل سواء كان في "طلباتي" (data-open) أو "الإدارة" (.btn-details)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-open], .btn-details');
  if (!btn) return;
  e.preventDefault();
  
    // لو ما لقيناها محليًا، جيبها من Firestore باستخدام db المحلي
    if (!r) {
      const doc = await db.collection('orders').doc(tracking).get();
      if (doc.exists) r = { id: doc.id, ...doc.data() };
    }

function handleMissingDetails(r) {
    if (!r) { alert('تعذّر إيجاد تفاصيل هذا الطلب الآن.'); return; }
}

    // بناء HTML
    const items  = r.items || [];
    const qtySum = items.reduce((s, x) => s + (x.quantity || 0), 0);
    const rowsHtml = items.length
      ? items.map((it, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${it.itemCode || ''}</td>
            <td>${it.quantity ?? ''}</td>
            <td>${typeof it.price === 'number' ? it.price.toFixed(2) : (it.price ?? '')}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" class="muted">لا توجد أصناف.</td></tr>';

    const attachHtml = (r.attachments?.length)
      ? `<ul>${r.attachments.map(a => `<li><a href="${a.url}" target="_blank">${a.name}</a></li>`).join('')}</ul>`
      : `<div class="muted">لا توجد مرفقات.</div>`;

    const createdAtStr = fmtDate(r.createdAt, { withTime: true });

    const modal = document.getElementById('detailsModal');
    const body  = document.getElementById('detailsBody');

    body.innerHTML = `
      <div class="inv-head">
        <div class="inv-brand">
          <img src="img/pagelogo.png" alt="logo">
          <div>
            <div class="inv-title">طلب شراء</div>
            <div class="muted">رقم التتبّع: <b>${r.tracking}</b></div>
          </div>
        </div>
        <div style="margin-inline-start:auto;text-align:left">
          <div>الفرع: <b>${r.branch || '-'}</b></div>
          <div>التاريخ: ${createdAtStr}</div>
        </div>
      </div>

      <div class="inv-grid" style="margin:10px 0 14px">
        <div><b>اسم المشروع:</b> ${r.projectName || '-'}</div>
        <div><b>اسم العميل:</b> ${r.customerName || '-'}</div>
        <div><b>الحالة:</b> ${statusLabel(r.status || 'created')}</div>
      </div>

      <table class="table-like">
        <thead><tr><th>#</th><th>كود الصنف</th><th>الكمية</th><th>سعر البيع</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="2" class="total">إجمالي الكميات</td><td class="total">${qtySum}</td><td></td></tr></tfoot>
      </table>

      <div style="margin-top:10px">
        <b>المرفقات:</b>
        ${attachHtml}
      </div>
    `;

    modal.classList.add('show');
  } catch (err) {
    console.error('openDetails error:', err);
    alert('حدث خطأ أثناء فتح التفاصيل.');
  }
}


// إغلاق/طباعة مودال التفاصيل
(function(){
  const modal = document.getElementById('detailsModal');
  const closeBtn = document.getElementById('closeDetails');
  const printBtn = document.getElementById('printDetailsBtn');
  closeBtn && (closeBtn.onclick = () => modal.classList.remove('show'));
  modal?.querySelector('.backdrop')?.addEventListener('click', () => modal.classList.remove('show'));
  printBtn && (printBtn.onclick = () => window.print());
})();
