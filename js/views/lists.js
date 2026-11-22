// Gemeinsame Listen-Ansicht für Einkaufsliste, Haushalt und Familien-To-Do.
import {
  h, icon, avatar, richText, field, selectField, modal, confirmBox, toast, popover, closePopover, emptyState,
  timeAgo, dueInfo, todayISO, fromISO, toISO, startOfDay, newId, findMention, fill, append, shorten,
} from "../ui.js";

const TITLE_MAX = 70;
const DESC_MAX = 500;
const COMMENT_MAX = 500;

// ── Wiederholungen (Haushalt) ────────────────────────────────
const REPEAT_PRESETS = [
  { value: "", label: "Einmalig (keine Wiederholung)" },
  { value: "1-day", label: "Täglich" },
  { value: "1-week", label: "Jede Woche" },
  { value: "2-week", label: "Alle 2 Wochen" },
  { value: "3-week", label: "Alle 3 Wochen" },
  { value: "1-month", label: "Jeden Monat" },
  { value: "custom", label: "Eigener Rhythmus …" },
];
const UNITS = { day: "Tage", week: "Wochen", month: "Monate" };

export function repeatText(r) {
  if (!r?.every) return "";
  if (r.every === 1) return { day: "täglich", week: "jede Woche", month: "jeden Monat" }[r.unit];
  return `alle ${r.every} ${UNITS[r.unit]}`;
}

/** Nächster Termin nach dem Erledigen (behält den Rhythmus bei). */
export function nextDue(iso, r) {
  const today = startOfDay(new Date());
  let d = fromISO(iso || todayISO());
  const dayOfMonth = d.getDate();
  let guard = 0;
  do {
    if (r.unit === "day") d.setDate(d.getDate() + r.every);
    else if (r.unit === "week") d.setDate(d.getDate() + 7 * r.every);
    else {
      d = new Date(d.getFullYear(), d.getMonth() + r.every, 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dayOfMonth, daysInMonth));
    }
  } while (d <= today && ++guard < 2000);
  return toISO(d);
}

/** Erkennt „alle 3 Wochen“, „jede Woche“, „täglich“ … im Text. */
export function parseRepeat(text) {
  const t = String(text || "").toLowerCase();
  if (/täglich|jeden tag/.test(t)) return { every: 1, unit: "day" };
  if (/wöchentlich|jede woche/.test(t)) return { every: 1, unit: "week" };
  if (/monatlich|jeden monat/.test(t)) return { every: 1, unit: "month" };
  const m = t.match(/(?:alle|jede[nrs]?)\s+(\d{1,3})\s*(tage?n?|wochen?|monate?n?)/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2].startsWith("tag") ? "day" : m[2].startsWith("woche") ? "week" : "month";
    if (n > 0) return { every: n, unit };
  }
  return null;
}

// ── Sortierungen ─────────────────────────────────────────────
const newestFirst = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
const byDue = (a, b) => {
  const da = a.due || "9999-99-99";
  const db = b.due || "9999-99-99";
  return da < db ? -1 : da > db ? 1 : (a.createdAt || 0) - (b.createdAt || 0);
};

