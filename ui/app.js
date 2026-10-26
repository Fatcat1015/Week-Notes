const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "BR", "P", "DIV"]);

const note = document.getElementById("note");
const rangeEl = document.getElementById("range");
const whenEl = document.getElementById("when");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const statusEl = document.getElementById("status");
const tools = Array.from(document.querySelectorAll(".tool"));

let store = { weeks: {} };
let viewMonday = startOfWeek(new Date());
let mounted = false;
let starting = false;
let saveTimer = 0;
let unreadable = false;

function startOfWeek(date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = day.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + mondayOffset);
  return day;
}

function addDays(date, count) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + count);
  return next;
}

function iso(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatRange(monday) {
  const sunday = addDays(monday, 6);
  const left = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const right = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (monday.getFullYear() !== sunday.getFullYear()) {
    return `${left}, ${monday.getFullYear()} – ${right}, ${sunday.getFullYear()}`;
  }
  const thisYear = new Date().getFullYear();
  const year = monday.getFullYear() !== thisYear ? `, ${monday.getFullYear()}` : "";
  return `${left} – ${right}${year}`;
}

function isCurrentWeek(monday) {
  return iso(monday) === iso(startOfWeek(new Date()));
}

function weekId(monday) {
  return iso(monday);
}

function blankTask() {
  return { html: "", state: "open", why: "" };
}

function textOf(html) {
  const holder = document.createElement("div");
  holder.innerHTML = html || "";
  return holder.textContent || "";
}

function sanitize(html) {
  const parsed = new DOMParser().parseFromString(html || "", "text/html");
  const holder = document.createElement("div");
  cleanNodes(parsed.body).forEach((node) => holder.appendChild(node));
  return holder.innerHTML;
}

function cleanNodes(node) {
  const kept = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      kept.push(document.createTextNode(child.textContent));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const children = cleanNodes(child);
    if (!ALLOWED.has(child.tagName)) {
      children.forEach((item) => kept.push(item));
      return;
    }
    const fresh = document.createElement(child.tagName.toLowerCase());
    children.forEach((item) => fresh.appendChild(item));
    kept.push(fresh);
  });
  return kept;
}

function htmlToTasks(html, why) {
  const holder = document.createElement("div");
  holder.innerHTML = sanitize(html || "");
  const tasks = [];
  const children = Array.from(holder.childNodes);
  const blocked = children.some((node) => {
    return node.nodeType === Node.ELEMENT_NODE && (node.tagName === "DIV" || node.tagName === "P");
  });

  function push(fragment) {
    const clean = sanitize(fragment);
    if (!textOf(clean).trim()) return;
    tasks.push({ html: clean, state: "open", why: "" });
  }

  if (blocked) {
    children.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) push(node.textContent);
      else if (node.tagName === "BR") return;
      else if (node.tagName === "DIV" || node.tagName === "P") push(node.innerHTML);
      else push(node.outerHTML);
    });
  } else if (holder.textContent.trim()) {
    push(holder.innerHTML);
  }

  const reason = (why || "").trim();
  if (reason) {
    if (!tasks.length) tasks.push({ html: "", state: "skipped", why: reason });
    else {
      const last = tasks[tasks.length - 1];
      last.state = "skipped";
      last.why = reason;
    }
  }
  return tasks;
}

function normalizeTask(task) {
  if (!task || typeof task !== "object") return null;
  const state = task.state === "done" || task.state === "skipped" ? task.state : "open";
  const html = typeof task.html === "string" ? sanitize(task.html) : "";
  const why = typeof task.why === "string" ? task.why : "";
  if (!textOf(html).trim() && !why.trim() && state === "open") return null;
  return { html, state, why };
}

function asTasks(value, legacyWhy) {
  if (Array.isArray(value)) return value.map(normalizeTask).filter(Boolean);
  if (typeof value === "string") return htmlToTasks(value, legacyWhy || "");
  if (value && Array.isArray(value.tasks)) return value.tasks.map(normalizeTask).filter(Boolean);
  if (value && typeof value.body === "string") return htmlToTasks(value.body, value.why || "");
  return [];
}

