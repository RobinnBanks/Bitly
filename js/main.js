const ACCOUNTS_KEY = "bitly-demo-accounts";
const USER_KEY = "bitly-current-user";
const RECENT_EMAIL_KEY = "bitly-recent-email";
const PUBLIC_THEME_KEY = "bitly-public-theme";

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const defaultState = () => ({
  kidName: "Eunice",
  buddyName: "Mochi",
  historyRange: "today",
  goals: { meals: 3, water: 5, glucose: 4, activity: 30 },
  logs: [
    { type: "meal", detail: "Breakfast", at: "Today · 08:30" },
    { type: "water", detail: "Water", at: "Today · 09:00" },
    { type: "water", detail: "Water", at: "Today · 10:45" },
    { type: "glucose", detail: "Glucose check", at: "Today · 09:10" },
    { type: "glucose", detail: "Glucose check", at: "Today · 12:15" },
    { type: "activity", detail: "Games", minutes: 12, at: "Today · 11:30" },
  ],
  trend: "stable",
  mood: "happy",
  notifications: [
    { id: 1, message: "I’m feeling low energy — maybe check your glucose?", time: "Today · 12:15", done: false, kind: "buddy" },
    { id: 2, message: "I’m thirsty — water time?", time: "Today · 10:45", done: false, kind: "buddy" },
    { id: 3, message: "You’re doing a great job, friend!", time: "Today · 09:10", done: true, kind: "win" },
  ],
  responses: 2,
  settings: {
    theme: "yellow", twoStep: false, notifications: true, tone: "gentle",
    highContrast: false, largeText: false, dyslexia: false, reducedMotion: false,
    buddy: { skin: "peach", hair: "plum", clothes: "teal", accessory: "none" },
  },
  lastSync: "Just now",
});

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getAccounts() { return readJSON(ACCOUNTS_KEY, []); }
function getCurrentUser() { return readJSON(USER_KEY, null); }
function stateKey(email) { return `bitly-demo-state-${email}`; }
function getState(email = getCurrentUser()?.email) {
  if (!email) return defaultState();
  const saved = readJSON(stateKey(email), null);
  if (!saved) return defaultState();
  const base = defaultState();
  return { ...base, ...saved, goals: { ...base.goals, ...(saved.goals || {}) }, settings: { ...base.settings, ...(saved.settings || {}), buddy: { ...base.settings.buddy, ...(saved.settings?.buddy || {}) } } };
}
function saveState(state, email = getCurrentUser()?.email) { if (email) writeJSON(stateKey(email), state); }
function getDisplayName(user) { return user?.name || user?.email?.split("@")[0] || "friend"; }
function roleName(type) { return type === "parent" ? "Parent" : type === "teen" ? "Teen" : "Kid"; }

let toastTimer;
function showToast(message) {
  const toast = $(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3300);
}

function currentRoute() { return (window.location.hash || "#home").slice(1).split("?")[0] || "home"; }

