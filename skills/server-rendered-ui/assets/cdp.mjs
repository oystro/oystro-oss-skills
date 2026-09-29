// Minimal Chrome DevTools Protocol driver.
//
// Drop-in, zero npm dependencies. Uses a chrome-headless-shell binary and Node's global
// WebSocket (Node >= 22). Justification for not taking a browser-automation dependency: this
// exists to measure element boxes and record DOM states, and the applications under test
// usually vendor everything else, so a full automation stack is out of proportion.
//
// Copy next to your test, then:
//
//   const b = await Browser.launch();
//   await b.goto('http://localhost:8080/');
//   await b.waitFor(`document.querySelector('.thing')`, { label: 'thing' });
//   const h = await b.eval(`return document.querySelector('.thing').getBoundingClientRect().height;`);
//   await b.close();

import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { homedir, tmpdir, platform } from 'node:os';
import { join } from 'node:path';

// Playwright's browser cache, per platform. Override with CHROME_HEADLESS_SHELL.
const CACHE_DIRS = {
  darwin: () => join(homedir(), 'Library', 'Caches', 'ms-playwright'),
  linux: () => join(homedir(), '.cache', 'ms-playwright'),
  win32: () => join(homedir(), 'AppData', 'Local', 'ms-playwright'),
};

// Subdirectory names and binary names differ by platform and by Chromium build.
const SHELL_DIR_PREFIX = 'chromium_headless_shell';
const SHELL_ARCH_DIRS = {
  darwin: ['mac-arm64', 'mac-x64', 'mac'],
  linux: ['linux', 'linux-arm64'],
  win32: ['win64', 'win32'],
};
const SHELL_BIN = platform() === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';

export function findHeadlessShell() {
  if (process.env.CHROME_HEADLESS_SHELL) return process.env.CHROME_HEADLESS_SHELL;

  const root = (CACHE_DIRS[platform()] || CACHE_DIRS.linux)();
  if (!existsSync(root)) {
    throw new Error(
      `no browser cache at ${root}. Set CHROME_HEADLESS_SHELL to a chrome-headless-shell ` +
        'binary, or install one with "npx playwright install chromium".'
    );
  }

  // Newest build first, so a stale cached build is not silently preferred.
  const candidates = readdirSync(root)
    .filter((d) => d.startsWith(SHELL_DIR_PREFIX))
    .sort()
    .reverse();

  for (const dir of candidates) {
    for (const arch of SHELL_ARCH_DIRS[platform()] || SHELL_ARCH_DIRS.linux) {
      const bin = join(root, dir, `chrome-headless-shell-${arch}`, SHELL_BIN);
      if (existsSync(bin)) return bin;
    }
  }
  throw new Error(`no chrome-headless-shell binary found under ${root}`);
}

export class Browser {
  constructor(proc, ws, profileDir) {
    this.proc = proc;
    this.ws = ws;
    this.profileDir = profileDir;
    this.nextId = 1;
    this.pending = new Map();
    this.sessionId = null;
    ws.addEventListener('message', (ev) => this._onMessage(String(ev.data)));
  }

  static async launch({ width = 1280, height = 900, binary } = {}) {
    const bin = binary || findHeadlessShell();
    const profileDir = await mkdtemp(join(tmpdir(), 'cdp-'));

    const proc = spawn(
      bin,
      [
        '--headless',
        '--remote-debugging-port=0',
        `--user-data-dir=${profileDir}`,
        `--window-size=${width},${height}`,
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        // Freeze animations. Without this a measurement can race a transition mid-flight
        // and report a height the user never actually sees.
        '--force-prefers-reduced-motion',
        'about:blank',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    // The endpoint is only known once the browser has started and printed it.
    const wsUrl = await new Promise((resolve, reject) => {
      let buf = '';
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for CDP endpoint.\n${buf}`)),
        20000
      );
      proc.stderr.on('data', (chunk) => {
        buf += chunk.toString();
        const m = buf.match(/ws:\/\/[^\s]+/);
        if (m) {
          clearTimeout(timer);
          resolve(m[0]);
        }
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`chrome-headless-shell exited early (${code}).\n${buf}`));
      });
    });

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('CDP socket error')), {
        once: true,
      });
    });

    const browser = new Browser(proc, ws, profileDir);

    const { targetInfos } = await browser.send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target available');

    const { sessionId } = await browser.send('Target.attachToTarget', {
      targetId: page.targetId,
      flatten: true,
    });
    browser.sessionId = sessionId;

    await browser.send('Page.enable');
    await browser.send('Runtime.enable');
    return browser;
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.id === undefined) return;
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    this.pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(`${msg.error.message} (${msg.error.code})`));
    else entry.resolve(msg.result);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (this.sessionId) payload.sessionId = this.sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    // Poll for readiness rather than trusting a fixed sleep.
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try {
        if (await this.eval('return document.readyState === "complete";')) return;
      } catch {
        // Navigation still in flight; the execution context may not exist yet.
      }
      await sleep(100);
    }
    throw new Error(`navigation to ${url} did not complete`);
  }

  // Evaluate an expression body. Throws with the page's own message on a script error,
  // so a typo in a selector never reads as a passing assertion.
  async eval(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression: `(() => { ${expression} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      const e = exceptionDetails.exception;
      throw new Error(
        `page eval failed: ${(e && (e.description || e.value)) || exceptionDetails.text}`
      );
    }
    return result.value;
  }

  async waitFor(expression, { timeout = 15000, label = expression, interval = 100 } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.eval(`return !!(${expression});`)) return;
      await sleep(interval);
    }
    throw new Error(`waitFor timed out: ${label}`);
  }

  // PNG bytes. An agent usually cannot inspect images, so this exists for the human: attach
  // it to a verification report as evidence, or diff it between states.
  async screenshot({ fullPage = false } = {}) {
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: fullPage,
    });
    return Buffer.from(data, 'base64');
  }

  async close() {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
    this.proc.kill('SIGTERM');
    await new Promise((resolve) => {
      this.proc.once('exit', resolve);
      setTimeout(resolve, 3000);
    });
    await rm(this.profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
