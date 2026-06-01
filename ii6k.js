/* ===============================
   Quantum OS — FINAL ULTRA EDITION
   =============================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const modal = $("#modal");
const content = $("#content");
const appsGrid = $("#apps");
const dockEl = $("#dock");
const desktop = $("#desktop");
const contextMenu = $("#contextMenu");

const STORAGE = {
  USER: "q_user",
  SCORES: "scores_v1",
  THEME: "q_theme_v1",
  PINS: "q_pins_v1",
  DOCK: "q_dock_v1",
  LAST_FILTER: "q_filter_v1",
};

const LOCK_PASSWORD = "1234";

let currentFilter = localStorage.getItem(STORAGE.LAST_FILTER) || "all";
let currentSearch = "";
let runningApps = new Set();
let contextAppKey = null;
let longPressTimer = null;

/* ===============================
   APP META
   =============================== */
const APP_META = {
  browser:    { title: "Browser", icon: "fa-solid fa-globe", category: "web", desc: "Search and browse websites" },
  phone:      { title: "Phone", icon: "fa-solid fa-phone", category: "tools", desc: "Simple calling simulation" },
  files:      { title: "Files", icon: "fa-solid fa-folder-open", category: "tools", desc: "Open and preview selected files" },
  music:      { title: "Music", icon: "fa-solid fa-music", category: "media", desc: "Play local audio files" },
  clock:      { title: "Clock", icon: "fa-regular fa-clock", category: "tools", desc: "Analog and digital clock" },

  settings:   { title: "Settings", icon: "fa-solid fa-gear", category: "system", desc: "Theme and desktop settings" },
  about:      { title: "About", icon: "fa-solid fa-circle-info", category: "system", desc: "About Quantum OS" },
  finance:    { title: "Finance", icon: "fa-solid fa-chart-line", category: "tools", desc: "Animated finance chart" },
  calc:       { title: "Calculator", icon: "fa-solid fa-calculator", category: "tools", desc: "Basic calculator" },
  system:     { title: "System", icon: "fa-solid fa-bolt", category: "system", desc: "System status overview" },

  ttt:        { title: "TicTacToe", icon: "fa-solid fa-table-cells-large", category: "games", desc: "Play vs AI" },
  sudoku:     { title: "Sudoku", icon: "fa-solid fa-border-all", category: "games", desc: "Classic Sudoku puzzle" },
  guess:      { title: "Guess", icon: "fa-solid fa-wand-magic-sparkles", category: "games", desc: "Guess the hidden number" },
  rps:        { title: "RPS", icon: "fa-solid fa-hand-fist", category: "games", desc: "Rock Paper Scissors" },
  reaction:   { title: "Reaction", icon: "fa-solid fa-bolt-lightning", category: "games", desc: "Test your reflexes" },
  memory:     { title: "Memory", icon: "fa-solid fa-brain", category: "games", desc: "Memory card challenge" },
  snake:      { title: "Snake", icon: "fa-solid fa-staff-snake", category: "games", desc: "Classic snake game" },
  click:      { title: "Click", icon: "fa-solid fa-hand-pointer", category: "games", desc: "Click as fast as possible" },

  leaderboard:{ title: "Leaderboard", icon: "fa-solid fa-trophy", category: "system", desc: "Top scores" },
  shutdown:   { title: "Shutdown", icon: "fa-solid fa-power-off", category: "system", desc: "Exit Quantum OS" },
};

const DEFAULT_DOCK = ["browser", "files", "music", "settings", "leaderboard"];

/* ===============================
   UTILS
   =============================== */
function openM(html){
  content.innerHTML = html;
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}
function closeM(){
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[m]));
}

function getStoredArray(key, fallback=[]){
  try{
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(v) ? v : fallback;
  }catch{
    return fallback;
  }
}
function setStoredArray(key, arr){
  localStorage.setItem(key, JSON.stringify(arr));
}

function getPins(){ return getStoredArray(STORAGE.PINS, []); }
function setPins(v){ setStoredArray(STORAGE.PINS, v); }

function getDockApps(){
  const saved = getStoredArray(STORAGE.DOCK, []);
  return saved.length ? saved : DEFAULT_DOCK;
}
function setDockApps(v){ setStoredArray(STORAGE.DOCK, v); }

function isPinned(key){ return getPins().includes(key); }
function isInDock(key){ return getDockApps().includes(key); }

function togglePin(key){
  const pins = getPins();
  const next = pins.includes(key) ? pins.filter(x => x !== key) : [key, ...pins];
  setPins(next);
  renderApps();
}

function toggleDock(key){
  const dock = getDockApps();
  const next = dock.includes(key) ? dock.filter(x => x !== key) : [...dock, key];
  setDockApps(next);
  renderDock();
}

function setRunning(key, state = true){
  if(state) runningApps.add(key);
  else runningApps.delete(key);
  renderApps();
  renderDock();
}

function playBeep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 700;
    g.gain.value = 0.08;
    o.start();
    o.stop(ctx.currentTime + 0.1);
  }catch{}
}

function updateHero(){
  $("#heroUser").textContent = localStorage.getItem(STORAGE.USER) || "Guest";
  $("#heroAppsCount").textContent = Object.keys(APP_META).length;
}

