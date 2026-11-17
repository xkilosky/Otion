import type { Project, ProjectFile } from "../types";

const uid = () =>
  `f_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

export const makeFile = (name: string, content = ""): ProjectFile => ({
  id: uid(),
  name,
  content,
});

export interface Template {
  id: string;
  name: string;
  tagline: string;
  swatch: [string, string];
  files: () => { name: string; content: string }[];
}

const blankHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hello Otion</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="card">
    <span class="pill">Otion</span>
    <h1>Hello, world.</h1>
    <p>Edit the files on the left — the preview updates as you type.</p>
    <button id="cheer">Tap me</button>
    <p class="count" id="count">0 taps</p>
  </main>
  <script src="script.js"></script>
</body>
</html>
`;

const blankCss = `* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #eef1f8;
  background: radial-gradient(circle at 20% 0%, #2a3358, #0c0f1a 60%);
}

.card {
  width: min(420px, 100%);
  padding: 28px 24px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
}

.pill {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9fb4ff;
}

h1 { margin: 8px 0 4px; font-size: 30px; letter-spacing: -0.02em; }
p { color: #aab3c9; line-height: 1.6; }

button {
  margin-top: 8px;
  padding: 12px 20px;
  border: 0;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #0a0d16;
  background: linear-gradient(135deg, #a9c1ff, #7ef2d0);
  cursor: pointer;
}

button:active { transform: scale(0.97); }
.count { font-size: 14px; font-variant-numeric: tabular-nums; }
`;

const blankJs = `const button = document.getElementById("cheer");
const label = document.getElementById("count");
let taps = 0;

button.addEventListener("click", () => {
  taps += 1;
  label.textContent = taps + (taps === 1 ? " tap" : " taps");
  console.log("tap", taps);
});

console.log("Otion is ready ✦");
`;

const landingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nimbus — ship faster</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="nav">
    <div class="brand">nimbus<span>.</span></div>
    <nav>
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a class="cta" href="#start">Get started</a>
    </nav>
  </header>

  <section class="hero">
    <p class="eyebrow">Now in public beta</p>
    <h1>Ship your ideas<br /><em>at light speed.</em></h1>
    <p class="sub">One workspace for designing, building and launching — on any device.</p>
    <form class="signup" id="signup">
      <input type="email" placeholder="you@company.com" required />
      <button type="submit">Join the waitlist</button>
    </form>
    <p class="note" id="note">No credit card. Ever.</p>
  </section>

  <section class="features" id="features">
    <article>
      <div class="icon">⚡</div>
      <h2>Instant preview</h2>
      <p>Every keystroke renders live in a sandboxed frame.</p>
    </article>
    <article>
      <div class="icon">📱</div>
      <h2>Build for thumbs</h2>
      <p>Layouts start mobile-first and scale up from there.</p>
    </article>
    <article>
      <div class="icon">☁️</div>
      <h2>Saved locally</h2>
      <p>Your workspace persists without an account.</p>
    </article>
  </section>
  <script src="app.js"></script>
</body>
</html>
`;

const landingCss = `* { box-sizing: border-box; }

:root {
  --ink: #0d1020;
  --muted: #5d6478;
  --accent: #5b5bd6;
}

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--ink);
  background: #fbfaff;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  gap: 12px;
}

.brand { font-weight: 800; font-size: 20px; letter-spacing: -0.03em; }
.brand span { color: var(--accent); }

.nav nav { display: flex; align-items: center; gap: 16px; }
.nav a { color: var(--muted); text-decoration: none; font-size: 14px; }
.nav a.cta {
  color: #fff;
  background: var(--ink);
  padding: 9px 14px;
  border-radius: 999px;
}

.hero {
  padding: 40px 20px 56px;
  text-align: center;
  background: radial-gradient(120% 90% at 50% 0%, #e9e6ff 0%, #fbfaff 60%);
}

.eyebrow {
  display: inline-block;
  margin: 0 0 14px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--accent);
  background: #ecebff;
}

