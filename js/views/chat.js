import { h, icon, avatar, richText, fmtTime, dayLabel, startOfDay, confirmBox, emptyState } from "../ui.js";

const MAX = 1000;

export default function chatView(el, ctx) {
  const list = h("div", { class: "chat-list", role: "log", "aria-live": "polite" });
  const input = h("textarea", { class: "chat-input", rows: 1, maxlength: MAX, placeholder: "Nachricht schreiben …", "aria-label": "Nachricht" });
  const sendBtn = h("button", { class: "send-btn", type: "submit", "aria-label": "Senden" }, icon("send"));
  const form = h(
    "form",
    {
      class: "composer",
      onsubmit: (e) => {
        e.preventDefault();
        send();
      },
    },
    input,
    sendBtn
  );
  el.append(list, form);

  const touch = matchMedia("(pointer: coarse)").matches;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !touch) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener("input", autosize);
  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }

  let stick = true;
  list.addEventListener("scroll", () => {
    stick = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  });

  function send() {
    const text = input.value.trim();
    if (!text) return input.focus();
    ctx.store.add(["chat"], { text: text.slice(0, MAX), memberId: ctx.me.id, name: ctx.me.name, createdAt: Date.now() });
    input.value = "";
    autosize();
    input.focus();
    stick = true;
  }

  function render() {
    const msgs = ctx.chat;
    if (!msgs.length) {
      list.replaceChildren(emptyState("chat", "Noch keine Nachrichten", "Schreib der Familie die erste Nachricht!"));
      return;
    }
    const out = [];
    let lastDay = 0;
    let lastAuthor = null;
    let lastTs = 0;
    for (const m of msgs) {
      const day = startOfDay(m.createdAt).getTime();
      if (day !== lastDay) {
        out.push(h("div", { class: "day-sep" }, h("span", {}, dayLabel(m.createdAt))));
        lastDay = day;
        lastAuthor = null;
      }
      const mine = m.memberId === ctx.me.id;
      const grouped = lastAuthor === m.memberId && m.createdAt - lastTs < 5 * 60 * 1000;
      lastAuthor = m.memberId;
      lastTs = m.createdAt;
      const name = ctx.name(m.memberId, m.name);
      const color = ctx.color(m.memberId, name);

      const msgEl = h("div", { class: "msg" + (mine ? " mine" : "") + (grouped ? " grouped" : "") });
      const bubble = h(
        "div",
        { class: "bubble" },
        !mine && !grouped ? h("div", { class: "msg-name", style: { color } }, name) : null,
        h("div", { class: "msg-text" }, richText(m.text, ctx)),
        h("div", { class: "msg-time" }, fmtTime(m.createdAt))
      );
      if (!mine) msgEl.append(grouped ? h("span", { class: "avatar-spacer" }) : avatar(name, color));
      msgEl.append(bubble);
      if (mine) {
        bubble.title = "Antippen für Optionen";
        bubble.addEventListener("click", () => msgEl.classList.toggle("show-actions"));
        msgEl.append(
          h(
            "button",
            {
              type: "button",
              class: "msg-del",
              onclick: async () => {
                if (await confirmBox("Diese Nachricht für alle löschen?")) ctx.store.remove(["chat"], m.id);
              },
            },
            icon("trash"),
            "Löschen"
          )
        );
      }
      out.push(msgEl);
    }
    list.replaceChildren(...out);
    if (stick) list.scrollTop = list.scrollHeight;
  }

  const off1 = ctx.on("chat", render);
  const off2 = ctx.on("members", render);
  render();
  requestAnimationFrame(() => {
    list.scrollTop = list.scrollHeight;
    if (!touch) input.focus();
  });

  return () => {
    off1();
    off2();
  };
}