// ── Die Ansicht ──────────────────────────────────────────────
function listView(cfg) {
  return function view(el, ctx) {
    const path = [cfg.collection];
    const touch = matchMedia("(pointer: coarse)").matches;
    let items = [];
    let loaded = false;
    let tab = "open";
    let who = "all";
    let detail = null;

    const head = h("div", { class: "view-head" });
    const filters = h("div", { class: "chips scroll", role: "group", "aria-label": "Nach Person filtern" });
    const body = h("div", { class: "cards" });
    const foot = h("div", { class: "list-foot" });
    append(el, [cfg.intro ? h("p", { class: "intro" }, cfg.intro) : null, head, filters, body, foot]);

    const unwatch = ctx.store.watch(path, (list) => {
      items = list;
      loaded = true;
      render();
    });
    const offMembers = ctx.on("members", render);

    const isRepeating = (it) => cfg.repeatable && it.repeat?.every;

    function render() {
      const open = items.filter((i) => !i.done);
      const done = items.filter((i) => i.done);

      const segBtn = (id, label, n) =>
        h(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": String(tab === id),
            class: tab === id ? "active" : "",
            onclick: () => {
              tab = id;
              render();
            },
          },
          label,
          h("span", { class: "count" }, String(n))
        );

      fill(
        head,
        h("div", { class: "seg", role: "tablist" }, segBtn("open", cfg.openLabel, open.length), segBtn("done", cfg.doneLabel, done.length)),
        h("button", { class: "btn primary", type: "button", title: cfg.addTitle, "aria-label": cfg.addTitle, onclick: () => openForm() }, icon("plus"), h("span", {}, cfg.addButton || "Neu"))
      );

      if (cfg.filterByPerson && ctx.members.size > 1) {
        if (who !== "all" && !ctx.members.has(who)) who = "all";
        const chip = (id, label) =>
          h(
            "button",
            {
              type: "button",
              class: "chip" + (who === id ? " active" : ""),
              "aria-pressed": String(who === id),
              onclick: () => {
                who = id;
                render();
              },
            },
            label
          );
        fill(
          filters,
          chip("all", "Alle"),
          ctx.memberList().map((m) => chip(m.id, m.id === ctx.me.id ? `${m.name} (ich)` : m.name))
        );
        filters.hidden = false;
      } else {
        filters.hidden = true;
      }

      let shown = tab === "open" ? open : done;
      if (who !== "all") shown = shown.filter((i) => i.assignee === who);
      shown = [...shown].sort(tab === "open" ? cfg.sortOpen || newestFirst : (a, b) => (b.doneAt || 0) - (a.doneAt || 0));

      if (!loaded) fill(body, h("p", { class: "muted center" }, "Lädt …"));
      else if (!shown.length) {
        fill(
          body,
          tab === "open"
            ? emptyState(cfg.icon, who === "all" ? cfg.emptyOpen[0] : "Hier ist nichts offen.", who === "all" ? cfg.emptyOpen[1] : "")
            : emptyState("check", cfg.emptyDone, "")
        );
      } else fill(body, shown.map(card));

      fill(
        foot,
        tab === "done" && done.length
          ? h("button", { type: "button", class: "btn ghost danger", onclick: clearDone }, icon("trash"), `Alle ${done.length} endgültig löschen`)
          : null
      );

      detail?.refresh();
    }

    // ── Karte ──
    function card(it) {
      const done = Boolean(it.done);
      const label = done ? cfg.undoLabel : isRepeating(it) ? "Als erledigt markieren" : cfg.checkLabel;
      return h(
        "div",
        { class: "card" + (done ? " done" : "") },
        h("button", { type: "button", class: "check" + (done ? " on" : ""), "aria-label": label, title: label, onclick: () => toggle(it) }, icon("check")),
        h(
          "div",
          {
            class: "card-main",
            role: "button",
            tabindex: "0",
            onclick: () => openDetail(it.id),
            onkeydown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetail(it.id);
              }
            },
          },
          h("div", { class: "card-title" }, it.title),
          it.desc ? h("div", { class: "card-desc" }, richText(it.desc, ctx)) : null,
          h("div", { class: "meta" }, metaTags(it))
        ),
        h(
          "button",
          {
            type: "button",
            class: "icon-btn small",
            "aria-label": "Optionen",
            onclick: (e) =>
              popover(e.currentTarget, [
                { icon: "edit", label: "Bearbeiten", onClick: () => openForm(it) },
                { icon: "comment", label: "Kommentieren", onClick: () => openDetail(it.id, true) },
                { icon: "trash", label: "Löschen", danger: true, onClick: () => del(it) },
              ]),
          },
          icon("more")
        )
      );
    }

    function metaTags(it) {
      const t = [];
      if (it.assignee || it.assigneeName) t.push(h("span", { class: "tag person" }, "@" + ctx.name(it.assignee, it.assigneeName)));
      if (!it.done && it.due) {
        const d = dueInfo(it.due);
        t.push(h("span", { class: "tag " + d.cls }, icon("calendar"), d.text));
      }
      if (isRepeating(it)) t.push(h("span", { class: "tag" }, icon("repeat"), repeatText(it.repeat)));
      if (it.duration) t.push(h("span", { class: "tag" }, icon("timer"), it.duration));
      const c = it.comments?.length || 0;
      if (c) t.push(h("span", { class: "tag" }, icon("comment"), String(c)));
      if (it.done) t.push(h("span", { class: "by" }, `${cfg.doneVerb} von ${ctx.name(it.doneBy, it.doneByName)} · ${timeAgo(it.doneAt)}`));
      else if (isRepeating(it) && it.lastDoneAt) t.push(h("span", { class: "by" }, `zuletzt: ${ctx.name(it.lastDoneBy, it.lastDoneByName)}, ${timeAgo(it.lastDoneAt)}`));
      else t.push(h("span", { class: "by" }, `von ${ctx.name(it.createdBy, it.createdByName)} · ${timeAgo(it.createdAt)}`));
      return t;
    }

    // ── Abhaken ──
    const undoDone = { done: false, doneAt: null, doneBy: null, doneByName: null };

    function toggle(it) {
      if (it.done) {
        ctx.store.update(path, it.id, undoDone);
        toast(`„${shorten(it.title)}“ ist wieder offen`);
        return;
      }
      if (isRepeating(it)) return completeRepeating(it);
      ctx.store.update(path, it.id, { done: true, doneAt: Date.now(), doneBy: ctx.me.id, doneByName: ctx.me.name });
      toast(`„${shorten(it.title)}“ ${cfg.doneVerb}`, { action: { label: "Rückgängig", onClick: () => ctx.store.update(path, it.id, undoDone) } });
    }

    function completeRepeating(it) {
      const before = {
        due: it.due ?? null,
        lastDoneAt: it.lastDoneAt ?? null,
        lastDoneBy: it.lastDoneBy ?? null,
        lastDoneByName: it.lastDoneByName ?? null,
        history: it.history || [],
      };
      const entry = { memberId: ctx.me.id, name: ctx.me.name, at: Date.now() };
      const next = nextDue(it.due, it.repeat);
      ctx.store.update(path, it.id, {
        due: next,
        lastDoneAt: entry.at,
        lastDoneBy: entry.memberId,
        lastDoneByName: entry.name,
        history: [...(it.history || []), entry].slice(-30),
      });
      toast(`Erledigt! Nächstes Mal: ${dueInfo(next).text}`, { action: { label: "Rückgängig", onClick: () => ctx.store.update(path, it.id, before) } });
    }

    // ── Löschen ──
    async function del(it, beforeToast) {
      const ok = await confirmBox(`„${shorten(it.title, 60)}“ wirklich löschen? Das kann nicht rückgängig gemacht werden.`);
      if (!ok) return;
      beforeToast?.();
      ctx.store.remove(path, it.id);
      toast("Gelöscht");
    }

    async function clearDone() {
      const done = items.filter((i) => i.done);
      const ok = await confirmBox(`${done.length} Einträge aus „${cfg.doneLabel}“ endgültig löschen? Das kann nicht rückgängig gemacht werden.`);
      if (!ok) return;
      done.forEach((i) => ctx.store.remove(path, i.id));
      toast("Aufgeräumt");
    }

    // ── Detail mit Kommentaren ──
    function openDetail(id, focusComment = false) {
      const info = h("div", { class: "detail-info" });
      const comments = h("div", { class: "comments" });
      const cInput = h("textarea", { rows: 2, maxlength: COMMENT_MAX, placeholder: "Kommentar schreiben …", "aria-label": "Kommentar", class: "comment-input" });
      const cForm = h(
        "form",
        {
          class: "comment-form",
          onsubmit: (e) => {
            e.preventDefault();
            addComment();
          },
        },
        cInput,
        h("button", { type: "submit", class: "send-btn", "aria-label": "Kommentar senden" }, icon("send"))
      );
      cInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !touch) {
          e.preventDefault();
          addComment();
        }
      });

      const m = modal({
        title: cfg.singular,
        body: h("div", {}, info, h("h3", { class: "sub" }, "Kommentare"), comments, cForm),
        cls: "wide",
        onClose: () => {
          if (detail?.id === id) detail = null;
        },
      });

      function addComment() {
        const text = cInput.value.trim();
        if (!text) return cInput.focus();
        ctx.store.arrayAdd(path, id, "comments", { id: newId(), memberId: ctx.me.id, name: ctx.me.name, text: text.slice(0, COMMENT_MAX), at: Date.now() });
        cInput.value = "";
        cInput.focus();
      }

      detail = {
        id,
        refresh() {
          const it = items.find((i) => i.id === id);
          if (!it) return m.close();
          fill(info, detailInfo(it, m));
          const cs = it.comments || [];
          fill(comments, cs.length ? cs.map((c) => commentEl(it, c)) : h("p", { class: "muted small" }, "Noch keine Kommentare."));
        },
      };
      detail.refresh();
      if (focusComment) setTimeout(() => cInput.focus(), 60);
    }

    function detailInfo(it, m) {
      const label = it.done ? cfg.undoLabel : isRepeating(it) ? "Erledigt" : cfg.checkLabel;
      return [
        h("div", { class: "detail-title" + (it.done ? " done" : "") }, it.title),
        it.desc ? h("div", { class: "detail-desc" }, richText(it.desc, ctx)) : null,
        h("div", { class: "meta" }, metaTags(it)),
        it.history?.length
          ? h(
              "div",
              { class: "history" },
              h("h3", { class: "sub" }, "Zuletzt erledigt"),
              h(
                "ul",
                {},
                it.history
                  .slice(-5)
                  .reverse()
                  .map((x) => h("li", {}, `${ctx.name(x.memberId, x.name)} · ${timeAgo(x.at)}`))
              )
            )
          : null,
        h(
          "div",
          { class: "detail-actions" },
          h("button", { type: "button", class: "btn " + (it.done ? "" : "primary"), onclick: () => toggle(it) }, icon(it.done ? "undo" : "check"), label),
          h("button", { type: "button", class: "btn", onclick: () => openForm(it) }, icon("edit"), "Bearbeiten"),
          h("button", { type: "button", class: "btn danger", onclick: () => del(it, () => m.close()) }, icon("trash"), "Löschen")
        ),
      ];
    }

    function commentEl(it, c) {
      const mine = c.memberId === ctx.me.id;
      const name = ctx.name(c.memberId, c.name);
      return h(
        "div",
        { class: "comment" },
        avatar(name, ctx.color(c.memberId, name), "small"),
        h(
          "div",
          { class: "comment-body" },
          h(
            "div",
            { class: "comment-head" },
            h("b", {}, name),
            h("span", { class: "muted" }, timeAgo(c.at)),
            mine
              ? h(
                  "button",
                  {
                    type: "button",
                    class: "link danger",
                    onclick: async () => {
                      if (await confirmBox("Diesen Kommentar löschen?")) ctx.store.arrayRemove(path, it.id, "comments", c);
                    },
                  },
                  "löschen"
                )
              : null
          ),
          h("div", { class: "comment-text" }, richText(c.text, ctx))
        )
      );
    }

    // ── Hinzufügen / Bearbeiten ──
    function openForm(it = null) {
      const isNew = !it;
      const F = cfg.fields || [];
      const fTitle = field({ label: "Titel", max: TITLE_MAX, value: it?.title, required: true, placeholder: cfg.titlePlaceholder });
      const fDesc = field({ label: "Beschreibung", max: DESC_MAX, multiline: true, value: it?.desc, placeholder: cfg.descPlaceholder });
      const parts = [fTitle.wrap, fDesc.wrap];

      let fAssignee, fDue, fRepeat, fEvery, fUnit, fDuration;
      const row = [];
      if (F.includes("assignee")) {
        fAssignee = selectField(
          cfg.assigneeLabel || "Wer?",
          [{ value: "", label: "Niemand Bestimmtes" }, ...ctx.memberList().map((m) => ({ value: m.id, label: m.id === ctx.me.id ? `${m.name} (ich)` : m.name }))],
          it?.assignee || ""
        );
        row.push(fAssignee.wrap);
      }
      if (F.includes("due")) {
        fDue = field({ label: cfg.dueLabel || "Fällig am", type: "date", value: it?.due ?? (isNew && cfg.dueDefaultToday ? todayISO() : "") });
        row.push(fDue.wrap);
      }
      if (row.length) parts.push(h("div", { class: "row" }, row));

      if (F.includes("repeat")) {
        const preset = it?.repeat?.every ? `${it.repeat.every}-${it.repeat.unit}` : "";
        const known = REPEAT_PRESETS.some((p) => p.value === preset);
        fRepeat = selectField("Wiederholung", REPEAT_PRESETS, known ? preset : "custom");
        fEvery = h("input", { type: "number", min: 1, max: 365, inputmode: "numeric", value: String(it?.repeat?.every || 2), "aria-label": "Anzahl" });
        fUnit = h("select", { "aria-label": "Einheit" }, Object.entries(UNITS).map(([v, l]) => h("option", { value: v }, l)));
        fUnit.value = it?.repeat?.unit || "week";
        const custom = h("div", { class: "row custom-repeat" }, h("span", { class: "muted" }, "alle"), fEvery, fUnit);
        const sync = () => {
          custom.hidden = fRepeat.sel.value !== "custom";
        };
        fRepeat.sel.addEventListener("change", sync);
        sync();
        parts.push(fRepeat.wrap, custom);
      }
      if (F.includes("duration")) {
        fDuration = field({ label: "Wie lange?", max: 40, value: it?.duration, placeholder: "z. B. 20 Min. oder 2 Wochen" });
        parts.push(fDuration.wrap);
      }
      if (isNew && cfg.formHint) parts.push(h("p", { class: "field-hint" }, icon("info"), cfg.formHint));

      const form = h(
        "form",
        {
          class: "form",
          onsubmit: (e) => {
            e.preventDefault();
            save();
          },
        },
        parts
      );
      form.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") {
          e.preventDefault();
          save();
        }
      });

      const m = modal({
        title: isNew ? cfg.addTitle : "Bearbeiten",
        body: form,
        cls: "wide",
        actions: [{ label: "Abbrechen" }, { label: isNew ? "Hinzufügen" : "Speichern", kind: "primary", onClick: () => save() }],
      });
      if (isNew && !touch) setTimeout(() => fTitle.input.focus(), 60);

      function save() {
        const title = fTitle.input.value.trim().slice(0, TITLE_MAX);
        if (!title) {
          fTitle.wrap.classList.add("invalid");
          fTitle.input.focus();
          toast("Bitte gib einen Titel ein.");
          return;
        }
        const desc = fDesc.input.value.trim().slice(0, DESC_MAX);
        const data = { title, desc };
        const detected = [];

        if (fAssignee) {
          let id = fAssignee.sel.value || null;
          if (!id && isNew) {
            const hit = findMention(`${title} ${desc}`, ctx.memberList());
            if (hit) {
              id = hit.id;
              detected.push("@" + hit.name);
            }
          }
          data.assignee = id;
          data.assigneeName = id ? ctx.name(id) : null;
        }
        if (fDue) data.due = fDue.input.value || null;
        if (fRepeat) {
          const v = fRepeat.sel.value;
          let r = null;
          if (v === "custom") r = { every: Math.max(1, Math.min(365, parseInt(fEvery.value, 10) || 1)), unit: fUnit.value };
          else if (v) {
            const [n, unit] = v.split("-");
            r = { every: Number(n), unit };
          } else if (isNew) {
            r = parseRepeat(`${title} ${desc}`);
            if (r) detected.push(repeatText(r));
          }
          data.repeat = r;
          if (r && !data.due) data.due = todayISO();
        }
        if (fDuration) data.duration = fDuration.input.value.trim().slice(0, 40) || null;

        if (isNew) {
          ctx.store.add(path, { ...data, done: false, comments: [], createdAt: Date.now(), createdBy: ctx.me.id, createdByName: ctx.me.name });
        } else {
          ctx.store.update(path, it.id, { ...data, updatedAt: Date.now() });
        }
        m.close();
        toast(isNew ? "Hinzugefügt" + (detected.length ? ` · erkannt: ${detected.join(", ")}` : "") : "Gespeichert");
      }
    }

    return () => {
      unwatch();
      offMembers();
      closePopover();
    };
  };
}

