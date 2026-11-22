// Kleine Helfer für die Oberfläche (ohne Framework).

// ── Elemente bauen ───────────────────────────────────────────
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "value") el.value = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (typeof v === "boolean" && k in el) el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of [children].flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

/** Inhalt ersetzen (null/false werden ignoriert). */
export function fill(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

export function shorten(text, n = 40) {
  const s = String(text || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ── Icons (eigene, einfache Strich-Icons) ────────────────────
const ICONS = {
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.7l2.6 11.4a1.8 1.8 0 0 0 1.8 1.4h8.3a1.8 1.8 0 0 0 1.7-1.3L21.5 8H6.1"/>',
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V10"/><path d="M10 20.5v-5.5h4v5.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  todo: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 12.2 2.8 2.8L16.5 9"/>',
  note: '<path d="M6 3.5h8.5l4 4V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M14 3.5V8h4.5"/><path d="M8 12.5h8M8 16.5h5"/>',
  settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/><path d="m11 13 9-9"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  comment: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
  repeat: '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 11.5V10a4 4 0 0 1 4-4h13"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2 1.5M9.5 2.5h5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.3v.2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  logout: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
};

export function icon(name, cls = "") {
  const span = document.createElement("span");
  span.className = "icon" + (cls ? " " + cls : "");
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
  return span;
}

export function logo() {
  const span = document.createElement("span");
  span.className = "logo";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML =
    '<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#d9622b"/><path d="M14 30 32 15l18 15v19a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="#fff"/><path d="M32 46s-9-5.3-9-11.2c0-2.8 2.1-4.8 4.6-4.8 1.8 0 3.4 1 4.4 2.6 1-1.6 2.6-2.6 4.4-2.6 2.5 0 4.6 2 4.6 4.8C41 40.7 32 46 32 46z" fill="#d9622b"/></svg>';
  return span;
}

// ── IDs, Farben, Avatare ─────────────────────────────────────
export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return [...bytes].map((b) => (b % 36).toString(36)).join("") + Date.now().toString(36);
}

export const COLORS = ["#d9622b", "#2f8f83", "#5b6ee1", "#c2477a", "#8a63d2", "#3d8b3d", "#b98a1b", "#3b88b5"];

export function hashColor(str = "") {
  let n = 0;
  for (const ch of String(str).toLowerCase()) n = (n * 31 + ch.codePointAt(0)) >>> 0;
  return COLORS[n % COLORS.length];
}

export function initials(name = "?") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]].map((p) => [...p][0]) : [...(parts[0] || "?")].slice(0, 2);
  return letters.join("").toUpperCase();
}

export function avatar(name, color, cls = "") {
  return h("span", { class: "avatar " + cls, style: { background: color || hashColor(name) }, title: name }, initials(name));
}

// ── Datum & Zeit ─────────────────────────────────────────────
const fTime = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const fShort = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
const fShortYear = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" });
const fLong = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" });
const fWeekdayShort = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short" });

export const fmtTime = (ts) => fTime.format(new Date(ts));
export function fmtDate(ts) {
  const d = new Date(ts);
  return d.getFullYear() === new Date().getFullYear() ? fShort.format(d) : fShortYear.format(d);
}
export const fmtLong = (ts) => fLong.format(new Date(ts));

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dayDiff(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
}

export function dayLabel(ts) {
  const diff = dayDiff(ts, new Date());
  if (diff === 0) return "Heute";
  if (diff === -1) return "Gestern";
  return fmtLong(ts);
}

export function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  const days = dayDiff(new Date(), ts);
  if (days === 0) return `vor ${Math.floor(s / 3600)} Std.`;
  if (days === 1) return `gestern, ${fmtTime(ts)}`;
  if (days < 7) return `vor ${days} Tagen`;
  return `am ${fmtDate(ts)}`;
}

export function toISO(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export const todayISO = () => toISO(new Date());
export function fromISO(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Fälligkeit als Text + CSS-Klasse */
export function dueInfo(iso) {
  if (!iso) return null;
  const diff = dayDiff(fromISO(iso), new Date());
  if (diff < -1) return { text: `seit ${-diff} Tagen fällig`, cls: "overdue" };
  if (diff === -1) return { text: "seit gestern fällig", cls: "overdue" };
  if (diff === 0) return { text: "heute", cls: "today" };
  if (diff === 1) return { text: "morgen", cls: "soon" };
  if (diff < 7) return { text: fWeekdayShort.format(fromISO(iso)), cls: "soon" };
  return { text: fmtDate(fromISO(iso)), cls: "" };
}

// ── Text mit @Erwähnungen und Links ──────────────────────────
const TOKEN = /(https?:\/\/[^\s<>"]+)|(@[\p{L}\p{N}_-]+)/gu;

export function richText(text, ctx) {
  const frag = document.createDocumentFragment();
  const str = String(text || "");
  const myFirst = ctx?.me?.name ? ctx.me.name.split(/\s+/)[0].toLowerCase() : null;
  let last = 0;
  for (const m of str.matchAll(TOKEN)) {
    if (m.index > last) frag.append(str.slice(last, m.index));
    if (m[1]) {
      const url = m[1].replace(/[.,;:!?)\]]+$/, "");
      frag.append(h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, url), m[1].slice(url.length));
    } else {
      const isMe = myFirst && m[2].slice(1).toLowerCase() === myFirst;
      frag.append(h("span", { class: "mention" + (isMe ? " me" : "") }, m[2]));
    }
    last = m.index + m[0].length;
  }
  frag.append(str.slice(last));
  return frag;
}

/** Findet ein Familienmitglied, das im Text mit @Name erwähnt wird. */
export function findMention(text, members) {
  for (const m of String(text || "").matchAll(/@([\p{L}\p{N}_-]+)/gu)) {
    const word = m[1].toLowerCase();
    const hit = members.find((p) => p.name.toLowerCase() === word || p.name.split(/\s+/)[0].toLowerCase() === word);
    if (hit) return hit;
  }
  return null;
}

// ── Modale Fenster ───────────────────────────────────────────
export function modal({ title, body, actions = [], onClose, cls = "" }) {
  const bodyEl = h("div", { class: "modal-body" }, body);
  const dlg = h("dialog", { class: "modal " + cls, "aria-label": title });
  const close = () => {
    if (dlg.open) dlg.close();
  };
  const footer = actions.length
    ? h(
        "div",
        { class: "modal-actions" },
        actions.map((a) =>
          h(
            "button",
            { type: "button", class: "btn " + (a.kind || ""), onclick: () => (a.onClick ? a.onClick(close) : close()) },
            a.icon ? icon(a.icon) : null,
            a.label
          )
        )
      )
    : null;
  dlg.append(
    h(
      "div",
      { class: "modal-inner" },
      h("div", { class: "modal-head" }, h("h2", {}, title), h("button", { type: "button", class: "icon-btn", "aria-label": "Schließen", onclick: close }, icon("close"))),
      bodyEl,
      footer
    )
  );
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) close();
  });
  dlg.addEventListener("close", () => {
    dlg.remove();
    onClose?.();
  });
  document.body.append(dlg);
  dlg.showModal();
  return {
    close,
    dlg,
    setBody(node) {
      bodyEl.replaceChildren(node);
    },
  };
}