function updateTimeUI(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  $("#heroTime").textContent = `${hh}:${mm}`;

  const lockClock = $("#lockClock");
  const lockDate = $("#lockDate");
  if(lockClock){
    lockClock.textContent = `${hh}:${mm}`;
  }
  if(lockDate){
    lockDate.textContent = now.toLocaleDateString("fa-IR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
}

/* ===============================
   BOOT / LOCK / LOGIN
   =============================== */
setTimeout(() => {
  $("#boot").style.display = "none";
  $("#lockScreen").style.display = "flex";
  updateTimeUI();
}, 1900);

window.addEventListener("load", () => {
  updateTimeUI();
  updateHero();
  loadTheme();
  renderApps();
  renderDock();

  const music = $("#welcomeMusic");
  if(music){
    music.volume = 0.5;
    music.play().catch(() => {
      document.addEventListener("click", () => music.play(), { once:true });
    });
  }
});

setInterval(updateTimeUI, 1000);

const lockScreen = $("#lockScreen");
const passwordBox = $("#passwordBox");
const lockError = $("#lockError");
let startY = 0;

function showPassword(){
  $("#lockHint").textContent = "Enter 1234";
  passwordBox.classList.remove("hidden");
  $("#lockPass")?.focus();
}
function unlock(){
  const val = $("#lockPass").value;
  if(val === LOCK_PASSWORD){
    lockError.textContent = "";
    lockScreen.style.opacity = "0";
    setTimeout(() => {
      lockScreen.style.display = "none";
      $("#login").style.display = "flex";
    }, 450);
  }else{
    lockError.textContent = "❌ Wrong Password";
  }
}

lockScreen.addEventListener("touchstart", e => startY = e.touches[0].clientY);
lockScreen.addEventListener("touchend", e => {
  const endY = e.changedTouches[0].clientY;
  if(startY - endY > 80) showPassword();
});
lockScreen.addEventListener("mousedown", e => startY = e.clientY);
lockScreen.addEventListener("mouseup", e => {
  if(startY - e.clientY > 80) showPassword();
});

$("#unlockBtn").addEventListener("click", unlock);
$("#lockPass").addEventListener("keydown", e => {
  if(e.key === "Enter") unlock();
});

function login(){
  const u = $("#username").value.trim();
  if(!u) return alert("Enter a username");
  localStorage.setItem(STORAGE.USER, u);
  $("#login").style.display = "none";
  desktop.classList.remove("hidden-desktop");
  updateHero();
}
$("#loginBtn").addEventListener("click", login);
$("#username").addEventListener("keydown", e => {
  if(e.key === "Enter") login();
});

/* ===============================
   SEARCH / FILTERS / RENDER
   =============================== */
$("#appSearch").addEventListener("input", e => {
  currentSearch = e.target.value.trim().toLowerCase();
  renderApps();
});

$("#filters").addEventListener("click", e => {
  const btn = e.target.closest(".filter");
  if(!btn) return;
  currentFilter = btn.dataset.filter;
  localStorage.setItem(STORAGE.LAST_FILTER, currentFilter);
  $$(".filter").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  renderApps();
});

(function initFilterState(){
  const btn = $(`.filter[data-filter="${currentFilter}"]`);
  if(btn){
    $$(".filter").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
  }
})();

function getVisibleApps(){
  let list = Object.entries(APP_META).map(([key, meta]) => ({ key, ...meta }));

  const pins = getPins();

  list.sort((a, b) => {
    const ap = pins.includes(a.key) ? 1 : 0;
    const bp = pins.includes(b.key) ? 1 : 0;
    if(bp !== ap) return bp - ap;
    return a.title.localeCompare(b.title);
  });

  if(currentFilter === "pinned"){
    list = list.filter(app => pins.includes(app.key));
  }else if(currentFilter !== "all"){
    list = list.filter(app => app.category === currentFilter);
  }

  if(currentSearch){
    list = list.filter(app => {
      const t = `${app.title} ${app.desc} ${app.category}`.toLowerCase();
      return t.includes(currentSearch);
    });
  }

  return list;
}

function renderApps(){
  const list = getVisibleApps();

  appsGrid.innerHTML = list.map((app, idx) => `
    <button
      class="app neon-card ${app.key === "shutdown" ? "shutdown-card" : ""}"
      data-app="${app.key}"
      data-app-key="${app.key}"
      style="animation-delay:${idx * 45}ms"
      title="${escapeHtml(app.desc)}"
    >
      ${isPinned(app.key) ? `<span class="app-pin"><i class="fa-solid fa-thumbtack"></i></span>` : ""}
      <span class="app-ic"><i class="${app.icon}"></i></span>
      <span class="app-tx">${escapeHtml(app.title)}</span>
      <span class="app-meta">${escapeHtml(app.category)}</span>
      ${runningApps.has(app.key) ? `<span class="app-running"></span>` : ""}
    </button>
  `).join("");
}

function renderDock(){
  const dockApps = getDockApps().filter(key => APP_META[key]);

  dockEl.innerHTML = dockApps.map(key => {
    const app = APP_META[key];
    return `
      <button class="dock-item ${runningApps.has(key) ? "running" : ""}" data-dock-app="${key}" title="${escapeHtml(app.title)}">
        <i class="${app.icon}"></i>
        <span>${escapeHtml(app.title)}</span>
      </button>
    `;
  }).join("");
}

/* ===============================
   CONTEXT MENU
   =============================== */
function openContextMenu(x, y, appKey){
  contextAppKey = appKey;
  contextMenu.classList.remove("hidden");

  const pad = 10;
  const w = 220;
  const h = 200;
  const maxX = window.innerWidth - w - pad;
  const maxY = window.innerHeight - h - pad;

  contextMenu.style.left = `${Math.max(pad, Math.min(x, maxX))}px`;
  contextMenu.style.top = `${Math.max(pad, Math.min(y, maxY))}px`;
}
function closeContextMenu(){
  contextMenu.classList.add("hidden");
  contextAppKey = null;
}

appsGrid.addEventListener("contextmenu", e => {
  const card = e.target.closest("[data-app-key]");
  if(!card) return;
  e.preventDefault();
  openContextMenu(e.clientX, e.clientY, card.dataset.appKey);
});

appsGrid.addEventListener("touchstart", e => {
  const card = e.target.closest("[data-app-key]");
  if(!card) return;
  const touch = e.touches[0];
  longPressTimer = setTimeout(() => {
    openContextMenu(touch.clientX, touch.clientY, card.dataset.appKey);
  }, 550);
}, { passive:true });

appsGrid.addEventListener("touchend", () => clearTimeout(longPressTimer));
appsGrid.addEventListener("touchmove", () => clearTimeout(longPressTimer));

document.addEventListener("click", e => {
  if(!e.target.closest("#contextMenu")) closeContextMenu();
});

contextMenu.addEventListener("click", e => {
  const btn = e.target.closest("[data-cm]");
  if(!btn || !contextAppKey) return;

  const action = btn.dataset.cm;
  if(action === "open") openApp(contextAppKey);
  if(action === "pin") togglePin(contextAppKey);
  if(action === "dock") toggleDock(contextAppKey);
  if(action === "info") {
    const app = APP_META[contextAppKey];
    openM(`
      <h3 class="neon-title"><i class="${app.icon}"></i> ${escapeHtml(app.title)}</h3>
      <p class="muted" style="margin-top:10px">Category: ${escapeHtml(app.category)}</p>
      <p style="margin-top:10px;line-height:1.9">${escapeHtml(app.desc)}</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px">
        <button class="btn" id="infoOpenBtn">Open</button>
      </div>
    `);
    $("#infoOpenBtn").addEventListener("click", () => openApp(contextAppKey));
  }

  closeContextMenu();
});

/* ===============================
   SCORE SYSTEM
   =============================== */
const GAMES = [
  {key:"Snake", label:"Snake"},
  {key:"Click", label:"Click Speed"},
  {key:"Reaction", label:"Reaction"},
  {key:"Memory", label:"Memory"},
  {key:"TicTacToe", label:"Tic Tac Toe"},
  {key:"Sudoku", label:"Sudoku"},
  {key:"Guess", label:"Guess Game"},
  {key:"RPS", label:"Rock Paper"},
];

function loadScores(){
  try { return JSON.parse(localStorage.getItem(STORAGE.SCORES) || "[]"); }
  catch { return []; }
}
function saveScore(gameKey, score){
  const user = localStorage.getItem(STORAGE.USER) || "Guest";
  const all = loadScores();
  all.push({ user, game: gameKey, score: Number(score) || 0, time: Date.now() });
  localStorage.setItem(STORAGE.SCORES, JSON.stringify(all));
}
function openLeaderboard(){
  const all = loadScores();
  openM(`
    <h3 class="neon-title"><i class="fa-solid fa-trophy"></i> Leaderboard</h3>
    <p class="muted" style="font-size:.85rem;margin-top:6px">Top 3 scores for each game</p>
    <div style="text-align:right;margin-top:14px">
      ${GAMES.map(g => {
        const top = all.filter(s => s.game === g.key).sort((a,b) => b.score - a.score).slice(0,3);
        return `
          <h4 style="margin:14px 0 6px;color:var(--neon-pink)">${g.label}</h4>
          ${top.length ? `
            <ol style="margin-right:18px;line-height:1.9">
              ${top.map(s => `<li>${escapeHtml(s.user)} — <b>${s.score}</b></li>`).join("")}
            </ol>
          ` : `<div class="muted">No score yet</div>`}
        `;
      }).join("")}
    </div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap">
      <button class="btn" id="resetScoresBtn">Reset Scores</button>
    </div>
  `);
  $("#resetScoresBtn").addEventListener("click", () => {
    if(!confirm("Reset all saved scores?")) return;
    localStorage.removeItem(STORAGE.SCORES);
    openLeaderboard();
  });
}

/* ===============================
   APPS
   =============================== */

/* Snake */
let snakeM, foodM, dirM, scoreM, snakeTimer;
function openSnakeMobile(){
  openM(`
    <h3 style="color:var(--neon-green)"><i class="fa-solid fa-staff-snake"></i> Snake</h3>
    <canvas id="snakeM" width="300" height="300"
      style="background:black;border-radius:18px;touch-action:none;border:1px solid rgba(255,255,255,.08);max-width:100%"></canvas>
    <p id="scoreM" class="muted" style="margin-top:10px">Score: 0</p>
    <div style="display:grid;grid-template-columns:repeat(3,64px);gap:10px;justify-content:center;margin-top:12px">
      <div></div><button class="btn" data-dir="up">↑</button><div></div>
      <button class="btn" data-dir="left">←</button><div></div><button class="btn" data-dir="right">→</button>
      <div></div><button class="btn" data-dir="down">↓</button><div></div>
    </div>
  `);

  const canvas = $("#snakeM");
  const ctx = canvas.getContext("2d");

  snakeM = [{x:150,y:150}];
  foodM = randomFood(canvas);
  dirM = {x:20,y:0};
  scoreM = 0;

  let startX, startY;
  canvas.addEventListener("touchstart", e => {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
  });
  canvas.addEventListener("touchend", e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if(Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 20 : -20, 0);
    else setDir(0, dy > 0 ? 20 : -20);
  });

  content.addEventListener("click", snakeButtonsHandler);
  clearInterval(snakeTimer);
  snakeTimer = setInterval(() => snakeLoop(ctx, canvas), 170);
}
function snakeButtonsHandler(e){
  const b = e.target.closest("[data-dir]");
  if(!b) return;
  const d = b.dataset.dir;
  if(d === "up") setDir(0, -20);
  if(d === "down") setDir(0, 20);
  if(d === "left") setDir(-20, 0);
  if(d === "right") setDir(20, 0);
}
function setDir(x,y){
  if(dirM && dirM.x === -x && dirM.y === -y) return;
  dirM = {x,y};
}
function snakeLoop(ctx, c){
  const head = {x:snakeM[0].x + dirM.x, y:snakeM[0].y + dirM.y};

  if(head.x < 0 || head.y < 0 || head.x >= c.width || head.y >= c.height) return endSnakeMobile();
  if(snakeM.some((p,idx) => idx > 0 && p.x === head.x && p.y === head.y)) return endSnakeMobile();

  snakeM.unshift(head);

  if(head.x === foodM.x && head.y === foodM.y){
    scoreM++;
    playBeep();
    foodM = randomFood(c);
  }else{
    snakeM.pop();
  }

  ctx.clearRect(0,0,c.width,c.height);

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--neon-cyan").trim() || "#00fff0";
  snakeM.forEach(s => ctx.fillRect(s.x, s.y, 18, 18));

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--neon-pink").trim() || "#ff2bdc";
  ctx.fillRect(foodM.x, foodM.y, 18, 18);

  $("#scoreM").textContent = `Score: ${scoreM}`;
}
function randomFood(c){
  const step = 20;
  const maxX = Math.floor(c.width / step);
  const maxY = Math.floor(c.height / step);
  return { x: Math.floor(Math.random() * maxX) * step, y: Math.floor(Math.random() * maxY) * step };
}
function endSnakeMobile(){
  clearInterval(snakeTimer);
  saveScore("Snake", scoreM);
  alert("💀 Game Over | Score: " + scoreM);
}

/* Click Speed */
let clickScore = 0, clickTime = 5, clickTimer = null;
function openClickGame(){
  clickScore = 0; clickTime = 5;
  openM(`
    <h3 class="neon-title"><i class="fa-solid fa-hand-pointer"></i> Click Speed</h3>
    <p class="muted">۵ ثانیه وقت داری</p>
    <h1 id="clickCount" style="margin-top:8px">0</h1>
    <button class="btn" id="clickBtn" style="font-size:1.4rem;margin:18px auto">Click</button>
    <p id="clickTime" class="muted">Time: 5</p>
  `);

  $("#clickBtn").addEventListener("click", () => {
    if(clickTime <= 0) return;
    clickScore++;
    playBeep();
    $("#clickCount").textContent = clickScore;
  });

  clearInterval(clickTimer);
  clickTimer = setInterval(() => {
    clickTime--;
    $("#clickTime").textContent = "Time: " + clickTime;
    if(clickTime <= 0){
      clearInterval(clickTimer);
      saveScore("Click", clickScore);
      alert("⏱ End | Score: " + clickScore);
    }
  }, 1000);
}

/* RPS */
function openRPS(){
  openM(`
    <h3 class="neon-title"><i class="fa-solid fa-hand-fist"></i> Rock Paper Scissors</h3>
    <div style="display:flex;gap:10px;margin:12px 0;justify-content:center;flex-wrap:wrap">
      ${["Rock","Paper","Scissors"].map(i => `<button class="btn" data-rps="${i}">${i}</button>`).join("")}
    </div>
    <div id="rpsResult" class="muted" style="margin-top:12px;font-size:1.1rem"></div>
  `);

  content.onclick = e => {
    const b = e.target.closest("[data-rps]");
    if(!b) return;
    playRPS(b.dataset.rps);
  };
}
function playRPS(user){
  const ai = ["Rock","Paper","Scissors"][Math.floor(Math.random()*3)];
  let res = "Draw";
  if(user !== ai){
    if(
      (user === "Rock" && ai === "Scissors") ||
      (user === "Paper" && ai === "Rock") ||
      (user === "Scissors" && ai === "Paper")
    ) res = "You won!";
    else res = "You lost!";
  }
  $("#rpsResult").innerHTML = `You: <b>${user}</b> | AI: <b>${ai}</b><br><span>${res}</span>`;
  if(res === "You won!") saveScore("RPS", 1);
}

/* Reaction */
let reactionStart = 0, reactionArmed = false, reactionTimeout = null;
function openReaction(){
  openM(`
    <h3 style="color:var(--neon-green)"><i class="fa-solid fa-bolt-lightning"></i> Reaction Test</h3>
    <div id="reactionBox"
      style="margin:16px auto;width:240px;height:240px;background:#222;border-radius:18px;
      display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;
      border:1px solid rgba(255,255,255,.10)">
      wait...
    </div>
    <p id="reactionResult" class="muted"></p>
  `);

  const box = $("#reactionBox");
  const result = $("#reactionResult");
  reactionArmed = false;
  result.textContent = "";
  clearTimeout(reactionTimeout);

  box.onclick = () => {
    if(!reactionArmed){
      result.textContent = "❌ Too soon!";
      return;
    }
    const ms = Date.now() - reactionStart;
    result.textContent = `⏱ Reaction: ${ms} ms`;
    saveScore("Reaction", Math.max(0, 5000 - ms));
    reactionArmed = false;
  };

  reactionTimeout = setTimeout(() => {
    box.style.background = "var(--neon-green)";
    box.style.color = "#000";
    box.textContent = "CLICK!";
    reactionStart = Date.now();
    reactionArmed = true;
  }, Math.random() * 2200 + 1500);
}

/* Memory */
let memFirst = null, memLock = false, memMatches = 0, memMoves = 0;
function openMemory(){
  memFirst = null; memLock = false; memMatches = 0; memMoves = 0;
  const icons = ["⚛","🚀","💎","👾","⚛","🚀","💎","👾"].sort(() => Math.random() - 0.5);

  openM(`
    <h3 style="color:var(--neon-pink)"><i class="fa-solid fa-brain"></i> Memory</h3>
    <p id="memStat" class="muted">Moves: 0</p>
    <div id="mem" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px">
      ${icons.map(i => `
        <button class="neon-card mem"
          style="height:62px;border:0;background:rgba(255,255,255,.04);
          display:flex;align-items:center;justify-content:center;font-size:1.55rem;
          color:transparent;cursor:pointer"
          data-val="${i}">${i}</button>
      `).join("")}
    </div>
  `);

  $("#mem").addEventListener("click", (e) => {
    const el = e.target.closest(".mem");
    if(!el) return;
    flipMem(el, el.dataset.val);
  });
}
function flipMem(el,val){
  if(memLock || el.classList.contains("open")) return;

  el.style.color = "white";
  el.classList.add("open");

  if(!memFirst){ memFirst = {el,val}; return; }

  memMoves++;
  $("#memStat").textContent = `Moves: ${memMoves}`;
  memLock = true;

  if(memFirst.val === val){
    memMatches++;
    memFirst = null;
    memLock = false;
    if(memMatches === 4){
      saveScore("Memory", Math.max(0, 100 - memMoves));
      setTimeout(() => alert("✅ Completed!"), 150);
    }
  }else{
    setTimeout(() => {
      el.style.color = "transparent";
      memFirst.el.style.color = "transparent";
      el.classList.remove("open");
      memFirst.el.classList.remove("open");
      memFirst = null;
      memLock = false;
    }, 700);
  }
}

/* TicTacToe */
let tttBoard, tttGameOver;
function openTicTacToe(){
  tttBoard = Array(9).fill(null);
  tttGameOver = false;
  openM(`
    <h3 class="neon-title"><i class="fa-solid fa-table-cells-large"></i> Tic Tac Toe — vs AI</h3>
    <p id="tttStatus" class="muted">Your turn (X)</p>
    <div class="ttt-board" id="tttboard"></div>
    <button class="btn" id="tttRestart">Restart</button>
  `);
  $("#tttRestart").addEventListener("click", openTicTacToe);
  renderTTT();
}
function renderTTT(){
  const board = $("#tttboard");
  board.innerHTML = "";
  tttBoard.forEach((v,i) => {
    const c = document.createElement("div");
    c.className = "ttt-cell neon-card";
    c.textContent = v || "";
    c.onclick = () => playerMove(i);
    board.appendChild(c);
  });
}
function playerMove(i){
  if(tttBoard[i] || tttGameOver) return;
  tttBoard[i] = "X";
  updateTTT();
  if(!tttGameOver) setTimeout(aiMove, 240);
}
function aiMove(){
  const move = findBestMove();
  if(move !== null) tttBoard[move] = "O";
  updateTTT();
}
function updateTTT(){
  renderTTT();
  const win = checkTTTWinner();
  if(win){
    tttGameOver = true;
    $("#tttStatus").textContent = win === "draw" ? "Draw" : (win === "X" ? "You won" : "AI won");
    if(win === "X") saveScore("TicTacToe", 1);
  }else{
    $("#tttStatus").textContent = "Your turn (X)";
  }
}
function checkTTTWinner(){
  const l = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const [a,b,c] of l){
    if(tttBoard[a] && tttBoard[a] === tttBoard[b] && tttBoard[a] === tttBoard[c]) return tttBoard[a];
  }
  return tttBoard.every(Boolean) ? "draw" : null;
}
function findBestMove(){
  for(let i=0;i<9;i++){
    if(!tttBoard[i]){
      tttBoard[i] = "O";
      if(checkTTTWinner() === "O"){ tttBoard[i] = null; return i; }
      tttBoard[i] = null;
    }
  }
  for(let i=0;i<9;i++){
    if(!tttBoard[i]){
      tttBoard[i] = "X";
      if(checkTTTWinner() === "X"){ tttBoard[i] = null; return i; }
      tttBoard[i] = null;
    }
  }
  const free = tttBoard.map((v,i) => v ? null : i).filter(v => v !== null);
  return free[Math.floor(Math.random() * free.length)] ?? null;
}

