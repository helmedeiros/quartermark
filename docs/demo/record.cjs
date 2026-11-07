const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const OUT = __dirname;
const API_PORT = process.env.QM_DEMO_API_PORT ?? "8771";
const WEB_PORT = process.env.QM_DEMO_WEB_PORT ?? "4174";
const BASE = `http://127.0.0.1:${WEB_PORT}`;
const VIEWPORT = { width: 1280, height: 720 };

const CURSOR = `
addEventListener("DOMContentLoaded", () => {
  const dot = document.createElement("div");
  dot.style.cssText =
    "position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;" +
    "border-radius:50%;background:rgba(37,99,235,.35);border:2px solid #2563eb;" +
    "pointer-events:none;left:-40px;top:-40px;transition:transform .12s";
  document.body.appendChild(dot);
  addEventListener("mousemove", (e) => {
    dot.style.left = e.clientX + "px";
    dot.style.top = e.clientY + "px";
  });
  addEventListener("mousedown", () => (dot.style.transform = "scale(.7)"));
  addEventListener("mouseup", () => (dot.style.transform = ""));
});
`;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await pause(200);
  }
  throw new Error(`${url} never came up`);
}

function start(cmd, args, env) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: "ignore",
    detached: true,
  });
  return () => {
    try {
      process.kill(-child.pid);
    } catch {}
  };
}

async function moveTo(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 20,
  });
  await pause(300);
}

async function click(page, locator) {
  await moveTo(page, locator);
  await locator.click();
}

async function type(locator, text) {
  await locator.pressSequentially(text, { delay: 150 });
}

async function scroll(page, dy) {
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, dy / 20);
    await pause(40);
  }
}

async function collapseSidebar(page) {
  await page.getByRole("button", { name: "Collapse quarter list" }).click();
}

const scenes = {
  async tree(page) {
    await page.goto(`${BASE}/t/atlas/okrs`);
    await collapseSidebar(page);
    await page.getByRole("link", { name: "Q1 2027" }).first().waitFor();
    await page.mouse.move(640, 500);
    return async () => {
      await pause(1800);
      await click(page, page.getByRole("link", { name: "Q1 2027" }).first());
      await page.getByRole("button", { name: "Expand all" }).waitFor();
      await pause(1800);
      await click(page, page.getByRole("button", { name: "Expand all" }));
      await pause(2000);
      await page.mouse.move(700, 450, { steps: 15 });
      await scroll(page, 480);
      await pause(2500);
    };
  },

  async capacity(page) {
    await page.goto(`${BASE}/t/atlas/okrs/2027-q1/gantt`);
    await collapseSidebar(page);
    await page.getByRole("button", { name: "Week" }).click();
    await page.mouse.move(640, 600);
    return async () => {
      await pause(1800);
      const input = page.locator("input[type=number]").first();
      await click(page, input);
      await type(input, "4");
      await input.press("Enter");
      await pause(2200);
      await input.press("Backspace");
      await type(input, "8");
      await input.press("Enter");
      await pause(2500);
      await moveTo(page, page.getByText("O-1-KR2-M2 In-app help").last());
      await pause(1800);
    };
  },

  async progress(page) {
    await page.goto(`${BASE}/t/atlas/okrs/2027-q1`);
    await collapseSidebar(page);
    await page.getByRole("button", { name: "Expand all" }).click();
    await page.mouse.move(640, 600);
    return async () => {
      await pause(1500);
      await click(page, page.getByRole("link", { name: /O-1-KR1 Median/ }));
      await page.getByText("Progress history").waitFor();
      await pause(2200);
      await page.mouse.move(500, 450, { steps: 15 });
      await scroll(page, 1500);
      await pause(2500);
    };
  },
};

async function record(browser, name) {
  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), "qm-video-"));
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const began = Date.now();
  const play = await scenes[name](page);
  await pause(500);
  const offset = (Date.now() - began) / 1000;
  await play();
  await context.close();
  const video = await page.video().path();
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    offset.toFixed(2),
    "-i",
    video,
    "-vf",
    "fps=8,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
    path.join(OUT, `${name}.gif`),
  ]);
  fs.rmSync(videoDir, { recursive: true, force: true });
  console.log(`wrote docs/demo/${name}.gif`);
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qm-demo-"));
  const stops = [
    start(
      path.join(ROOT, "bin/okrd"),
      ["-demo", "-addr", `127.0.0.1:${API_PORT}`],
      { QUARTERMARK_DB: path.join(dataDir, "demo.db") },
    ),
  ];
  try {
    await waitFor(`http://127.0.0.1:${API_PORT}/api/teams`);
    stops.push(
      start(
        path.join(ROOT, "web/node_modules/.bin/vite"),
        [
          "preview",
          "web",
          "--host",
          "127.0.0.1",
          "--port",
          WEB_PORT,
          "--strictPort",
        ],
        { QUARTERMARK_API_PORT: API_PORT },
      ),
    );
    await waitFor(`${BASE}/api/teams`);
    const browser = await chromium.launch();
    try {
      const only = process.argv.slice(2);
      for (const name of only.length ? only : Object.keys(scenes)) {
        await record(browser, name);
      }
    } finally {
      await browser.close();
    }
  } finally {
    stops.forEach((stop) => stop());
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
