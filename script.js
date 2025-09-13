<script>
/* ---------- Firebase ---------- */
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

/* ---------- helpers / routing ---------- */
const $ = (s)=>document.querySelector(s);
const navLinks = $("#navLinks");
const sessionBtn = $("#sessionBtn");
const routes = { "#/login":"view-login", "#/new":"view-new", "#/my":"view-my", "#/admin":"view-admin" };

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
let currentUser=null, userProfile=null, canSeeAdmin=false;

/* ---------- remember email + toggle/clear pwd & email ---------- */
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

/* ---------- MY ORDERS elements ---------- */
const myBody = $("#myOrdersBody"), mySearch = $("#mySearch"), mySort = $("#mySort");

/* ---------- auth ---------- */
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
  whoami.textContent=badge; whoamiMy.textContent=badge; whoamiAdmin.textContent=badge;

  navLinks.querySelectorAll("[data-auth]").forEach(a=>{
    const t=a.dataset.auth; a.style.display=(t==="user")? "" : (canSeeAdmin? "" : "none");
  });
  sessionBtn.textContent="خروج"; sessionBtn.setAttribute("href","#/login");

  if (location.hash === "#/login" || !location.hash) location.hash="#/new";
  route();
  subscribeMyOrders();
  if(canSeeAdmin) loadAdminOrders();
});

/* ---------- tracking / counters ---------- */
const branchCodes={Riyadh:"RUH",Dammam:"DMM",Jeddah:"JED",Makkah:"MKK",Madina:"MED",HQ:"HQ"};
const pad5=(n)=>String(n).padStart(5,"0");

/* ---------- multi items UI ---------- */
const itemsWrap = $("#itemsWrap");
const addItemBtn = $("#addItemBtn");
function makeItemRow(values={}){
  const row=document.createElement("div");
  row.className="item-row";
  row.innerHTML = `
    <input type="text" class="it-code" placeholder="كود الصنف" value="${values.itemCode||""}">
    <input type="number" class="it-qty"  min="1" step="1" placeholder="الكمية" value="${values.quantity||""}">
    <input type="number" class="it-price" min="0" step="0.01" placeholder="سعر البيع" value="${values.price||""}">
    <button type="button" class="remove">🗑</button>`;
  row.querySelector(".remove").onclick=()=> row.remove();
  return row;
}
function ensureAtLeastOneRow(){ if(!itemsWrap.children.length){ itemsWrap.appendChild(makeItemRow()); } }
addItemBtn.onclick = ()=> itemsWrap.appendChild(makeItemRow());
ensureAtLeastOneRow();

/* ---------- links UI ---------- */
const linksWrap = $("#linksWrap");
const addLinkBtn = $("#addLinkBtn");
function makeLinkRow(values={}){
  const r=document.createElement("div");
  r.className="link-row";
  r.innerHTML=`
    <input class="ln-name" placeholder="اسم المرفق (مثال: عرض سعر)" value="${values.name||""}">
    <input class="ln-url"  placeholder="https://example.com/file.pdf" value="${values.url||""}">
    <button type="button" class="remove">🗑</button>`;
  r.querySelector(".remove").onclick=()=>{ r.remove(); if(linksWrap.children.length < 2) addLinkBtn.disabled = false; };
  return r;
}
addLinkBtn.onclick = ()=>{ if (linksWrap.children.length >= 2) return; linksWrap.appendChild(makeLinkRow()); if (linksWrap.children.length >= 2) addLinkBtn.disabled = true; };

/* ---------- new order ---------- */
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
    price:    Number(r.querySelector(".it-price").value)
  })).filter(x=>x.itemCode && Number.isFinite(x.quantity) && x.quantity>0 && Number.isFinite(x.price) && x.price>=0);

  if(items.length===0){ showMsg(newMsg,"أضف صنفًا واحدًا على الأقل بشكل صحيح.","error"); return; }
  if (linksWrap.children.length > 2) { showMsg(newMsg, "مسموح بمرفقين كحد أقصى.", "error"); return; }

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

