// Cartoon Studio — application bootstrap.
// Wires every interactive surface: nav, scroll reveals, the live Studio,
// gallery, revenue tools, and the contact form.

import { STYLES, EXAMPLE_SUBJECTS, buildMasterPrompt } from "./lib/prompts.js";
import { generate } from "./lib/backends.js";
import { validators } from "./lib/validate.js";
import {
  PLANS, planPrice, quoteCommercial, PRINT_PRODUCTS, PRINT_SIZES, printPrice,
  STYLE_PACKS, cartTotal,
} from "./lib/pricing.js";
import { GALLERY, TESTIMONIALS, STATS, FEATURES } from "./data.js";
import { submitContact, paymentLink, planLinkKey, startCheckout } from "./lib/payments.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, attrs = {}, html = "") => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "dataset") Object.assign(n.dataset, v);
    else n.setAttribute(k, v);
  }
  if (html) n.innerHTML = html;
  return n;
};
const money = (n) => "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 });

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initFooterYear();
  initReveal();
  initStats();
  initFeatures();
  initStudio();
  initGallery();
  initPlans();
  initQuote();
  initStore();
  initPrintShop();
  initTestimonials();
  initContactForm();
});

/* ---------------- Navigation ---------------- */
function initNav() {
  const toggle = $("#nav-toggle");
  const nav = $("#primary-nav");
  if (!toggle || !nav) return;
  const setNav = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () =>
    setNav(toggle.getAttribute("aria-expanded") !== "true")
  );
  nav.addEventListener("click", (e) => e.target.closest("a") && setNav(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setNav(false));

  // Shrink header on scroll for a premium feel.
  const header = $(".site-header");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initFooterYear() {
  const y = $("#year");
  if (y) y.textContent = String(new Date().getFullYear());
}

/* ---------------- Scroll reveal ---------------- */
function initReveal() {
  const els = $$("[data-reveal]");
  if (!("IntersectionObserver" in window) || !els.length) {
    els.forEach((e) => e.classList.add("revealed"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((e) => io.observe(e));
}

/* ---------------- Stats + Features ---------------- */
function initStats() {
  const mount = $("#stats");
  if (!mount) return;
  STATS.forEach((s) => {
    mount.appendChild(
      el("div", { class: "stat", "data-reveal": "" },
        `<span class="stat-value">${s.value}</span><span class="stat-label">${s.label}</span>`)
    );
  });
}

function initFeatures() {
  const mount = $("#features-grid");
  if (!mount) return;
  FEATURES.forEach((f) => {
    mount.appendChild(
      el("article", { class: "feature card", "data-reveal": "" },
        `<div class="feature-icon" aria-hidden="true">${f.icon}</div>
         <h3>${f.title}</h3><p>${f.body}</p>`)
    );
  });
}

/* ---------------- Live Studio ---------------- */
function initStudio() {
  const root = $("#studio");
  if (!root) return;

  const styleWrap = $("#studio-styles", root);
  const subject = $("#studio-subject", root);
  const chipsWrap = $("#studio-chips", root);
  const genBtn = $("#studio-generate", root);
  const canvas = $("#studio-canvas", root);
  const promptView = $("#studio-prompt", root);
  const dlBtn = $("#studio-download", root);
  const engineTag = $("#studio-engine", root);

  let activeStyle = STYLES[0].id;
  let currentSvgSrc = null;
  let seedCounter = 0;

  // Style cards
  STYLES.forEach((s, i) => {
    const btn = el("button", {
      class: "style-card" + (i === 0 ? " active" : ""),
      type: "button",
      dataset: { style: s.id },
      "aria-pressed": i === 0 ? "true" : "false",
    }, `<strong>${s.name}</strong><span>${s.tagline}</span>`);
    btn.addEventListener("click", () => {
      activeStyle = s.id;
      $$(".style-card", styleWrap).forEach((c) => {
        const on = c.dataset.style === s.id;
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", String(on));
      });
      updatePrompt();
    });
    styleWrap.appendChild(btn);
  });

  // Example chips
  EXAMPLE_SUBJECTS.forEach((ex) => {
    const chip = el("button", { class: "chip", type: "button" }, ex);
    chip.addEventListener("click", () => {
      subject.value = ex;
      updatePrompt();
      render();
    });
    chipsWrap.appendChild(chip);
  });

  function updatePrompt() {
    const mp = buildMasterPrompt(activeStyle, subject.value);
    promptView.textContent = mp.positive;
  }

  async function render() {
    genBtn.disabled = true;
    genBtn.classList.add("loading");
    canvas.classList.add("rendering");
    engineTag.textContent = "";
    // Small delay so the shimmer reads as "working" even though it's instant.
    await new Promise((r) => setTimeout(r, 260));

    const result = await generate({
      prompt: subject.value.trim() || "a friendly character",
      style: activeStyle,
      seed: (seedCounter += 1) * 2654435761,
    });
    currentSvgSrc = result.src;
    canvas.innerHTML = `<img src="${result.src}" alt="Generated cartoon" />`;
    engineTag.textContent =
      result.engine === "demo" ? "Rendered by Studio Demo Engine" : `Rendered by ${result.engine}`;
    dlBtn.disabled = false;
    genBtn.disabled = false;
    genBtn.classList.remove("loading");
    canvas.classList.remove("rendering");
  }

  subject.addEventListener("input", updatePrompt);
  genBtn.addEventListener("click", render);
  $("#studio-variation", root)?.addEventListener("click", render);

  dlBtn.addEventListener("click", () => {
    if (!currentSvgSrc) return;
    const a = el("a", { href: currentSvgSrc, download: "cartoon-studio.svg" });
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // Seed the demo with a real example so the studio never looks empty.
  subject.value = EXAMPLE_SUBJECTS[0];
  updatePrompt();
  render();
}

/* ---------------- Gallery ---------------- */
function initGallery() {
  const grid = $("#gallery-grid");
  if (!grid) return;
  grid.innerHTML = "";
  // Import lazily to keep the initial render snappy.
  import("./lib/renderer.js").then(({ renderCartoonDataUrl }) => {
    GALLERY.forEach((item) => {
      const src = renderCartoonDataUrl({ prompt: item.prompt, style: item.style });
      const card = el("figure", { class: "gallery-item", "data-reveal": "" },
        `<img src="${src}" alt="${item.title}: ${item.prompt}" loading="lazy" />
         <figcaption><strong>${item.title}</strong><span>${item.by}</span></figcaption>`);
      grid.appendChild(card);
    });
    initReveal();
  });
}

/* ---------------- Pricing plans ---------------- */
function initPlans() {
  const mount = $("#plans");
  const toggle = $("#billing-toggle");
  if (!mount) return;
  let cycle = "monthly";

  const draw = () => {
    mount.innerHTML = "";
    PLANS.forEach((p) => {
      const price = planPrice(p, cycle);
      const suffix = cycle === "annual" ? "/yr" : "/mo";
      const card = el("article", {
        class: "plan card" + (p.featured ? " featured" : ""),
        "data-reveal": "",
      }, `
        ${p.featured ? '<span class="badge">Most popular</span>' : ""}
        <h3>${p.name}</h3>
        <p class="plan-blurb">${p.blurb}</p>
        <p class="plan-price"><span class="amount">${money(price)}</span><span class="per">${suffix}</span></p>
        <ul>${p.features.map((f) => `<li>${f}</li>`).join("")}</ul>
        <button class="btn ${p.featured ? "btn-primary" : "btn-ghost"}" type="button" data-plan="${p.id}">${p.cta}</button>
      `);
      mount.appendChild(card);
    });
    $$("[data-plan]", mount).forEach((b) =>
      b.addEventListener("click", () => {
        const plan = PLANS.find((p) => p.id === b.dataset.plan);
        const priceLabel = `${money(planPrice(plan, cycle))}${cycle === "annual" ? "/yr" : "/mo"}`;
        const link = paymentLink(planLinkKey(plan.id, cycle));
        if (link) {
          // Configured: send the buyer to Stripe-hosted checkout.
          flash($("#plan-status"), `Redirecting to secure checkout for ${plan.name} (${priceLabel})…`);
          window.location.assign(link);
          return;
        }
        // Demo fallback until a Stripe Payment Link is configured.
        flash($("#plan-status"),
          `Great choice — ${plan.name} at ${priceLabel}. Add a Stripe Payment Link to enable live checkout.`);
      })
    );
  };

  if (toggle) {
    toggle.addEventListener("change", () => {
      cycle = toggle.checked ? "annual" : "monthly";
      $("#billing-label").textContent = toggle.checked ? "Annual (save 17%)" : "Monthly";
      draw();
    });
  }
  draw();
}

/* ---------------- Commercial license quote ---------------- */
function initQuote() {
  const form = $("#quote-form");
  if (!form) return;
  const out = $("#quote-result");

  const compute = () => {
    const data = {
      scope: form.scope.value,
      reach: form.reach.value,
      assets: Number(form.assets.value) || 1,
      exclusive: form.exclusive.checked,
      rush: form.rush.checked,
    };
    const q = quoteCommercial(data);
    out.innerHTML =
      `<span class="quote-total">${money(q.total)}</span>
       <span class="quote-sub">${money(q.perAsset)} per asset · ${data.assets} asset${data.assets > 1 ? "s" : ""}</span>`;
    form.dataset.total = String(q.total);
  };

  $$("input, select", form).forEach((i) =>
    i.addEventListener("input", compute)
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    checkoutOrDemo(
      {
        kind: "quote",
        scope: form.scope.value,
        reach: form.reach.value,
        assets: Number(form.assets.value) || 1,
        exclusive: form.exclusive.checked,
        rush: form.rush.checked,
      },
      $("#quote-status"),
      `Quote locked at ${money(Number(form.dataset.total))}. Add a checkout API to take payment live.`
    );
  });
  compute();
}

/* ---------------- Style-pack store ---------------- */
function initStore() {
  const mount = $("#store-grid");
  if (!mount) return;
  const cart = [];
  const cartCount = $("#cart-count");
  const cartTotalEl = $("#cart-total");

  const refresh = () => {
    cartCount.textContent = String(cart.reduce((n, i) => n + i.qty, 0));
    cartTotalEl.textContent = money(cartTotal(cart));
  };

  STYLE_PACKS.forEach((pack) => {
    const card = el("article", { class: "pack card", "data-reveal": "" }, `
      <h3>${pack.name}</h3>
      <p class="pack-blurb">${pack.blurb}</p>
      <p class="pack-meta">${pack.count} styles · <strong>${money(pack.price)}</strong></p>
      <button class="btn btn-ghost" type="button" data-pack="${pack.id}">Add to cart</button>
    `);
    $("button", card).addEventListener("click", () => {
      const existing = cart.find((i) => i.id === pack.id);
      if (existing) existing.qty += 1;
      else cart.push({ id: pack.id, price: pack.price, qty: 1 });
      refresh();
      flash($("#store-status"), `Added “${pack.name}” to your cart.`);
    });
    mount.appendChild(card);
  });
  refresh();

  $("#cart-checkout")?.addEventListener("click", () => {
    if (!cart.length) return flash($("#store-status"), "Your cart is empty — add a style pack first.");
    checkoutOrDemo(
      { kind: "cart", items: cart.map((i) => ({ id: i.id, qty: i.qty })) },
      $("#store-status"),
      `Checking out ${cart.reduce((n, i) => n + i.qty, 0)} pack(s) for ${money(cartTotal(cart))}… Add a checkout API to take payment live.`
    );
  });
}

/* ---------------- Print shop ---------------- */
function initPrintShop() {
  const form = $("#print-form");
  if (!form) return;
  const out = $("#print-result");

  const compute = () => {
    const res = printPrice({
      product: form.product.value,
      size: form.size.value,
      qty: Number(form.qty.value) || 1,
    });
    out.innerHTML =
      `<span class="quote-total">${money(res.total)}</span>
       <span class="quote-sub">${money(res.unit)} each${res.bulkApplied ? " · bulk discount applied" : ""}</span>`;
    form.dataset.total = String(res.total);
  };

  $$("input, select", form).forEach((i) => i.addEventListener("input", compute));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    checkoutOrDemo(
      {
        kind: "print",
        product: form.product.value,
        size: form.size.value,
        qty: Number(form.qty.value) || 1,
      },
      $("#print-status"),
      `Order ready — ${money(Number(form.dataset.total))} total. Add a checkout API to take payment live.`
    );
  });
  compute();
}

/* ---------------- Testimonials ---------------- */
function initTestimonials() {
  const mount = $("#testimonials");
  if (!mount) return;
  TESTIMONIALS.forEach((t) => {
    mount.appendChild(
      el("figure", { class: "testimonial card", "data-reveal": "" }, `
        <blockquote>“${t.quote}”</blockquote>
        <figcaption><strong>${t.name}</strong><span>${t.role}</span></figcaption>`)
    );
  });
}

/* ---------------- Contact form ---------------- */
function initContactForm() {
  const form = $("#contact-form");
  if (!form) return;
  const status = $("#form-status");

  const setFieldError = (field, message) => {
    const errorEl = $("#" + field.name + "-error");
    field.classList.toggle("invalid", Boolean(message));
    field.setAttribute("aria-invalid", message ? "true" : "false");
    if (errorEl) errorEl.textContent = message;
    return !message;
  };
  const setStatus = (message, type) => {
    if (!status) return;
    status.textContent = message;
    status.className = "form-status" + (type ? " " + type : "");
  };

  form.addEventListener("input", (e) => {
    const f = e.target;
    if (validators[f.name] && f.classList.contains("invalid"))
      setFieldError(f, validators[f.name](f.value));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setStatus("", null);
    let firstInvalid = null;
    Object.keys(validators).forEach((name) => {
      const field = form.elements[name];
      if (!setFieldError(field, validators[name](field.value)) && !firstInvalid)
        firstInvalid = field;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      setStatus("Please fix the highlighted fields.", "error");
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    setStatus("Sending…", null);

    // Delivers via Formspree when configured (js/lib/payments.js); otherwise
    // resolves locally so the demo still confirms.
    submitContact({
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim(),
    })
      .then(() => {
        form.reset();
        setStatus("Thanks! We'll be in touch soon.", "success");
      })
      .catch(() => {
        setStatus("Something went wrong sending your enquiry. Please try again.", "error");
      })
      .finally(() => btn && (btn.disabled = false));
  });
}

/* ---------------- helpers ---------------- */
let flashTimer;
function flash(node, message) {
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => node.classList.remove("show"), 4200);
}

// Route a dynamic-amount purchase through the checkout API when configured,
// otherwise show the demo message. Prices are computed server-side.
function checkoutOrDemo(payload, statusNode, demoMessage) {
  flash(statusNode, "Preparing secure checkout…");
  startCheckout(payload)
    .then((url) => {
      if (url) window.location.assign(url);
      else flash(statusNode, demoMessage);
    })
    .catch(() => flash(statusNode, "Checkout is temporarily unavailable. Please try again."));
}
