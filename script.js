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
    updateNavLinks(user);
    if (location.hash === "#/login") {
      location.hash = "#/new";
    }
    route();
  } else {
    document.body.classList.add("auth-out");
    switchView("login");
    updateNavLinks(null);
  }
});

function switchView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const view = document.getElementById("view-" + viewId);
  if (view) view.classList.add("active");
}

function setUserRole(user) {
  db.collection("users").doc(user.uid).get().then(doc => {
    const role = doc.exists ? doc.data().role : "user";
    showLinksForRole(role);
  }).catch(console.error);
}

function showLinksForRole(role) {
  document.querySelectorAll("[data-auth]").forEach(link => {
    link.style.display = (
      link.dataset.auth === role ||
      (link.dataset.auth === "user" && role !== "admin")
    ) ? "inline-block" : "none";
  });
}

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
      auth.signOut().then(() => {
        location.hash = "#/login";
        switchView("login");
        updateNavLinks(null);
      });
    };
  } else {
    sessionBtn.textContent = "دخول";
    sessionBtn.onclick = () => {
      location.hash = "#/login";
    };
  }
}

function isAdmin(user) {
  const email = user?.email || "";
  return email.endsWith("@admin.com") || email === "admin@baytalebaa.com";
}

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

window.addEventListener("load", () => {
  const savedEmail = localStorage.getItem("savedEmail");
  if (savedEmail) {
    document.getElementById("loginEmail").value = savedEmail;
    document.getElementById("rememberEmail").checked = true;
  }
});

function showMessage(text, success = true, containerId = "loginMsg") {
  const msg = document.getElementById(containerId);
  msg.textContent = text;
  msg.className = `msg ${success ? "success" : "error"}`;
  msg.style.display = "block";
  setTimeout(() => {
    msg.style.display = "none";
  }, 5000);
}

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
      location.hash = "#/new";
    });
  }).catch(err => {
    loginMsg.textContent = err.message;
    loginMsg.className = "msg error";
    loginMsg.style.display = "block";
  });
});

document.getElementById("clearEmail").addEventListener("click", () => {
  document.getElementById("loginEmail").value = "";
});

document.getElementById("clearPwd").addEventListener("click", () => {
  document.getElementById("loginPassword").value = "";
});

document.getElementById("togglePwd").addEventListener("click", () => {
  const pwdInput = document.getElementById("loginPassword");
  pwdInput.type = pwdInput.type === "password" ? "text" : "password";
});