// ── Die drei Listen ──────────────────────────────────────────
export const shoppingView = listView({
  collection: "shopping",
  icon: "cart",
  singular: "Einkauf",
  addTitle: "Etwas auf die Einkaufsliste",
  addButton: "Hinzufügen",
  openLabel: "Einkaufen",
  doneLabel: "Gekauft",
  checkLabel: "Als gekauft abhaken",
  undoLabel: "Zurück auf die Liste",
  doneVerb: "gekauft",
  titlePlaceholder: "z. B. Milch (2 Liter)",
  descPlaceholder: "Marke, Menge, wo es das gibt …",
  emptyOpen: ["Die Einkaufsliste ist leer.", "Tippe auf „Hinzufügen“, um etwas einzutragen."],
  emptyDone: "Noch nichts gekauft.",
  sortOpen: newestFirst,
});

export const choresView = listView({
  collection: "chores",
  icon: "home",
  singular: "Haushaltsaufgabe",
  addTitle: "Neue Haushaltsaufgabe",
  addButton: "Neue Aufgabe",
  openLabel: "Aufgaben",
  doneLabel: "Erledigt",
  checkLabel: "Als erledigt markieren",
  undoLabel: "Wieder öffnen",
  doneVerb: "erledigt",
  titlePlaceholder: "z. B. Müll rausbringen",
  descPlaceholder: "z. B. @Max macht das alle 3 Wochen, gelbe Säcke nicht vergessen",
  formHint: "Tipp: Schreibst du „@Name“ und „alle 3 Wochen“ in den Text, werden Person und Rhythmus automatisch übernommen.",
  emptyOpen: ["Noch keine Haushaltsaufgaben.", "Trag ein, wer was macht – einmalig oder regelmäßig."],
  emptyDone: "Noch nichts erledigt.",
  fields: ["assignee", "due", "repeat", "duration"],
  assigneeLabel: "Wer macht das?",
  dueLabel: "Wann (nächstes Mal)?",
  dueDefaultToday: true,
  repeatable: true,
  filterByPerson: true,
  sortOpen: byDue,
});

export const todoView = listView({
  collection: "todos",
  icon: "todo",
  singular: "To-Do",
  addTitle: "Neues To-Do",
  addButton: "Neu",
  openLabel: "Offen",
  doneLabel: "Erledigt",
  checkLabel: "Als erledigt markieren",
  undoLabel: "Wieder öffnen",
  doneVerb: "erledigt",
  titlePlaceholder: "z. B. Urlaub buchen",
  descPlaceholder: "Details, Links, @Erwähnungen …",
  emptyOpen: ["Keine offenen To-Dos.", "Hier kommt alles rein, was die Familie erledigen muss."],
  emptyDone: "Noch nichts erledigt.",
  fields: ["assignee", "due"],
  assigneeLabel: "Wer kümmert sich?",
  dueLabel: "Bis wann?",
  filterByPerson: true,
  sortOpen: byDue,
});
