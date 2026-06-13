// ─── Route Guard Protection ──────────────────────────────────────────────────
(function checkRouteGuard() {
  const path = window.location.pathname;
  const isLoginPage = path.endsWith("/login.html") || path.endsWith("/register.html") || path.endsWith("index.html");
  const isAdminPage = path.includes("/admin") || path.endsWith("admin.html");

  const userData = localStorage.getItem("cv_user");
  let user = null;
  if (userData) {
    try {
      user = JSON.parse(userData);
    } catch (e) {
      localStorage.removeItem("cv_user");
    }
  }

  const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/\s+/g, '_');
  const userRole = user?.role ? normalizeRole(user.role) : null;

  // If visiting an admin page without a valid user or role, redirect to login
  if (isAdminPage) {
    if (!user || !user.token) {
      window.location.href = "/store/login.html";
      return;
    }

    const allowedRoles = ['super_admin', 'admin', 'staff_admin', 'staff'];
    if (!allowedRoles.includes(userRole)) {
      window.location.href = "/store/shop.html";
      return;
    }
  }

  // If already logged in and visiting login page, redirect to correct portal
  if (isLoginPage && user && user.token) {
    if (['super_admin', 'admin'].includes(userRole)) {
      window.location.href = "/admin/dashboard.html";
    } else if (userRole === 'staff') {
      window.location.href = "/admin/dashboard.html";
    } else {
      window.location.href = "/store/shop.html";
    }
  }
})();

// ─── Tailwind configuration (runs before Tailwind parses the DOM) ─────────────
if (typeof tailwind !== 'undefined') {
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        "colors": {
          "on-primary": "#00363a",
          "surface-slate": "#404040",
          "secondary-container": "#b600f8",
          "primary": "#dbfcff",
          "surface-container-low": "#1a1b20",
          "on-tertiary-fixed-variant": "#3c4d00",
          "inverse-surface": "#e3e2e7",
          "inverse-primary": "#006970",
          "primary-fixed-dim": "#00dbe9",
          "surface-container-highest": "#343439",
          "error": "#ffb4ab",
          "secondary": "#ebb2ff",
          "on-secondary-fixed": "#320047",
          "on-background": "#e3e2e7",
          "on-secondary-fixed-variant": "#74009f",
          "surface-container-lowest": "#0d0e12",
          "on-secondary": "#520072",
          "on-tertiary": "#283500",
          "surface-variant": "#343439",
          "glow-purple": "rgba(188, 19, 254, 0.4)",
          "on-tertiary-fixed": "#161e00",
          "secondary-fixed": "#f8d8ff",
          "inverse-on-surface": "#2f3035",
          "surface-container": "#1e1f24",
          "tertiary-fixed-dim": "#abd600",
          "tertiary-fixed": "#c3f400",
          "surface-bright": "#38393d",
          "glow-cyan": "rgba(0, 240, 255, 0.4)",
          "secondary-fixed-dim": "#ebb2ff",
          "on-surface-variant": "#b9cacb",
          "outline-variant": "#3b494b",
          "tertiary": "#e9ffa8",
          "on-error": "#690005",
          "primary-fixed": "#7df4ff",
          "outline": "#849495",
          "surface-dim": "#121317",
          "on-error-container": "#ffdad6",
          "on-surface": "#e3e2e7",
          "glass-fill": "rgba(25, 26, 31, 0.6)",
          "on-tertiary-container": "#506600",
          "surface": "#121317",
          "primary-container": "#00f0ff",
          "on-secondary-container": "#fff6fc",
          "on-primary-fixed-variant": "#004f54",
          "on-primary-fixed": "#002022",
          "on-primary-container": "#006970",
          "surface-container-high": "#292a2e",
          "error-container": "#93000a",
          "surface-tint": "#00dbe9",
          "background": "#121317",
          "surface-charcoal": "#191A1F",
          "tertiary-container": "#bbea00"
        },
        "borderRadius": {
          "DEFAULT": "0.25rem",
          "lg": "0.5rem",
          "xl": "0.75rem",
          "full": "9999px"
        },
        "spacing": {
          "container-max": "1280px",
          "margin-desktop": "64px",
          "gutter": "24px",
          "base": "8px",
          "margin-mobile": "20px"
        },
        "fontFamily": {
          "display-lg":        ["Sora"],
          "price-display":     ["Sora"],
          "headline-lg":       ["Sora"],
          "body-md":           ["Inter"],
          "headline-md":       ["Sora"],
          "label-caps":        ["JetBrains Mono"],
          "headline-lg-mobile":["Sora"],
          "body-lg":           ["Inter"]
        }
      }
    }
  };
}

// ─── API Base URL ─────────────────────────────────────────────────────────────
const API_BASE = "/api";

// ─── CyberAPI — Lightweight fetch wrapper ─────────────────────────────────────
const CyberAPI = {
  _getHeaders() {
    const headers = { "Content-Type": "application/json" };
    const userData = localStorage.getItem("cv_user");
    if (userData) {
      try {
        const u = JSON.parse(userData);
        if (u.token) {
          headers["Authorization"] = `Bearer ${u.token}`;
        }
      } catch (e) {}
    }
    return headers;
  },

  async get(endpoint, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `${API_BASE}/${endpoint}${qs ? "?" + qs : ""}`;
    const res = await fetch(url, {
      headers: this._getHeaders()
    });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return res.json();
  },

  async post(endpoint, body = {}) {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`POST → ${res.status}`);
    return res.json();
  },

  async put(endpoint, id, body = {}) {
    const res = await fetch(`${API_BASE}/${endpoint}/${id}`, {
      method: "PUT",
      headers: this._getHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`PUT → ${res.status}`);
    return res.json();
  },

  async delete(endpoint, id) {
    const res = await fetch(`${API_BASE}/${endpoint}/${id}`, {
      method: "DELETE",
      headers: this._getHeaders()
    });
    if (!res.ok) throw new Error(`DELETE → ${res.status}`);
    return res.json();
  }
};

