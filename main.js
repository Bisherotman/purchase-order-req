/***************************************************
 * 🔥 إعدادات Firebase
 ***************************************************/
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

/***************************************************
 * 🌐 دوال مساعدة + التوجيه بين الصفحات
 ***************************************************/
const $ = (s) => document.querySelector(s);
const routes = { "#/login":"view-login", "#/new":"view-new", "#/my":"view-my", "#/admin":"view-admin" };
const navLinks   = $("#navLinks");
const sessionBtn = $("#sessionBtn");
const AR_GREG    = 'ar-SA-u-ca-gregory-nu-latn';

function fmtDate(ts, {withTime=false}={}) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  try {
    return withTime
      ? d.toLocaleString(AR_GREG,{dateStyle:'medium',timeStyle:'short'})
      : d.toLocaleDateString(AR_GREG,{dateStyle:'medium'});
  } catch {
    return withTime
      ? d.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})
      : d.toLocaleDateString('en-GB',{dateStyle:'medium'});
  }
}
function setActive(hash){
  navLinks.querySelectorAll("a").forEach(a=>
    a.classList.toggle("active",a.getAttribute("href")==hash)
  );
}
function showMsg(el,text,type="success"){ el.textContent=text; el.className="msg "+type; el.style.display="block"; }
function hideMsg(el){ el.style.display="none"; }
function showView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}
function route(){
  const h = location.hash || "#/login";
  if (!currentUser && h!=="#/login"){ location.hash="#/login"; setActive("#/login"); showView("view-login"); return; }
  if (!canSeeAdmin && h==="#/admin"){ location.hash="#/new"; }
  const target = routes[location.hash] || "view-login";
  setActive(location.hash);
  showView(target);
}
window.addEventListener("hashchange",route);

/***************************************************
 * 🧩 الحالة العامة + تسجيل الدخول
 ***************************************************/
const loginForm = $("#loginForm"),
      loginMsg  = $("#loginMsg"),
      loginBtn  = $("#loginBtn");
const whoami = $("#whoami"), whoamiMy = $("#whoamiMy"), whoamiAdmin = $("#whoamiAdmin");
// عناصر صفحة "طلبــاتي"
const myBody         = document.getElementById('myOrdersBody');
const mySearch       = document.getElementById('mySearch');
const mySort         = document.getElementById('mySort');
const myFilterStatus = document.getElementById('myFilterStatus');

// عناصر صفحة "إدارة الطلبات"
const adminBody = document.getElementById('adminOrdersBody');

let currentUser = null, userProfile = null, canSeeAdmin = false;

const rememberCk = $("#rememberEmail");
const savedEmail = localStorage.getItem("savedEmail");
if (savedEmail){ $("#loginEmail").value=savedEmail; rememberCk.checked=true; showEmailClearIfNeeded(); }

function showEmailClearIfNeeded(){
  $("#clearEmail").style.display = $("#loginEmail").value.trim() ? "flex":"none";
}
$("#loginEmail").addEventListener("input",showEmailClearIfNeeded);
$("#clearEmail").onclick=()=>{ $("#loginEmail").value=""; $("#loginEmail").focus(); showEmailClearIfNeeded(); };

function showPwdButtonsIfNeeded(){
  const has = $("#loginPassword").value.length>0;
  $("#togglePwd").style.display = has ? "flex":"none";
  $("#clearPwd").style.display  = has ? "flex":"none";
}
$("#togglePwd").onclick=()=>{
  const f=$("#loginPassword");
  const show=f.type==="password";
  f.type = show?"text":"password";
  $("#togglePwd").textContent = show?"إخفاء":"إظهار";
};
$("#loginPassword").addEventListener("input",showPwdButtonsIfNeeded);
$("#clearPwd").onclick=()=>{ $("#loginPassword").value=""; $("#loginPassword").focus(); showPwdButtonsIfNeeded(); };

