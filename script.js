// ✅ script.js الكامل والمُحدّث — بوابة طلبات الشراء

// 1. Firebase config
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
const db = firebase.firestore();

// 2. Auth state
auth.onAuthStateChanged((user) => {
  if (user) {
    document.body.classList.remove("auth-out");
    setUserRole(user);
    updateNavLinks(user);
    if (location.hash === "#/login") location.hash = "#/new";
    route();
    loadMyOrders();
    loadOrders();
  } else {
    document.body.classList.add("auth-out");
    updateNavLinks(null);
    switchView("login");
  }
});

// 3. Switch View
function switchView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const view = document.getElementById("view-" + viewId);
  if (view) view.classList.add("active");
}

// 4. Role Handling
function setUserRole(user) {
  db.collection("users").doc(user.uid).get().then(doc => {
    const role = doc.exists ? doc.data().role : "user";
    showLinksForRole(role);
  });
}

function showLinksForRole(role) {
  document.querySelectorAll("[data-auth]").forEach(link => {
    const authType = link.getAttribute("data-auth");
    link.style.display = (authType === role || (authType === "user" && role !== "admin")) ? "inline-block" : "none";
  });
}

// 5. Navbar Buttons
function updateNavLinks(user) {
  const links = document.querySelectorAll("[data-auth]");
  links.forEach(link => {
    const required = link.getAttribute("data-auth");
    link.style.display = user && ((required === "user") || (required === "admin" && isAdmin(user)))
      ? "inline-block" : "none";
  });

  const sessionBtn = document.getElementById("sessionBtn");
  if (user) {
    sessionBtn.textContent = "خروج";
    sessionBtn.onclick = () => auth.signOut();
  } else {
    sessionBtn.textContent = "دخول";
    sessionBtn.onclick = () => location.hash = "#/login";
  }
}

function isAdmin(user) {
  const email = user?.email || "";
  return email.endsWith("@admin.com") || email === "admin@baytalebaa.com";
}

// 6. Routing
window.addEventListener("hashchange", route);
function route() {
  const hash = location.hash || "#/login";
  document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
  const target = document.querySelector(`[id="view-${hash.replace("#/", "")}"]`);
  if (target) target.classList.add("active");
}

// 7. Login
const loginForm = document.getElementById("loginForm");
loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const remember = document.getElementById("rememberEmail").checked;
  const loginMsg = document.getElementById("loginMsg");

  if (remember) localStorage.setItem("savedEmail", email);
  else localStorage.removeItem("savedEmail");

  auth.setPersistence(
    remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION
  ).then(() => {
    return auth.signInWithEmailAndPassword(email, password);
  }).catch(err => {
    showMessage(err.message, false);
  });
});

// 8. Load My Orders
function loadMyOrders() {
  const user = auth.currentUser;
  if (!user) return;

  db.collection("orders").where("uid", "==", user.uid)
    .orderBy("createdAt", "desc")
    .get().then(snapshot => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderOrders("myOrdersBody", orders);
    });
}

// 9. Load All Orders for Admin
function loadOrders() {
  db.collection("orders")
    .orderBy("createdAt", "desc")
    .get().then(snapshot => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderAdminTable(orders);
    });
}

// 10. Render Orders
function renderOrders(containerId, orders) {
  const tbody = document.getElementById(containerId);
  tbody.innerHTML = "";
  orders.forEach(order => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${order.tracking || "-"}</td>
      <td>${order.item || "-"}</td>
      <td>${order.qty || "-"}</td>
      <td>${order.price || "-"}</td>
      <td>${order.project || "-"}</td>
      <td>${order.status || "-"}</td>
      <td>${new Date(order.createdAt?.seconds * 1000).toLocaleString()}</td>
      <td><button onclick='showDetails(${JSON.stringify(order)})'>تفاصيل</button></td>
    `;
    tbody.appendChild(row);
  });
}

// 11. Render Admin
function renderAdminTable(orders) {
  const tbody = document.getElementById("adminOrdersBody");
  tbody.innerHTML = "";
  orders.forEach(order => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${order.branch || "-"}</td>
      <td>${order.tracking || "-"}</td>
      <td>${order.item || "-"}</td>
      <td>${order.qty || "-"}</td>
      <td>${order.price || "-"}</td>
      <td>${order.project || "-"}</td>
      <td>${order.status || "-"}</td>
      <td><button data-id="${order.id}" class="approveBtn">✔</button></td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll(".approveBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await updateOrderStatus(id, "تمت الموافقة");
    });
  });
}

// 12. Approve Order
async function updateOrderStatus(id, newStatus) {
  try {
    await db.collection("orders").doc(id).update({ status: newStatus });
    showMessage("تم التحديث", true, "adminMsg");
    loadOrders();
  } catch (err) {
    showMessage("فشل التحديث: " + err.message, false, "adminMsg");
  }
}

// 13. Add Attachment Link
const addLinkBtn = document.getElementById("addLinkBtn");
addLinkBtn?.addEventListener("click", () => {
  const wrap = document.getElementById("linksWrap");
  if (wrap.children.length >= 2) return;
  const input = document.createElement("input");
  input.type = "url";
  input.placeholder = "https://example.com";
  input.classList.add("link-input");
  wrap.appendChild(input);
});

// 14. Show/Print Details
function showDetails(order) {
  const modal = document.getElementById("detailsModal");
  const body = document.getElementById("detailsBody");
  body.innerHTML = `
    <h3>تفاصيل الطلب</h3>
    <p><strong>رقم التتبّع:</strong> ${order.tracking}</p>
    <p><strong>اسم المشروع:</strong> ${order.project}</p>
    <p><strong>اسم العميل:</strong> ${order.customer}</p>
    <p><strong>الفرع:</strong> ${order.branch}</p>
    <p><strong>الصنف:</strong> ${order.item}</p>
    <p><strong>الكمية:</strong> ${order.qty}</p>
    <p><strong>السعر:</strong> ${order.price}</p>
    <p><strong>الحالة:</strong> ${order.status}</p>
    <p><strong>تاريخ الطلب:</strong> ${new Date(order.createdAt?.seconds * 1000).toLocaleString()}</p>
  `;
  modal.setAttribute("aria-hidden", "false");
}
document.getElementById("closeDetails").addEventListener("click", () => {
  document.getElementById("detailsModal").setAttribute("aria-hidden", "true");
});
document.getElementById("printDetailsBtn").addEventListener("click", () => window.print());

// 15. Email Remember
window.addEventListener("load", () => {
  const savedEmail = localStorage.getItem("savedEmail");
  if (savedEmail) {
    document.getElementById("loginEmail").value = savedEmail;
    document.getElementById("rememberEmail").checked = true;
  }
});

// 16. Show message
function showMessage(text, success = true, id = "loginMsg") {
  const msg = document.getElementById(id);
  msg.textContent = text;
  msg.className = `msg ${success ? "success" : "error"}`;
  msg.style.display = "block";
  setTimeout(() => msg.style.display = "none", 5000);
}
