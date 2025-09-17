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
function makeItemRow(values={}){ ... }   // (بقي كما هو – اختصرناه هنا)
function ensureAtLeastOneRow(){ ... }
addItemBtn.onclick=()=>itemsWrap.appendChild(makeItemRow());

const linksWrap=$("#linksWrap"), addLinkBtn=$("#addLinkBtn");
function makeLinkRow(values={}){ ... }
addLinkBtn.onclick=()=>{ ... };

const newMsg=$("#newMsg"), submitOrderBtn=$("#submitOrder");
submitOrderBtn.addEventListener("click", async ()=>{ ... });

/***************************************************
 * 🛠️ صفحة إدارة الطلبات (Admin)
 ***************************************************/
const adminBody=$("#adminOrdersBody"),
      adminSearch=$("#adminSearch"),
      adminFilterBranch=$("#adminFilterBranch"),
      adminFilterStatus=$("#adminFilterStatus"),
      adminFilterUser=$("#adminFilterUser"),
      adminSort=$("#adminSort");

let usersById={}, adminRows=[];

async function loadAdminOrders(){ ... }
function populateAdminUsers(rows){ ... }
function renderTableRow(r){ ... }
function renderAdmin(){ ... }

adminSearch.addEventListener("input",renderAdmin);
adminFilterBranch.addEventListener("change",renderAdmin);
adminFilterStatus.addEventListener("change",renderAdmin);
adminFilterUser.addEventListener("change",renderAdmin);
adminSort.addEventListener("change",renderAdmin);

document.addEventListener("change", async e => { ... }); // تحديث الحالة
document.addEventListener("click", e => { ... });        // توسيع الأصناف

/***************************************************
 * 📄 صفحة طلبــاتي (My Orders) – نسخة للقراءة فقط
 ***************************************************/
const myBody         = $("#myOrdersBody"),
      mySearch       = $("#mySearch"),
      myFilterStatus = $("#myFilterStatus"),
      mySort         = $("#mySort");
let myUnsub=null, myRows=[];

function subscribeMyOrders(){
  if (myUnsub){ myUnsub(); myUnsub=null; }
  if (!currentUser) return;
  const q = db.collection("orders").where("createdBy","==",currentUser.uid);
  myUnsub = q.onSnapshot(snap=>{
    myRows = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderMy(myRows);
  }, err=>{ console.error(err); showMsg($("#newMsg"),"تعذّر تحميل طلباتك: "+(err.message||err),"error"); });
}

// تسميات الحالة + كلاس
function statusLabel(s){ return {created:"جديد",ordered:"تم الطلب من المصنع",shipped:"تم الشحن",partial:"وصلت جزئياً",delivered:"وصلت بالكامل"}[s] || s || "غير معروف"; }
function statusClass(s){ return {created:"s-created",ordered:"s-ordered",shipped:"s-shipped",partial:"s-partial",delivered:"s-delivered"}[s] || "s-created"; }

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
          <button type="button" class="btn-details btn-sm" data-id="${r.tracking}">🗂️</button>
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

async function openDetails(tracking){ ... } // بقي كما هو

/***************************************************
 * 🚀 تشغيل أولي
 ***************************************************/
ensureAtLeastOneRow();
route();
