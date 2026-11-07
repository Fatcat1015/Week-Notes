const TEXT = {
  en: {
    weekday0: "Mon", weekday1: "Tue", weekday2: "Wed", weekday3: "Thu",
    weekday4: "Fri", weekday5: "Sat", weekday6: "Sun",
    minimize: "Minimize", previousWeek: "Previous week", nextWeek: "Next week",
    settings: "Settings", format: "Format", bold: "Bold", italic: "Italic",
    underline: "Underline", strike: "Strikethrough",
    thisWeek: "This week", pastWeek: "Past week", futureWeek: "Future week",
    reminders: "Reminders", reminderPlaceholder: "A note for every week",
    deadlines: "Deadlines", deadlinePlaceholder: "Date and what is due", deadline: "Deadline",
    addTask: "Add a task", today: "Today", task: "Task",
    dragDeadline: "Drag deadline", dragTask: "Drag task",
    completeTask: "Complete task", skipTask: "Skip task", done: "Done", skip: "Skip",
    whySkipped: "Why this was skipped", hour: "h", hours: "Hours",
    deleteDeadline: "Delete deadline", deleteTask: "Delete task",
    confirmDeleteDeadline: "Delete this deadline?", confirmDeleteTask: "Delete this task?",
    cancel: "Cancel", confirm: "Confirm",
    taskSaves: "Task saves", showInFolder: "Show in folder", exportSaves: "Export",
    importSaves: "Import", language: "Language", close: "Close",
    size: "Size",     font: "Font", fontDefault: "Default",
    fontAsk: "Which installed font should this use?",
    fontSearch: "Search fonts",
    fontLoading: "Loading fonts…",
    saveFailed: "Could not save the note. The previous file was left as it was.",
    readFailed: "The saved note could not be read. It was left untouched.",
    openFailed: "The saved note could not be opened.",
    importInvalid: "That file is not a Week Note save.",
    importFailed: "That file could not be read.",
    exportFailed: "The save could not be exported.",
  },
  zh: {
    weekday0: "周一", weekday1: "周二", weekday2: "周三", weekday3: "周四",
    weekday4: "周五", weekday5: "周六", weekday6: "周日",
    minimize: "最小化", previousWeek: "上一周", nextWeek: "下一周",
    settings: "设置", format: "格式", bold: "粗体", italic: "斜体",
    underline: "下划线", strike: "删除线",
    thisWeek: "本周", pastWeek: "过去的一周", futureWeek: "未来的一周",
    reminders: "提醒", reminderPlaceholder: "每周都在的备注",
    deadlines: "截止日期", deadlinePlaceholder: "日期和事项", deadline: "截止日期",
    addTask: "添加任务", today: "今天", task: "任务",
    dragDeadline: "拖动截止日期", dragTask: "拖动任务",
    completeTask: "完成任务", skipTask: "跳过任务", done: "完成", skip: "跳过",
    whySkipped: "跳过的原因", hour: "时", hours: "小时",
    deleteDeadline: "删除截止日期", deleteTask: "删除任务",
    confirmDeleteDeadline: "删除这个截止日期？", confirmDeleteTask: "删除这个任务？",
    cancel: "取消", confirm: "确认",
    taskSaves: "任务存档", showInFolder: "打开位置", exportSaves: "导出",
    importSaves: "导入", language: "语言", close: "关闭",
    size: "字号",     font: "字体", fontDefault: "默认",
    fontAsk: "使用哪一种已安装的字体？",
    fontSearch: "搜索字体",
    fontLoading: "正在载入字体…",
    saveFailed: "无法保存笔记，原文件未改动。",
    readFailed: "无法读取已保存的笔记，文件未改动。",
    openFailed: "无法打开已保存的笔记。",
    importInvalid: "这不是 Week Note 的存档。",
    importFailed: "无法读取这个文件。",
    exportFailed: "无法导出存档。",
  },
};

const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "BR", "P", "DIV"]);

const note = document.getElementById("note");
const confirmEl = document.getElementById("confirm");
const confirmQuestion = document.getElementById("confirm-question");
const confirmCancel = document.getElementById("confirm-cancel");
const confirmOk = document.getElementById("confirm-ok");
const settingsEl = document.getElementById("settings");
const settingsBtn = document.getElementById("settings-open");
const settingsTitle = document.getElementById("settings-title");
const settingsSavesLabel = document.getElementById("settings-saves-label");
const settingsPath = document.getElementById("settings-path");
const settingsLocate = document.getElementById("settings-locate");
const settingsExport = document.getElementById("settings-export");
const settingsImport = document.getElementById("settings-import");
const settingsLanguageLabel = document.getElementById("settings-language-label");
const settingsSizeLabel = document.getElementById("settings-size-label");
const settingsSize = document.getElementById("settings-size");
const settingsSizeValue = document.getElementById("settings-size-value");
const settingsFontLabel = document.getElementById("settings-font-label");
const settingsFont = document.getElementById("settings-font");
const settingsFontDefault = document.getElementById("settings-font-default");
const fontPicker = document.getElementById("font-picker");
const fontAsk = document.getElementById("font-ask");
const fontSearch = document.getElementById("font-search");
const fontList = document.getElementById("font-list");
const settingsClose = document.getElementById("settings-close");
const languageButtons = Array.from(document.querySelectorAll(".settings-languages button"));
const rangeEl = document.getElementById("range");
const whenEl = document.getElementById("when");
const collapseBtn = document.getElementById("collapse");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const statusEl = document.getElementById("status");
const tools = Array.from(document.querySelectorAll(".tool"));