function ensureWeek(id, monday) {
  if (!store.weeks[id]) store.weeks[id] = { deadlines: [], days: {} };
  const week = store.weeks[id];
  week.deadlines = asTasks(week.deadlines, "");
  if (!week.days || typeof week.days !== "object" || Array.isArray(week.days)) week.days = {};
  for (let index = 0; index < 7; index += 1) {
    const dayId = iso(addDays(monday, index));
    const current = week.days[dayId];
    week.days[dayId] = { tasks: asTasks(current, "") };
  }
  return week;
}

function readEditor(editor) {
  if (!editor.textContent.trim()) return "";
  return sanitize(editor.innerHTML);
}

function writeEditor(editor, html) {
  editor.innerHTML = sanitize(html || "");
}

function showError(message) {
  statusEl.hidden = false;
  statusEl.textContent = message;
}

function clearError() {
  statusEl.hidden = true;
  statusEl.textContent = "";
}

function actionButton(action, label, pressed) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "task-action";
  button.dataset.action = action;
  button.textContent = label;
  button.setAttribute("aria-pressed", pressed ? "true" : "false");
  button.setAttribute("aria-label", action === "done" ? "Complete task" : "Skip task");
  return button;
}

function createWhyInput(value) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "why-input";
  input.placeholder = "Why this was skipped";
  input.value = value || "";
  input.setAttribute("aria-label", "Why this was skipped");
  return input;
}

function syncTaskChrome(row) {
  if (!row) return;
  const editor = row.querySelector(".editor");
  const actions = row.querySelector(".task-actions");
  if (!editor || !actions) return;
  const open = (row.dataset.state || "open") === "open";
  actions.hidden = editor.textContent.trim() === "" && open;
}

function createTaskRow(task, placeholder, label) {
  const state = task.state || "open";
  const row = document.createElement("div");
  row.className = "task";
  if (state === "done") row.classList.add("is-done");
  if (state === "skipped") row.classList.add("is-skipped");
  row.dataset.state = state;
  if (task.why) row.dataset.why = task.why;

  const line = document.createElement("div");
  line.className = "task-line";

  const editor = document.createElement("div");
  editor.className = "editor";
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.dataset.placeholder = placeholder;
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-label", label);
  writeEditor(editor, task.html);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(
    actionButton("done", "Done", state === "done"),
    actionButton("skip", "Skip", state === "skipped"),
  );
  line.append(editor, actions);
  row.append(line);
  if (state === "skipped") row.append(createWhyInput(task.why));
  syncTaskChrome(row);
  return row;
}

function fillList(list, tasks, placeholder, label) {
  list.replaceChildren();
  tasks.forEach((task) => list.append(createTaskRow(task, placeholder, label)));
  list.append(createTaskRow(blankTask(), placeholder, label));
}

function render() {
  const monday = viewMonday;
  const id = weekId(monday);
  const week = ensureWeek(id, monday);
  const today = iso(new Date());
  const current = isCurrentWeek(monday);

  rangeEl.textContent = formatRange(monday);
  whenEl.textContent = current ? "This week" : "Past week";
  nextBtn.disabled = current;

  note.replaceChildren();

  const deadlines = document.createElement("section");
  deadlines.className = "block deadlines";
  const deadlinesHeading = document.createElement("h2");
  deadlinesHeading.textContent = "Deadlines";
  const deadlineList = document.createElement("div");
  deadlineList.dataset.list = "deadlines";
  fillList(deadlineList, week.deadlines, "Date and what is due", "Deadline");
  deadlines.append(deadlinesHeading, deadlineList);
  note.append(deadlines);

  for (let index = 0; index < 7; index += 1) {
    const date = addDays(monday, index);
    const dayId = iso(date);
    const section = document.createElement("section");
    section.className = dayId === today ? "block day is-today" : "block day";
    const heading = document.createElement("h2");
    heading.textContent = `${WEEKDAYS[index]} ${date.getDate()}`;
    const list = document.createElement("div");
    list.dataset.list = "day";
    list.dataset.day = dayId;
    fillList(list, week.days[dayId].tasks, "Add a task", `${WEEKDAYS[index]} task`);
    section.append(heading, list);
    note.append(section);
  }
}

function readTask(row) {
  const whyInput = row.querySelector(".why-input");
  const why = whyInput ? whyInput.value : (row.dataset.why || "");
  const state = row.dataset.state === "done" || row.dataset.state === "skipped" ? row.dataset.state : "open";
  return {
    html: readEditor(row.querySelector(".editor")),
    state,
    why,
  };
}