export function confirmBox(text, { title = "Bist du sicher?", ok = "Löschen", danger = true } = {}) {
  return new Promise((resolve) => {
    let result = false;
    modal({
      title,
      body: h("p", { class: "confirm-text" }, text),
      cls: "small",
      actions: [
        { label: "Abbrechen" },
        {
          label: ok,
          kind: danger ? "danger solid" : "primary",
          onClick: (close) => {
            result = true;
            close();
          },
        },
      ],
      onClose: () => resolve(result),
    });
  });
}

// ── Kurze Hinweise unten ─────────────────────────────────────
let toastTimer = null;
export function toast(msg, { kind = "", action = null, ms = 3200 } = {}) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  clearTimeout(toastTimer);
  const t = h(
    "div",
    { class: "toast " + kind, role: "status" },
    h("span", {}, msg),
    action
      ? h(
          "button",
          {
            type: "button",
            onclick: () => {
              action.onClick();
              t.remove();
            },
          },
          action.label
        )
      : null
  );
  (document.querySelector("dialog[open]") || document.body).append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, ms);
}

// ── Kleines Menü (⋯) ─────────────────────────────────────────
let openPop = null;
export function closePopover() {
  if (!openPop) return;
  openPop.el.remove();
  document.removeEventListener("pointerdown", openPop.outside, true);
  window.removeEventListener("resize", closePopover);
  document.removeEventListener("scroll", closePopover, true);
  openPop = null;
}

export function popover(anchor, items) {
  closePopover();
  const el = h(
    "div",
    { class: "popover", role: "menu" },
    items.map((i) =>
      h(
        "button",
        {
          type: "button",
          role: "menuitem",
          class: "pop-item" + (i.danger ? " danger" : ""),
          onclick: () => {
            closePopover();
            i.onClick();
          },
        },
        icon(i.icon),
        i.label
      )
    )
  );
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth;
  const ht = el.offsetHeight;
  let top = r.bottom + 4;
  if (top + ht > innerHeight - 8) top = Math.max(8, r.top - ht - 4);
  const left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8));
  el.style.top = top + "px";
  el.style.left = left + "px";
  const outside = (e) => {
    if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover();
  };
  openPop = { el, outside };
  document.addEventListener("pointerdown", outside, true);
  window.addEventListener("resize", closePopover);
  document.addEventListener("scroll", closePopover, true);
  el.querySelector("button")?.focus();
}

// ── Formularfelder ───────────────────────────────────────────
export function field({ label, value = "", max, multiline = false, placeholder = "", type = "text", required = false, rows = 4, list, hint }) {
  const input = multiline
    ? h("textarea", { rows, maxlength: max, placeholder })
    : h("input", { type, maxlength: max, placeholder, list, autocomplete: "off" });
  input.value = value ?? "";
  const counter = max ? h("span", { class: "counter", "aria-hidden": "true" }) : null;
  const update = () => {
    if (!counter) return;
    counter.textContent = `${input.value.length}/${max}`;
    counter.classList.toggle("near", input.value.length >= max * 0.9);
  };
  input.addEventListener("input", () => {
    update();
    wrap.classList.remove("invalid");
  });
  const wrap = h(
    "label",
    { class: "field" },
    h("span", { class: "field-label" }, label, required ? h("span", { class: "req" }, " *") : null),
    counter,
    input,
    hint ? h("span", { class: "field-hint" }, hint) : null
  );
  update();
  return { wrap, input };
}

export function selectField(label, options, value) {
  const sel = h(
    "select",
    {},
    options.map((o) => h("option", { value: o.value }, o.label))
  );
  sel.value = value ?? "";
  return { wrap: h("label", { class: "field" }, h("span", { class: "field-label" }, label), sel), sel };
}

export function emptyState(iconName, title, text) {
  return h("div", { class: "empty" }, icon(iconName, "big"), h("p", { class: "empty-title" }, title), text ? h("p", { class: "muted" }, text) : null);
}

// ── Design (hell/dunkel) ─────────────────────────────────────
export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "light" || mode === "dark") root.dataset.theme = mode;
  else delete root.dataset.theme;
}