/* Sudoku */
const sudokuPuzzle = [
  [5,3,0,0,7,0,0,0,0],
  [6,0,0,1,9,5,0,0,0],
  [0,9,8,0,0,0,0,6,0],
  [8,0,0,0,6,0,0,0,3],
  [4,0,0,8,0,3,0,0,1],
  [7,0,0,0,2,0,0,0,6],
  [0,6,0,0,0,0,2,8,0],
  [0,0,0,4,1,9,0,0,5],
  [0,0,0,0,8,0,0,7,9]
];
let sudokuBoard = [];
function openSudoku(){
  sudokuBoard = JSON.parse(JSON.stringify(sudokuPuzzle));
  openM(`
    <h3 style="color:var(--neon-green)"><i class="fa-solid fa-border-all"></i> Sudoku</h3>
    <div class="sudoku-board" id="sudokuboard"></div>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <button class="btn" id="sudokuCheck">Check</button>
      <button class="btn" id="sudokuNew">New</button>
    </div>
  `);
  $("#sudokuCheck").addEventListener("click", checkSudoku);
  $("#sudokuNew").addEventListener("click", openSudoku);
  renderSudoku();
}
function renderSudoku(){
  const board = $("#sudokuboard");
  board.innerHTML = "";
  sudokuBoard.forEach((row,y) => {
    row.forEach((val,x) => {
      const div = document.createElement("div");
      div.className = "sudoku-cell" + (sudokuPuzzle[y][x] ? " fixed" : "");
      if(val) div.textContent = val;
      else{
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.maxLength = 1;
        input.oninput = (e) => {
          const n = parseInt(e.target.value);
          sudokuBoard[y][x] = isNaN(n) ? 0 : n;
        };
        div.appendChild(input);
      }
      board.appendChild(div);
    });
  });
}
function checkSudoku(){
  for(let y=0;y<9;y++){
    for(let x=0;x<9;x++){
      const v = sudokuBoard[y][x];
      if(v === 0) return alert("❌ Table is not complete");
      if(!isValidSudoku(y,x,v)) return alert(`❌ خطا در سطر ${y+1} ستون ${x+1}`);
    }
  }
  saveScore("Sudoku", 1);
  alert("✅ You won");
}
function isValidSudoku(r,c,val){
  for(let i=0;i<9;i++){
    if(i !== c && sudokuBoard[r][i] === val) return false;
    if(i !== r && sudokuBoard[i][c] === val) return false;
  }
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let y=br;y<br+3;y++){
    for(let x=bc;x<bc+3;x++){
      if((y !== r || x !== c) && sudokuBoard[y][x] === val) return false;
    }
  }
  return true;
}