h1 {
  margin: 0;
  font-size: clamp(34px, 10vw, 62px);
  line-height: 1.02;
  letter-spacing: -0.045em;
}

h1 em { font-style: normal; color: var(--accent); }

.sub {
  max-width: 32ch;
  margin: 16px auto 26px;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.55;
}

.signup {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
  margin: 0 auto;
}

.signup input {
  padding: 14px 16px;
  font-size: 16px;
  border-radius: 12px;
  border: 1px solid #ddd9ff;
  background: #fff;
  outline-color: var(--accent);
}

.signup button {
  padding: 14px 16px;
  font-size: 16px;
  font-weight: 650;
  border: 0;
  border-radius: 12px;
  color: #fff;
  background: var(--accent);
  cursor: pointer;
}

.signup button:active { transform: scale(0.99); }
.note { color: var(--muted); font-size: 13px; margin-top: 12px; }

.features {
  display: grid;
  gap: 14px;
  padding: 8px 20px 48px;
  max-width: 960px;
  margin: 0 auto;
}

.features article {
  padding: 20px;
  border-radius: 16px;
  border: 1px solid #ebe8ff;
  background: #fff;
}

.icon { font-size: 22px; }
.features h2 { font-size: 17px; margin: 10px 0 6px; letter-spacing: -0.01em; }
.features p { margin: 0; color: var(--muted); font-size: 14.5px; line-height: 1.55; }

@media (min-width: 720px) {
  .nav { padding: 22px 48px; }
  .features { grid-template-columns: repeat(3, 1fr); padding: 24px 48px 72px; }
  .signup { flex-direction: row; }
  .signup input { flex: 1; }
}
`;

const landingJs = `const form = document.getElementById("signup");
const note = document.getElementById("note");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = form.querySelector("input").value;
  note.textContent = "You're on the list, " + email.split("@")[0] + " ✦";
  note.style.color = "#5b5bd6";
  form.reset();
  console.log("waitlist signup:", email);
});

console.log("Nimbus landing page loaded");
`;

const gameHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Dot Rush</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header>
    <div class="score">Score <strong id="score">0</strong></div>
    <div class="timer" id="timer">30s</div>
  </header>

  <main id="board" aria-label="game board">
    <div class="start">
      <h1>Dot Rush</h1>
      <p>Tap the glowing dot before it moves.</p>
      <button id="play">Play</button>
    </div>
  </main>
  <script src="game.js"></script>
</body>
</html>
`;

const gameCss = `* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

html, body { height: 100%; margin: 0; }

body {
  display: flex;
  flex-direction: column;
  font-family: ui-rounded, system-ui, -apple-system, sans-serif;
  color: #eef1f8;
  background: #0a0c14;
  overflow: hidden;
  user-select: none;
}

header {
  display: flex;
  justify-content: space-between;
  padding: 16px 20px;
  font-size: 14px;
  letter-spacing: 0.02em;
  color: #8b93ad;
}

strong { color: #7ef2d0; font-size: 20px; margin-left: 6px; }
.timer { font-variant-numeric: tabular-nums; }

#board {
  position: relative;
  flex: 1;
  margin: 0 12px 12px;
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 40%, #151a2c, #0a0c14 70%),
    #0a0c14;
  border: 1px solid #1d2236;
}

.start {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  padding: 24px;
  gap: 6px;
}

.start h1 { margin: 0; font-size: 32px; letter-spacing: -0.03em; }
.start p { margin: 0; color: #8b93ad; font-size: 15px; }

.start button {
  justify-self: center;
  margin-top: 18px;
  padding: 14px 38px;
  font-size: 17px;
  font-weight: 700;
  border: 0;
  border-radius: 999px;
  color: #06120e;
  background: linear-gradient(135deg, #9ff5dc, #6fd0ff);
  cursor: pointer;
}

.dot {
  position: absolute;
  width: 58px;
  height: 58px;
  margin: -29px 0 0 -29px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #b9fff0, #34d8ac 60%, #12987a);
  box-shadow: 0 0 0 8px rgba(52, 216, 172, 0.12), 0 0 34px rgba(52, 216, 172, 0.5);
  transition: transform 0.09s ease-out;
  animation: pop 0.18s ease-out;
}

@keyframes pop {
  from { transform: scale(0.6); opacity: 0.4; }
  to { transform: scale(1); opacity: 1; }
}

.over {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 8px;
  text-align: center;
  background: rgba(10, 12, 20, 0.86);
  backdrop-filter: blur(6px);
}

.over h2 { margin: 0; font-size: 26px; }
.over p { margin: 0; color: #8b93ad; }
.over button { margin: 16px auto 0; }
`;