const BUNDLED_FONT = "Courier Prime";
const ENGLISH_FONT = "ELEGANT TYPEWRITER";
const CHINESE_FONT = "汇文明朝体";
const CHINESE_FAMILY = "Huiwen-mincho";
const DEFAULT_FONTS = { en: ENGLISH_FONT, zh: CHINESE_FONT };
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 12;

let lang = "en";
let chosenFonts = { en: "", zh: "" };
let fontSize = DEFAULT_FONT_SIZE;
let fontLoad = 0;
let errorKey = "";

function t(key) {
  const pack = TEXT[lang] || TEXT.en;
  return pack[key] || TEXT.en[key] || key;
}

function weekdayName(index) {
  return t(`weekday${index}`);
}

function taskLabel(index) {
  const name = weekdayName(index);
  return lang === "zh" ? `${name}任务` : `${name} task`;
}

let store = { weeks: {}, reminder: "", reminderOpen: false };
let viewMonday = startOfWeek(new Date());
let mounted = false;
let starting = false;
let saveTimer = 0;
let unreadable = false;
let undoStack = [];
let deleteUndoArmed = false;
let pendingDelete = null;

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

function formatDay(date, withYear) {
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const options = { month: lang === "zh" ? "numeric" : "short", day: "numeric" };
  if (withYear) options.year = "numeric";
  return date.toLocaleDateString(locale, options);
}

function formatRange(monday) {
  const sunday = addDays(monday, 6);
  const thisYear = new Date().getFullYear();
  const crossYear = monday.getFullYear() !== sunday.getFullYear();
  const left = formatDay(monday, crossYear || monday.getFullYear() !== thisYear);
  const right = formatDay(sunday, crossYear || sunday.getFullYear() !== thisYear);
  return `${left} – ${right}`;
}

function weekPlace(monday) {
  const view = iso(monday);
  const current = iso(startOfWeek(new Date()));
  if (view === current) return t("thisWeek");
  if (view < current) return t("pastWeek");
  return t("futureWeek");
}

function weekId(monday) {
  return iso(monday);
}

function blankTask() {
  return { html: "", state: "open", why: "", hours: "" };
}

function durationValue(value, max) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return "";
  let rounded = Number(number.toFixed(1));
  if (typeof max === "number") rounded = Math.min(rounded, max);
  return rounded;
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
    tasks.push({ html: clean, state: "open", why: "", hours: "" });
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
    if (!tasks.length) tasks.push({ html: "", state: "skipped", why: reason, hours: "" });
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
  const hours = durationValue(task.hours, 999);
  if (!textOf(html).trim() && !why.trim() && state === "open") return null;
  return { html, state, why, hours };
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

function showError(key) {
  errorKey = key;
  statusEl.hidden = false;
  statusEl.textContent = t(key);
}

function clearError() {
  errorKey = "";
  statusEl.hidden = true;
  statusEl.textContent = "";
}

function applyChrome() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  collapseBtn.setAttribute("aria-label", t("minimize"));
  collapseBtn.title = t("minimize");
  prevBtn.setAttribute("aria-label", t("previousWeek"));
  nextBtn.setAttribute("aria-label", t("nextWeek"));
  settingsBtn.setAttribute("aria-label", t("settings"));
  settingsBtn.title = t("settings");
  document.querySelector(".toolbar").setAttribute("aria-label", t("format"));
  const toolNames = { bold: "bold", italic: "italic", underline: "underline", strikeThrough: "strike" };
  tools.forEach((button) => {
    const name = toolNames[button.dataset.cmd];
    if (name) button.setAttribute("aria-label", t(name));
  });
  confirmCancel.textContent = t("cancel");
  confirmOk.textContent = t("confirm");
  settingsTitle.textContent = t("settings");
  settingsSavesLabel.textContent = t("taskSaves");
  settingsLocate.textContent = t("showInFolder");
  settingsExport.textContent = t("exportSaves");
  settingsImport.textContent = t("importSaves");
  settingsLanguageLabel.textContent = t("language");
  settingsSizeLabel.textContent = t("size");
  settingsFontLabel.textContent = t("font");
  settingsFontDefault.textContent = t("fontDefault");
  fontAsk.textContent = t("fontAsk");
  fontSearch.placeholder = t("fontSearch");
  settingsClose.textContent = t("close");
  applyFont();
  applyFontSize();
  languageButtons.forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.language === lang ? "true" : "false");
  });
  if (errorKey) statusEl.textContent = t(errorKey);
}

