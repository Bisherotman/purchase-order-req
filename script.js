// 🌐 Firebase App Initialization
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

// 🌐 Auth state control
auth.onAuthStateChanged(user => {
  if (user) {
    document.body.classList.remove("auth-out");
    setUserRole(user);
    route(); // تحديث العرض عند الدخول
  } else {
    document.body.classList.add("auth-out");
    switchView("login");
  }
});
// 🔄 Switch view logic
function switchView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const view = document.getElementById("view-" + viewId);
  if (view) view.classList.add("active");
}

// 🧠 Get user role and update UI accordingly
function setUserRole(user) {
  db.collection("users").doc(user.uid).get().then(doc => {
    const role = doc.exists ? doc.data().role : "user";
    showLinksForRole(role);
  }).catch(console.error);
}

// 📌 Show nav links based on role
function showLinksForRole(role) {
  document.querySelectorAll("[data-auth]").forEach(link => {
    link.style.display = (
      link.dataset.auth === role ||
      (link.dataset.auth === "user" && role !== "admin")
    ) ? "inline-block" : "none";
  });

  const sessionBtn = document.getElementById("sessionBtn");
  if (auth.currentUser) {
    sessionBtn.textContent = "خروج";
   sessionBtn.onclick = () => {
  auth.signOut().then(() => {
    location.hash = "#/login";   // ✅ يرجع للصفحة الرئيسية
    switchView("login");         // ✅ يعرض صفحة تسجيل الدخول
    updateNavLinks(null);        // ✅ يخفي الأزرار
  });
};

// 📲 Login functionality
document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const remember = document.getElementById("rememberEmail").checked;
  const loginMsg = document.getElementById("loginMsg");

  if (remember) {
    localStorage.setItem("savedEmail", email);
  } else {
    localStorage.removeItem("savedEmail");
  }

  auth.setPersistence(
  remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION
).then(() => {
  return auth.signInWithEmailAndPassword(email, password).then(() => {
    location.hash = "#/new"; // ✅ التوجيه للصفحة الجديدة بعد تسجيل الدخول
  });
}).catch(err => {
  loginMsg.textContent = err.message;
  loginMsg.className = "msg error";
  loginMsg.style.display = "block";
});

});
// 📄 Render orders for user
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
      <td>${order.date || "-"}</td>
      <td><button onclick='showDetails(${JSON.stringify(order)})'>تفاصيل</button></td>
    `;
    tbody.appendChild(row);
  });
}

// 👑 Render admin table
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

  // ✅ الموافقة على الطلب
  document.querySelectorAll(".approveBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await updateOrderStatus(id, "تمت الموافقة");
    });
  });
}

// ✅ تحديث حالة الطلب
async function updateOrderStatus(id, newStatus) {
  try {
    const orderRef = db.collection("orders").doc(id);
    await orderRef.update({ status: newStatus });
    showMessage("تم تحديث حالة الطلب بنجاح", true, "adminMsg");
    loadOrders(); // تأكد أن عندك دالة loadOrders لوحدها أو عدل حسب مشروعك
  } catch (err) {
    showMessage("فشل في تحديث الحالة: " + err.message, false, "adminMsg");
  }
}

// 🔍 عرض تفاصيل الطلب
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

// إغلاق نافذة التفاصيل
document.getElementById("closeDetails").addEventListener("click", () => {
  document.getElementById("detailsModal").setAttribute("aria-hidden", "true");
});

// طباعة تفاصيل الطلب
document.getElementById("printDetailsBtn").addEventListener("click", () => {
  window.print();
});
// 🔐 عرض روابط القائمة حسب حالة الدخول
function updateNavLinks(user) {
  const links = document.querySelectorAll("[data-auth]");
  links.forEach((link) => {
    const required = link.getAttribute("data-auth");
    link.style.display =
      (required === "user" && user) || (required === "admin" && isAdmin(user))
        ? "inline-block"
        : "none";
  });

  const sessionBtn = document.getElementById("sessionBtn");
  if (user) {
    sessionBtn.textContent = "خروج";
    sessionBtn.onclick = () => {
      firebase.auth().signOut();
    };
  } else {
    sessionBtn.textContent = "دخول";
    sessionBtn.onclick = () => {
      location.hash = "#/login";
    };
  }
}

// ⚖️ هل المستخدم أدمن؟
function isAdmin(user) {
  const email = user?.email || "";
  return email.endsWith("@admin.com") || email === "admin@baytalebaa.com";
}

// 🧭 التوجيه حسب الرابط (hash routing)
window.addEventListener("hashchange", route);
function route() {
  const hash = location.hash || "#/login";
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("active");
  });

  const target = document.querySelector(`[id="view-${hash.replace("#/", "")}"]`);
  if (target) target.classList.add("active");
}
route();

// 💌 استرجاع الإيميل المحفوظ عند تحميل الصفحة
window.addEventListener("load", () => {
  const savedEmail = localStorage.getItem("savedEmail");
  if (savedEmail) {
    document.getElementById("loginEmail").value = savedEmail;
    document.getElementById("rememberEmail").checked = true;
  }
});

// 🔔 عرض رسالة
function showMessage(text, success = true, containerId = "loginMsg") {
  const msg = document.getElementById(containerId);
  msg.textContent = text;
  msg.className = `msg ${success ? "success" : "error"}`;
  msg.style.display = "block";
  setTimeout(() => {
    msg.style.display = "none";
  }, 5000);
}