/* Guess */
let secretNumber = 0, attempts = 0;
function openNumberGuess(){
  secretNumber = Math.floor(Math.random()*100)+1;
  attempts = 0;
  openM(`
    <h3 style="color:var(--neon-purple)"><i class="fa-solid fa-wand-magic-sparkles"></i> Guess Game</h3>
    <p class="muted" style="margin:16px 0">عدد بین 1 تا 100</p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <input id="guessInput" type="number" min="1" max="100" placeholder="حدس..." />
      <button class="btn" id="guessBtn">حدس</button>
    </div>
    <div id="guessResult" style="margin-top:16px;font-size:1.05rem;height:160px;overflow:auto;text-align:right"></div>
    <button class="btn" style="margin-top:12px" id="guessNew">بازی جدید</button>
  `);
  $("#guessBtn").addEventListener("click", checkGuess);
  $("#guessNew").addEventListener("click", openNumberGuess);
}
function checkGuess(){
  const input = $("#guessInput");
  const result = $("#guessResult");
  const guess = parseInt(input.value);
  if(isNaN(guess) || guess < 1 || guess > 100){
    result.innerHTML += `<div style="color:var(--neon-red)">⚠️ عدد 1 تا 100</div>`;
    return;
  }
  attempts++;
  let message = "", color = "";
  if(guess < secretNumber){ message = `📈 بالاتر! (حدس ${attempts})`; color = "var(--neon-cyan)"; }
  else if(guess > secretNumber){ message = `📉 پایین‌تر! (حدس ${attempts})`; color = "var(--neon-pink)"; }
  else{
    message = `🎉 درست بود: <b>${secretNumber}</b> در ${attempts} حدس`;
    color = "var(--neon-green)";
    saveScore("Guess", Math.max(0, 120 - attempts * 10));
  }
  result.innerHTML += `<div style="color:${color};margin:8px 0">${message}</div>`;
  result.scrollTop = result.scrollHeight;
  input.value = "";
  input.focus();
}

