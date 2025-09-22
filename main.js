
// إعدادات Firebase
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

// دوال مساعدة
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const AR_GREG = 'ar-SA-u-ca-gregory-nu-latn';


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

function showMsg(el,text,type="success"){ el.textContent=text; el.className="msg "+type; el.style.display="block"; }
function hideMsg(el){ el.style.display="none"; }
function displayNameOrEmail(u,p){ return (p && p.name) ? p.name : (u.displayName || u.email); }
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

// التوجيه بين الصفحات
const routes = { "#/login":"view-login", "#/new":"view-new", "#/my":"view-my", "#/admin":"view-admin" };
const navLinks   = $("#navLinks");
const sessionBtn = $("#sessionBtn");
function setActive(hash){
  navLinks.querySelectorAll("a").forEach(a=>
    a.classList.toggle("active",a.getAttribute("href")==hash)
  );
}
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

// الحالة العامة + تسجيل الدخول
let currentUser = null, userProfile = null, canSeeAdmin = false;
const loginForm = $("#loginForm"),
      loginMsg  = $("#loginMsg"),
      loginBtn  = $("#loginBtn");
const whoami = $("#whoami"), whoamiMy = $("#whoamiMy"), whoamiAdmin = $("#whoamiAdmin");
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

// صفحة الطلب الجديد
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
  return row;
}
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
    }, { merge: true });
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

// جدول طلباتي
const myBody         = document.getElementById('myOrdersBody');
const mySearch       = document.getElementById('mySearch');
const mySort         = document.getElementById('mySort');
const myFilterStatus = document.getElementById('myFilterStatus');

