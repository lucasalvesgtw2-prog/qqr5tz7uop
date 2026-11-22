// Tagesablauf: wer ist wann wo (z. B. Bad 7:05–7:15). Zeigt Überschneidungen an.
import { h, icon, field, modal, confirmBox, toast, popover, closePopover, emptyState, hashColor, initials, fill, append, shorten } from "../ui.js";

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const SUGGESTIONS = ["Bad", "Dusche", "Küche", "Frühstück", "Mittagessen", "Abendessen", "Hausaufgaben", "Waschmaschine", "Auto"];

const todayDow = () => ((new Date().getDay() + 6) % 7) + 1; // Mo = 1 … So = 7
const toMin = (t) => {
  const [hh, mm] = String(t || "0:0").split(":").map(Number);
  return (hh || 0) * 60 + (mm || 0);
};
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const norm = (s) => String(s || "").trim().toLowerCase();

export default function scheduleView(el, ctx) {
  const path = ["schedule"];
  let entries = [];
  let loaded = false;
  let day = todayDow();
  let place = "";

  const head = h("div", { class: "view-head" });
  const dayChips = h("div", { class: "chips days", role: "group", "aria-label": "Wochentag" });
  const placeChips = h("div", { class: "chips scroll", role: "group", "aria-label": "Ort / Tätigkeit" });
  const timelines = h("div", { class: "timelines" });
  const list = h("div", { class: "cards" });
  append(el, [head, dayChips, placeChips, timelines, list]);

  const unwatch = ctx.store.watch(path, (l) => {
    entries = l;
    loaded = true;
    render();
  });
  const offMembers = ctx.on("members", render);

  function personColor(e) {
    const m = ctx.memberList().find((p) => norm(p.name) === norm(e.person));
    return m?.color || hashColor(e.person);
  }

  /** Überschneidungen am gleichen Ort am gewählten Tag */
  function clashes(dayEntries) {
    const map = new Map();
    for (const a of dayEntries) {
      for (const b of dayEntries) {
        if (a === b || norm(a.activity) !== norm(b.activity)) continue;
        if (toMin(a.from) < toMin(b.to) && toMin(b.from) < toMin(a.to)) {
          if (!map.has(a.id)) map.set(a.id, []);
          map.get(a.id).push(b);
        }
      }
    }
    return map;
  }

  function render() {
    fill(
      head,
      h("p", { class: "intro grow" }, `${DAY_NAMES[day - 1]}${day === todayDow() ? " (heute)" : ""}`),
      h("button", { class: "btn primary", type: "button", title: "Neuer Eintrag", "aria-label": "Neuer Eintrag", onclick: () => openForm() }, icon("plus"), h("span", {}, "Eintrag"))
    );

    fill(
      dayChips,
      DAYS.map((d, i) =>
        h(
          "button",
          {
            type: "button",
            class: "chip day" + (day === i + 1 ? " active" : "") + (todayDow() === i + 1 ? " is-today" : ""),
            "aria-pressed": String(day === i + 1),
            "aria-label": DAY_NAMES[i],
            onclick: () => {
              day = i + 1;
              render();
            },
          },
          d
        )
      )
    );

    const dayEntries = entries
      .filter((e) => Array.isArray(e.days) && e.days.includes(day))
      .sort((a, b) => toMin(a.from) - toMin(b.from) || toMin(a.to) - toMin(b.to));

    // Orte / Tätigkeiten an diesem Tag
    const places = [];
    for (const e of dayEntries) if (!places.some((p) => norm(p) === norm(e.activity))) places.push(e.activity.trim());
    if (place && !places.some((p) => norm(p) === place)) place = "";
    const chip = (value, label) =>
      h(
        "button",
        {
          type: "button",
          class: "chip" + (place === value ? " active" : ""),
          "aria-pressed": String(place === value),
          onclick: () => {
            place = value;
            render();
          },
        },
        label
      );
    fill(placeChips, places.length > 1 ? [chip("", "Alles"), places.map((p) => chip(norm(p), p))] : null);
    placeChips.hidden = places.length <= 1;

    const clash = clashes(dayEntries);
    const shown = place ? dayEntries.filter((e) => norm(e.activity) === place) : dayEntries;

    // Zeitleisten pro Ort
    const groups = [];
    for (const e of shown) {
      let g = groups.find((x) => norm(x.name) === norm(e.activity));
      if (!g) groups.push((g = { name: e.activity.trim(), items: [] }));
      g.items.push(e);
    }
    fill(timelines, groups.filter((g) => g.items.length > 1 || place).map((g) => timeline(g, clash)));

    if (!loaded) fill(list, h("p", { class: "muted center" }, "Lädt …"));
    else if (!shown.length) {
      fill(
        list,
        entries.length
          ? emptyState("clock", `Für ${DAY_NAMES[day - 1]} ist nichts eingetragen.`, "")
          : emptyState("clock", "Noch kein Tagesablauf.", "Trag ein, wer wann z. B. das Bad benutzt – so gibt’s morgens kein Gedränge.")
      );
    } else fill(list, shown.map((e) => row(e, clash.get(e.id))));
  }

  function timeline(g, clash) {
    const start = Math.min(...g.items.map((e) => toMin(e.from)));
    const end = Math.max(...g.items.map((e) => toMin(e.to)));
    const span = Math.max(end - start, 1);
    const lanes = [];
    const placed = g.items.map((e) => {
      let lane = lanes.findIndex((lastEnd) => lastEnd <= toMin(e.from));
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(0);
      }
      lanes[lane] = toMin(e.to);
      return { e, lane };
    });
    const n = g.items.filter((e) => clash.has(e.id)).length;
    const LANE = 30;
    return h(
      "div",
      { class: "tl-group" },
      h(
        "div",
        { class: "tl-head" },
        h("b", {}, g.name),
        h("span", { class: "muted" }, `${fromMin(start)}–${fromMin(end)}`),
        n ? h("span", { class: "tag overdue" }, icon("warn"), "Überschneidung") : h("span", { class: "tag ok" }, icon("check"), "passt")
      ),
      h(
        "div",
        { class: "tl-bar", style: { height: lanes.length * LANE + 4 + "px" } },
        placed.map(({ e, lane }) => {
          const left = ((toMin(e.from) - start) / span) * 100;
          const width = ((toMin(e.to) - toMin(e.from)) / span) * 100;
          return h(
            "button",
            {
              type: "button",
              class: "tl-seg" + (clash.has(e.id) ? " clash" : ""),
              style: { left: left + "%", width: `calc(${width}% - 2px)`, top: lane * LANE + 2 + "px", background: personColor(e) },
              title: `${e.person}: ${e.from}–${e.to}`,
              "aria-label": `${e.person} ${e.from} bis ${e.to}`,
              onclick: () => openForm(e),
            },
            width > 14 ? e.person : initials(e.person)
          );
        })
      ),
      h("div", { class: "tl-scale" }, h("span", {}, fromMin(start)), h("span", {}, fromMin(end)))
    );
  }

  function row(e, clashWith) {
    const color = personColor(e);
    return h(
      "div",
      { class: "sched-row" + (clashWith ? " has-clash" : "") },
      h("div", { class: "sched-time" }, h("span", {}, e.from), h("span", { class: "to" }, e.to)),
      h("span", { class: "sched-stripe", style: { background: color } }),
      h(
        "div",
        {
          class: "sched-info",
          role: "button",
          tabindex: "0",
          onclick: () => openForm(e),
          onkeydown: (ev) => {
            if (ev.key === "Enter") openForm(e);
          },
        },
        h("div", { class: "sched-title" }, h("b", {}, e.person), h("span", { class: "tag" }, e.activity)),
        e.note ? h("div", { class: "card-desc" }, e.note) : null,
        h("div", { class: "meta" }, h("span", { class: "by" }, daysText(e.days))),
        clashWith
          ? h(
              "div",
              { class: "clash-note" },
              icon("warn"),
              `Überschneidung mit ${clashWith.map((c) => `${c.person} (${c.from}–${c.to})`).join(", ")}`
            )
          : null
      ),
      h(
        "button",
        {
          type: "button",
          class: "icon-btn small",
          "aria-label": "Optionen",
          onclick: (ev) =>
            popover(ev.currentTarget, [
              { icon: "edit", label: "Bearbeiten", onClick: () => openForm(e) },
              { icon: "plus", label: "Kopieren", onClick: () => openForm({ ...e, id: null }) },
              { icon: "trash", label: "Löschen", danger: true, onClick: () => del(e) },
            ]),
        },
        icon("more")
      )
    );
  }

  function daysText(days = []) {
    const s = [...days].sort().join(",");
    if (s === "1,2,3,4,5,6,7") return "jeden Tag";
    if (s === "1,2,3,4,5") return "Mo–Fr";
    if (s === "6,7") return "Wochenende";
    return [...days].sort().map((d) => DAYS[d - 1]).join(", ");
  }

  async function del(e, beforeToast) {
    if (!(await confirmBox(`Eintrag „${e.person} · ${e.activity} ${e.from}–${e.to}“ löschen?`))) return;
    beforeToast?.();
    ctx.store.remove(path, e.id);
    toast("Gelöscht");
  }

  function openForm(e = null) {
    const isNew = !e?.id;
    const dlId = "dl-" + Math.random().toString(36).slice(2);
    const people = ctx.memberList().map((m) => m.name);
    for (const x of entries) if (!people.some((p) => norm(p) === norm(x.person))) people.push(x.person);
    const places = [...SUGGESTIONS];
    for (const x of entries) if (!places.some((p) => norm(p) === norm(x.activity))) places.push(x.activity);

    const fPerson = field({ label: "Wer?", max: 30, value: e?.person ?? ctx.me.name, required: true, list: dlId + "p", placeholder: "Name" });
    const fWhat = field({ label: "Was / Wo?", max: 30, value: e?.activity ?? "", required: true, list: dlId + "a", placeholder: "z. B. Bad" });
    const fFrom = field({ label: "Von", type: "time", value: e?.from ?? "07:00", required: true });
    const fTo = field({ label: "Bis", type: "time", value: e?.to ?? "07:15", required: true });
    const fNote = field({ label: "Notiz", max: 200, value: e?.note ?? "", placeholder: "optional" });

    let selected = new Set(e?.days?.length ? e.days : [day]);
    const dayBtns = h("div", { class: "day-toggles" });
    const quick = (label, days) =>
      h(
        "button",
        {
          type: "button",
          class: "chip small",
          onclick: () => {
            selected = new Set(days);
            renderDays();
          },
        },
        label
      );
    function renderDays() {
      fill(
        dayBtns,
        DAYS.map((d, i) =>
          h(
            "button",
            {
              type: "button",
              class: "day-toggle" + (selected.has(i + 1) ? " on" : ""),
              "aria-pressed": String(selected.has(i + 1)),
              "aria-label": DAY_NAMES[i],
              onclick: () => {
                selected.has(i + 1) ? selected.delete(i + 1) : selected.add(i + 1);
                renderDays();
              },
            },
            d
          )
        )
      );
    }
    renderDays();

    const form = h(
      "form",
      {
        class: "form",
        onsubmit: (ev) => {
          ev.preventDefault();
          save();
        },
      },
      h("div", { class: "row" }, fPerson.wrap, fWhat.wrap),
      h("datalist", { id: dlId + "p" }, people.map((p) => h("option", { value: p }))),
      h("datalist", { id: dlId + "a" }, places.map((p) => h("option", { value: p }))),
      h("div", { class: "row" }, fFrom.wrap, fTo.wrap),
      h(
        "div",
        { class: "field" },
        h("span", { class: "field-label" }, "An welchen Tagen?"),
        dayBtns,
        h("div", { class: "chips" }, quick("Jeden Tag", [1, 2, 3, 4, 5, 6, 7]), quick("Mo–Fr", [1, 2, 3, 4, 5]), quick("Wochenende", [6, 7]))
      ),
      fNote.wrap
    );
    form.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && ev.target.tagName === "INPUT") {
        ev.preventDefault();
        save();
      }
    });

    const actions = [{ label: "Abbrechen" }];
    if (!isNew) actions.unshift({ label: "Löschen", kind: "danger", icon: "trash", onClick: (close) => del(e, close) });
    actions.push({ label: isNew ? "Eintragen" : "Speichern", kind: "primary", onClick: () => save() });
    const m = modal({ title: isNew ? "Neuer Eintrag im Tagesablauf" : "Eintrag bearbeiten", body: form, cls: "wide", actions });

    function save() {
      const person = fPerson.input.value.trim().replace(/\s+/g, " ");
      const activity = fWhat.input.value.trim().replace(/\s+/g, " ");
      const from = fFrom.input.value;
      const to = fTo.input.value;
      if (!person) return invalid(fPerson, "Bitte gib an, wer.");
      if (!activity) return invalid(fWhat, "Bitte gib an, was oder wo (z. B. Bad).");
      if (!from || !to) return invalid(from ? fTo : fFrom, "Bitte gib eine Uhrzeit an.");
      if (toMin(to) <= toMin(from)) return invalid(fTo, "„Bis“ muss nach „Von“ liegen.");
      if (!selected.size) return toast("Bitte wähle mindestens einen Tag.");

      const data = {
        person: person.slice(0, 30),
        activity: activity.slice(0, 30),
        from,
        to,
        days: [...selected].sort(),
        note: fNote.input.value.trim().slice(0, 200),
      };
      // Überschneidungen prüfen (nur Hinweis, speichern trotzdem)
      const others = entries.filter(
        (x) =>
          x.id !== e?.id &&
          norm(x.activity) === norm(activity) &&
          x.days?.some((d) => selected.has(d)) &&
          toMin(x.from) < toMin(to) &&
          toMin(from) < toMin(x.to)
      );

      if (isNew) ctx.store.add(path, { ...data, createdAt: Date.now(), createdBy: ctx.me.id, createdByName: ctx.me.name });
      else ctx.store.update(path, e.id, { ...data, updatedAt: Date.now() });
      m.close();
      if (others.length)
        toast(`Achtung: überschneidet sich mit ${others.map((o) => `${shorten(o.person, 15)} (${o.from}–${o.to})`).join(", ")}`, { kind: "warn", ms: 6000 });
      else toast(isNew ? "Eingetragen" : "Gespeichert");
    }

    function invalid(f, msg) {
      f.wrap.classList.add("invalid");
      f.input.focus();
      toast(msg);
    }
  }

  return () => {
    unwatch();
    offMembers();
    closePopover();
  };
}