/* Finance */
function openFinance(){
  openM(`
    <h3 style="color:var(--neon-green)"><i class="fa-solid fa-chart-line"></i> Quantum Finance</h3>
    <canvas id="chart" width="700" height="240" style="max-width:100%"></canvas>
    <p class="muted" style="font-size:.8rem">نمودار شبیه‌سازی</p>
  `);
  const canvas = $("#chart");
  const ctx = canvas.getContext("2d");
  let data = Array.from({length:60}, () => 100 + Math.random() * 10);

  function draw(){
    if(!$("#chart")) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--neon-cyan").trim() || "#00fff0";
    ctx.lineWidth = 2;

    ctx.beginPath();
    data.forEach((v,i) => {
      const x = i * (canvas.width / 60);
      const y = canvas.height - (v - 80) * 2;
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();

    data.push(data[data.length - 1] + (Math.random() - .45) * 4);
    data.shift();
    requestAnimationFrame(draw);
  }
  draw();
}

/* Calc */
let expr = "";
function openCalc(){
  expr = "";
  openM(`
    <h3 style="color:var(--neon-pink)"><i class="fa-solid fa-calculator"></i> Calculator</h3>
    <div id="scr" style="background:black;color:white;padding:12px;border-radius:14px;font-size:1.2rem;border:1px solid rgba(255,255,255,.08)">0</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px">
      ${["7","8","9","/","4","5","6","*","1","2","3","-","0",".","C","+"]
        .map(b => `<button class="btn" data-press="${b}">${b}</button>`).join("")}
      <button class="btn" style="grid-column:1/5" id="calcEq">=</button>
    </div>
  `);
  content.onclick = e => {
    const p = e.target.closest("[data-press]");
    if(!p) return;
    press(p.dataset.press);
  };
  $("#calcEq").addEventListener("click", calc);
}
function press(v){
  if(v === "C"){ expr = ""; $("#scr").textContent = "0"; return; }
  expr += v;
  $("#scr").textContent = expr || "0";
}
function calc(){
  try{
    // eslint-disable-next-line no-eval
    expr = String(eval(expr));
    $("#scr").textContent = expr;
  }catch{
    $("#scr").textContent = "Err";
    expr = "";
  }
}

/* Browser */
function browser(){
  openM(`
    <h3 style="color:var(--neon-cyan)"><i class="fa-solid fa-globe"></i> Quantum Browser</h3>
    <div style="display:flex;gap:8px;margin-bottom:10px;justify-content:center;flex-wrap:wrap">
      <input id="qurl" placeholder="Search / URL" style="flex:1;min-width:240px;direction:ltr" />
      <button class="btn" id="goBtn"><i class="fa-solid fa-magnifying-glass"></i></button>
    </div>
    <iframe id="browserFrame" style="width:100%;height:420px;border-radius:16px;background:black;border:1px solid rgba(255,255,255,.08)" src="https://duckduckgo.com"></iframe>
    <p class="muted" style="font-size:.75rem;margin-top:8px">بعضی سایت‌ها داخل iframe باز نمی‌شوند.</p>
  `);
  const input = $("#qurl");
  $("#goBtn").addEventListener("click", loadPage);
  input.addEventListener("keydown", (e) => { if(e.key === "Enter") loadPage(); });
}
function loadPage(){
  const q = ($("#qurl")?.value || "").trim();
  const frame = $("#browserFrame");
  if(!frame) return;

  if(!q){ frame.src = "https://duckduckgo.com"; return; }
  const isUrl = /^https?:\/\//i.test(q) || q.includes(".");
  frame.src = isUrl ? (q.startsWith("http") ? q : `https://${q}`) : `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
}

/* Music */
function music(){
  openM(`
    <h3 style="color:var(--neon-cyan)"><i class="fa-solid fa-music"></i> Music</h3>
    <div class="file-input">
      <input type="file" accept="audio/*" id="musicFile">
      <label class="file-btn" for="musicFile"><i class="fa-solid fa-file-audio"></i> Choose Audio</label>
      <span class="file-name" id="musicName">No file</span>
    </div>
    <audio id="audio" controls style="width:100%;margin-top:12px"></audio>
  `);

  $("#musicFile").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    $("#musicName").textContent = f ? f.name : "No file";
    if(f) $("#audio").src = URL.createObjectURL(f);
  });
}

/* Files */
function files(){
  openM(`
    <h3 style="color:var(--neon-cyan)"><i class="fa-solid fa-folder-open"></i> Files</h3>
    <div class="file-input">
      <input type="file" multiple id="filePick">
      <label class="file-btn" for="filePick"><i class="fa-solid fa-file-arrow-up"></i> Choose Files</label>
      <span class="file-name" id="fileName">No file</span>
    </div>
    <ul id="list" style="text-align:right;margin-top:12px;max-height:320px;overflow:auto;line-height:1.85"></ul>
  `);

  $("#filePick").addEventListener("change", (e) => {
    const ul = $("#list");
    const files = [...e.target.files || []];
    $("#fileName").textContent = files.length ? `${files.length} file(s)` : "No file";
    ul.innerHTML = "";
    for(const f of files) ul.innerHTML += `<li>${escapeHtml(f.name)}</li>`;
  });
}

/* Phone */
function phone(){
  openM(`
    <h3 style="color:var(--neon-cyan)"><i class="fa-solid fa-phone"></i> Phone</h3>
    <div style="display:grid;gap:10px;justify-items:center">
      <input id="phoneNumber" inputmode="tel" placeholder="شماره..." style="max-width:360px" />
      <button class="btn" id="callBtn">تماس</button>
    </div>
  `);
  $("#callBtn").addEventListener("click", () => alert("در حال تماس..."));
}

/* Settings */
function settings(){
  const root = getComputedStyle(document.documentElement);
  const cyan = root.getPropertyValue("--neon-cyan").trim() || "#00fff0";
  const pink = root.getPropertyValue("--neon-pink").trim() || "#ff2bdc";
  const font = parseInt(root.getPropertyValue("--font")) || 16;
  const radius = parseInt(root.getPropertyValue("--radius")) || 22;

  openM(`
    <h3 class="neon-title"><i class="fa-solid fa-gear"></i> Settings</h3>
    <div style="display:grid;gap:14px;text-align:right;margin-top:12px;justify-items:center">
      <div style="width:100%;max-width:520px;text-align:right">
        <label class="muted" style="display:block;margin-bottom:6px">Neon Cyan</label>
        <input type="color" value="${cyan}" id="cyanPick">
      </div>

      <div style="width:100%;max-width:520px;text-align:right">
        <label class="muted" style="display:block;margin-bottom:6px">Neon Pink</label>
        <input type="color" value="${pink}" id="pinkPick">
      </div>

      <div style="width:100%;max-width:520px;text-align:right">
        <label class="muted" style="display:block;margin-bottom:6px">Font Size</label>
        <input type="range" min="12" max="22" value="${font}" id="fontRange">
      </div>

      <div style="width:100%;max-width:520px;text-align:right">
        <label class="muted" style="display:block;margin-bottom:6px">Card Radius</label>
        <input type="range" min="10" max="34" value="${radius}" id="radiusRange">
      </div>

      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:6px">
        <button class="btn" id="saveTheme">Save Theme</button>
        <button class="btn btn-ghost" id="resetTheme">Reset</button>
      </div>
    </div>
  `);

  const apply = () => {
    document.documentElement.style.setProperty("--neon-cyan", $("#cyanPick").value);
    document.documentElement.style.setProperty("--neon-pink", $("#pinkPick").value);
    document.documentElement.style.setProperty("--font", $("#fontRange").value + "px");
    document.documentElement.style.setProperty("--radius", $("#radiusRange").value + "px");
  };

  $("#cyanPick").addEventListener("input", apply);
  $("#pinkPick").addEventListener("input", apply);
  $("#fontRange").addEventListener("input", apply);
  $("#radiusRange").addEventListener("input", apply);

  $("#saveTheme").addEventListener("click", () => {
    const t = {
      cyan: $("#cyanPick").value,
      pink: $("#pinkPick").value,
      font: $("#fontRange").value,
      radius: $("#radiusRange").value
    };
    localStorage.setItem(STORAGE.THEME, JSON.stringify(t));
    alert("✅ Theme saved");
  });

  $("#resetTheme").addEventListener("click", () => {
    localStorage.removeItem(STORAGE.THEME);
    location.reload();
  });
}

function loadTheme(){
  try{
    const t = JSON.parse(localStorage.getItem(STORAGE.THEME) || "null");
    if(!t) return;
    if(t.cyan) document.documentElement.style.setProperty("--neon-cyan", t.cyan);
    if(t.pink) document.documentElement.style.setProperty("--neon-pink", t.pink);
    if(t.font) document.documentElement.style.setProperty("--font", t.font + "px");
    if(t.radius) document.documentElement.style.setProperty("--radius", t.radius + "px");
  }catch{}
}

function about(){
  openM(`
    <h3 class="neon-title">Quantum OS</h3>
    <p style="margin-top:12px;line-height:1.9">
      A futuristic web desktop experience with apps, tools, games, dock, filters, search and neon UI.
    </p>
    <p class="muted" style="margin-top:10px">Powered by Saleh Amoo</p>
  `);
}
function about2(){
  openM(`<h2 class="neon-title">Developed By SA || Saleh Amoo</h2>`);
}
function openSystem(){
  openM(`
    <h3 class="neon-title"><i class="fa-solid fa-bolt"></i> Quantum System</h3>
    <ul style="text-align:right;margin-top:10px;line-height:2">
      <li>CPU: active</li>
      <li>Games: active</li>
      <li>User: ${(localStorage.getItem(STORAGE.USER) || "Guest")}</li>
      <li>Mode: ${location.protocol === "file:" ? "Offline (file://)" : "Server (http/https)"}</li>
      <li>Pinned Apps: ${getPins().length}</li>
      <li>Dock Apps: ${getDockApps().length}</li>
    </ul>
  `);
}

/* Clock */
function openClock(){
  openM(`
    <h2 class="neon-title" style="margin-bottom:16px;"><i class="fa-regular fa-clock"></i> Clock</h2>
    <div class="clock-app">
      <div class="analog-clock">
        <div class="clock-hand clock-hour" id="cHour"></div>
        <div class="clock-hand clock-minute" id="cMinute"></div>
        <div class="clock-hand clock-second" id="cSecond"></div>
        <div class="clock-center"></div>
      </div>
    </div>
    <div id="digitalClock" class="digital-clock">00:00:00</div>
  `);
  updateAnalogClock();
}
function updateAnalogClock(){
  const now = new Date();
  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours();

  const dc = $("#digitalClock");
  if(dc) dc.innerText = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;

  const sec = $("#cSecond"), min = $("#cMinute"), hr = $("#cHour");
  if(!sec || !min || !hr) return;

  sec.style.transform = `rotate(${s * 6 - 90}deg)`;
  min.style.transform = `rotate(${m * 6 + s * 0.1 - 90}deg)`;
  hr.style.transform  = `rotate(${(h % 12) * 30 + m * 0.5 - 90}deg)`;
}
setInterval(() => { if($("#cSecond")) updateAnalogClock(); }, 1000);

/* Shutdown */
function shutdownSystem(){
  const overlay = document.createElement("div");
  overlay.className = "exit-overlay";
  const logo = document.createElement("img");
  logo.src = "SA.png";
  logo.className = "exit-logo";
  overlay.appendChild(logo);
  document.body.appendChild(overlay);
  setTimeout(() => { history.back(); }, 800);
}

/* ===============================
   ROUTER
   =============================== */
const ROUTES = {
  browser, phone, files, music,
  clock: openClock,
  settings, about,
  finance: openFinance,
  calc: openCalc,
  system: openSystem,
  ttt: openTicTacToe,
  sudoku: openSudoku,
  guess: openNumberGuess,
  rps: openRPS,
  reaction: openReaction,
  memory: openMemory,
  snake: openSnakeMobile,
  click: openClickGame,
  leaderboard: openLeaderboard,
  shutdown: shutdownSystem,
  developer: about2
};

function openApp(appKey){
  if(!ROUTES[appKey]) return;
  setRunning(appKey, true);
  ROUTES[appKey]();
}

appsGrid.addEventListener("click", e => {
  const btn = e.target.closest("[data-app]");
  if(!btn) return;
  openApp(btn.dataset.app);
});

dockEl.addEventListener("click", e => {
  const btn = e.target.closest("[data-dock-app]");
  if(!btn) return;
  openApp(btn.dataset.dockApp);
});

$$("[data-open-global]").forEach(btn => {
  btn.addEventListener("click", () => {
    openApp(btn.dataset.openGlobal);
  });
});

/* ===============================
   MODAL
   =============================== */
$("#closeModalBtn").addEventListener("click", () => {
  closeM();
  content.onclick = null;
  setRunning("browser", false);
  setRunning("phone", false);
  setRunning("files", false);
  setRunning("music", false);
  setRunning("clock", false);
  setRunning("settings", false);
  setRunning("about", false);
  setRunning("finance", false);
  setRunning("calc", false);
  setRunning("system", false);
  setRunning("ttt", false);
  setRunning("sudoku", false);
  setRunning("guess", false);
  setRunning("rps", false);
  setRunning("reaction", false);
  setRunning("memory", false);
  setRunning("snake", false);
  setRunning("click", false);
  setRunning("leaderboard", false);
  setRunning("developer", false);
});

modal.addEventListener("click", (e) => {
  if(e.target === modal){
    closeM();
  }
});

/* ===============================
   PWA / SW
   =============================== */
if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

function isPWA(){ return window.matchMedia("(display-mode: standalone)").matches; }
function isAndroid(){ return /Android/i.test(navigator.userAgent); }

window.addEventListener("load", () => {
  if(isPWA() || (isAndroid() && isPWA())){
    const btn = $("#pwa-exit-btn");
    if(btn) btn.style.display = "block";
  }
});

$("#pwa-exit-btn")?.addEventListener("click", shutdownSystem);

function enableExitOnBack(){
  history.pushState(null, "", location.href);
  window.addEventListener("popstate", () => {
    document.body.innerHTML = `<div style="background:black;color:#ff3b3b;height:100vh;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">App closed</div>`;
  });
}
if(isPWA()) enableExitOnBack();

/* ===============================
   KEYBOARD SHORTCUTS
   =============================== */
document.addEventListener("keydown", e => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"){
    e.preventDefault();
    $("#appSearch")?.focus();
  }
  if(e.key === "/"){
    const active = document.activeElement;
    const tag = active?.tagName?.toLowerCase();
    if(tag !== "input" && tag !== "textarea"){
      e.preventDefault();
      $("#appSearch")?.focus();
    }
  }
  if(e.key === "Escape"){
    closeContextMenu();
    if(modal.style.display === "flex") closeM();
  }
});
