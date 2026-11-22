// Private Notizen – nur für die Person auf diesem Gerät sichtbar.
import { h, icon, field, modal, confirmBox, toast, emptyState, timeAgo, fill, append, shorten } from "../ui.js";

const TITLE_MAX = 100;
const TEXT_MAX = 5000;

export default function notesView(el, ctx) {
  const path = ["private", ctx.store.uid, "notes"];
  let notes = [];
  let loaded = false;
  let query = "";

  const search = h("input", { type: "search", placeholder: "Notizen durchsuchen …", "aria-label": "Notizen durchsuchen", class: "search" });
  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    render();
  });
  const grid = h("div", { class: "notes-grid" });

  append(el, [
    h("div", { class: "notice" }, icon("lock"), h("span", {}, h("b", {}, "Nur für dich. "), "Andere Familienmitglieder können diese Notizen nicht sehen. Sie gehören zu diesem Gerät bzw. Browser.")),
    h(
      "div",
      { class: "view-head" },
      h("div", { class: "search-wrap" }, icon("search"), search),
      h("button", { class: "btn primary", type: "button", title: "Neue Notiz", "aria-label": "Neue Notiz", onclick: () => openForm() }, icon("plus"), h("span", {}, "Notiz"))
    ),
    grid,
  ]);

  const unwatch = ctx.store.watch(path, (list) => {
    notes = list;
    loaded = true;
    render();
  });

  function render() {
    let shown = [...notes].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    if (query) shown = shown.filter((n) => `${n.title} ${n.text}`.toLowerCase().includes(query));
    if (!loaded) return fill(grid, h("p", { class: "muted center" }, "Lädt …"));
    if (!shown.length) {
      return fill(grid, query ? emptyState("search", "Nichts gefunden.", "") : emptyState("note", "Noch keine Notizen.", "Halte hier Gedanken, Ideen oder Erinnerungen nur für dich fest."));
    }
    fill(
      grid,
      shown.map((n) =>
        h(
          "button",
          { type: "button", class: "note-card", onclick: () => openForm(n) },
          n.title ? h("div", { class: "note-title" }, n.title) : null,
          n.text ? h("div", { class: "note-text" }, n.text) : null,
          h("div", { class: "note-date" }, timeAgo(n.updatedAt || n.createdAt))
        )
      )
    );
  }

  function openForm(n = null) {
    const isNew = !n;
    const fTitle = field({ label: "Titel", max: TITLE_MAX, value: n?.title, placeholder: "optional" });
    const fText = field({ label: "Notiz", max: TEXT_MAX, multiline: true, rows: 10, value: n?.text, placeholder: "Schreib los …" });
    const form = h(
      "form",
      {
        class: "form",
        onsubmit: (e) => {
          e.preventDefault();
          save();
        },
      },
      fTitle.wrap,
      fText.wrap
    );
    const actions = [{ label: "Abbrechen" }, { label: isNew ? "Speichern" : "Speichern", kind: "primary", onClick: () => save() }];
    if (!isNew)
      actions.unshift({
        label: "Löschen",
        kind: "danger",
        icon: "trash",
        onClick: async (close) => {
          if (!(await confirmBox(`Notiz „${shorten(n.title || n.text, 40)}“ löschen? Das kann nicht rückgängig gemacht werden.`))) return;
          close();
          ctx.store.remove(path, n.id);
          toast("Notiz gelöscht");
        },
      });
    const m = modal({ title: isNew ? "Neue Notiz" : "Notiz", body: form, cls: "wide", actions });
    setTimeout(() => (isNew ? fText.input : fText.input).focus(), 60);

    function save() {
      const title = fTitle.input.value.trim().slice(0, TITLE_MAX);
      const text = fText.input.value.trim().slice(0, TEXT_MAX);
      if (!title && !text) {
        toast("Die Notiz ist leer.");
        return fText.input.focus();
      }
      if (isNew) ctx.store.add(path, { title, text, createdAt: Date.now(), updatedAt: Date.now() });
      else ctx.store.update(path, n.id, { title, text, updatedAt: Date.now() });
      m.close();
      toast("Gespeichert");
    }
  }

  return () => unwatch();
}