function taskHasContent(task) {
  return Boolean(textOf(task.html).trim() || task.why.trim() || task.state !== "open");
}

function readList(list) {
  return Array.from(list.querySelectorAll(":scope > .task")).map(readTask).filter(taskHasContent);
}

function capture() {
  if (!mounted || unreadable) return;
  const monday = viewMonday;
  const week = ensureWeek(weekId(monday), monday);
  const deadlines = note.querySelector('[data-list="deadlines"]');
  if (deadlines) week.deadlines = readList(deadlines);
  note.querySelectorAll('[data-list="day"]').forEach((list) => {
    week.days[list.dataset.day] = { tasks: readList(list) };
  });
}

function prune(source) {
  const weeks = {};
  Object.entries(source.weeks).forEach(([id, week]) => {
    const deadlines = asTasks(week.deadlines, "").filter(taskHasContent);
    const days = {};
    Object.entries(week.days || {}).forEach(([dayId, day]) => {
      const tasks = asTasks(day, "").filter(taskHasContent);
      if (tasks.length) days[dayId] = { tasks };
    });
    if (deadlines.length || Object.keys(days).length) weeks[id] = { deadlines, days };
  });
  return { weeks };
}

function scheduleSave() {
  if (unreadable) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

async function saveNow() {
  if (unreadable) return;
  clearTimeout(saveTimer);
  capture();
  const api = window.pywebview && window.pywebview.api;
  if (!api) return;
  try {
    const result = await api.save_note(prune(store));
    if (!result || result.ok !== true) {
      showError("Could not save the note. The previous file was left as it was.");
      return;
    }
    clearError();
  } catch (error) {
    showError("Could not save the note. The previous file was left as it was.");
  }
}

function stateForAction(action) {
  return action === "done" ? "done" : "skipped";
}

function applyTaskState(row, state) {
  row.dataset.state = state;
  row.classList.toggle("is-done", state === "done");
  row.classList.toggle("is-skipped", state === "skipped");
  row.querySelectorAll(".task-action").forEach((button) => {
    const pressed = stateForAction(button.dataset.action) === state;
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
  });
  const existing = row.querySelector(".why-input");
  if (state === "skipped") {
    if (!existing) {
      const input = createWhyInput(row.dataset.why || "");
      row.append(input);
      input.focus();
    }
    return;
  }
  if (existing) {
    row.dataset.why = existing.value;
    existing.remove();
  }
}

function useTagFormatting() {
  try {
    document.execCommand("styleWithCSS", false, false);
  } catch (error) {
    // The editor still accepts the format buttons without this hint.
  }
}

function applyFormat(command) {
  const active = document.activeElement;
  if (!active || !active.closest || !active.closest(".editor")) return;
  useTagFormatting();
  document.execCommand(command, false, null);
  updateToolbar();
  scheduleSave();
}

function updateToolbar() {
  tools.forEach((button) => {
    let pressed = false;
    try {
      pressed = document.queryCommandState(button.dataset.cmd);
    } catch (error) {
      pressed = false;
    }
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
  });
}

function showWeek(monday, options) {
  if (mounted) capture();
  viewMonday = startOfWeek(monday);
  render();
  mounted = true;
  if (options && options.save) saveNow();
  if (options && options.focusToday) {
    const todayEditor = note.querySelector(".day.is-today .task .editor");
    if (todayEditor) todayEditor.focus();
  }
}

function listOf(row) {
  return row.closest("[data-list]");
}

function placeholderOf(list) {
  const editor = list.querySelector(".editor");
  return editor ? editor.dataset.placeholder : "";
}

function labelOf(list) {
  const editor = list.querySelector(".editor");
  return editor ? editor.getAttribute("aria-label") : "Task";
}

function ensureTrailingBlank(list) {
  const rows = list.querySelectorAll(":scope > .task");
  const last = rows[rows.length - 1];
  const editor = last && last.querySelector(".editor");
  const empty = editor && editor.textContent.trim() === "" && (last.dataset.state || "open") === "open";
  if (!empty) list.append(createTaskRow(blankTask(), placeholderOf(list), labelOf(list)));
}

prevBtn.addEventListener("click", () => {
  showWeek(addDays(viewMonday, -7), { save: true });
});

nextBtn.addEventListener("click", () => {
  if (nextBtn.disabled) return;
  const next = addDays(viewMonday, 7);
  if (iso(next) > iso(startOfWeek(new Date()))) return;
  showWeek(next, { save: true });
});

tools.forEach((button) => {
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => applyFormat(button.dataset.cmd));
});

