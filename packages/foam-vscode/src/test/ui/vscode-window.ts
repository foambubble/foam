import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import {
  _electron as electron,
  type ElectronApplication,
  type Frame,
  type Locator,
  type Page,
} from 'playwright-core';
import { expect, inject, onTestFinished } from 'vitest';

/**
 * Settings that keep the window the same from run to run: nothing opens or
 * announces itself unless the test asks for it.
 */
const BASE_SETTINGS: Record<string, unknown> = {
  'workbench.colorTheme': 'Default Dark Modern',
  'workbench.startupEditor': 'none',
  'workbench.tips.enabled': false,
  'workbench.secondarySideBar.defaultVisibility': 'hidden',
  'chat.disableAIFeatures': true,
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'extensions.autoCheckUpdates': false,
  'extensions.autoUpdate': false,
  'security.workspace.trust.enabled': false,
  'git.enabled': false,
};

const WINDOW_SIZE = { width: 1280, height: 800 };

const clearedScreenshotDirs = new Set<string>();

export interface OpenVSCodeOptions {
  /** The workspace's files, by path relative to its root. */
  files: Record<string, string>;
  /** User settings, over the harness's own. */
  settings?: Record<string, unknown>;
}

/**
 * Opens a VS Code window on a new workspace holding `files`, with this
 * checkout's extension and a fresh profile, and waits for Foam to activate.
 * The window is closed and its files removed when the test finishes; if the
 * test failed, a screenshot of the window is kept first.
 */
export async function openVSCode(
  options: OpenVSCodeOptions
): Promise<VSCodeWindow> {
  // A short base path: VS Code's IPC socket lives in the user-data dir on
  // macOS, and a socket path over 104 characters fails with ENOTSOCK.
  const dir = mkdtempSync(path.join(os.tmpdir(), 'foam-ui-'));
  const workspace = path.join(dir, 'workspace');
  const userDataDir = path.join(dir, 'user-data');
  const settingsFile = path.join(userDataDir, 'User', 'settings.json');
  const screenshotDir = currentTestScreenshotDir();
  // a test's screenshots replace those of its last run, and no other test's
  if (!clearedScreenshotDirs.has(screenshotDir)) {
    rmSync(screenshotDir, { recursive: true, force: true });
    clearedScreenshotDirs.add(screenshotDir);
  }

  for (const [file, content] of Object.entries(options.files)) {
    mkdirSync(path.dirname(path.join(workspace, file)), { recursive: true });
    writeFileSync(path.join(workspace, file), content);
  }
  mkdirSync(path.dirname(settingsFile), { recursive: true });
  const settings = { ...BASE_SETTINGS, ...options.settings };
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

  let window: VSCodeWindow | undefined;
  let app: ElectronApplication | undefined;
  onTestFinished(async ({ task }) => {
    if (task.result?.state === 'fail' && window) {
      await window.screenshot('failure').catch(() => undefined);
    }
    await app?.close();
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  // VS Code launched with this set starts as plain Node, not as an editor
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({
    executablePath: inject('vscodeExecutable'),
    args: [
      `--extensionDevelopmentPath=${inject('extensionDevelopmentPath')}`,
      `--user-data-dir=${userDataDir}`,
      `--extensions-dir=${path.join(dir, 'extensions')}`,
      '--disable-gpu',
      '--disable-workspace-trust',
      '--disable-updates',
      '--disable-telemetry',
      '--skip-welcome',
      '--skip-release-notes',
      '--new-window',
      workspace,
    ],
    env,
  });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height);
  }, WINDOW_SIZE);
  // Keys and focus behave as in a focused window even when the OS gives
  // focus to another one, as it does when the tests run on a desktop.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

  window = new VSCodeWindow(page, screenshotDir, settingsFile, settings);
  await window.waitForFoamContributions();
  await window.activateFoam();
  return window;
}

export class VSCodeWindow {
  constructor(
    /** The workbench page, for anything this class does not wrap. */
    readonly page: Page,
    private readonly screenshotDir: string,
    private readonly settingsFile: string,
    private settings: Record<string, unknown>
  ) {}

  /**
   * Waits until VS Code has registered Foam's contributions. The palette
   * lists the commands registered when it opens, so a command run before
   * then is not found. Commands are registered with the views, which are
   * drawn.
   */
  async waitForFoamContributions() {
    await this.page
      .getByRole('button', { name: /^Connections/ })
      .waitFor({ timeout: 60_000 });
  }

  /**
   * Foam activates on demand, and VS Code runs a command only once its
   * extension has finished activating, which for Foam includes loading the
   * workspace. So Foam is ready when its What's New page opens. The page and
   * the notice a fresh profile gets are then put away, leaving the window as
   * it started.
   */
  async activateFoam() {
    await this.runCommand("Foam: Show What's New");
    const whatsNew = this.page
      .getByRole('main')
      .getByRole('tab')
      .filter({ hasText: 'WHATS_NEW.md' });
    await whatsNew.waitFor({ timeout: 60_000 });
    const notice = this.page.getByRole('dialog', {
      name: /What's new in Foam/,
    });
    await notice.getByRole('button', { name: 'Dismiss' }).click();
    // clicked, not run from the palette: the page is a webview with focus,
    // and keys sent to it while it loads are lost
    await whatsNew.getByRole('button', { name: /^Close/ }).click();
    await whatsNew.waitFor({ state: 'detached' });
  }

