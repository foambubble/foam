import * as https from 'https';
import { bold, dim, warning } from './colors';
import { State } from './state';

declare const __CLI_VERSION__: string;
declare const __CORE_VERSION__: string;

const NPM_PACKAGE = 'foam-cli';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NOTIFY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getCurrentVersion(): string {
  return __CLI_VERSION__;
}

export function getCoreVersion(): string {
  return __CORE_VERSION__;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [cMaj, cMin, cPat] = parse(candidate);
  const [rMaj, rMin, rPat] = parse(current);
  if (cMaj !== rMaj) return cMaj > rMaj;
  if (cMin !== rMin) return cMin > rMin;
  return cPat > rPat;
}

export function fetchLatestVersion(options: { allowProcessExit?: boolean } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://registry.npmjs.org/${NPM_PACKAGE}/latest`,
      { timeout: 5000 },
      res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (typeof data.version === 'string') {
              resolve(data.version);
            } else {
              reject(new Error('Unexpected registry response'));
            }
          } catch {
            reject(new Error('Failed to parse registry response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Registry request timed out'));
    });
    if (options.allowProcessExit) {
      // Allow the process to exit even if this request is still pending
      req.on('socket', (socket: { unref: () => void }) => socket.unref());
    }
  });
}

export function formatUpdateNotice(latestVersion: string): string {
  return (
    `\n${warning('A new release of foam-cli is available:')} ${dim(getCurrentVersion())} → ${bold(
      latestVersion
    )}\n` + `To upgrade, run: ${bold('npm install -g foam-cli@latest')}\n`
  );
}

export function checkForUpdateNotice(): string | null {
  const cache = State.readUpdateCheck();

  const shouldFetch =
    !cache || Date.now() - new Date(cache.lastChecked).getTime() > CHECK_INTERVAL_MS;

  if (shouldFetch) {
    // Fire-and-forget background refresh — never awaited
    fetchLatestVersion({ unref: true })
      .then(latestVersion => {
        State.writeUpdateCheck({
          ...cache,
          lastChecked: new Date().toISOString(),
          latestVersion,
        });
      })
      .catch(() => {
        // non-critical
      });
  }

  if (!cache || !isNewerVersion(cache.latestVersion, getCurrentVersion())) {
    return null;
  }

  // Rate-limit: show the notice at most once per NOTIFY_INTERVAL_MS, regardless
  // of how often the user invokes the CLI.
  const lastNotifiedMs = cache.lastNotified ? new Date(cache.lastNotified).getTime() : 0;
  if (Date.now() - lastNotifiedMs < NOTIFY_INTERVAL_MS) {
    return null;
  }

  State.writeUpdateCheck({
    ...cache,
    lastNotified: new Date().toISOString(),
  });

  return formatUpdateNotice(cache.latestVersion);
}
