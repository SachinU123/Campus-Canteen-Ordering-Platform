(function () {
  // ---------- Utils ----------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const USERS_KEY   = "vpp_users";     // [{email, passwordHash? (plain for demo)}]
  const SESSION_KEY = "vpp_session";   // { email, loginAt }
  const RL_KEY      = "vpp_login_rl";  // { count, windowStart }

  const MAX_ATTEMPTS = 5;
  const WINDOW_MS    = 10 * 60 * 1000; // 10 minutes

  function emailValid(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function now() { return Date.now(); }

  // Tiny (fake) hash for demo (do NOT use in production)
  const hash = (s="") => btoa(unescape(encodeURIComponent(s))).replace(/=/g, "");

  function toast(msg, ms = 1400) {
    let host = $("#toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;z-index:9999";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = "background:#111827;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.25);font-size:14px;opacity:0;transform:translateY(10px);transition:opacity .2s, transform .2s";
    host.appendChild(el);a
    requestAnimationFrame(()=>{ el.style.opacity="1"; el.style.transform="translateY(0)"; });
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(10px)"; setTimeout(()=>el.remove(), 200); }, ms);
  }

  function readJSON(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
  function writeJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  // Seed demo user if none exist
  function ensureDemoUser() {
    let users = readJSON(USERS_KEY, []);
    if (!Array.isArray(users) || users.length === 0) {
      users = [{ email: "demo@vpp.local", pass: hash("demo123") }];
      writeJSON(USERS_KEY, users);
    }
  }

  // ---------- Rate limiting ----------
  function rlGet() { return readJSON(RL_KEY, { count: 0, windowStart: 0 }); }
  function rlReset() { writeJSON(RL_KEY, { count: 0, windowStart: now() }); }
  function rlBump() {
    const st = rlGet();
    const t = now();
    if (!st.windowStart || t - st.windowStart > WINDOW_MS) {
      writeJSON(RL_KEY, { count: 1, windowStart: t });
      return 1;
    }
    const c = (st.count || 0) + 1;
    writeJSON(RL_KEY, { count: c, windowStart: st.windowStart });
    return c;
  }
  function rlBlocked() {
    const st = rlGet();
    const t = now();
    if (!st.windowStart || t - st.windowStart > WINDOW_MS) return false;
    return (st.count || 0) >= MAX_ATTEMPTS;
  }
  function rlRemaining() {
    const st = rlGet();
    const t = now();
    if (!st.windowStart || t - st.windowStart > WINDOW_MS) return MAX_ATTEMPTS;
    return Math.max(0, MAX_ATTEMPTS - (st.count || 0));
  }

  // ---------- UI wiring ----------
  function insertError(el, msg) {
    removeError(el);
    const p = el.parentElement || el.closest("label") || el;
    const err = document.createElement("div");
    err.className = "field-error";
    err.textContent = msg;
    err.style.cssText = "color:#ff6666;font-size:12px;margin-top:6px";
    p.appendChild(err);
    el.setAttribute("aria-invalid", "true");
  }
  function removeError(el) {
    el.removeAttribute("aria-invalid");
    const p = el.parentElement || el.closest("label") || el;
    const e = $(".field-error", p);
    if (e) e.remove();
  }

  function addPasswordToggle(input) {
    if (!input || input.dataset.toggled) return;
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;display:block";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle password visibility");
    btn.style.cssText = "position:absolute;right:10px;top:50%;transform:translateY(-50%);background:transparent;border:none;cursor:pointer;color:#555";
    btn.innerHTML = "👁️";
    wrap.appendChild(btn);

    btn.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      btn.innerHTML = input.type === "password" ? "👁️" : "🙈";
    });

    input.dataset.toggled = "1";
  }

  // ---------- Auth ----------
  function findUser(email) {
    const users = readJSON(USERS_KEY, []);
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  async function login(email, password) {
  if (rlBlocked()) {
    const st = rlGet();
    const msLeft = Math.max(0, WINDOW_MS - (now() - (st.windowStart || 0)));
    const min = Math.ceil(msLeft / 60000);
    throw new Error(`Too many attempts. Try again in ~${min} min.`);
  }

  const res = await fetch("http://localhost:3000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    rlBump();
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Invalid email or password.");
  }

  rlReset();
  const data = await res.json();
  writeJSON(SESSION_KEY, { token: data.token, user: data.user, loginAt: Date.now() });
  return true;
}

  // ---------- Forgot password (mock) ----------
  function forgotPassword(email) {
    if (!emailValid(email)) throw new Error("Enter a valid email to reset password.");
    // In a real app: call backend to send reset link
    // Here: store a mock token
    localStorage.setItem(`vpp_reset_${email.toLowerCase()}`, JSON.stringify({ token: Math.random().toString(36).slice(2), at: Date.now() }));
    return true;
  }

  // ---------- Init ----------
  function init() {
    ensureDemoUser();

    const form = $("form");
    const email = $("#email");
    const password = $("#password");
    const forgot = document.querySelector('.form-options a[href="#"]');

    if (!form || !email || !password) return;

    // password toggle
    addPasswordToggle(password);

    // live validation (optional light)
    email.addEventListener("input", () => {
      if (!email.value) { removeError(email); return; }
      emailValid(email.value) ? removeError(email) : insertError(email, "Please enter a valid email.");
    });
    password.addEventListener("input", () => {
      if (!password.value) { removeError(password); return; }
      password.value.length >= 6 ? removeError(password) : insertError(password, "Minimum 6 characters.");
    });

    // Submit
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // reset field errors
      removeError(email);
      removeError(password);

      const ev = (email.value || "").trim();
      const pv = (password.value || "");

      let ok = true;
      if (!ev || !emailValid(ev)) {
        insertError(email, "Please enter a valid email.");
        ok = false;
      }
      if (!pv || pv.length < 6) {
        insertError(password, "Minimum 6 characters.");
        ok = false;
      }
      if (!ok) return;

      // disable button while "processing"
      const btn = $(".btn-primary", form);
      const original = btn ? btn.textContent : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Signing in…";
      }

      // Simulate async auth
      setTimeout(() => {
        try {
          login(ev, pv);
          toast("Signed in");
          // redirect
          window.location.href = "home.html";
        } catch (err) {
          insertError(password, err.message || "Sign-in failed.");
          toast("Sign-in failed");
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = original || "Sign in";
          }
        }
      }, 450);
    });

    // Forgot password
    if (forgot) {
      forgot.addEventListener("click", (e) => {
        e.preventDefault();
        const ev = (email.value || "").trim();
        try {
          if (!ev) throw new Error("Enter your email above first.");
          if (!emailValid(ev)) throw new Error("Enter a valid email.");
          forgotPassword(ev);
          toast("Reset link sent to your email");
        } catch (err) {
          insertError(email, err.message || "Unable to send reset link.");
          toast("Could not send reset link");
        }
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