  /** Runs a command from the palette, by its title. */
  async runCommand(title: string) {
    const name = 'Type the name of a command to run.';
    const input = this.page.getByRole('textbox', { name });
    await this.openQuickInput('F1', input);
    await input.fill(`>${title}`);
    // a command with a keybinding carries it in the option's name
    await this.page
      .getByRole('listbox', { name })
      .getByRole('option', { name: new RegExp(`^${escapeRegExp(title)}`) })
      .first()
      .click();
  }

  /** Opens a workspace file in the editor through Quick Open. */
  async openFile(file: string) {
    const input = this.page.getByRole('textbox', {
      name: /^Search files by name/,
    });
    await this.openQuickInput('ControlOrMeta+P', input);
    await input.fill(file);
    const name = path.basename(file);
    await this.page
      .getByRole('option', { name: new RegExp(`^${escapeRegExp(name)}`) })
      .first()
      .click();
    await this.page
      .getByRole('tab', { name: new RegExp(`^${escapeRegExp(name)}`) })
      .waitFor();
  }

  /**
   * Presses `key` until `input`, the quick input it opens, is shown. A key
   * pressed in a webview reaches the workbench only once the webview has
   * loaded, and then asynchronously, so it may need pressing again; callers
   * fill the input rather than type, in case focus is still away.
   */
  private async openQuickInput(key: string, input: Locator) {
    for (let attempt = 1; ; attempt++) {
      await this.page.keyboard.press(key);
      try {
        await input.waitFor({ timeout: 5_000 });
        return;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
  }

  /** The lines drawn in the editor that has focus, top to bottom. */
  async editorLines(): Promise<string[]> {
    return this.page.evaluate(() => {
      const editor = document.activeElement?.closest('[role="code"]');
      if (!editor) throw new Error('No editor has focus');
      // Monaco gives its rendered lines no role, and `role=code`'s text
      // follows DOM order, which is not line order
      return Array.from(editor.querySelectorAll('.view-line'))
        .map(line => ({
          top: line.getBoundingClientRect().top,
          text: (line.textContent ?? '').replace(/\u00a0/g, ' '),
        }))
        .sort((a, b) => a.top - b.top)
        .map(line => line.text);
    });
  }

  /** Moves the mouse over the first `text` drawn in the focused editor. */
  async hoverText(text: string) {
    const box = await this.page.evaluate(text => {
      const editor = document.activeElement?.closest('[role="code"]');
      const lines = editor
        ? Array.from(editor.querySelectorAll('.view-line'))
        : [];
      for (const line of lines) {
        const nodes: { node: Text; start: number }[] = [];
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        let content = '';
        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          nodes.push({ node, start: content.length });
          content += node.data.replace(/\u00a0/g, ' ');
        }
        const index = content.indexOf(text);
        if (index < 0) continue;
        const at = (offset: number) => {
          const hit = [...nodes].reverse().find(n => n.start <= offset);
          return [hit.node, offset - hit.start] as const;
        };
        const range = document.createRange();
        range.setStart(...at(index));
        range.setEnd(...at(index + text.length));
        const rect = range.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
      return null;
    }, text);
    if (!box) throw new Error(`"${text}" is not drawn in the focused editor`);
    await this.page.mouse.move(box.x, box.y);
  }

  /** The webview frame whose document contains `selector`. */
  async webview(selector: string, { timeout = 30_000 } = {}): Promise<Frame> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      for (const frame of this.page.frames()) {
        const found = await frame
          .locator(selector)
          .count()
          .catch(() => 0);
        if (found > 0) return frame;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`No webview contains ${selector}`);
  }

  /** Changes user settings; VS Code applies them without a reload. */
  async updateSettings(patch: Record<string, unknown>) {
    this.settings = { ...this.settings, ...patch };
    writeFileSync(this.settingsFile, JSON.stringify(this.settings, null, 2));
  }

  /** Reloads the window, keeping its workspace and profile. */
  async reload() {
    const loaded = this.page.waitForEvent('load');
    await this.runCommand('Developer: Reload Window');
    await loaded;
    await this.waitForFoamContributions();
  }

  /** Saves a screenshot of the window under the run's results; returns its path. */
  async screenshot(name: string): Promise<string> {
    const file = path.join(this.screenshotDir, `${slug(name)}.png`);
    await this.page.screenshot({ path: file });
    console.log(`Screenshot: ${file}`);
    return file;
  }
}

/** `<results>/<test file>/<test name>`, for the test running now. */
function currentTestScreenshotDir() {
  const { testPath, currentTestName } = expect.getState();
  return path.join(
    inject('uiTestResultsDir'),
    path.basename(testPath ?? 'unknown', '.ui.ts'),
    slug(currentTestName ?? 'unknown')
  );
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
