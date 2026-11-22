import { ACCESS } from "./config.js";
import { deriveFromCode, normalizeCode } from "./crypto.js";
import { connect, onStoreError, errorText } from "./store.js";
import { ls } from "./storage.js";
import { h, icon, logo, toast, newId, COLORS, hashColor, avatar, confirmBox, applyTheme } from "./ui.js";
import chatView from "./views/chat.js";
import { shoppingView, todoView, choresView } from "./views/lists.js";
import scheduleView from "./views/schedule.js";
import notesView from "./views/notes.js";
import settingsView from "./views/settings.js";

const root = document.getElementById("app");
export const SESSION_KEY = "fa-session";

const ROUTES = [
  { id: "chat", label: "Chat", title: "Familien-Chat", icon: "chat", view: chatView },
  { id: "einkauf", label: "Einkauf", title: "Einkaufsliste", icon: "cart", view: shoppingView },
  { id: "haushalt", label: "Haushalt", title: "Aufgaben & Haushalt", icon: "home", view: choresView },
  { id: "ablauf", label: "Ablauf", title: "Tagesablauf", icon: "clock", view: scheduleView },
  { id: "todo", label: "To-Do", title: "Familien-To-Do", icon: "todo", view: todoView },
  { id: "notizen", label: "Notizen", title: "Meine Notizen", icon: "note", view: notesView },
];
const SETTINGS = { id: "einstellungen", label: "Einstellungen", title: "Einstellungen", icon: "settings", view: settingsView };

// ── Start ────────────────────────────────────────────────────
boot();

async function boot() {
  applyTheme(ls.get("fa-theme", "auto"));
  const session = ls.get(SESSION_KEY);
  if (!session?.familyId) return showCodeScreen();

  root.replaceChildren(h("div", { class: "boot" }, logo(), h("p", {}, "Verbinde …")));
  let store;
  try {
    store = await connect(session.familyId);
  } catch (e) {
    console.error(e);
    return showErrorScreen(e);
  }
  onStoreError((e) => toast(errorText(e), { kind: "error", ms: 5000 }));
  const ctx = createCtx(store, session);
  if (!session.memberId) return showNameScreen(ctx);
  startMain(ctx);
}

