(function () {
  // ---------- Utils ----------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const USERS_KEY   = "vpp_users";   // [{ email, pass, name }]
  const SESSION_KEY = "vpp_session"; // { email, loginAt }

  const emailValid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const strongEnough = (p) => {
    // simple strength: >= 6 chars + at least one letter and one number
    if (!p || p.length < 6) return false;
    const hasLetter = /[A-Za-z]/.test(p);
    const hasNumber = /[0-9]/.test(p);
    return hasLetter && hasNumber;
  };

  // NOTE: demo hash (do NOT use in production)
  const hash = (s="") => btoa(unescape(encodeURIComponent(s))).replace(/=/g, "");

  const readJSON  = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
  const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

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
    host.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity="1"; el.style.transform="translateY(0)"; });
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(10px)"; setTimeout(()=>el.remove(), 200); }, ms);
  }

  function insertError(el, msg) {
    removeError(el);
    const parent = el.parentElement || el.closest("label") || el;
    const e = document.createElement("div");
    e.className = "field-error";
    e.textContent = msg;
    e.style.cssText = "color:#ff6666;font-size:12px;margin-top:6px";
    parent.appendChild(e);
    el.setAttribute("aria-invalid", "true");
  }
  function removeError(el) {
    el.removeAttribute("aria-invalid");
    const parent = el.parentElement || el.closest("label") || el;
    const e = $(".field-error", parent);
    if (e) e.remove();
  }

  // Show/hide toggles for password inputs
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

  // ---------- Registration ----------
  function emailExists(email) {
    const users = readJSON(USERS_KEY, []);
    return users.some(u => (u.email || "").toLowerCase() === email.toLowerCase());
  }

  async function createUser({ name, email, password }) {
  const res = await fetch("http://localhost:3000/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: name, email, password })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Registration failed");
  }

  return res.json();
}


  // ---------- Init ----------
  function init() {
    const form   = $("form");
    const nameEl = $("#fullname");
    const email  = $("#email");
    const pass   = $("#password");
    const conf   = $("#confirm-password");

    if (!form || !nameEl || !email || !pass || !conf) return;

    // toggles
    addPasswordToggle(pass);
    addPasswordToggle(conf);

    // light live validation
    email.addEventListener("input", () => {
      if (!email.value) { removeError(email); return; }
      emailValid(email.value) ? removeError(email) : insertError(email, "Please enter a valid email.");
    });
    pass.addEventListener("input", () => {
      if (!pass.value) { removeError(pass); return; }
      strongEnough(pass.value) ? removeError(pass) : insertError(pass, "Min 6 chars, include letters & numbers.");
    });
    conf.addEventListener("input", () => {
      if (!conf.value) { removeError(conf); return; }
      conf.value === pass.value ? removeError(conf) : insertError(conf, "Passwords do not match.");
    });

    form.addEventListener("submit"), (e) => {
      e.preventDefault();

      // reset errors
      [nameEl, email, pass, conf].forEach(removeError);

      const nv = (nameEl.value || "").trim();
      const ev = (email.value || "").trim();
      const pv = (pass.value || "");
      const cv = (conf.value || "");

      let ok = true;
      if (!nv || nv.length < 2) { insertError(nameEl, "Please enter your full name."); ok = false; }
      if (!ev || !emailValid(ev)) { insertError(email, "Please enter a valid email."); ok = false; }
      if (!pv || !strongEnough(pv)) { insertError(pass, "Min 6 chars, include letters & numbers."); ok = false; }
      if (cv !== pv) { insertError(conf, "Passwords do not match."); ok = false; }
      if (!ok) return;

      if (emailExists(ev)) {
        insertError(email, "An account with this email already exists.");
        toast("Email already registered");
        return;
      }

      // disable button while "processing"
      const btn = $(".btn-primary", form);
      const original = btn ? btn.textContent : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Creating account…";
      }

    // Real async work (backend API)
    (async () => {
      try {
        await createUser({ name: nv, email: ev, password: pv });
        toast("Account created!");

        // optional auto-login
        const loginRes = await fetch("http://localhost:3000/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: ev, password: pv })
        });

        if (loginRes.ok) {
          const data = await loginRes.json();
          writeJSON(SESSION_KEY, { token: data.token, user: data.user, loginAt: Date.now() });
        }

        window.location.href = "home.html"; // or login.html if you prefer
      } catch (err) {
        toast("Could not create account");
        insertError(email, err.message || "Something went wrong. Please try again.");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = original || "Sign Up";
        }
      }
    })();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