function setLanguage(next) {
  lang = next === "zh" ? "zh" : "en";
  applyChrome();
  if (mounted) showWeek(viewMonday);
}

function activeFontName() {
  const chosen = chosenFonts[lang];
  if (chosen) return chosen;
  return DEFAULT_FONTS[lang];
}

function sameChineseFont(name) {
  return name === CHINESE_FONT || name === CHINESE_FAMILY;
}

function fontsMatch(left, right) {
  return left === right || (sameChineseFont(left) && sameChineseFont(right));
}

function fontLabel(name) {
  if (sameChineseFont(name)) return lang === "zh" ? CHINESE_FONT : CHINESE_FAMILY;
  return name;
}

function fontFamily(name) {
  const cleaned = String(name || "").replace(/["\\]/g, "");
  const lead = sameChineseFont(cleaned) ? [CHINESE_FAMILY, CHINESE_FONT] : [cleaned];
  const parts = [];
  lead.concat([BUNDLED_FONT, "Courier New", "sans-serif"]).forEach((item) => {
    if (item && !parts.includes(item)) parts.push(item);
  });
  return parts.map((item) => (item === "sans-serif" ? item : `"${item}"`)).join(", ");
}

function applyFont() {
  const name = activeFontName();
  document.documentElement.style.setProperty("--ui-font", fontFamily(name));
  settingsFont.textContent = fontLabel(name);
  settingsFont.style.fontFamily = fontFamily(name);
}

function clampFontSize(value) {
  const size = Number(value);
  if (!Number.isInteger(size)) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
}

function applyFontSize() {
  document.documentElement.style.setProperty("--note-size", `${fontSize}px`);
  settingsSize.value = String(fontSize);
  settingsSizeValue.textContent = String(fontSize);
}

function restoreDefaultFonts() {
  chosenFonts = { en: DEFAULT_FONTS.en, zh: DEFAULT_FONTS.zh };
  applyFont();
  closeFontPicker();
  const api = window.pywebview && window.pywebview.api;
  if (api && api.reset_fonts) api.reset_fonts();
}

function closeFontPicker() {
  fontLoad += 1;
  fontPicker.hidden = true;
  settingsFont.setAttribute("aria-expanded", "false");
}

function fontSearchText(name) {
  return sameChineseFont(name) ? `${CHINESE_FONT} ${CHINESE_FAMILY}` : name;
}

function filterFontList() {
  const query = fontSearch.value.trim().toLocaleLowerCase();
  fontList.querySelectorAll("button").forEach((button) => {
    const haystack = `${button.dataset.search || ""} ${button.textContent}`.toLocaleLowerCase();
    button.hidden = Boolean(query) && !haystack.includes(query);
  });
}

function chooseFont(name) {
  chosenFonts[lang] = name;
  applyFont();
  closeFontPicker();
  fontList.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", fontsMatch(button.dataset.font, name) ? "true" : "false");
  });
  const api = window.pywebview && window.pywebview.api;
  if (api && api.set_font) api.set_font(name, lang);
}

function rememberFont(items, seen, name, chinese, label) {
  const cleaned = String(name || "").trim();
  if (!cleaned || seen.has(cleaned) || (sameChineseFont(cleaned) && seen.has(CHINESE_FONT))) return;
  const family = sameChineseFont(cleaned) ? CHINESE_FAMILY : cleaned;
  const stored = sameChineseFont(cleaned) ? (lang === "zh" ? CHINESE_FONT : CHINESE_FAMILY) : cleaned;
  if (sameChineseFont(cleaned)) {
    seen.add(CHINESE_FONT);
    seen.add(CHINESE_FAMILY);
  } else {
    seen.add(cleaned);
  }
  const localized = String(label || "").trim();
  const showLocalized = lang === "zh" && /[\u3400-\u9fff]/.test(localized);
  items.push({
    name: stored,
    family,
    chinese: Boolean(chinese) || sameChineseFont(cleaned),
    label: showLocalized ? localized : fontLabel(stored),
    search: `${localized} ${cleaned} ${stored} ${fontSearchText(cleaned)}`,
  });
}