function createCtx(store, session) {
  const listeners = {};
  const ctx = {
    store,
    session,
    members: new Map(),
    membersLoaded: false,
    chat: [],
    get me() {
      const m = ctx.members.get(session.memberId);
      return { id: session.memberId, name: m?.name || session.name || "?", color: m?.color || hashColor(session.name) };
    },
    name(id, fallback = "Unbekannt") {
      return ctx.members.get(id)?.name || fallback || "Unbekannt";
    },
    color(id, fallbackName = "") {
      return ctx.members.get(id)?.color || hashColor(fallbackName || id || "");
    },
    memberList() {
      return [...ctx.members.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
    },
    on(evt, fn) {
      (listeners[evt] ||= new Set()).add(fn);
      return () => listeners[evt].delete(fn);
    },
    emit(evt) {
      listeners[evt]?.forEach((fn) => fn());
    },
    saveSession() {
      ls.set(SESSION_KEY, session);
    },
    logout,
  };
  return ctx;
}

// ── Schritt 1: Zugangscode ───────────────────────────────────
function showCodeScreen() {
  const err = h("p", { class: "auth-error", role: "alert" });
  const input = h("input", {
    type: "text",
    class: "code-input",
    placeholder: "Code",
    autocomplete: "off",
    autocapitalize: "characters",
    spellcheck: "false",
    maxlength: 40,
    "aria-label": "Familien-Code",
  });
  const btn = h("button", { class: "btn primary block", type: "submit" }, "Weiter");

  const form = h(
    "form",
    {
      class: "auth-card",
      onsubmit: async (e) => {
        e.preventDefault();
        const code = normalizeCode(input.value);
        if (!code) {
          err.textContent = "Bitte gib den Code ein.";
          return input.focus();
        }
        btn.disabled = true;
        btn.textContent = "Prüfe …";
        err.textContent = "";
        try {
          const { verifier, familyId } = await deriveFromCode(code);
          if (verifier !== ACCESS.verifier) {
            err.textContent = "Der Code stimmt leider nicht.";
            input.select();
            return;
          }
          ls.set(SESSION_KEY, { familyId });
          boot();
        } catch (ex) {
          err.textContent =
            ex.message === "insecure-context"
              ? "Die App muss über https:// geöffnet werden."
              : "Das hat nicht geklappt. Bitte nochmal versuchen.";
        } finally {
          btn.disabled = false;
          btn.textContent = "Weiter";
        }
      },
    },
    logo(),
    h("h1", {}, "Familien-App"),
    h("p", { class: "muted" }, "Gib euren Familien-Code ein, um die App zu öffnen."),
    input,
    err,
    btn
  );
  root.replaceChildren(h("div", { class: "auth" }, form));
  input.focus();
}

// ── Schritt 2: Name ──────────────────────────────────────────
function showNameScreen(ctx) {
  let members = [];
  const existing = h("div", { class: "existing" });
  const err = h("p", { class: "auth-error", role: "alert" });
  const input = h("input", { type: "text", maxlength: 30, placeholder: "z. B. Isabella", autocomplete: "given-name", "aria-label": "Dein Name" });

  const unwatch = ctx.store.watch(["members"], (list) => {
    members = list;
    renderExisting();
  });

  function renderExisting() {
    existing.replaceChildren(
      ...(members.length
        ? [
            h("p", { class: "muted small" }, "Schon dabei (z. B. auf einem anderen Gerät)? Tippe auf deinen Namen:"),
            h(
              "div",
              { class: "chips center" },
              members.map((m) => h("button", { type: "button", class: "chip", onclick: () => choose(m) }, avatar(m.name, m.color, "tiny"), m.name))
            ),
          ]
        : [])
    );
  }

  async function choose(m) {
    const ok = await confirmBox(`Du meldest dich als „${m.name}“ an. Richtig?`, { title: "Das bist du?", ok: "Ja, das bin ich", danger: false });
    if (ok) finish(m.id, m.name);
  }

  function finish(id, name) {
    unwatch();
    ctx.session.memberId = id;
    ctx.session.name = name;
    ctx.saveSession();
    startMain(ctx);
  }

  const form = h(
    "form",
    {
      class: "auth-card",
      onsubmit: (e) => {
        e.preventDefault();
        const name = input.value.trim().replace(/\s+/g, " ");
        if (!name) {
          err.textContent = "Bitte gib deinen Namen ein.";
          return input.focus();
        }
        const same = members.find((m) => m.name.toLowerCase() === name.toLowerCase());
        if (same) return choose(same);
        const id = newId();
        const color = COLORS[members.length % COLORS.length];
        ctx.store.set(["members"], id, { name, color, createdAt: Date.now() });
        finish(id, name);
      },
    },
    logo(),
    h("h1", {}, "Wie heißt du?"),
    h("p", { class: "muted" }, "Dein Name wird im Chat und bei Einträgen angezeigt. Du kannst ihn später in den Einstellungen ändern."),
    input,
    err,
    h("button", { class: "btn primary block", type: "submit" }, "Los geht’s"),
    existing
  );
  root.replaceChildren(h("div", { class: "auth" }, form));
  input.focus();
}

function showErrorScreen(e) {
  const msg = String(e?.code || e?.message || e);
  root.replaceChildren(
    h(
      "div",
      { class: "auth" },
      h(
        "div",
        { class: "auth-card" },
        logo(),
        h("h1", {}, "Keine Verbindung"),
        h("p", { class: "muted" }, "Die Datenbank konnte nicht erreicht werden. Bist du online?"),
        h("p", { class: "small muted" }, errorText(e) + (msg ? ` (${msg})` : "")),
        h("button", { class: "btn primary block", type: "button", onclick: () => location.reload() }, "Nochmal versuchen")
      )
    )
  );
}

// ── Hauptansicht ─────────────────────────────────────────────
function startMain(ctx) {
  const title = h("h1", { class: "topbar-title" });
  const content = h("main", { class: "content", id: "content", tabindex: "-1" });
  const badge = h("span", { class: "badge", hidden: true });

  const navLink = (r) =>
    h(
      "a",
      { href: "#" + r.id, class: "nav-item" + (r === SETTINGS ? " nav-settings" : ""), dataset: { route: r.id } },
      icon(r.icon),
      h("span", { class: "nav-label" }, r.label),
      r.id === "chat" ? badge : null
    );

  const banner =
    ctx.store.mode === "demo" && !ls.get("fa-demo-banner-hidden")
      ? h(
          "div",
          { class: "banner" },
          icon("info"),
          h("span", {}, h("b", {}, "Demo-Modus: "), "Einträge bleiben nur auf diesem Gerät, bis die Datenbank eingerichtet ist."),
          h(
            "button",
            {
              type: "button",
              class: "icon-btn small",
              "aria-label": "Hinweis ausblenden",
              onclick: (e) => {
                ls.set("fa-demo-banner-hidden", true);
                e.currentTarget.closest(".banner").remove();
              },
            },
            icon("close")
          )
        )
      : null;

  const shell = h(
    "div",
    { class: "shell" },
    h(
      "nav",
      { class: "nav", "aria-label": "Bereiche" },
      h("div", { class: "nav-brand" }, logo(), h("span", {}, "Familien-App")),
      ROUTES.map(navLink),
      navLink(SETTINGS)
    ),
    h(
      "div",
      { class: "main" },
      h(
        "header",
        { class: "topbar" },
        title,
        ctx.store.mode === "demo" ? h("span", { class: "pill warn" }, "Demo") : null,
        h("a", { href: "#einstellungen", class: "icon-btn topbar-settings", "aria-label": "Einstellungen" }, icon("settings"))
      ),
      banner,
      content
    )
  );
  root.replaceChildren(shell);

  // Gemeinsame Live-Daten
  ctx.store.watch(["members"], (list) => {
    ctx.members = new Map(list.map((m) => [m.id, m]));
    ctx.membersLoaded = true;
    if (!ctx.members.has(ctx.session.memberId) && ctx.session.name) {
      // Eigenes Profil fehlt (z. B. gelöscht) → wieder anlegen
      ctx.store.set(["members"], ctx.session.memberId, { name: ctx.session.name, color: hashColor(ctx.session.name), createdAt: Date.now() });
    }
    ctx.emit("members");
  });
  ctx.store.watch(
    ["chat"],
    (msgs) => {
      ctx.chat = msgs;
      ctx.emit("chat");
      updateBadge();
    },
    { limitLast: 300 }
  );

  let current = null;
  function route() {
    const id = location.hash.slice(1) || "chat";
    const r = ROUTES.find((x) => x.id === id) || (id === SETTINGS.id ? SETTINGS : ROUTES[0]);
    if (current?.id === r.id) return;
    try {
      current?.unmount?.();
    } catch (e) {
      console.error(e);
    }
    content.replaceChildren();
    content.className = "content view-" + r.id;
    title.textContent = r.title;
    shell.querySelectorAll(".nav-item").forEach((a) => a.classList.toggle("active", a.dataset.route === r.id));
    ctx.route = r.id;
    current = { id: r.id, unmount: r.view(content, ctx) };
    content.scrollTop = 0;
    updateBadge();
  }

  function updateBadge() {
    const last = ls.get("fa-chat-read", 0);
    const newest = ctx.chat.length ? ctx.chat[ctx.chat.length - 1].createdAt : 0;
    if (ctx.route === "chat" && newest > last) ls.set("fa-chat-read", newest);
    const unread = ctx.route === "chat" ? 0 : ctx.chat.filter((m) => m.createdAt > last && m.memberId !== ctx.me.id).length;
    badge.hidden = unread === 0;
    badge.textContent = unread > 9 ? "9+" : String(unread);
    document.title = unread ? `(${unread}) Familien-App` : "Familien-App";
  }

  window.addEventListener("hashchange", route);
  route();
}

// Für die Einstellungen (über ctx.logout erreichbar)
async function logout() {
  const ok = await confirmBox("Auf diesem Gerät abmelden? Du brauchst danach wieder den Familien-Code. Deine privaten Notizen bleiben auf diesem Gerät erhalten.", {
    title: "Abmelden",
    ok: "Abmelden",
  });
  if (!ok) return;
  ls.del(SESSION_KEY);
  location.hash = "";
  location.reload();
}