loginForm.addEventListener("submit",async e=>{
  e.preventDefault(); hideMsg(loginMsg); loginBtn.classList.add("loading");
  try{
    await auth.signInWithEmailAndPassword($("#loginEmail").value.trim(),$("#loginPassword").value);
    rememberCk.checked ? localStorage.setItem("savedEmail",$("#loginEmail").value.trim())
                       : localStorage.removeItem("savedEmail");
    showMsg(loginMsg,"تم تسجيل الدخول.","success");
  }catch(err){ showMsg(loginMsg,"خطأ: "+(err.message||err),"error"); }
  finally{ loginBtn.classList.remove("loading"); }
});
sessionBtn.addEventListener("click",e=>{ if(currentUser){ e.preventDefault(); auth.signOut(); } });

function displayNameOrEmail(u,p){ return (p && p.name) ? p.name : (u.displayName || u.email); }
document.getElementById("brandLink").addEventListener("click",e=>{
  e.preventDefault(); location.hash = currentUser ? "#/new" : "#/login";
});

auth.onAuthStateChanged(async user=>{
  currentUser = user;
  document.body.classList.toggle('auth-out',!user);
  document.body.classList.toggle('auth-in', !!user);

  if (!user){
    userProfile=null; canSeeAdmin=false;
    navLinks.querySelectorAll("[data-auth]").forEach(a=>a.style.display="none");
    sessionBtn.textContent="دخول"; sessionBtn.setAttribute("href","#/login");
    if (myUnsub){ myUnsub(); myUnsub=null; }
    if (location.hash!=="#/login") location.hash="#/login";
    showView("view-login"); setActive("#/login");
    return;
  }

  const snap=await db.collection("users").doc(user.uid).get();
  if (!snap.exists){ showMsg(loginMsg,"حسابك غير مهيأ.","error"); await auth.signOut(); return; }

  userProfile=snap.data();
  canSeeAdmin=!!userProfile.isAdmin || userProfile.branch==="HQ";

  const badge=`مرحباً، ${displayNameOrEmail(user,userProfile)} — الفرع: ${userProfile.branch}${canSeeAdmin?' — إدارة':''}`;
  $("#whoami").textContent=badge; $("#whoamiMy").textContent=badge; $("#whoamiAdmin").textContent=badge;

  navLinks.querySelectorAll("[data-auth]").forEach(a=>{
    const t=a.dataset.auth; a.style.display=(t==="user") ? "" : (canSeeAdmin ? "" : "none");
  });
  sessionBtn.textContent="خروج"; sessionBtn.setAttribute("href","#/login");

  if (location.hash==="#/login" || !location.hash) location.hash="#/new";
  route();
  subscribeMyOrders();
  if (canSeeAdmin) loadAdminOrders();
});

/***************************************************
 * 🆕 صفحة الطلب الجديد
 ***************************************************/
const branchCodes = { Riyadh:"RUH", Dammam:"DMM", Jeddah:"JED", Makkah:"MKK", Madina:"MED", HQ:"HQ" };
const pad5 = n => String(n).padStart(5,"0");