function collectFonts(fonts) {
  const items = [];
  const seen = new Set();
  if (lang === "zh") rememberFont(items, seen, CHINESE_FONT, true, CHINESE_FONT);
  else rememberFont(items, seen, ENGLISH_FONT, false, ENGLISH_FONT);
  fonts.forEach((entry) => {
    if (typeof entry === "string") {
      rememberFont(items, seen, entry, false, entry);
      return;
    }
    if (!entry) return;
    rememberFont(items, seen, entry.name, entry.chinese, entry.label);
  });
  rememberFont(items, seen, BUNDLED_FONT, false, BUNDLED_FONT);
  if (lang !== "zh") return items;
  const first = [];
  const rest = [];
  items.forEach((item) => {
    if (item.chinese || sameChineseFont(item.name)) first.push(item);
    else rest.push(item);
  });
  return first.concat(rest);
}

function renderFontList(fonts) {
  const current = activeFontName();
  fontList.replaceChildren();
  let currentButton = null;
  collectFonts(fonts).forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.font = item.name;
    button.dataset.search = item.search;
    button.textContent = item.label;
    const stack = `${fontFamily(item.family)}, var(--ui-font)`;
    button.style.fontFamily = /[\u3400-\u9fff]/.test(item.label) ? stack : `var(--ui-font), ${stack}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-pressed", fontsMatch(item.name, current) ? "true" : "false");
    button.addEventListener("click", () => chooseFont(item.name));
    fontList.append(button);
    if (fontsMatch(item.name, current)) currentButton = button;
  });
  if (currentButton) currentButton.scrollIntoView({ block: "nearest" });
  filterFontList();
}

async function openFontPicker() {
  const ticket = ++fontLoad;
  fontPicker.hidden = false;
  settingsFont.setAttribute("aria-expanded", "true");
  fontAsk.textContent = t("fontAsk");
  fontSearch.placeholder = t("fontSearch");
  fontSearch.value = "";
  fontList.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "font-loading";
  loading.textContent = t("fontLoading");
  fontList.append(loading);
  fontSearch.focus();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (ticket !== fontLoad) return;
  const api = window.pywebview && window.pywebview.api;
  let fonts = [];
  if (api && api.list_fonts) {
    try {
      const result = await api.list_fonts();
      if (result && Array.isArray(result.fonts)) fonts = result.fonts;
    } catch (error) {
      fonts = [];
    }
  }
  if (ticket !== fontLoad) return;
  renderFontList(fonts);
}

function strokeIcon(pathData) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("d", pathData);
  svg.append(path);
  return svg;
}

function actionIcon(action) {
  return strokeIcon(action === "done" ? "M2 6.2 L4.7 9 L10 3" : "M3 3 L9 9 M9 3 L3 9");
}

function trashIcon() {
  return strokeIcon("M2.5 3.5 H9.5 M4.6 3.5 V2.6 H7.4 V3.5 M3.3 3.5 L3.9 10.2 H8.1 L8.7 3.5");
}

function gripIcon() {
  return strokeIcon("M1.5 3.4 H10.5 M1.5 6 H10.5 M1.5 8.6 H10.5");
}

function actionButton(action, state) {
  const pressed = stateForAction(action) === state;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "task-action";
  button.dataset.action = action;
  button.append(actionIcon(action));
  button.hidden = state !== "open" && !pressed;
  button.setAttribute("aria-pressed", pressed ? "true" : "false");
  button.setAttribute("aria-label", action === "done" ? t("completeTask") : t("skipTask"));
  button.title = action === "done" ? t("done") : t("skip");
  return button;
}

function createDurationInput(className, value, label, max) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "0.1";
  input.max = String(max);
  input.className = className;
  input.value = value === "" || value === undefined || value === null ? "" : String(value);
  input.setAttribute("aria-label", label);
  input.inputMode = "decimal";
  return input;
}

function fitHourField(input) {
  const length = String(input.value || "").length;
  input.style.width = `${Math.max(length, 1)}ch`;
}

function createTimeColumn(task) {
  const column = document.createElement("div");
  column.className = "task-time";
  const hours = createDurationInput("task-hours", task.hours, t("hours"), 999);
  fitHourField(hours);
  const hourLabel = document.createElement("span");
  hourLabel.textContent = t("hour");
  column.append(hours, hourLabel);
  column.addEventListener("click", (event) => {
    if (event.target !== hours) hours.focus();
  });
  return column;
}

function createWhyInput(value) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "why-input";
  input.placeholder = t("whySkipped");
  input.value = value || "";
  input.setAttribute("aria-label", t("whySkipped"));
  return input;
}

function syncTaskChrome(row) {
  if (!row) return;
  const editor = row.querySelector(".editor");
  const actions = row.querySelector(".task-actions");
  const time = row.querySelector(".task-time");
  if (!editor || !actions || !time) return;
  const open = (row.dataset.state || "open") === "open";
  const hidden = editor.textContent.trim() === "" && open;
  actions.hidden = hidden;
  time.hidden = hidden;
  const edge = row.querySelector(".task-edge");
  if (edge) edge.hidden = hidden;
  const grip = row.querySelector(".task-grip");
  if (grip) grip.hidden = hidden;
}

function createTaskRow(task, placeholder, label, kind) {
  const state = task.state || "open";
  const row = document.createElement("div");
  row.className = "task";
  if (state === "done") row.classList.add("is-done");
  if (state === "skipped") row.classList.add("is-skipped");
  row.dataset.state = state;
  if (task.why) row.dataset.why = task.why;

  const line = document.createElement("div");
  line.className = "task-line";

  const grip = document.createElement("button");
  grip.type = "button";
  grip.className = "task-grip";
  grip.tabIndex = -1;
  const deadline = kind === "deadline";
  grip.setAttribute("aria-label", deadline ? t("dragDeadline") : t("dragTask"));
  grip.append(gripIcon());

  const editor = document.createElement("div");
  editor.className = "editor";
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.dataset.placeholder = placeholder;
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-label", label);
  writeEditor(editor, task.html);

  const time = createTimeColumn(task);
  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(
    actionButton("done", state),
    actionButton("skip", state),
  );
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "task-delete";
  remove.setAttribute("aria-label", deadline ? t("deleteDeadline") : t("deleteTask"));
  remove.append(trashIcon());
  const edge = document.createElement("div");
  edge.className = "task-edge";
  edge.append(remove);
  const tail = document.createElement("div");
  tail.className = "task-tail";
  tail.append(time, actions);
  line.append(grip, editor, tail, edge);
  row.append(line);
  if (state === "skipped") row.append(createWhyInput(task.why));
  syncTaskChrome(row);
  return row;
}

function fillList(list, tasks, placeholder, label, kind) {
  list.replaceChildren();
  tasks.forEach((task) => list.append(createTaskRow(task, placeholder, label, kind)));
  list.append(createTaskRow(blankTask(), placeholder, label, kind));
}

function renderReminder() {
  const section = document.createElement("section");
  section.className = "block reminders";
  const open = store.reminderOpen === true;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "reminder-toggle";
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  const mark = document.createElement("span");
  mark.className = "reminder-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = open ? "▾" : "▸";
  toggle.append(mark, document.createTextNode(t("reminders")));
  const body = document.createElement("div");
  body.className = "reminder-body";
  body.contentEditable = "true";
  body.spellcheck = true;
  body.dataset.placeholder = t("reminderPlaceholder");
  body.setAttribute("role", "textbox");
  body.setAttribute("aria-label", t("reminders"));
  writeEditor(body, store.reminder || "");
  body.hidden = !open;
  toggle.addEventListener("click", () => {
    const next = toggle.getAttribute("aria-expanded") !== "true";
    store.reminderOpen = next;
    body.hidden = !next;
    toggle.setAttribute("aria-expanded", next ? "true" : "false");
    mark.textContent = next ? "▾" : "▸";
    scheduleSave();
    if (next) body.focus();
  });
  section.append(toggle, body);
  return section;
}

function render() {
  const monday = viewMonday;
  const id = weekId(monday);
  const week = ensureWeek(id, monday);
  const today = iso(new Date());

  rangeEl.textContent = formatRange(monday);
  whenEl.textContent = weekPlace(monday);
  nextBtn.disabled = false;

  note.replaceChildren();
  note.append(renderReminder());

  const deadlines = document.createElement("section");
  deadlines.className = "block deadlines";
  const deadlinesHeading = document.createElement("h2");
  deadlinesHeading.textContent = t("deadlines");
  const deadlineList = document.createElement("div");
  deadlineList.dataset.list = "deadlines";
  fillList(deadlineList, week.deadlines, t("deadlinePlaceholder"), t("deadline"), "deadline");
  deadlines.append(deadlinesHeading, deadlineList);
  note.append(deadlines);

  for (let index = 0; index < 7; index += 1) {
    const date = addDays(monday, index);
    const dayId = iso(date);
    const section = document.createElement("section");
    section.className = dayId === today ? "block day is-today" : "block day";
    const heading = document.createElement("h2");
    heading.textContent = `${weekdayName(index)} ${date.getDate()}`;
    if (dayId === today) heading.dataset.today = t("today");
    const list = document.createElement("div");
    list.dataset.list = "day";
    list.dataset.day = dayId;
    fillList(list, week.days[dayId].tasks, t("addTask"), taskLabel(index), "task");
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
    hours: durationValue(row.querySelector(".task-hours") && row.querySelector(".task-hours").value, 999),
  };
}

function taskHasContent(task) {
  return Boolean(textOf(task.html).trim() || task.why.trim() || task.state !== "open");
}

function readList(list) {
  return Array.from(list.querySelectorAll(":scope > .task")).map(readTask).filter(taskHasContent);
}

function readReminder(body) {
  if (!body || !body.textContent.trim()) return "";
  return sanitize(body.innerHTML);
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
  const reminder = note.querySelector(".reminder-body");
  if (reminder) store.reminder = readReminder(reminder);
  const toggle = note.querySelector(".reminder-toggle");
  if (toggle) store.reminderOpen = toggle.getAttribute("aria-expanded") === "true";
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
  const reminder = typeof source.reminder === "string" ? source.reminder : "";
  return { weeks, reminder, reminderOpen: source.reminderOpen === true };
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
      showError("saveFailed");
      return;
    }
    clearError();
  } catch (error) {
    showError("saveFailed");
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
    button.hidden = state !== "open" && !pressed;
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

function editingField(node) {
  return node && node.closest && node.closest(".editor, .reminder-body");
}

function disarmDeleteUndo() {
  deleteUndoArmed = false;
  undoStack = [];
}

function closeDeleteConfirm() {
  pendingDelete = null;
  confirmEl.hidden = true;
}

function openDeleteConfirm(row) {
  pendingDelete = row;
  const list = listOf(row);
  confirmQuestion.textContent = list && list.dataset.list === "deadlines"
    ? t("confirmDeleteDeadline")
    : t("confirmDeleteTask");
  confirmEl.hidden = false;
  confirmCancel.focus();
}

function deleteTask(row) {
  const list = listOf(row);
  if (!list || !row.isConnected) return;
  const task = readTask(row);
  if (!taskHasContent(task)) return;
  const index = Array.from(list.querySelectorAll(":scope > .task")).indexOf(row);
  undoStack.push({
    weekId: weekId(viewMonday),
    mondayTime: viewMonday.getTime(),
    list: list.dataset.list,
    dayId: list.dataset.day || "",
    index,
    task,
  });
  deleteUndoArmed = true;
  row.remove();
  ensureTrailingBlank(list);
  note.focus({ preventScroll: true });
  scheduleSave();
}

function undoDelete() {
  const item = undoStack.pop();
  if (!item) return;
  if (iso(viewMonday) !== item.weekId) showWeek(new Date(item.mondayTime));
  const list = item.list === "deadlines"
    ? note.querySelector('[data-list="deadlines"]')
    : note.querySelector(`[data-list="day"][data-day="${item.dayId}"]`);
  if (!list) return;
  const row = createTaskRow(item.task, placeholderOf(list), labelOf(list), list.dataset.list === "deadlines" ? "deadline" : "task");
  const rows = list.querySelectorAll(":scope > .task");
  list.insertBefore(row, rows[item.index] || null);
  ensureTrailingBlank(list);
  note.focus({ preventScroll: true });
  scheduleSave();
}

function applyFormat(command) {
  const active = document.activeElement;
  if (!editingField(active)) return;
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
  return editor ? editor.getAttribute("aria-label") : t("task");
}

function ensureTrailingBlank(list) {
  const rows = list.querySelectorAll(":scope > .task");
  const last = rows[rows.length - 1];
  const editor = last && last.querySelector(".editor");
  const empty = editor && editor.textContent.trim() === "" && (last.dataset.state || "open") === "open";
  if (!empty) {
    list.append(createTaskRow(
      blankTask(),
      placeholderOf(list),
      labelOf(list),
      list.dataset.list === "deadlines" ? "deadline" : "task",
    ));
  }
}

let draggedTask = null;
let suppressClick = false;

function clearDragMarks() {
  note.querySelectorAll(".is-drop-before, .is-drop-after, .is-dragging").forEach((row) => {
    row.classList.remove("is-drop-before", "is-drop-after", "is-dragging");
  });
}

function dropTargetAt(x, y) {
  const hit = document.elementFromPoint(x, y);
  if (!hit || !note.contains(hit) || hit.closest(".reminders")) return null;
  const section = hit.closest(".day, .deadlines");
  const list = hit.closest("[data-list]") || (section && section.querySelector("[data-list]"));
  if (!list) return null;
  const rows = Array.from(list.querySelectorAll(":scope > .task"));
  let before = null;
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    const blank = !taskHasContent(readTask(row));
    if (blank || y < rect.top + rect.height / 2) {
      before = row;
      break;
    }
  }
  return { list, before };
}

function markDrop(target) {
  note.querySelectorAll(".is-drop-before, .is-drop-after").forEach((row) => {
    row.classList.remove("is-drop-before", "is-drop-after");
  });
  if (!target || !target.before) return;
  const before = target.before;
  if (!taskHasContent(readTask(before)) && before.previousElementSibling) {
    before.previousElementSibling.classList.add("is-drop-after");
    return;
  }
  before.classList.add("is-drop-before");
}

function sameDrop(row, target) {
  if (!target || listOf(row) !== target.list) return false;
  return target.before === row || row.nextElementSibling === target.before;
}

function moveDraggedTask(row, target) {
  if (!target || sameDrop(row, target)) return;
  const origin = listOf(row);
  target.list.insertBefore(row, target.before);
  ensureTrailingBlank(origin);
  if (origin !== target.list) ensureTrailingBlank(target.list);
  disarmDeleteUndo();
  scheduleSave();
}

function scrollNote(y) {
  const rect = note.getBoundingClientRect();
  if (y < rect.top + 32) note.scrollTop -= 16;
  else if (y > rect.bottom - 32) note.scrollTop += 16;
}

note.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !confirmEl.hidden || !settingsEl.hidden) return;
  const grip = event.target.closest && event.target.closest(".task-grip");
  if (!grip || !note.contains(grip)) return;
  const row = grip.closest(".task");
  if (!row || !taskHasContent(readTask(row))) return;
  event.preventDefault();
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  let active = false;

  function move(pointerEvent) {
    if (pointerEvent.pointerId !== pointerId) return;
    const dx = pointerEvent.clientX - startX;
    const dy = pointerEvent.clientY - startY;
    if (!active) {
      if (dx * dx + dy * dy < 25) return;
      active = true;
      draggedTask = row;
      suppressClick = true;
      row.classList.add("is-dragging");
      document.body.classList.add("is-task-drag");
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
    }
    scrollNote(pointerEvent.clientY);
    markDrop(dropTargetAt(pointerEvent.clientX, pointerEvent.clientY));
  }

  function end(pointerEvent) {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
    if (!active) return;
    const target = dropTargetAt(pointerEvent.clientX, pointerEvent.clientY);
    clearDragMarks();
    document.body.classList.remove("is-task-drag");
    draggedTask = null;
    moveDraggedTask(row, target);
    setTimeout(() => {
      suppressClick = false;
    }, 0);
  }

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
});

note.addEventListener("click", (event) => {
  if (!suppressClick) return;
  suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}, true);

collapseBtn.addEventListener("click", () => {
  const api = window.pywebview && window.pywebview.api;
  if (api && api.collapse_to_icon) api.collapse_to_icon();
});

function closeSettings() {
  closeFontPicker();
  settingsEl.hidden = true;
}

async function openSettings() {
  closeDeleteConfirm();
  applyChrome();
  settingsEl.hidden = false;
  settingsClose.focus();
  const api = window.pywebview && window.pywebview.api;
  if (!api || !api.get_settings) return;
  try {
    const settings = await api.get_settings();
    if (!settingsEl.hidden) {
      settingsPath.textContent = settings && settings.savePath ? settings.savePath : "";
    }
  } catch (error) {
    settingsPath.textContent = "";
  }
}

settingsBtn.addEventListener("click", () => {
  if (settingsEl.hidden) openSettings();
  else closeSettings();
});

settingsClose.addEventListener("click", closeSettings);

settingsEl.addEventListener("click", (event) => {
  if (event.target === settingsEl) closeSettings();
});

settingsLocate.addEventListener("click", () => {
  const api = window.pywebview && window.pywebview.api;
  if (api && api.open_save_folder) api.open_save_folder();
});

settingsExport.addEventListener("click", async () => {
  const api = window.pywebview && window.pywebview.api;
  if (!api || !api.export_note) return;
  await saveNow();
  try {
    const result = await api.export_note(lang);
    if (!result || result.cancelled) return;
    if (!result.ok) showError(result.error === "unreadable" ? "readFailed" : "exportFailed");
  } catch (error) {
    showError("exportFailed");
  }
});

settingsImport.addEventListener("click", async () => {
  const api = window.pywebview && window.pywebview.api;
  if (!api || !api.import_note) return;
  try {
    const result = await api.import_note(lang);
    if (!result || result.cancelled) return;
    if (!result.ok) {
      showError(result.error === "invalid" ? "importInvalid" : "importFailed");
      return;
    }
    store = {
      weeks: result.weeks || {},
      reminder: typeof result.reminder === "string" ? result.reminder : "",
      reminderOpen: result.reminderOpen === true,
    };
    unreadable = false;
    clearError();
    showWeek(viewMonday);
  } catch (error) {
    showError("importFailed");
  }
});

settingsFont.addEventListener("click", () => {
  if (fontPicker.hidden) openFontPicker();
  else closeFontPicker();
});

settingsFontDefault.addEventListener("click", restoreDefaultFonts);

fontSearch.addEventListener("input", filterFontList);
fontSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && fontSearch.value) {
    event.preventDefault();
    event.stopPropagation();
    fontSearch.value = "";
    filterFontList();
    return;
  }
  if (event.key !== "Enter") return;
  event.preventDefault();
  const visible = fontList.querySelector("button:not([hidden])");
  if (visible) visible.click();
});

settingsSize.addEventListener("input", () => {
  fontSize = clampFontSize(Number(settingsSize.value));
  applyFontSize();
  const api = window.pywebview && window.pywebview.api;
  if (api && api.set_font_size) api.set_font_size(fontSize);
});

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.dataset.language === "zh" ? "zh" : "en";
    if (next === lang) return;
    setLanguage(next);
    const api = window.pywebview && window.pywebview.api;
    if (api && api.set_language) api.set_language(next);
  });
});

prevBtn.addEventListener("click", () => {
  closeDeleteConfirm();
  showWeek(addDays(viewMonday, -7), { save: true });
});

nextBtn.addEventListener("click", () => {
  closeDeleteConfirm();
  showWeek(addDays(viewMonday, 7), { save: true });
});

confirmCancel.addEventListener("click", () => {
  closeDeleteConfirm();
});

confirmOk.addEventListener("click", () => {
  const row = pendingDelete;
  closeDeleteConfirm();
  if (row) deleteTask(row);
});

tools.forEach((button) => {
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => applyFormat(button.dataset.cmd));
});

note.addEventListener("click", (event) => {
  const remove = event.target.closest && event.target.closest(".task-delete");
  if (remove && note.contains(remove)) {
    const row = remove.closest(".task");
    if (!row || !taskHasContent(readTask(row))) return;
    openDeleteConfirm(row);
    return;
  }
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
  if (editingField(event.target)) disarmDeleteUndo();
  if (event.target.closest && event.target.closest(".reminder-body")) {
    scheduleSave();
    return;
  }
  const row = event.target.closest && event.target.closest(".task");
  if (!row) return;
  if (event.target.classList && event.target.classList.contains("task-hours")) fitHourField(event.target);
  syncTaskChrome(row);
  scheduleSave();
});

note.addEventListener("change", (event) => {
  const input = event.target;
  if (!input.classList) return;
  if (!input.classList.contains("task-hours")) return;
  const hours = durationValue(input.value, 999);
  input.value = hours === "" ? "" : String(hours);
  fitHourField(input);
  scheduleSave();
});

note.addEventListener("focusout", (event) => {
  const editor = editingField(event.target);
  if (!editor || !note.contains(editor)) return;
  if (!editor.textContent.trim()) editor.innerHTML = "";
  const row = editor.closest(".task");
  if (row) syncTaskChrome(row);
  scheduleSave();
});

note.addEventListener("paste", (event) => {
  const editor = editingField(event.target);
  if (!editor) return;
  disarmDeleteUndo();
  event.preventDefault();
  const clipboard = event.clipboardData;
  const html = clipboard ? clipboard.getData("text/html") : "";
  const text = clipboard ? clipboard.getData("text/plain") : "";
  const clean = html ? sanitize(html) : "";
  useTagFormatting();
  if (clean && textOf(clean).trim()) document.execCommand("insertHTML", false, clean);
  else document.execCommand("insertText", false, text);
  const row = editor.closest(".task");
  if (row) syncTaskChrome(row);
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
  if (event.key === "Escape" && !settingsEl.hidden) {
    if (!fontPicker.hidden) closeFontPicker();
    else closeSettings();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "z") {
    if (!deleteUndoArmed || !undoStack.length || !confirmEl.hidden) return;
    event.preventDefault();
    undoDelete();
    if (!undoStack.length) deleteUndoArmed = false;
    return;
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const editor = document.activeElement;
  if (!editingField(editor)) return;
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
  if (api && api.get_settings) {
    try {
      const settings = await api.get_settings();
      lang = settings && settings.language === "zh" ? "zh" : "en";
      chosenFonts = { en: "", zh: "" };
      const stored = settings && settings.fonts;
      if (stored && typeof stored === "object") {
        chosenFonts.en = typeof stored.en === "string" ? stored.en.trim() : "";
        chosenFonts.zh = typeof stored.zh === "string" ? stored.zh.trim() : "";
      } else if (settings && typeof settings.font === "string") {
        chosenFonts[lang] = settings.font.trim();
      }
      fontSize = clampFontSize(settings && settings.fontSize);
    } catch (error) {
      lang = "en";
    }
  }
  applyChrome();
  if (api && api.load_note) {
    try {
      const loaded = await api.load_note();
      store = {
        weeks: loaded.weeks || {},
        reminder: typeof loaded.reminder === "string" ? loaded.reminder : "",
        reminderOpen: loaded.reminderOpen === true,
      };
      if (loaded.unreadable) {
        unreadable = true;
        showError("readFailed");
      }
    } catch (error) {
      showError("openFailed");
    }
  }
  showWeek(new Date(), { focusToday: true });
}

let scrollTimer = 0;
note.addEventListener("scroll", () => {
  note.classList.add("is-scrolling");
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => note.classList.remove("is-scrolling"), 700);
});

window.addEventListener("pywebviewready", init);
window.setTimeout(() => {
  if (!window.pywebview) init();
}, 600);