note.addEventListener("click", (event) => {
  const button = event.target.closest && event.target.closest(".task-action");
  if (!button || !note.contains(button)) return;
  const row = button.closest(".task");
  const editor = row.querySelector(".editor");
  if (!editor.textContent.trim()) return;
  const nextState = stateForAction(button.dataset.action);
  const next = (row.dataset.state || "open") === nextState ? "open" : nextState;
  applyTaskState(row, next);
  scheduleSave();
});

note.addEventListener("input", (event) => {
  const row = event.target.closest && event.target.closest(".task");
  if (!row) return;
  syncTaskChrome(row);
  scheduleSave();
});

note.addEventListener("focusout", (event) => {
  const editor = event.target.closest && event.target.closest(".editor");
  if (!editor || !note.contains(editor)) return;
  if (!editor.textContent.trim()) editor.innerHTML = "";
  syncTaskChrome(editor.closest(".task"));
  scheduleSave();
});

note.addEventListener("paste", (event) => {
  const editor = event.target.closest && event.target.closest(".editor");
  if (!editor) return;
  event.preventDefault();
  const clipboard = event.clipboardData;
  const html = clipboard ? clipboard.getData("text/html") : "";
  const text = clipboard ? clipboard.getData("text/plain") : "";
  const clean = html ? sanitize(html) : "";
  useTagFormatting();
  if (clean && textOf(clean).trim()) document.execCommand("insertHTML", false, clean);
  else document.execCommand("insertText", false, text);
  syncTaskChrome(editor.closest(".task"));
  scheduleSave();
});

note.addEventListener("keydown", (event) => {
  const editor = event.target.closest && event.target.closest(".editor");
  if (!editor || event.isComposing) return;
  if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    const row = editor.closest(".task");
    if (!editor.textContent.trim()) {
      const next = row.nextElementSibling;
      if (next && next.classList.contains("task")) next.querySelector(".editor").focus();
      return;
    }
    const list = listOf(row);
    const next = row.nextElementSibling;
    if (next && next.classList.contains("task")) next.querySelector(".editor").focus();
    else {
      ensureTrailingBlank(list);
      const created = list.querySelector(":scope > .task:last-child .editor");
      if (created) created.focus();
    }
    return;
  }
  if (event.key === "Backspace" && editor.textContent.trim() === "") {
    const row = editor.closest(".task");
    const list = listOf(row);
    const rows = list.querySelectorAll(":scope > .task");
    if (rows.length < 2) return;
    event.preventDefault();
    const previous = row.previousElementSibling;
    row.remove();
    ensureTrailingBlank(list);
    const focusEditor = previous && previous.querySelector(".editor");
    if (focusEditor) focusEditor.focus();
    scheduleSave();
  }
});

document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const editor = document.activeElement;
  if (!editor || !editor.closest || !editor.closest(".editor")) return;
  const key = event.key.toLowerCase();
  const command = key === "b" ? "bold"
    : key === "i" ? "italic"
      : key === "u" ? "underline"
        : event.shiftKey && key === "x" ? "strikeThrough"
          : "";
  if (!command) return;
  event.preventDefault();
  applyFormat(command);
});

document.addEventListener("selectionchange", updateToolbar);
window.addEventListener("pagehide", () => {
  saveNow();
});

async function init() {
  if (starting || mounted) return;
  starting = true;
  useTagFormatting();
  const api = window.pywebview && window.pywebview.api;
  if (api && api.load_note) {
    try {
      const loaded = await api.load_note();
      store = { weeks: loaded.weeks || {} };
      if (loaded.unreadable) {
        unreadable = true;
        showError("The saved note could not be read. It was left untouched.");
      }
    } catch (error) {
      showError("The saved note could not be opened.");
    }
  }
  showWeek(new Date(), { focusToday: true });
}

window.addEventListener("pywebviewready", init);
window.setTimeout(() => {
  if (!window.pywebview) init();
}, 600);