const itemsWrap=$("#itemsWrap"), addItemBtn=$("#addItemBtn");
function makeItemRow(values = {}) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input type="text" class="it-code" placeholder="كود الصنف" value="${values.itemCode || ""}">
    <input type="number" class="it-qty" min="1" step="1" placeholder="الكمية" value="${values.quantity || ""}">
    <input type="number" class="it-price" min="0" step="0.01" placeholder="سعر البيع" value="${values.price || ""}">
    <select class="it-ship" required>
      <option value="">اختر نوع الشحن</option>
      <option value="Sea freight">Sea freight</option>
      <option value="DHL freight">DHL freight</option>
      <option value="Air freight">Air freight</option>
    </select>
    <button type="button" class="remove">🗑</button>
  `;
  row.querySelector(".remove").onclick = () => row.remove();
  return row;}

function ensureAtLeastOneRow() {
  if (!itemsWrap.children.length) {
    itemsWrap.appendChild(makeItemRow());
  }
}
addItemBtn.onclick = () => itemsWrap.appendChild(makeItemRow());

const linksWrap  = $("#linksWrap");
const addLinkBtn = $("#addLinkBtn");

function makeLinkRow(values = {}) {
  const r = document.createElement("div");
  r.className = "link-row";
  r.innerHTML = `
    <input class="ln-name" placeholder="اسم المرفق (مثال: عرض سعر)" value="${values.name || ""}">
    <input class="ln-url"  placeholder="https://example.com/file.pdf" value="${values.url  || ""}">
    <button type="button" class="remove">🗑</button>`;
  r.querySelector(".remove").onclick = () => {
    r.remove();
    if (linksWrap.children.length < 3) addLinkBtn.disabled = false;
  };
  return r;
}
addLinkBtn.onclick = () => {
  if (linksWrap.children.length >= 3) return;
  linksWrap.appendChild(makeLinkRow());
  if (linksWrap.children.length >= 3) addLinkBtn.disabled = true;
};

const newMsg         = $("#newMsg");
const submitOrderBtn = $("#submitOrder");
// زر الإرسال – مستمع وحيد
submitOrderBtn.addEventListener("click", async () => {
  hideMsg(newMsg);

  if (!confirm("هل أنت متأكد أنك تريد إرسال الطلب؟")) return;
  if (!currentUser || !userProfile) {
    showMsg(newMsg, "يجب تسجيل الدخول أولاً.", "error");
    return;
  }

  const projectName  = $("#projectName").value.trim();
  const customerName = $("#customerName").value.trim();
  if (!projectName)  { showMsg(newMsg, "يرجى إدخال اسم المشروع", "error"); return; }
  if (!customerName) { showMsg(newMsg, "يرجى إدخال اسم العميل", "error"); return; }

  const itemRows = [...itemsWrap.querySelectorAll(".item-row")];
  for (let i = 0; i < itemRows.length; i++) {
    const row  = itemRows[i];
    const code = row.querySelector(".it-code")?.value.trim();
    const qty  = row.querySelector(".it-qty")?.value;
    const price= row.querySelector(".it-price")?.value;
    const ship = row.querySelector(".it-ship")?.value;
    if (!code || !qty || !price || !ship) {
      showMsg(newMsg, `يرجى تعبئة جميع الحقول في الصنف رقم ${i + 1}`, "error");
      return;
    }
  }

  if (linksWrap.children.length === 0) {
    showMsg(newMsg, "يجب إضافة مرفق واحد على الأقل", "error");
    return;
  }
  for (let i = 0; i < linksWrap.children.length; i++) {
    const r = linksWrap.children[i];
    const name = r.querySelector(".ln-name")?.value.trim();
    const url  = r.querySelector(".ln-url")?.value.trim();
    if (!name || !url) {
      showMsg(newMsg, `يرجى تعبئة اسم ورابط المرفق رقم ${i + 1}`, "error");
      return;
    }
  }

  const items = [...itemsWrap.querySelectorAll(".item-row")].map(r => ({
    itemCode:     r.querySelector(".it-code").value.trim(),
    quantity:     Number(r.querySelector(".it-qty").value),
    price:        Number(r.querySelector(".it-price").value),
    shippingType: r.querySelector(".it-ship")?.value || "",
    status:       "created",
    deliveredQty: 0
  }));

  if (items.length === 0) {
    showMsg(newMsg, "أضف صنفًا واحدًا على الأقل بشكل صحيح.", "error");
    return;
  }

  if (linksWrap.children.length > 3) {
    showMsg(newMsg, "مسموح بثلاث مرفقات كحد أقصى.", "error");
    return;
  }

  const attachments = [...linksWrap.querySelectorAll(".link-row")].map(r => {
    const name = (r.querySelector(".ln-name").value || "ملف").trim();
    const url  = r.querySelector(".ln-url").value.trim();
    return url ? { name, url } : null;
  }).filter(Boolean);

  // 🔥 تنفيذ العملية
  submitOrderBtn.classList.add("loading");
  submitOrderBtn.disabled = true;

  try {
    const branch = userProfile.branch;
    const code   = branchCodes[branch] || "UNK";
    const counterRef = db.collection("counters").doc(branch);
    const seq = await db.runTransaction(async (tx) => {
      const s = await tx.get(counterRef);
      let next = 1;
      if (s.exists) next = (s.data().next || 1);
      tx.set(counterRef, { next: next + 1 }, { merge: true });
      return next;
    });
    const tracking = code + pad5(seq);

    await db.collection("orders").doc(tracking).set({
      tracking,
      branch,
      projectName,
      customerName,
      items,
      attachments,
      createdBy: currentUser.uid,
      createdByEmail: currentUser.email || "",
      status: "created",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // إعادة الضبط
    showMsg(newMsg, `تم تسجيل الطلب. رقم التتبّع: ${tracking}`, "success");
    $("#projectName").value  = "";
    $("#customerName").value = "";
    itemsWrap.innerHTML      = "";
    ensureAtLeastOneRow();
    linksWrap.innerHTML      = "";
    addLinkBtn.disabled      = false;

    subscribeMyOrders();
    if (canSeeAdmin) loadAdminOrders();

  } catch (err) {
    console.error(err);
    showMsg(newMsg, "خطأ أثناء الإرسال: " + (err.message || err), "error");
  } finally {
    submitOrderBtn.classList.remove("loading");
    submitOrderBtn.disabled = false;
  }
});
  
// تسميات الحالة + كلاس
function statusLabel(s) {
  return {
    created:   "جديد",
    ordered:   "تم الطلب من المصنع",
    shipped:   "تم الشحن",
    partial:   "وصلت جزئياً",
    delivered: "وصلت بالكامل"
  }[s] || s || "غير معروف";
}

function statusClass(s) {
  return {
    created:   "s-created",
    ordered:   "s-ordered",
    shipped:   "s-shipped",
    partial:   "s-partial",
    delivered: "s-delivered"
  }[s] || "s-created";
}


/* ✅ تم التعديل هنا ليطابق جدول الإدارة لكن بلا أي تعديل حالة */
function renderMy(rows){
  // فلترة
  const selectedStatus=(myFilterStatus?.value||"").trim();
  if (selectedStatus) rows = rows.filter(r=>(r.status||"")===selectedStatus);

  // بحث
  const term=(mySearch.value||"").trim().toLowerCase();
  rows = rows.filter(r=>{
    if(!term) return true;
    const inTracking=(r.tracking||"").toLowerCase().includes(term);
    const inProj=(r.projectName||"").toLowerCase().includes(term);
    const inCust=(r.customerName||"").toLowerCase().includes(term);
    const inItems=(r.items||[]).some(it=>(it.itemCode||"").toLowerCase().includes(term));
    return inTracking || inProj || inCust || inItems;
  });

  // ترتيب
  rows.sort((a,b)=> mySort.value==="createdAt_desc"
    ? (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0)
    : (a.createdAt?.toMillis?.()||0) - (b.createdAt?.toMillis?.()||0));

  // رسم الصفوف بأسلوب الإدارة لكن بلا select
  myBody.innerHTML = rows.map(r=>{
    const total = r.items?.reduce((sum,x)=>sum+(x.price||0),0) || "";
    return `
      <tr data-tracking="${r.tracking}">
        <td>${r.tracking}</td>
        <td>${fmtDate(r.createdAt)}</td>
        <td>${r.projectName || "-"}</td>
        <td>${displayNameOrEmail({email:r.createdByEmail||""}, {})}</td>
        <td><span class="status ${statusClass(r.status)}">${statusLabel(r.status)}</span></td>
        <td>${typeof total==="number" ? total.toFixed(2) : total}</td>
        <td style="white-space:nowrap;text-align:left;">
          <button type="button" class="btn-details btn-sm" data-admin="${r.tracking}">🗂️</button>
        </td>
      </tr>`;
  }).join("");
}

mySearch.addEventListener("input",()=>renderMy(myRows));
mySort.addEventListener("change",()=>renderMy(myRows));
myFilterStatus.addEventListener("change",()=>renderMy(myRows));

/***************************************************
 * 🖨️ تفاصيل الطلب (مشترك بين الصفحات)
 ***************************************************/
document.addEventListener('click', async e=>{
  const btn = e.target.closest('[data-open], .btn-details');
  if (!btn) return;
  e.preventDefault();
  const tr = btn.closest('tr');
  const tracking = btn.dataset.open || btn.dataset.id || tr?.dataset.tracking;
  if (!tracking) return;
  openDetails(tracking);
});

(function(){
  const modal = document.getElementById('detailsModal');
  document.getElementById('closeDetails').onclick = ()=> modal.classList.remove('show');
  modal.querySelector('.backdrop')?.addEventListener('click',()=>modal.classList.remove('show'));
  document.getElementById('printDetailsBtn').onclick = ()=> window.print();
})();

async function openDetails(tracking) {
  try {
    let r =
      (Array.isArray(myRows)    && myRows.find(x => x.tracking === tracking)) ||
      (Array.isArray(adminRows) && adminRows.find(x => x.tracking === tracking));

    if (!r) {
      const doc = await db.collection('orders').doc(tracking).get();
      if (doc.exists) r = { id: doc.id, ...doc.data() };
    }

    if (!r) { alert('تعذّر إيجاد تفاصيل هذا الطلب.'); return; }

    const items = r.items || [];
    const qtySum = items.reduce((s, x) => s + (x.quantity || 0), 0);
    const createdAtStr = fmtDate(r.createdAt, { withTime: true });

    const rowsHtml = items.length
      ? items.map((it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${it.itemCode || '-'}</td>
          <td>${it.quantity ?? '-'}</td>
          <td>${typeof it.price === 'number' ? it.price.toFixed(2) : (it.price || '-')}</td>
          <td>${it.shippingType || '-'}</td>
        </tr>`).join('')
      : `<tr><td colspan="5" class="muted">لا توجد أصناف</td></tr>`;

    const attachHtml = (r.attachments?.length)
      ? `<ul>${r.attachments.map(a => `<li><a href="${a.url}" target="_blank">${a.name}</a></li>`).join('')}</ul>`
      : `<div class="muted">لا توجد مرفقات</div>`;

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
        <thead><tr><th>#</th><th>كود الصنف</th><th>الكمية</th><th>السعر</th><th>الشحن</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="2" class="total">الإجمالي</td><td class="total">${qtySum}</td><td colspan="2"></td></tr></tfoot>
      </table>

      <div style="margin-top:10px">
        <b>المرفقات:</b>
        ${attachHtml}
      </div>
    `;

    modal.classList.add('show');
  } catch (err) {
    console.error("openDetails error:", err);
    alert("فشل تحميل تفاصيل الطلب.");
  }
}

/***************************************************
 * 🚀 تشغيل أولي
 ***************************************************/
// 🟢 جلب طلبات المستخدم (تحديث مباشر)
let myUnsub = null;
let myRows  = [];   // مصفوفة الطلبات الخاصة بالمستخدم

function subscribeMyOrders() {
  // إذا كان هناك اشتراك قديم، نفصله
  if (myUnsub) { myUnsub(); myUnsub = null; }

  // نتأكد أن المستخدم مسجّل دخول
  if (!currentUser) return;

  // الاشتراك في أوامر المستخدم الحالي
  myUnsub = db.collection("orders")
    .where("createdBy", "==", currentUser.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      myRows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderMy(myRows);   // موجودة مسبقاً – ترسم جدول "طلبــاتي"
    }, (err) => {
      console.error("subscribeMyOrders error:", err);
      showMsg(newMsg, "تعذّر تحميل الطلبات. حاول لاحقاً.", "error");
    });
}

// 🟢 جلب كل الطلبات لصفحة الإدارة
let adminUnsub = null;
let adminRows  = [];

function loadAdminOrders() {
  if (adminUnsub) { adminUnsub(); adminUnsub = null; }
  if (!currentUser || !canSeeAdmin) return;

  adminUnsub = db.collection("orders")
    .orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      adminRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // إن كانت عندك دالة لعرض جدول الإدارة استدعها هنا:
      // renderAdmin(adminRows);
      renderAdmin(adminRows);
    }, (err) => {
      console.error("loadAdminOrders error:", err);
      showMsg(newMsg, "تعذّر تحميل طلبات الإدارة. حاول لاحقاً.", "error");
    });
}
function renderAdmin(rows){
  adminBody.innerHTML = rows.map(r=>{
    const total = r.items?.reduce((sum,x)=>sum+(x.price||0),0) || "";
    return `
      <tr data-tracking="${r.tracking}">
        <td>${r.tracking}</td>
        <td>${fmtDate(r.createdAt)}</td>
        <td>${r.projectName || "-"}</td>
        <td>${displayNameOrEmail({email:r.createdByEmail||""}, {})}</td>
        <td><span class="status ${statusClass(r.status)}">${statusLabel(r.status)}</span></td>
        <td>${typeof total==="number" ? total.toFixed(2) : total}</td>
        <td><button type="button" class="btn-details btn-sm" data-id="${r.tracking}">🗂️</button></td>
      </tr>`;
  }).join("");
}

const rowsHtml = (r.items || []).map((it, idx) => `
  <tr>
    <td>${idx + 1}</td>
    <td>${it.itemCode || '-'}</td>
    <td>${it.quantity ?? '-'}</td>
    <td>${typeof it.price === 'number' ? it.price.toFixed(2) : (it.price || '-')}</td>
    <td>${it.shippingType || '-'}</td>
    <td>
      <select class="item-status" data-index="${idx}" data-id="${r.tracking}">
        <option value="created"   ${it.status==='created'?'selected':''}>جديد</option>
        <option value="ordered"   ${it.status==='ordered'?'selected':''}>تم الطلب من المصنع</option>
        <option value="shipped"   ${it.status==='shipped'?'selected':''}>تم الشحن</option>
        <option value="partial"   ${it.status==='partial'?'selected':''}>وصلت جزئياً</option>
        <option value="delivered" ${it.status==='delivered'?'selected':''}>وصلت بالكامل</option>
      </select>
    </td>
  </tr>`).join('');
document.getElementById('m_items').innerHTML = rowsHtml;

document.querySelectorAll('.item-status').forEach(sel=>{
  sel.addEventListener('change', async e=>{
    const idx = e.target.dataset.index;
    const orderId = e.target.dataset.id;
    const newStatus = e.target.value;

    await db.collection('orders').doc(orderId)
      .update({ [`items.${idx}.status`]: newStatus });

    await updateOrderStatus(orderId);
  });
});

async function updateOrderStatus(orderId){
  const snap = await db.collection("orders").doc(orderId).get();
  const items = snap.data().items || [];
  const statuses = items.map(i => i.status);

  let overall;
  if (statuses.every(s => s === 'delivered')) {
    overall = 'delivered';
  } else if (statuses.some(s => s === 'partial' || s === 'delivered')) {
    overall = 'partial';
  } else if (statuses.every(s => s === 'shipped')) {
    overall = 'shipped';
  } else if (statuses.every(s => s === 'ordered')) {
    overall = 'ordered';
  } else {
    overall = 'created';
  }

  await db.collection("orders").doc(orderId).update({ status: overall });
}

// 🔵 فتح مودال الإدارة الجديد عند الضغط على زر التفاصيل
document.addEventListener('click', async e=>{
  const btn = e.target.closest('[data-admin]');
  if (!btn) return;
  e.preventDefault();
  const tracking = btn.dataset.admin;
  openAdminModal(tracking);   // ← تأكّد أن دالة openAdminModal موجودة
});

ensureAtLeastOneRow();
route();