/* ---------- MY ORDERS (Realtime) + details/print ---------- */
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
  const term=(mySearch.value||"").toLowerCase();
  rows=rows.filter(r=>{
    const hasItem = (r.items||[]).some(it => (it.itemCode||"").toLowerCase().includes(term));
    return !term ||
      r.tracking.toLowerCase().includes(term) ||
      (r.projectName||"").toLowerCase().includes(term) ||
      (r.customerName||"").toLowerCase().includes(term) ||
      hasItem;
  });
  rows.sort((a,b)=> (mySort.value==="createdAt_desc"
    ? (b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)
    : (a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0)));

  myTableBody.innerHTML=rows.map(r=>{
    const items=r.items||[];
    const firstCode = items[0]?.itemCode || "";
    const extra = items.length>1 ? ` (+${items.length-1})` : "";
    const qtySum = items.reduce((s,x)=>s+(x.quantity||0),0);
    const priceFirst = items.length ? (items[0].price ?? "") : "";
    return `
      <tr>
        <td><strong>${r.tracking}</strong></td>
        <td>${firstCode}${extra}</td>
        <td>${qtySum}</td>
        <td>${(typeof priceFirst==="number") ? priceFirst.toFixed(2) : priceFirst}</td>
        <td>${r.projectName||"-"}</td>
        <td><span class="status ${statusClass(r.status)}">${statusLabel(r.status)}</span></td>
        <td>${r.createdAt?.toDate?.().toLocaleString('ar-SA')||""}</td>
        <td><button type="button" class="btn-strong" data-open="${r.tracking}" style="padding:6px 10px;border-radius:10px">تفاصيل</button></td>
      </tr>`;
  }).join("");

  document.querySelectorAll('[data-open]').forEach(btn=>{ btn.onclick = ()=> openDetails(btn.dataset.open); });
}
mySearch.addEventListener("input",()=>renderMy(myRows));
mySort.addEventListener("change",()=>renderMy(myRows));

/* تفاصيل + طباعة محسّنة */
const modal=$("#detailsModal"), closeDetails=$("#closeDetails"), detailsBody=$("#detailsBody"), printBtn=$("#printDetailsBtn");
function openDetails(tracking){
  const r = (myRows.length? myRows : adminRows).find(x=>x.tracking===tracking);
  if(!r) return;
  const items=r.items||[];
  const qtySum=items.reduce((s,x)=>s+(x.quantity||0),0);
  const rows=items.map((it,i)=>`
    <tr><td>${i+1}</td><td>${it.itemCode||""}</td><td>${it.quantity??""}</td><td>${(typeof it.price==="number")?it.price.toFixed(2):it.price??""}</td></tr>
  `).join("");
  const attachHtml = (r.attachments?.length)
    ? `<ul>${r.attachments.map(a=>`<li><a href="${a.url}" target="_blank">${a.name}</a></li>`).join("")}</ul>`
    : `<div class="muted">لا توجد مرفقات.</div>`;

  detailsBody.innerHTML = `
    <div class="inv-head">
      <div class="inv-brand">
        <img src="img/pagelogo.png" alt="logo">
        <div>
          <div class="inv-title">طلب شراء</div>
          <div class="muted">رقم التتبّع: <b>${r.tracking}</b></div>
        </div>
      </div>
      <div style="margin-inline-start:auto;text-align:left">
        <div>الفرع: <b>${r.branch}</b></div>
        <div>التاريخ: ${r.createdAt?.toDate?.().toLocaleString('ar-SA')||""}</div>
      </div>
    </div>

    <div class="inv-grid" style="margin:10px 0 14px">
      <div><b>اسم المشروع:</b> ${r.projectName||"-"}</div>
      <div><b>اسم العميل:</b> ${r.customerName||"-"}</div>
      <div><b>أنشئ بواسطة:</b> ${displayNameOrEmail(currentUser,userProfile)}</div>
      <div><b>الحالة:</b> ${statusLabel(r.status)}</div>
    </div>

    <table class="table-like">
      <thead><tr><th>#</th><th>كود الصنف</th><th>الكمية</th><th>سعر البيع</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2" class="total">إجمالي الكميات</td><td class="total">${qtySum}</td><td></td></tr></tfoot>
    </table>

    <div style="margin-top:10px">
      <b>المرفقات:</b>
      ${attachHtml}
    </div>
  `;
  modal.classList.add("show");
}
closeDetails.onclick = ()=> modal.classList.remove("show");
modal.querySelector(".backdrop").onclick = ()=> modal.classList.remove("show");
printBtn.onclick = ()=> window.print();