const gameJs = `const board = document.getElementById("board");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");

let score = 0;
let timeLeft = 30;
let playing = false;
let dot = null;
const tick = null;

function spawn() {
  if (!dot) {
    dot = document.createElement("button");
    dot.className = "dot";
    dot.setAttribute("aria-label", "tap the dot");
    dot.addEventListener("pointerdown", hit);
    board.appendChild(dot);
  }
  const rect = board.getBoundingClientRect();
  const pad = 40;
  const x = pad + Math.random() * (rect.width - pad * 2);
  const y = pad + Math.random() * (rect.height - pad * 2);
  dot.style.left = x + "px";
  dot.style.top = y + "px";
}

function hit() {
  if (!playing) return;
  score += 1;
  scoreEl.textContent = score;
  spawn();
}

function startGame() {
  board.querySelector(".start, .over")?.remove();
  score = 0;
  timeLeft = 30;
  playing = true;
  scoreEl.textContent = "0";
  timerEl.textContent = "30s";
  spawn();
  console.log("game started");

  clearInterval(window.__otionTimer);
  window.__otionTimer = setInterval(() => {
    if (!playing) return;
    timeLeft -= 1;
    timerEl.textContent = timeLeft + "s";
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  playing = false;
  clearInterval(window.__otionTimer);
  dot?.remove();
  dot = null;
  const over = document.createElement("div");
  over.className = "over";
  over.innerHTML =
    "<h2>Time!</h2><p>You scored " + score + " points.</p>" +
    '<button id="again">Play again</button>';
  board.appendChild(over);
  over.querySelector("#again").addEventListener("click", startGame);
  console.log("game over — score", score);
}

document.getElementById("play").addEventListener("click", startGame);
`;

export const templates: Template[] = [
  {
    id: "blank",
    name: "Hello, Otion",
    tagline: "A tiny page to start from",
    swatch: ["#7ea6ff", "#7ef2d0"],
    files: () => [
      { name: "index.html", content: blankHtml },
      { name: "styles.css", content: blankCss },
      { name: "script.js", content: blankJs },
    ],
  },
  {
    id: "landing",
    name: "Landing page",
    tagline: "Responsive marketing site",
    swatch: ["#8b8bff", "#ff9ecb"],
    files: () => [
      { name: "index.html", content: landingHtml },
      { name: "styles.css", content: landingCss },
      { name: "app.js", content: landingJs },
    ],
  },
  {
    id: "game",
    name: "Dot Rush",
    tagline: "Touch game in 80 lines",
    swatch: ["#7ef2d0", "#38bdf8"],
    files: () => [
      { name: "index.html", content: gameHtml },
      { name: "styles.css", content: gameCss },
      { name: "game.js", content: gameJs },
    ],
  },
];

export function projectFromTemplate(templateId: string): Project {
  const template =
    templates.find((item) => item.id === templateId) ?? templates[0];
  return {
    id: `p_${Date.now().toString(36)}`,
    name: template.name,
    files: template.files().map((file) => makeFile(file.name, file.content)),
  };
}

export const starterProject = (): Project => projectFromTemplate("blank");
