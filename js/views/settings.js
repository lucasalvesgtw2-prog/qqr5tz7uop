import { h, icon, avatar, field, toast, confirmBox, COLORS, applyTheme, fill, append } from "../ui.js";
import { ls } from "../storage.js";
import { APP_VERSION } from "../config.js";

export default function settingsView(el, ctx) {
  const profile = h("section", { class: "section" });
  const family = h("section", { class: "section" });

  // ── Profil ──
  const fName = field({ label: "Dein Name", max: 30, value: ctx.me.name });
  const preview = h("div", { class: "profile-preview" });
  const swatches = h("div", { class: "swatches", role: "radiogroup", "aria-label": "Deine Farbe" });

  function renderProfile() {
    fill(preview, avatar(fName.input.value.trim() || ctx.me.name, ctx.me.color, "large"), h("div", {}, h("b", {}, ctx.me.name), h("div", { class: "muted small" }, "So sieht die Familie dich.")));
    fill(
      swatches,
      COLORS.map((c) =>
        h("button", {
          type: "button",
          class: "swatch" + (c === ctx.me.color ? " on" : ""),
          style: { background: c },
          role: "radio",
          "aria-checked": String(c === ctx.me.color),
          "aria-label": "Farbe " + c,
          onclick: () => {
            ctx.store.set(["members"], ctx.me.id, { color: c });
          },
        })
      )
    );
  }

  function saveName() {
    const name = fName.input.value.trim().replace(/\s+/g, " ");
    if (!name) {
      fName.wrap.classList.add("invalid");
      return toast("Der Name darf nicht leer sein.");
    }
    if (name === ctx.me.name) return toast("Das ist schon dein Name.");
    const taken = ctx.memberList().find((m) => m.id !== ctx.me.id && m.name.toLowerCase() === name.toLowerCase());
    if (taken) return toast(`„${name}“ gibt es schon in der Familie.`);
    ctx.store.set(["members"], ctx.me.id, { name, color: ctx.me.color });
    ctx.session.name = name;
    ctx.saveSession();
    toast("Name gespeichert");
  }

  fName.input.addEventListener("input", renderProfile);
  fName.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveName();
    }
  });

  append(profile, [
    h("h2", {}, "Dein Profil"),
    preview,
    h("div", { class: "inline-form" }, fName.wrap, h("button", { type: "button", class: "btn primary", onclick: saveName }, "Speichern")),
    h("div", { class: "field" }, h("span", { class: "field-label" }, "Deine Farbe"), swatches),
  ]);

  // ── Darstellung ──
  let theme = ls.get("fa-theme", "auto");
  const themeSeg = h("div", { class: "seg", role: "radiogroup", "aria-label": "Design" });
  function renderTheme() {
    fill(
      themeSeg,
      [
        ["auto", "Automatisch"],
        ["light", "Hell"],
        ["dark", "Dunkel"],
      ].map(([v, l]) =>
        h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": String(theme === v),
            class: theme === v ? "active" : "",
            onclick: () => {
              theme = v;
              ls.set("fa-theme", v);
              applyTheme(v);
              renderTheme();
            },
          },
          l
        )
      )
    );
  }
  renderTheme();

  // ── Familie ──
  function renderFamily() {
    const list = ctx.memberList();
    fill(
      family,
      h("h2", {}, `Familie (${list.length})`),
      h(
        "ul",
        { class: "member-list" },
        list.map((m) =>
          h(
            "li",
            {},
            avatar(m.name, m.color),
            h("span", { class: "grow" }, m.name, m.id === ctx.me.id ? h("span", { class: "muted" }, " (du)") : null),
            m.id !== ctx.me.id
              ? h(
                  "button",
                  {
                    type: "button",
                    class: "icon-btn small",
                    "aria-label": `${m.name} entfernen`,
                    title: "Entfernen (z. B. doppelte Einträge)",
                    onclick: async () => {
                      if (
                        await confirmBox(
                          `„${m.name}“ aus der Liste entfernen? Nachrichten und Einträge bleiben erhalten. Nutzt die Person die App noch, erscheint sie beim nächsten Öffnen wieder.`,
                          { ok: "Entfernen" }
                        )
                      )
                        ctx.store.remove(["members"], m.id);
                    },
                  },
                  icon("trash")
                )
              : null
          )
        )
      )
    );
  }

  const demo = ctx.store.mode === "demo";
  append(el, [
    profile,
    h("section", { class: "section" }, h("h2", {}, "Darstellung"), themeSeg),
    family,
    h(
      "section",
      { class: "section" },
      h("h2", {}, "Verbindung"),
      h(
        "p",
        { class: "status-line" },
        h("span", { class: "dot " + (demo ? "warn" : "ok") }),
        demo ? "Demo-Modus – Daten nur auf diesem Gerät" : "Online-Datenbank verbunden (Firebase)"
      ),
      demo ? h("p", { class: "muted small" }, "Damit alle in der Familie dieselben Daten sehen, muss die kostenlose Firebase-Datenbank eingerichtet werden. Die Anleitung steht in der README-Datei im GitHub-Repository.") : null
    ),
    h(
      "section",
      { class: "section" },
      h("h2", {}, "Abmelden"),
      h("p", { class: "muted small" }, "Meldet nur dieses Gerät ab. Danach brauchst du wieder den Familien-Code."),
      h("button", { type: "button", class: "btn danger", onclick: () => ctx.logout() }, icon("logout"), "Abmelden")
    ),
    h("p", { class: "muted small center" }, `Familien-App · Version ${APP_VERSION}`),
  ]);

  renderProfile();
  renderFamily();
  const off = ctx.on("members", () => {
    renderProfile();
    renderFamily();
  });
  return () => off();
}