/* ---------- ADMIN (بحث مُحسّن + زر التفاصيل) ---------- */
const adminBody=$("#adminOrdersBody"), adminSearch=$("#adminSearch"), adminFilterBranch=$("#adminFilterBranch");
let adminRows=[];
async function loadAdminOrders(){
  if(!canSeeAdmin) return;
  const snap=await db.collection("orders").get();
  adminRows=snap.docs.map(d=>({id:d.id,...d.data()}));
  renderAdmin();
}
function renderAdmin(){
  const term=(adminSearch.value||"").toLowerCase();
  const fb=adminFilterBranch.value;

  let rows = adminRows.filter(r=>{
    if (fb && r.branch!==fb) return false;
    if (!term) return true;
    const inItems = (r.items||[]).some(it => (it.itemCode||"").toLowerCase().includes(term));
    return r.tracking.toLowerCase().includes(term) ||
           (r.projectName||"").toLowerCase().includes(term) ||
           (r.customerName||"").toLowerCase().includes(term) ||
           inItems;
  });
  rows.sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));

  adminBody.innerHTML=rows.map(r=>{
    const items=r.items||[];
    const firstCode=items[0]?.itemCode || "";
    const extra=items.length>1 ? ` (+${items.length-1})` : "";
    const qtySum=items.reduce((s,x)=>s+(x.quantity||0),0);
    const priceFirst=items.length ? (items[0].price ?? "") : "";
    return `
      <tr>
        <td>${r.branch}</td>
        <td><strong>${r.tracking}</strong></td>
        <td>${firstCode}${extra}</td>
        <td>${qtySum}</td>
        <td>${(typeof priceFirst==="number") ? priceFirst.toFixed(2) : priceFirst}</td>
        <td>${r.projectName||"-"}</td>
        <td><span class="status ${statusClass(r.status)}">${statusLabel(r.status)}</span></td>
        <td style="display:flex;gap:6px;align-items:center">
          <select data-id="${r.tracking}" class="updStatus">
            ${["created","ordered","shipped","delivered"].map(s=>`<option value="${s}" ${r.status===s?"selected":""}>${statusLabel(s)}</option>`).join("")}
          </select>
          <button type="button" class="btn-strong open-details" data-open="${r.tracking}" style="padding:6px 10px;border-radius:10px">تفاصيل</button>
        </td>
      </tr>`;
  }).join("");

  // تغيـير الحالة
  document.querySelectorAll(".updStatus").forEach(sel=>{
    sel.onchange=async(e)=>{
      const id=e.target.dataset.id, val=e.target.value;
      await db.collection("orders").doc(id).update({status:val});
      loadAdminOrders(); subscribeMyOrders();
    };
  });
  // فتح التفاصيل
  adminBody.querySelectorAll(".open-details").forEach(btn=>{
    btn.onclick = ()=> openDetails(btn.dataset.open);
  });
}
adminSearch.addEventListener("input",renderAdmin);
adminFilterBranch.addEventListener("change",renderAdmin);

function statusLabel(s){ return {created:"جديد",ordered:"تم الطلب من المصنع",shipped:"تم الشحن",delivered:"وصلت"}[s] || s; }
function statusClass(s){ return {created:"s-created",ordered:"s-ordered",shipped:"s-shipped",delivered:"s-delivered"}[s] || "s-created"; }

/* ---------- init ---------- */
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
    update();
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
})();
(function(){
  const email = document.getElementById('loginEmail');
  const pwd   = document.getElementById('loginPassword');
  const clearEmail = document.getElementById('clearEmail');
  const togglePwd  = document.getElementById('togglePwd');
  const clearPwd   = document.getElementById('clearPwd');

  function uEmail(){ clearEmail.style.display = email && email.value ? 'flex' : 'none'; }
  function uPwd(){ 
    const has = pwd && pwd.value; 
    togglePwd.style.display = has ? 'flex':'none';
    clearPwd .style.display = has ? 'flex':'none';
  }

  ['input','focus','blur','change'].forEach(ev=>{
    if(email) email.addEventListener(ev,uEmail);
    if(pwd)   pwd.addEventListener(ev,uPwd);
  });

  if(clearEmail) clearEmail.onclick = ()=>{ email.value=''; email.focus(); uEmail(); };
  if(togglePwd ) togglePwd .onclick = ()=>{ pwd.type = (pwd.type==='password'?'text':'password'); pwd.focus(); };
  if(clearPwd  ) clearPwd  .onclick = ()=>{ pwd.value=''; pwd.focus(); uPwd(); };

  uEmail(); uPwd(); // تهيئة أولية
})();
  const passwordInput = document.querySelector('.pwd-wrap input');
  const toggleBtn = document.querySelector('.pwd-toggle');
  const clearBtn = document.querySelector('.pwd-clear');

  // زر 👁️
  toggleBtn.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      passwordInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });

  // زر X
  clearBtn.addEventListener('click', () => {
    passwordInput.value = '';
    passwordInput.focus();
    clearBtn.style.display = 'none';
    toggleBtn.style.display = 'none';
  });

  // إظهار الزرين عند الكتابة
  passwordInput.addEventListener('input', () => {
    if (passwordInput.value.length > 0) {
      clearBtn.style.display = 'flex';
      toggleBtn.style.display = 'flex';
    } else {
      clearBtn.style.display = 'none';
      toggleBtn.style.display = 'none';
    }
  });
document.getElementById("loginForm").addEventListener("submit", (e) => e.preventDefault());



</script>
