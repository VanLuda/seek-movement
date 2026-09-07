/* The Seek Movement – site scripts (no dependencies) */
(function () {
  "use strict";

  var cfg = window.SEEK_CONFIG || { payments: {}, forms: {} };
  var payments = cfg.payments || {};
  var forms = cfg.forms || {};

  /* ---------- Header: solid on scroll, mobile menu ---------- */
  var header = document.getElementById("site-header");
  var toggle = document.querySelector(".nav-toggle");
  var mobileNav = document.getElementById("mobile-nav");

  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 10);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setMenu(open) {
    if (!toggle || !mobileNav) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileNav.hidden = !open;
    header.classList.toggle("menu-open", open);
    document.body.classList.toggle("no-scroll", open);
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    mobileNav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 767) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
  }

  /* ---------- Helpers ---------- */
  function showStatus(el, type, message) {
    if (!el) return;
    el.className = "form-status " + type;
    el.textContent = message;
    el.hidden = false;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function setBusy(btn, busy, label) {
    if (!btn) return;
    btn.disabled = busy;
    btn.setAttribute("aria-busy", String(busy));
    if (label) {
      if (busy) { btn.dataset.label = btn.textContent; btn.textContent = label; }
      else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
    }
  }
  function formToObject(form) {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (value, key) {
      if (key in data) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    form.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      if (!cb.name) return;
      if (!(cb.name in data)) data[cb.name] = false;
      else if (data[cb.name] === cb.value || data[cb.name] === "on") data[cb.name] = true;
    });
    return data;
  }
  function endpoint(base, path) {
    return base.replace(/\/+$/, "") + path;
  }
  function postJSON(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) throw new Error(json.error || json.message || ("Request failed (" + res.status + ")"));
        return json;
      });
    });
  }

  /* ---------- Registration → Stripe Checkout ---------- */
  var reg = document.getElementById("registration-form");
  if (reg) {
    var regStatus = reg.querySelector(".form-status");
    var regBtn = reg.querySelector('button[type="submit"]');
    reg.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!reg.reportValidity()) return;
      if (reg.querySelector(".honeypot input") && reg.querySelector(".honeypot input").value) return;
      var data = formToObject(reg);
      regStatus.hidden = true;

      if (payments.checkoutEndpoint) {
        setBusy(regBtn, true, "Redirecting to secure payment…");
        postJSON(endpoint(payments.checkoutEndpoint, "/checkout"), data)
          .then(function (json) {
            if (!json.url) throw new Error("No checkout URL returned.");
            window.location.href = json.url;
          })
          .catch(function (err) {
            setBusy(regBtn, false, true);
            showStatus(regStatus, "error", "We couldn't start your payment: " + err.message + " Please try again or email " + (reg.dataset.contact || "us") + ".");
          });
      } else if (payments.registrationPaymentLink) {
        var link = payments.registrationPaymentLink;
        link += (link.indexOf("?") === -1 ? "?" : "&") + "prefilled_email=" + encodeURIComponent(data.email || "");
        window.location.href = link;
      } else {
        showStatus(regStatus, "info", "Online registration is not available yet. Please email " + (reg.dataset.contact || "us") + " to register.");
      }
    });
  }

  /* ---------- Donate → Stripe Checkout ---------- */
  var donate = document.getElementById("donate-form");
  if (donate) {
    var donateStatus = donate.querySelector(".form-status");
    var donateBtn = donate.querySelector('button[type="submit"]');
    var amountInput = donate.querySelector('input[name="amount"]');
    donate.addEventListener("submit", function (e) {
      e.preventDefault();
      donateStatus.hidden = true;
      var amount = parseFloat(String(amountInput.value).replace(/[^0-9.]/g, ""));
      if (payments.checkoutEndpoint) {
        if (!(amount >= 1)) {
          showStatus(donateStatus, "error", "Please enter an amount of $1 or more.");
          amountInput.focus();
          return;
        }
        setBusy(donateBtn, true, "One moment…");
        postJSON(endpoint(payments.checkoutEndpoint, "/donate"), { amount: amount })
          .then(function (json) {
            if (!json.url) throw new Error("No checkout URL returned.");
            window.location.href = json.url;
          })
          .catch(function (err) {
            setBusy(donateBtn, false, true);
            showStatus(donateStatus, "error", "We couldn't start your donation: " + err.message);
          });
      } else if (payments.donatePaymentLink) {
        window.location.href = payments.donatePaymentLink;
      } else {
        showStatus(donateStatus, "info", "Online giving is not available yet. Please contact us to give.");
      }
    });
  }

  /* ---------- Simple forms (survey, release) → form endpoint ---------- */
  document.querySelectorAll("form[data-form]").forEach(function (form) {
    var status = form.querySelector(".form-status");
    var btn = form.querySelector('button[type="submit"]');
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var hp = form.querySelector(".honeypot input");
      if (hp && hp.value) return;
      if (!forms.endpoint) {
        showStatus(status, "info", "This form is not connected yet. Please email us instead.");
        return;
      }
      var data = formToObject(form);
      data._form = form.dataset.form;
      data._subject = form.dataset.subject || ("Website " + form.dataset.form + " submission");
      setBusy(btn, true, "Sending…");
      postJSON(forms.endpoint, data)
        .then(function () {
          form.querySelectorAll(".form-section, .form-actions, .field, .likert, .form-intro").forEach(function (el) { el.hidden = true; });
          showStatus(status, "success", form.dataset.success || "Thank you! Your response has been received.");
        })
        .catch(function (err) {
          setBusy(btn, false, true);
          showStatus(status, "error", "Something went wrong: " + err.message + " Please try again.");
        });
    });
  });
})();