// ─── Toast Notification System ────────────────────────────────────────────────
const Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.createElement("div");
      this._container.id = "toast-container";
      this._container.style.cssText = [
        "position:fixed", "bottom:24px", "right:24px", "z-index:9999",
        "display:flex", "flex-direction:column", "gap:8px", "pointer-events:none"
      ].join(";");
      document.body.appendChild(this._container);
    }
    return this._container;
  },

  show(message, type = "info", duration = 3500) {
    const colors = {
      success: { bg: "rgba(0,240,255,0.15)", border: "#00f0ff", icon: "✓" },
      error:   { bg: "rgba(255,180,171,0.15)", border: "#ffb4ab", icon: "✕" },
      warning: { bg: "rgba(233,255,168,0.15)", border: "#e9ffa8", icon: "!" },
      info:    { bg: "rgba(182,0,248,0.15)",   border: "#b600f8", icon: "i" }
    };
    const c = colors[type] || colors.info;
    const el = document.createElement("div");
    el.style.cssText = [
      `background:${c.bg}`,
      "backdrop-filter:blur(12px)",
      `border:1px solid ${c.border}`,
      `box-shadow:0 0 20px ${c.border}33`,
      "border-radius:10px",
      "padding:12px 18px",
      "display:flex", "align-items:center", "gap:10px",
      "font-family:JetBrains Mono,monospace",
      "font-size:12px",
      "color:#e3e2e7",
      "min-width:260px", "max-width:380px",
      "pointer-events:auto",
      "transition:all 0.3s ease",
      "opacity:0", "transform:translateY(8px)"
    ].join(";");
    el.innerHTML = `
      <span style="font-weight:bold;color:${c.border};font-size:14px">${c.icon}</span>
      <span style="flex:1">${message}</span>
      <span style="cursor:pointer;opacity:0.5" onclick="this.parentElement.remove()">×</span>
    `;
    this._getContainer().appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, "success"); },
  error(msg)   { this.show(msg, "error");   },
  warning(msg) { this.show(msg, "warning"); },
  info(msg)    { this.show(msg, "info");    }
};

// ─── Skeleton Loader Helper ───────────────────────────────────────────────────
function skeletonRow(cols = 7) {
  const cells = Array.from({ length: cols }, () =>
    `<td class="px-6 py-4"><div style="height:14px;border-radius:6px;background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.05) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite"></div></td>`
  ).join("");
  return `<tr>${cells}</tr>`;
}

function showTableSkeleton(tbodyId, rows = 5, cols = 7) {
  const tbody = document.getElementById(tbodyId);
  if (tbody) tbody.innerHTML = Array(rows).fill(skeletonRow(cols)).join("");
}

// Shimmer keyframes injected once
(function injectShimmer() {
  if (document.getElementById("shimmer-style")) return;
  const s = document.createElement("style");
  s.id = "shimmer-style";
  s.textContent = "@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}";
  document.head.appendChild(s);
})();

// ─── Shared Nav & Micro-interactions ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Highlight active sidebar link based on current URL
  const links       = document.querySelectorAll("aside a, nav a");
  const currentPath = window.location.pathname;

  links.forEach(link => {
    const href = link.getAttribute("href");
    if (href && href !== "#" && currentPath.endsWith(href)) {
      link.classList.remove("text-on-surface-variant", "opacity-70");
      link.classList.add("bg-secondary-container/20", "text-secondary-container", "border-r-2", "border-secondary-container");
    }
  });

  // Scale-down press feedback on buttons & links
  document.querySelectorAll("button, a").forEach(elem => {
    elem.addEventListener("mousedown",  () => elem.classList.add("scale-95"));
    elem.addEventListener("mouseup",    () => elem.classList.remove("scale-95"));
    elem.addEventListener("mouseleave", () => elem.classList.remove("scale-95"));
  });

  // Handle logout buttons globally
  const logoutButtons = document.querySelectorAll("button, a");
  logoutButtons.forEach(btn => {
    if (btn.textContent.trim().toLowerCase().includes("logout")) {
      btn.addEventListener("click", () => {
        localStorage.removeItem("cv_user");
        const path = window.location.pathname;
        window.location.href = path.includes("/admin/") ? "../index.html" : "index.html";
      });
    }
  });

  // Handle all placeholder '#' links globally
  document.querySelectorAll("a[href='#']").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      Toast.info("Module Offline / Coming Soon.");
    });
  });

  // API health check
fetch(`${API_BASE}/dashboard/summary`, { 
    method: "GET", 
    signal: AbortSignal.timeout(2000),
    credentials: "include"
})
.then(r => {
    if (r.ok) console.log("[CYBER-VAPE] API connected ✓");
})
.catch(() => {
    Toast.warning("Server offline - run: npm start");
});
});