function renderMy(rows) {
  const selectedStatus = (myFilterStatus?.value || "").trim();
  if (selectedStatus) rows = rows.filter(r => (r.status || "") === selectedStatus);
  const term = (mySearch.value || "").trim().toLowerCase();
  rows = rows.filter(r => {
    if (!term) return true;
    const inTracking = (r.tracking || "").toLowerCase().includes(term);
    const inProj = (r.projectName || "").toLowerCase().includes(term);
    const inCust = (r.customerName || "").toLowerCase().includes(term);
    const inItems = (r.items || []).some(it => (it.itemCode || "").toLowerCase().includes(term));
    return inTracking || inProj || inCust || inItems;
  });
  rows.sort((a, b) => mySort.value === "createdAt_desc"
    ? (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
    : (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  myBody.innerHTML = rows.map(r => {
    const itemsArr = Array.isArray(r.items) ? r.items : [];
    const total = itemsArr.length
      ? itemsArr.reduce((sum, x) => sum + (x.price || 0), 0)
      : 0;
    return `
      <tr data-tracking="${r.tracking}">
        <td>${r.tracking}</td>
        <td>${fmtDate(r.createdAt)}</td>
        <td>${r.projectName || "-"}</td>
        <td>${displayNameOrEmail({ email: r.createdByEmail || "" }, r.createdByUserProfile)}</td>
        <td><span class="status ${statusClass(r.status)}">${statusLabel(r.status)}</span></td>
        <td>${typeof total === "number" ? total.toFixed(2) : total}</td>
        <td style="white-space:nowrap;text-align:left;">
          <button type="button" class="btn-admin-details btn-sm" data-open="${r.tracking}">🗂️</button>
        </td>
      </tr>`;
  }).join("");
}

mySearch.addEventListener("input", () => renderMy(myRows));
mySort.addEventListener("change", () => renderMy(myRows));
myFilterStatus.addEventListener("change", () => renderMy(myRows));

// جلب طلبات المستخدم (معدل لجلب بيانات المستخدمين)
let myUnsub = null;
let myRows = [];
function subscribeMyOrders() {
  if (myUnsub) { myUnsub(); myUnsub = null; }
  if (!currentUser ) return;
  myUnsub = db.collection("orders")
    .where("createdBy", "==", currentUser .uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(async (snap) => {
      const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // جمع كل userId المستخدمين (للمستخدم الحالي فقط، عادةً userId واحد)
      const userIds = [...new Set(orders.map(o => o.createdBy))];
      const userPromises = userIds.map(uid => db.collection("users").doc(uid).get());
      const userSnaps = await Promise.all(userPromises);

      // خريطة المستخدمين
      const usersMap = userSnaps.reduce((acc, doc) => {
        if (doc.exists) acc[doc.id] = doc.data();
        return acc;
      }, {});

      // دمج بيانات المستخدمين مع الطلبات
      myRows = orders.map(order => ({
        ...order,
        createdByUserProfile: usersMap[order.createdBy] || null  // camelCase بدون مسافة
      }));

      renderMy(myRows);
    }, (err) => {
      console.error("subscribeMyOrders error:", err);
      showMsg(newMsg, "تعذّر تحميل الطلبات. حاول لاحقاً.", "error");
    });
}

// جلب كل الطلبات لصفحة الإدارة (معدل ليكون async ويجلب بيانات المستخدمين)
let adminUnsub = null;
let adminRows = [];
const adminBody = document.getElementById('adminOrdersBody');
function loadAdminOrders() {
  if (adminUnsub) { adminUnsub(); adminUnsub = null; }
  if (!currentUser  || !canSeeAdmin) return;

  adminUnsub = db.collection("orders")
    .orderBy("createdAt", "desc")
    .onSnapshot(async (snap) => {
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // جمع كل userId المستخدمين
      const userIds = [...new Set(orders.map(o => o.createdBy))];
      const userPromises = userIds.map(uid => db.collection("users").doc(uid).get());
      const userSnaps = await Promise.all(userPromises);

      // خريطة المستخدمين
      const usersMap = userSnaps.reduce((acc, doc) => {
        if (doc.exists) acc[doc.id] = doc.data();
        return acc;
      }, {});

      // دمج بيانات المستخدمين مع الطلبات
      adminRows = orders.map(order => ({
        ...order,
        createdByUserProfile: usersMap[order.createdBy] || null  // camelCase بدون مسافة
      }));

      renderAdmin(adminRows);
    }, (err) => {
      console.error("loadAdminOrders error:", err);
    });
}

function renderAdmin(rows) {
  adminBody.innerHTML = rows.map(r => {
    const itemsArr = Array.isArray(r.items) ? r.items : [];
    const total = itemsArr.reduce((sum, x) => sum + (x.price || 0), 0);
    return `
      <tr data-tracking="${r.tracking}">
        <td>${r.tracking}</td>
        <td>${fmtDate(r.createdAt)}</td>
        <td>${r.projectName || "-"}</td>
        <td>${displayNameOrEmail({ email: r.createdByEmail || "" }, r.createdByUserProfile)}</td>
        <td><span class="status ${statusClass(r.status)}">${statusLabel(r.status)}</span></td>
        <td>${typeof total === "number" ? total.toFixed(2) : total}</td>
        <td><button type="button" class="btn-admin-details btn-sm" data-admin="${r.tracking}">🗂️</button></td>
      </tr>`;
  }).join("");
}

async function updateOrderInDB(tracking, data) {
  return db.collection("orders").doc(tracking).update(data);
}

// دالة لحساب الحالة العامة للطلب (معدلة لتأخذ deliveredQty بعين الاعتبار، وnote كـ deliveredQty)
function calcOrderStatus(items) {
  const statuses = items.map(it => it.status || 'created');
  const deliveredQtys = items.map(it => (it.deliveredQty || it.note || 0)); // note يُعامل كـ deliveredQty
  const quantities = items.map(it => it.quantity || 0);
  const hasPartialDelivery = items.some((it, i) => (deliveredQtys[i] > 0) && (deliveredQtys[i] < quantities[i]));

  if (statuses.every(s => s === 'delivered') && !hasPartialDelivery) return 'delivered';
  if (statuses.some(s => s === 'partial' || s === 'delivered') || hasPartialDelivery) return 'partial';
  if (statuses.every(s => s === 'shipped')) return 'shipped';
  if (statuses.every(s => s === 'ordered')) return 'ordered';
  return 'created';
}

// دالة تصدير CSV (كما هي، صحيحة)
function exportCurrentOrderToCSV() {
  if (!window.currentOrder) return;
  const order = window.currentOrder;
  const rows = order.items || [];
  let csv = 'كود الصنف,الكمية,السعر,الشحن,الحالة,الرقم الجزئي\n';
  rows.forEach(it => {
    csv += [
      it.itemCode || '',
      it.quantity || '',
      it.price || '',
      it.shippingType || '',
      statusLabel(it.status || 'created'),
      it.note || ''
    ].map(field => `"${field}"`).join(',') + '\n';
  });
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `order-${order.tracking}.csv`;
  link.click();
}

// دالة موحدة لفتح المودال (معدلة لاستخدام pendingChangesMap وتحديث فوري للحالة الخارجية)
async function openOrderModal(tracking, options = {}) {
  const { readonly = false } = options;
  console.log('openOrderModal called', tracking, 'readonly:', readonly);

  try {
    // جلب الطلب من Firestore أو الذاكرة
    let order = null;
    const snap = await db.collection('orders').doc(tracking).get();
    if (snap.exists) {
      order = { id: snap.id, ...snap.data() };
    } else {
      order = (Array.isArray(myRows) && myRows.find(x => x.tracking === tracking)) ||
              (Array.isArray(adminRows) && adminRows.find(x => x.tracking === tracking));
    }
    if (!order) {
      alert('تعذّر إيجاد تفاصيل هذا الطلب.');
      return;
    }

    window.currentOrder = order;

    // إعادة تهيئة المودال (إخفاء الرسائل والأزرار في البداية)
    const confirmBtn = document.getElementById('confirmAdminChanges');
    const msgBox = document.getElementById('adminConfirmMsg');
    if (confirmBtn) {
      confirmBtn.style.display = 'none';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'تأكيد العملية';
      confirmBtn.classList.remove('loading');
    }
    if (msgBox) {
      msgBox.style.display = 'none';
      msgBox.textContent = '';
    }

    // تعيين البيانات الأساسية
    document.getElementById('m_id').textContent = order.tracking || '-';
    document.getElementById('m_date').textContent = fmtDate(order.createdAt, { withTime: true }) || '-';
    document.getElementById('m_project').textContent = order.projectName || '-';
    document.getElementById('m_customer').textContent = order.customerName || '-';
    let userName = order.createdByEmail || '-';
    if (order.createdBy) {
      try {
        const userSnap = await db.collection('users').doc(order.createdBy).get();
        if (userSnap.exists) {
          userName = userSnap.data().name || order.createdByEmail || '-';
        }
      } catch (err) {
        console.error('Error fetching user name:', err);
      }
    }
    document.getElementById('m_user').textContent = userName;
    document.getElementById('m_status').textContent = statusLabel(order.status || 'created');
    const total = (order.items || []).reduce((sum, x) => sum + (Number(x.price) || 0), 0);
    document.getElementById('m_total').textContent = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // حساب إجمالي الكمية (يمكن إضافته في HTML إذا مطلوب، مثل <span id="m_qty">...</span>)
    const qtySum = (order.items || []).reduce((sum, x) => sum + (x.quantity || 0), 0);
    const qtyEl = document.getElementById('m_qty'); // إذا موجود في HTML
    if (qtyEl) qtyEl.textContent = qtySum.toLocaleString('en-US');

    // بناء جدول الأصناف
    const items = Array.isArray(order.items) ? order.items : [];
    const rowsHtml = items.map((it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${it.itemCode || '-'}</td>
        <td>${typeof it.quantity === 'number' ? it.quantity.toLocaleString('en-US') : (it.quantity || '-')}</td>
        <td>${typeof it.price === 'number' ? it.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (it.price || '-')}</td>
        <td>${it.shippingType || '-'}</td>
        <td>
          ${readonly ? 
            `<span class="status-display">${statusLabel(it.status || 'created')} ${it.note ? ` (<span class="note-display">${it.note}</span>)` : ''}</span>` :
            `
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="status-display">${statusLabel(it.status || 'created')} ${it.note ? ` (<span class="note-display">${it.note}</span>)` : ''}</span>
                <select class="item-status" data-index="${idx}" style="width:140px; display:none;">
                  <option value="created" ${it.status === 'created' ? 'selected' : ''}>جديد</option>
                  <option value="ordered" ${it.status === 'ordered' ? 'selected' : ''}>تم الطلب من المصنع</option>
                  <option value="shipped" ${it.status === 'shipped' ? 'selected' : ''}>تم الشحن</option>
                  <option value="partial" ${it.status === 'partial' ? 'selected' : ''}>وصلت جزئياً</option>
                  <option value="delivered" ${it.status === 'delivered' ? 'selected' : ''}>وصلت بالكامل</option>
                </select>
                <input type="number" class="manual-status" data-index="${idx}" style="display:none; width:60px; margin-top:4px;" placeholder="رقم جزئي" value="${it.note || ''}">
                <button type="button" class="btn-edit-note" data-index="${idx}" title="تعديل">✏️</button>
              </div>
            `
          }
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="muted">لا توجد أصناف</td></tr>';

    const tbody = document.getElementById('m_items');
    if (tbody) tbody.innerHTML = rowsHtml;

    // عرض المرفقات (يتطلب #attachmentsSection في HTML)
    const attachments = Array.isArray(order.attachments) ? order.attachments : [];
    const attachHtml = attachments.length 
      ? `<ul style="list-style: none; padding: 0;">${attachments.map(a => `<li style="margin: 0.5rem 0;"><a href="${a.url}" target="_blank" style="color: #007bff; text-decoration: none;">📎 ${a.name}</a></li>`).join('')}</ul>`
      : '<div class="muted">لا توجد مرفقات</div>';
    const attachSection = document.getElementById('attachmentsSection');
    if (attachSection) {
      attachSection.innerHTML = `<h4>المرفقات:</h4> ${attachHtml}`;
    }

    // إخفاء/إظهار أزرار التعديل بناءً على readonly
    const editButtons = document.querySelectorAll('.btn-edit-note');
    editButtons.forEach(btn => btn.style.display = readonly ? 'none' : 'inline-block');

    // إعدادات التعديل (فقط إذا لم يكن readonly)
    let pendingChangesMap = {}; // { idx: { status: value, note: value } } - object لتجنب التكرار
    if (!readonly) {
      // إعداد زر التأكيد (مع loading state)
      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          if (confirmBtn.disabled) return; // منع النقر المتعدد

          const msgBox = document.getElementById('adminConfirmMsg');
          if (msgBox) {
            msgBox.style.display = 'none';
            msgBox.textContent = '';
          }

          // Loading state
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'جاري التحديث...';
          confirmBtn.classList.add('loading');

          try {
            // تطبيق التغييرات من pendingChangesMap
            for (const idx in pendingChangesMap) {
              const changes = pendingChangesMap[idx];
              for (const field in changes) {
                order.items[idx][field] = changes[field];
                // ربط note بـ deliveredQty للحساب الجزئي
                if (field === 'note') {
                  order.items[idx].deliveredQty = Number(changes[field]) || 0;
                }
              }
            }

            // حساب الحالة العامة الجديدة من الأصناف (هذا اللي يخلي الحالة الخارجية متل الداخلية)
            const newStatus = calcOrderStatus(order.items);

            // حفظ في Firestore
            await updateOrderInDB(order.tracking, { items: order.items, status: newStatus });

            // تحديث فوري للجداول الخارجية محلياً (بدون إعادة اشتراك كاملة للسرعة)
            if (Array.isArray(myRows)) {
              const myOrderIndex = myRows.findIndex(row => row.tracking === order.tracking);
              if (myOrderIndex !== -1) {
                myRows[myOrderIndex] = { ...myRows[myOrderIndex], items: order.items, status: newStatus };
                renderMy(myRows); // إعادة رسم "طلباتي" مع الحالة الجديدة فوراً
              }
            }
            if (Array.isArray(adminRows)) {
              const adminOrderIndex = adminRows.findIndex(row => row.tracking === order.tracking);
              if (adminOrderIndex !== -1) {
                adminRows[adminOrderIndex] = { ...adminRows[adminOrderIndex], items: order.items, status: newStatus };
                renderAdmin(adminRows); // إعادة رسم "إدارة الطلبات" مع الحالة الجديدة فوراً
              }
            }

            // تحديث الحالة في المودال نفسه
            document.getElementById('m_status').textContent = statusLabel(newStatus);

            // رسالة نجاح
            if (msgBox) {
              msgBox.textContent = `تم تغيير حالة الأصناف بنجاح. الحالة العامة الجديدة: ${statusLabel(newStatus)}`;
              msgBox.className = 'msg success';
              msgBox.style.display = 'block';
            }

            // مسح التغييرات
            pendingChangesMap = {};

            // إخفاء زر التأكيد
            if (confirmBtn) confirmBtn.style.display = 'none';

            // إغلاق المودال بعد 2 ثواني
            setTimeout(() => {
              const modal = document.getElementById('orderModal');
              if (modal) {
                modal.classList.remove('show');
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
              }
            }, 2000);

          } catch (err) {
            console.error(err);
            if (msgBox) {
              msgBox.textContent = 'حدث خطأ أثناء التحديث: ' + (err.message || err);
              msgBox.className = 'msg error';
              msgBox.style.display = 'block';
            }
          } finally {
            // إعادة تهيئة الزر
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'تأكيد العملية';
            confirmBtn.classList.remove('loading');
          }
        };
      }

      // Event Delegation على tbody للتعديلات (مرة واحدة فقط، أفضل أداء)
      const tbody = document.getElementById('m_items');
      if (tbody && !tbody.dataset.delegationAdded) {
        tbody.dataset.delegationAdded = 'true';

        // تغيير الحالة (select)
        tbody.addEventListener('change', e => {
          if (e.target.classList.contains('item-status')) {
            const idx = parseInt(e.target.dataset.index);
            const val = e.target.value;
            if (!pendingChangesMap[idx]) pendingChangesMap[idx] = {};
            pendingChangesMap[idx].status = val;

            // إظهار/إخفاء الـ note input بناءً على الحالة
            const input = document.querySelector(`.manual-status[data-index="${idx}"]`);
            const editBtn = document.querySelector(`.btn-edit-note[data-index="${idx}"]`);
            if (val === 'shipped' || val === 'partial') {
              if (input) input.style.display = 'inline-block';
              if (editBtn) editBtn.style.display = 'inline-block';
            } else {
              if (input) input.style.display = 'none';
              if (editBtn) editBtn.style.display = 'none';
            }

            // إظهار زر التأكيد
            if (confirmBtn) confirmBtn.style.display = 'inline-block';
          }
        });

        // إدخال الـ note (input)
        tbody.addEventListener('input', e => {
          if (e.target.classList.contains('manual-status')) {
            const idx = parseInt(e.target.dataset.index);
            const val = e.target.value;
            if (!pendingChangesMap[idx]) pendingChangesMap[idx] = {};
            pendingChangesMap[idx].note = val;

            // إظهار زر التأكيد
            if (confirmBtn) confirmBtn.style.display = 'inline-block';
          }
        });

        // نقر زر التعديل (btn-edit-note)
        tbody.addEventListener('click', e => {
          if (e.target.classList.contains('btn-edit-note')) {
            const idx = parseInt(e.target.dataset.index);
            const select = document.querySelector(`.item-status[data-index="${idx}"]`);
            const input = document.querySelector(`.manual-status[data-index="${idx}"]`);
            const display = e.target.closest('td').querySelector('.status-display');

            if (display) display.style.display = 'none';
            if (select) select.style.display = 'inline-block';
            if (input) input.style.display = 'inline-block';
            e.target.style.display = 'none';

            // إظهار زر التأكيد
            if (confirmBtn) confirmBtn.style.display = 'inline-block';
          }
        });
      }
    } else {
      // للـ readonly، أخفِ زر التأكيد
      if (confirmBtn) confirmBtn.style.display = 'none';
    }

    // ✅ عرض المودال فعليًا (دائماً في النهاية)
    const modal = document.getElementById('orderModal');
    if (modal) {
      modal.classList.add('show');
      modal.style.display = 'grid';
      modal.setAttribute('aria-hidden', 'false');
      modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

  } catch (err) {
    console.error('openOrderModal error:', err);
    alert('فشل في تحميل تفاصيل الطلب');
  }
} 

// Event listeners للأزرار 🗂️ (لفتح المودال)
document.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-admin-details');
  if (!btn) return;
  e.preventDefault();
  const tracking = btn.dataset.admin || btn.dataset.open;
  if (tracking) {
    const readonly = !!btn.dataset.open;  // readonly لـ "طلباتي"، editable للإدارة
    await openOrderModal(tracking, { readonly });
  }
});

// Event listener للتصدير (إذا كان فيه زر #exportExcel في HTML داخل المودال)
document.addEventListener('click', e => {
  if (e.target.id === 'exportExcel') {
    exportCurrentOrderToCSV();
  }
});

// Event listener للطباعة (إذا كان فيه data-action="print" في HTML داخل المودال)
document.addEventListener('click', e => {
  if (e.target.dataset.action === 'print') {
    window.print();
  }
});

// إغلاق المودال عند الضغط على زر × أو خارج المودال (موحد)
document.addEventListener('click', function (e) {
  const modal = document.getElementById('orderModal');
  if (!modal) return;

  // زر الإغلاق (× أو .modal__close)
  if (e.target.closest('.modal__close')) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    return;
  }

  // الضغط خارج محتوى المودال
  if (e.target === modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
});

// إغلاق المودال عند الضغط على Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('orderModal');
    if (modal && modal.classList.contains('show')) {
      modal.classList.remove('show');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  }
});

// التأكد من وجود صف واحد على الأقل في الطلب الجديد + التوجيه الأولي
ensureAtLeastOneRow();
route();