function showAuth(mode = "login") {
  const modal = $("#auth-modal");
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  switchAuthTab(mode);
  const email = $("input[name='email']", $("#login-form"));
  if (email && !email.value) email.value = localStorage.getItem(RECENT_EMAIL_KEY) || "";
}
function closeAuth() {
  const modal = $("#auth-modal");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
}
function switchAuthTab(mode) {
  $$("[data-auth-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.authTab === mode));
  $$("[data-auth-form]").forEach((form) => form.classList.toggle("is-hidden", form.dataset.authForm !== mode));
  const copy = {
    login: ["Welcome back", "Your buddy<br /><em>missed you.</em>", "Pick up right where you left off and see what today has in store."],
    signup: ["Welcome to the club", "Make space for<br /><em>small wins.</em>", "A Bitly account keeps your buddy, your patterns, and your progress together."],
  }[mode];
  $("[data-auth-kicker]").textContent = copy[0];
  $("[data-auth-title]").innerHTML = copy[1];
  $("[data-auth-copy]").textContent = copy[2];
}

function route() {
  const user = getCurrentUser();
  const routeName = currentRoute();
  const publicRoute = ["home", "about", "story", "signup", "login"].includes(routeName);
  const loggedIn = Boolean(user);
  $("#public-view")?.classList.toggle("is-hidden", loggedIn);
  $("#app-view")?.classList.toggle("is-hidden", !loggedIn);
  $(".public-topbar")?.classList.toggle("is-hidden", loggedIn);
  $(".app-topbar")?.classList.toggle("is-hidden", !loggedIn);
  $(".public-footer")?.classList.toggle("is-hidden", loggedIn);

  if (loggedIn) {
    const view = ["notifications", "settings"].includes(routeName) ? routeName : "dashboard";
    $$(".app-view-section").forEach((section) => section.classList.toggle("is-active", section.dataset.view === view));
    $$("[data-nav-view]").forEach((link) => link.classList.toggle("active", link.dataset.navView === view));
    hydrateApp();
    if (publicRoute) window.history.replaceState({}, "", "#dashboard");
  } else {
    if (!publicRoute) window.history.replaceState({}, "", "#home");
    if (routeName === "login" || routeName === "signup") showAuth(routeName);
  }
  $$(".main-nav").forEach((nav) => nav.classList.remove("open"));
  $$(".menu-toggle").forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyTheme(theme) {
  document.body.classList.remove("theme-pink", "theme-mix", "theme-dark", "theme-blue");
  if (theme && theme !== "yellow") document.body.classList.add(`theme-${theme}`);
}
function applyAccessibility(settings) {
  const body = document.body;
  body.classList.toggle("a11y-high-contrast", Boolean(settings.highContrast));
  body.classList.toggle("a11y-large", Boolean(settings.largeText));
  body.classList.toggle("a11y-dyslexia", Boolean(settings.dyslexia));
  body.classList.toggle("a11y-reduced-motion", Boolean(settings.reducedMotion));
}
function applyBuddy(buddy = {}) {
  const classes = ["buddy-skin-peach", "buddy-skin-golden", "buddy-skin-cocoa", "buddy-hair-plum", "buddy-hair-blue", "buddy-hair-sunny", "buddy-clothes-teal", "buddy-clothes-pink", "buddy-clothes-lavender", "buddy-accessory-none", "buddy-accessory-bow", "buddy-accessory-cap", "buddy-accessory-star"];
  document.body.classList.remove(...classes);
  Object.entries(buddy).forEach(([key, value]) => {
    if (value) document.body.classList.add(`buddy-${key}-${value}`);
  });
}

function hydrateApp() {
  const user = getCurrentUser();
  const state = getState();
  const label = roleName(user?.type);
  $$("[data-user-name]").forEach((el) => { el.textContent = getDisplayName(user); });
  $$("[data-account-label]").forEach((el) => { el.textContent = label; });
  $$("[data-parent-space]").forEach((el) => { el.classList.toggle("is-hidden", user?.type !== "parent"); });
  $$("[data-teen-space]").forEach((el) => { el.classList.toggle("is-hidden", user?.type === "parent"); });
  const kidName = state.kidName || getDisplayName(user);
  const buddyName = state.buddyName || "Mochi";
  $("[data-profile-field='kidName']").value = kidName;
  $("[data-profile-field='buddyName']").value = buddyName;
  $("[data-kid-label]").textContent = user?.type === "parent" ? "Kid’s name" : "Your name";
  $("[data-circle-copy]").textContent = user?.type === "parent" ? `${kidName} + ${buddyName}` : `${buddyName} is your buddy`;
  $("[data-circle-subcopy]").textContent = user?.type === "parent" ? "Keep the care circle warm, personal, and easy to check in on." : "Give your buddy a name that feels like yours.";
  $$("[data-buddy-name]").forEach((el) => { el.textContent = buddyName; });
  $("[data-goal-heading]").textContent = user?.type === "parent" ? "Set goals for your child" : "Set goals for yourself";
  $("[data-monitor-copy]").textContent = user?.type === "parent" ? "Monitor online — your child’s buddy is active." : "Monitor online — your buddy is synced.";
  $("#glucose-trend").value = state.trend;
  hydrateSettingsFields(state, user);
  renderState(state);
  applyTheme(state.settings.theme);
  applyAccessibility(state.settings);
  applyBuddy(state.settings.buddy);
}

function renderState(state) {
  const counts = {
    meals: state.logs.filter((log) => log.type === "meal").length,
    water: state.logs.filter((log) => log.type === "water").length,
    glucose: state.logs.filter((log) => log.type === "glucose").length,
    activity: state.logs.filter((log) => log.type === "activity").reduce((sum, log) => sum + (log.minutes || 10), 0),
  };
  const values = {
    meals: Math.min(100, Math.round((counts.meals / state.goals.meals) * 100)),
    water: Math.min(100, Math.round((counts.water / state.goals.water) * 100)),
    glucose: Math.min(100, Math.round((counts.glucose / state.goals.glucose) * 100)),
    activity: Math.min(100, Math.round((counts.activity / state.goals.activity) * 100)),
  };
  ["meals", "water", "glucose", "activity"].forEach((key) => {
    $(`[data-progress-${key}]`).textContent = key === "activity" ? counts[key] : counts[key];
    $(`[data-goal-${key}]`).textContent = state.goals[key];
    $(`[data-bar-${key}]`).style.setProperty("--value", `${values[key]}%`);
  });
  $("[data-stat-water]").textContent = `${values.water}%`;
  $("[data-stat-activity]").textContent = `${values.activity}%`;
  $("[data-stat-energy]").textContent = `${Math.min(99, 64 + values.water / 4 + values.activity / 5)}%`;
  $("[data-activity-count]").textContent = state.logs.filter((log) => log.type === "activity").length;
  $("[data-sync-time]").textContent = state.lastSync;
  renderBuddyMood(state.mood || moodForTrend(state.trend), false);
  renderActivity(state);
  renderNotifications(state);
  renderHistory(state);
}

function moodForTrend(trend) { return trend === "low" ? "tired" : trend === "high" ? "high" : "happy"; }
function renderBuddyMood(mood, notify = true) {
  const messages = {
    happy: ["Feeling happy", "“You’re doing a great job, friend!”", "“I’m ready for whatever today brings!”"],
    hungry: ["A little hungry", "“My belly is rumbling. Maybe a snack?”", "“I’m getting hungry — maybe a snack?”"],
    tired: ["Feeling low energy", "“I might need a snack soon.”", "“Let’s take a soft little break.”"],
    high: ["Taking it slow", "“I don’t need sugar right now.”", "“I can’t eat right now. Let’s wait a bit.”"],
    energetic: ["Full of sparkle", "“Look at you go, superstar!”", "“That activity gave me a little boost!”"],
  };
  const [status, message, reaction] = messages[mood] || messages.happy;
  document.body.classList.remove("mood-hungry", "mood-tired", "mood-energetic", "mood-high");
  if (mood !== "happy") document.body.classList.add(`mood-${mood}`);
  $$("[data-buddy-status]").forEach((el) => { el.textContent = status; });
  $$("[data-buddy-message]").forEach((el) => { el.textContent = message; });
  $$("[data-reaction]").forEach((el) => { el.textContent = reaction; });
  if (notify) showToast(`Pixel Buddy is ${status.toLowerCase()}.`);
}

function renderActivity(state) {
  const feed = $("[data-activity-feed]");
  if (!feed) return;
  const logs = state.logs.filter((log) => log.type === "activity").slice(-3).reverse();
  feed.innerHTML = logs.map((log) => `<div><span>${log.detail === "Games" ? "✦" : log.detail === "Walking" ? "⌁" : "♧"}</span><p><strong>${log.detail}</strong> helped your energy.<small>${log.at} · ${log.minutes || 10} min</small></p></div>`).join("") || `<div><span>♡</span><p><strong>No activity yet</strong><small>Choose something above to get moving.</small></p></div>`;
}

function renderNotifications(state) {
  const list = $("[data-notification-list]");
  if (!list) return;
  const notifications = state.notifications || [];
  list.innerHTML = notifications.map((item) => `<div class="notification-item ${item.done ? "done" : ""}" data-notification-id="${item.id}"><span class="notification-face">${item.kind === "win" ? "✦" : "◡̈"}</span><p>${item.message}<small>${item.time}</small></p><button type="button" data-notification-done="${item.id}">${item.done ? "Done ✓" : "Mark done"}</button></div>`).join("") || `<p class="empty-note">Your buddy is quiet for now. You’re doing great.</p>`;
  const openCount = notifications.filter((item) => !item.done).length;
  $$("[data-notification-count]").forEach((el) => { el.textContent = openCount; el.classList.toggle("is-hidden", openCount === 0); });
  $$("[data-response-count]").forEach((el) => { el.textContent = state.responses || 0; });
}

function renderHistory(state) {
  const chart = $("[data-history-chart]");
  if (!chart) return;
  const histories = {
    today: { labels: ["8a", "10a", "12p", "2p", "4p", "6p", "Now"], values: [106, 122, 114, 137, 119, 128, 111] },
    days: { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Now"], values: [98, 126, 115, 141, 120, 132, 110] },
    weeks: { labels: ["W1", "W2", "W3", "W4", "W5", "W6", "Now"], values: [105, 118, 129, 112, 138, 121, 116] },
    months: { labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Now"], values: [93, 108, 116, 124, 119, 131, 112] },
  };
  const range = histories[state.historyRange] ? state.historyRange : "today";
  const history = histories[range];
  chart.innerHTML = history.values.map((value, index) => {
    const height = Math.max(18, Math.min(92, ((value - 70) / 90) * 100));
    const status = value > 135 ? "warm" : value < 80 ? "low" : "steady";
    return `<div class="history-bar-wrap"><span class="history-tooltip">${history.labels[index]} · ${value} mg/dL</span><b class="history-bar ${status}" style="--bar-height:${height}%"></b><small>${history.labels[index]}</small></div>`;
  }).join("");
  $$("[data-history-range]").forEach((button) => button.classList.toggle("active", button.dataset.historyRange === range));
  const average = Math.round(history.values.reduce((sum, value) => sum + value, 0) / history.values.length);
  $("[data-history-average]").innerHTML = `${average} mg/dL avg <span>↗</span>`;
  $("[data-history-summary]").textContent = `${history.values.filter((value) => value >= 80 && value <= 140).length}/${history.values.length} in range`;
}

function nowLabel() {
  return `Today · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
function addNotification(message, state, kind = "buddy") {
  state.notifications.unshift({ id: Date.now(), message, time: nowLabel(), done: false, kind });
  state.notifications = state.notifications.slice(0, 12);
}
function logAction(type, detail) {
  const user = getCurrentUser();
  if (!user) return;
  const state = getState();
  if (type === "meal" && state.trend === "high") {
    state.mood = "high";
    saveState(state);
    renderBuddyMood("high");
    showToast("Your buddy is taking it slow right now.");
    return;
  }
  const minutes = type === "activity" ? (detail === "Sports" ? 22 : detail === "Walking" ? 18 : 12) : undefined;
  state.logs.push({ type, detail, minutes, at: nowLabel() });
  if (type === "meal") {
    state.mood = detail === "Sugary snack" ? "tired" : "happy";
    addNotification(detail === "Sugary snack" ? "I’m full — no more sugar right now." : "That helped! I feel steadier now.", state, "win");
    renderBuddyMood(state.mood);
  } else if (type === "water") {
    state.mood = "happy";
    addNotification("I feel refreshed. Thanks for the water!", state, "win");
    renderBuddyMood("happy");
  } else if (type === "activity") {
    state.mood = "energetic";
    addNotification(`${detail} were fun! Want to log more activity?`, state, "win");
    renderBuddyMood("energetic");
  } else if (type === "glucose") {
    state.mood = moodForTrend(state.trend);
    addNotification("Thanks for checking in with me.", state, "win");
    renderBuddyMood(state.mood);
  }
  state.responses = (state.responses || 0) + 1;
  saveState(state);
  renderState(state);
  showToast(type === "meal" ? `${detail} logged — your buddy reacted.` : `${detail} logged. Nice little win!`);
}

function hydrateSettingsFields(state, user) {
  $("[data-settings-email]").value = user?.email || "";
  $("[data-setting-two-step]").checked = Boolean(state.settings.twoStep);
  $("[data-setting-high-contrast]").checked = Boolean(state.settings.highContrast);
  $("[data-setting-large-text]").checked = Boolean(state.settings.largeText);
  $("[data-setting-dyslexia]").checked = Boolean(state.settings.dyslexia);
  $("[data-setting-reduced-motion]").checked = Boolean(state.settings.reducedMotion);
  $("[data-setting-notifications]").checked = state.settings.notifications !== false;
  $("[data-setting-tone]").value = state.settings.tone || "gentle";
  $$("[name='theme']").forEach((radio) => { radio.checked = radio.value === (state.settings.theme || "yellow"); });
  $$("[data-buddy-setting]").forEach((control) => { control.value = state.settings.buddy[control.dataset.buddySetting] || control.value; });
}

function saveSettings() {
  const user = getCurrentUser();
  if (!user) return;
  const state = getState();
  const oldEmail = user.email;
  const newEmail = $("[data-settings-email]").value.trim();
  if (!newEmail) { showToast("Please add an email first."); return; }
  user.email = newEmail;
  const password = $("[data-settings-password]").value;
  if (password) user.password = password;
  state.settings.theme = $("[name='theme']:checked")?.value || "yellow";
  state.settings.twoStep = $("[data-setting-two-step]").checked;
  state.settings.highContrast = $("[data-setting-high-contrast]").checked;
  state.settings.largeText = $("[data-setting-large-text]").checked;
  state.settings.dyslexia = $("[data-setting-dyslexia]").checked;
  state.settings.reducedMotion = $("[data-setting-reduced-motion]").checked;
  state.settings.notifications = $("[data-setting-notifications]").checked;
  state.settings.tone = $("[data-setting-tone]").value;
  $$("[data-buddy-setting]").forEach((control) => { state.settings.buddy[control.dataset.buddySetting] = control.value; });
  const accounts = getAccounts().map((account) => account.email === oldEmail ? user : account);
  if (!accounts.some((account) => account.email === user.email && account !== user)) {
    writeJSON(ACCOUNTS_KEY, accounts);
    writeJSON(USER_KEY, user);
    saveState(state, user.email);
    if (oldEmail !== user.email) localStorage.removeItem(stateKey(oldEmail));
    localStorage.setItem(RECENT_EMAIL_KEY, user.email);
    applyTheme(state.settings.theme); applyAccessibility(state.settings); applyBuddy(state.settings.buddy);
    $("[data-settings-password]").value = "";
    showToast("Your Bitly space has been updated.");
  } else {
    showToast("That email is already in use.");
  }
}

function createAccount(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  if (data.type === "kid") { showToast("Please ask a parent to create a Kid account."); return; }
  const accounts = getAccounts();
  if (accounts.some((account) => account.email.toLowerCase() === data.email.toLowerCase())) { showToast("That email already has a Bitly account."); return; }
  const account = { email: data.email, password: data.password, type: data.type, name: data.email.split("@")[0] };
  accounts.push(account);
  writeJSON(ACCOUNTS_KEY, accounts);
  localStorage.setItem(RECENT_EMAIL_KEY, account.email);
  event.currentTarget.reset();
  showToast("Your account is ready! Now let’s log you in.");
  setTimeout(() => switchAuthTab("login"), 550);
}

function login(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const account = getAccounts().find((item) => item.email.toLowerCase() === data.email.toLowerCase() && item.password === data.password);
  if (!account) { showToast("We couldn’t find a match. Check your email and password."); return; }
  writeJSON(USER_KEY, account);
  localStorage.setItem(RECENT_EMAIL_KEY, account.email);
  closeAuth();
  showToast(`Welcome back, ${getDisplayName(account)}!`);
  window.location.hash = "#dashboard";
}

function demoLogin(type) {
  const email = `${type}@bitly.demo`;
  let account = getAccounts().find((item) => item.email === email);
  if (!account) {
    account = { email, password: "demo", type, name: type === "parent" ? "Maya" : "Alex" };
    writeJSON(ACCOUNTS_KEY, [...getAccounts(), account]);
  }
  writeJSON(USER_KEY, account);
  localStorage.setItem(RECENT_EMAIL_KEY, email);
  showToast(`Opening the ${roleName(type).toLowerCase()} demo…`);
  setTimeout(() => { window.location.hash = "#dashboard"; }, 350);
}

function sendReminder(self = false) {
  const state = getState();
  const messages = self ? ["I’m hungry — want to log a snack?", "I’m thirsty — water time?", "I’m feeling low energy — maybe check your glucose?"] : ["Your Bitly buddy looks hungry — time for a snack?", "Your buddy is low on energy — maybe check your glucose?", "Water time! Your buddy wants a drink."];
  const message = self ? messages[state.notifications.length % messages.length] : $("[data-reminder-select]")?.value || messages[state.notifications.length % messages.length];
  addNotification(message, state);
  saveState(state);
  renderState(state);
  showToast(self ? "A reminder is waiting in your inbox." : "A friendly reminder was sent to their buddy.");
}

function checkEat() {
  const state = getState();
  const mealCount = state.logs.filter((log) => log.type === "meal").length;
  const message = mealCount ? `I checked in — ${state.kidName || "your kid"} has ${mealCount} meal${mealCount === 1 ? "" : "s"} logged today.` : `I’m checking in — has ${state.kidName || "your kid"} eaten something?`;
  addNotification(message, state, mealCount ? "win" : "buddy");
  saveState(state);
  renderState(state);
  showToast(mealCount ? "Their meal log is up to date." : "A gentle eat-something check-in was sent.");
}

function saveCircle() {
  const state = getState();
  const kidName = $("[data-profile-field='kidName']").value.trim();
  const buddyName = $("[data-profile-field='buddyName']").value.trim();
  if (!kidName || !buddyName) {
    showToast("Give both your circle and buddy a name first.");
    return;
  }
  state.kidName = kidName;
  state.buddyName = buddyName;
  saveState(state);
  hydrateApp();
  showToast(`${buddyName} is ready to hang out with ${kidName}.`);
}

function bindEvents() {
  $("#login-form")?.addEventListener("submit", login);
  $("#signup-form")?.addEventListener("submit", createAccount);
  $("#goals-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const state = getState();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    Object.keys(state.goals).forEach((key) => { state.goals[key] = Math.max(1, Number(data[key]) || state.goals[key]); });
    saveState(state); closeGoals(); renderState(state); showToast("Today’s goals are saved.");
  });
  $("#glucose-trend")?.addEventListener("change", (event) => {
    const state = getState(); state.trend = event.target.value; state.mood = moodForTrend(state.trend); saveState(state); renderBuddyMood(state.mood); renderState(state);
    showToast(state.trend === "stable" ? "Your buddy feels steady." : state.trend === "high" ? "Your buddy is taking it slow." : "Your buddy is feeling a little tired.");
  });
  $$("[data-buddy-setting]").forEach((control) => control.addEventListener("change", () => {
    const state = getState(); state.settings.buddy[control.dataset.buddySetting] = control.value; saveState(state); applyBuddy(state.settings.buddy); showToast("Your buddy is trying on a new look.");
  }));
  $$("[name='theme']").forEach((radio) => radio.addEventListener("change", () => { applyTheme(radio.value); }));
  $$("[data-public-theme]").forEach((button) => button.addEventListener("click", () => { const theme = button.dataset.publicTheme; localStorage.setItem(PUBLIC_THEME_KEY, theme); applyTheme(theme); showToast("Bitly’s public look has changed."); }));
  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "close-modal") closeAuth();
    if (action === "close-public-settings") $("#public-settings-modal").classList.remove("open");
    if (action === "public-settings") $("#public-settings-modal").classList.add("open");
    if (action === "close-goals") closeGoals();
    if (action === "logout") {
      localStorage.removeItem(USER_KEY); closeAuth(); applyTheme(localStorage.getItem(PUBLIC_THEME_KEY) || "yellow"); showToast("You’re logged out. See you soon!"); setTimeout(() => { window.location.hash = "#home"; }, 450);
    }
    if (action === "sync") { const state = getState(); state.lastSync = "Just now"; saveState(state); renderState(state); showToast("Your monitor is synced and smiling."); }
    if (action === "edit-goals") openGoals();
    if (action === "send-reminder") sendReminder(false);
    if (action === "self-reminder") sendReminder(true);
    if (action === "check-eat") checkEat();
    if (action === "save-circle") saveCircle();
    if (action === "add-custom-log") {
      const input = $("[data-custom-log]");
      const customLog = input?.value.trim();
      if (customLog) {
        logAction("activity", customLog);
        input.value = "";
      } else {
        showToast("Give your custom log a name first.");
      }
    }
    if (action === "mark-all") { const state = getState(); state.notifications.forEach((item) => { item.done = true; }); saveState(state); renderState(state); showToast("All caught up!"); }
    const authTab = event.target.closest("[data-auth-tab]")?.dataset.authTab;
    if (authTab) switchAuthTab(authTab);
    const demo = event.target.closest("[data-demo-type]")?.dataset.demoType;
    if (demo) demoLogin(demo);
    const quickLog = event.target.closest("[data-log-type]")?.dataset.logType;
    if (quickLog) {
      const mealDetails = ["Salad", "Granola bar", "Egg", "Sugary snack"];
      logAction(quickLog, quickLog === "meal" ? mealDetails[getState().logs.filter((log) => log.type === "meal").length % mealDetails.length] : quickLog === "water" ? "Water" : quickLog === "activity" ? "Walking" : "Glucose check");
    }
    const activity = event.target.closest("[data-activity]")?.dataset.activity;
    if (activity) logAction("activity", activity);
    const historyRange = event.target.closest("[data-history-range]")?.dataset.historyRange;
    if (historyRange) {
      const state = getState();
      state.historyRange = historyRange;
      saveState(state);
      renderHistory(state);
    }
    const done = event.target.closest("[data-notification-done]")?.dataset.notificationDone;
    if (done) { const state = getState(); const item = state.notifications.find((notification) => String(notification.id) === String(done)); if (item && !item.done) { item.done = true; state.responses = (state.responses || 0) + 1; saveState(state); renderState(state); showToast("Nice response. Your buddy feels heard."); } }
    const toggle = event.target.closest(".menu-toggle");
    if (toggle) { const nav = toggle.classList.contains("app-menu-toggle") ? $(".app-nav") : $(".public-nav"); const open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open)); }
  });
  $$(".role-options input").forEach((radio) => radio.addEventListener("change", () => $(".kid-note").classList.toggle("is-hidden", radio.value !== "kid" || !radio.checked)));
  $("[data-action='save-settings']")?.addEventListener("click", saveSettings);
}

function openGoals() {
  const state = getState();
  const user = getCurrentUser();
  const modal = $("#goal-modal");
  modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
  $$("input", $("#goals-form")).forEach((input) => { if (state.goals[input.name]) input.value = state.goals[input.name]; });
  $("[data-goal-modal-copy]").textContent = user?.type === "parent" ? "Small, doable steps for your child." : "Small, doable steps for your own rhythm.";
}
function closeGoals() { const modal = $("#goal-modal"); modal?.classList.remove("open"); modal?.setAttribute("aria-hidden", "true"); }

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => {
  applyTheme(localStorage.getItem(PUBLIC_THEME_KEY) || "yellow");
  bindEvents();
  const previewDemo = new URLSearchParams(window.location.search).get("demo");
  if (["parent", "teen"].includes(previewDemo)) {
    const email = `${previewDemo}@bitly.demo`;
    const account = { email, password: "demo", type: previewDemo, name: previewDemo === "parent" ? "Maya" : "Alex" };
    writeJSON(USER_KEY, account);
    if (!getAccounts().some((item) => item.email === email)) writeJSON(ACCOUNTS_KEY, [...getAccounts(), account]);
  }
  route();
});