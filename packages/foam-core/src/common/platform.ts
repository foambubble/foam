/**
 * Host environment detection.
 *
 * Must be safe to evaluate at module load in every runtime Foam targets:
 * Node (extension host, CLI, MCP), browsers (graph webview), and React
 * Native / Hermes (mobile), where `navigator` exists but `userAgent` is
 * undefined.
 */

const LANGUAGE_DEFAULT = 'en';

interface ProcessLike {
  platform?: string;
}

interface NavigatorLike {
  userAgent?: string;
  language?: string;
  product?: string;
}

export interface PlatformEnv {
  process?: ProcessLike;
  navigator?: NavigatorLike;
}

export interface PlatformInfo {
  isWindows: boolean;
  isMacintosh: boolean;
  isLinux: boolean;
  /** Running on Node.js (extension host, CLI, MCP server) */
  isNative: boolean;
  /** Running in a browser */
  isWeb: boolean;
  /** Running in React Native (Hermes / JSC) */
  isReactNative: boolean;
  language: string;
  userAgent: string | undefined;
}

export function detectPlatform(env: PlatformEnv): PlatformInfo {
  const info: PlatformInfo = {
    isWindows: false,
    isMacintosh: false,
    isLinux: false,
    isNative: false,
    isWeb: false,
    isReactNative: false,
    language: LANGUAGE_DEFAULT,
    userAgent: undefined,
  };

  const navigatorLike = env.navigator;
  const processLike = env.process;

  // React Native first: it polyfills both `navigator` and a minimal
  // `process`, and its navigator has no userAgent.
  if (navigatorLike?.product === 'ReactNative') {
    info.isReactNative = true;
    if (typeof navigatorLike.language === 'string') {
      info.language = navigatorLike.language;
    }
    return info;
  }

  // Node next: Node >= 21 also defines a global `navigator` (userAgent
  // "Node.js/<version>"), so checking navigator first would misclassify
  // Node as web.
  if (typeof processLike?.platform === 'string') {
    info.isNative = true;
    info.isWindows = processLike.platform === 'win32';
    info.isMacintosh = processLike.platform === 'darwin';
    info.isLinux = processLike.platform === 'linux';
    return info;
  }

  // Browser: a navigator with a string userAgent.
  if (typeof navigatorLike?.userAgent === 'string') {
    const userAgent = navigatorLike.userAgent;
    info.isWeb = true;
    info.userAgent = userAgent;
    info.isWindows =
      userAgent.indexOf('Windows') >= 0 || userAgent.indexOf('win32') >= 0;
    info.isMacintosh = userAgent.indexOf('Macintosh') >= 0;
    info.isLinux = userAgent.indexOf('Linux') >= 0;
    if (typeof navigatorLike.language === 'string') {
      info.language = navigatorLike.language;
    }
    return info;
  }

  // Unknown environment: every flag stays false, defaults apply.
  return info;
}

declare const process: ProcessLike | undefined;
declare const navigator: NavigatorLike | undefined;

const _current = detectPlatform({
  process: typeof process === 'object' ? process : undefined,
  navigator: typeof navigator === 'object' ? navigator : undefined,
});

export const isWindows = _current.isWindows;
export const isMacintosh = _current.isMacintosh;
export const isLinux = _current.isLinux;
export const isNative = _current.isNative;
export const isWeb = _current.isWeb;
export const isReactNative = _current.isReactNative;
export const userAgent = _current.userAgent;

/**
 * The language of the host environment, all lower case
 * (e.g. en, zh-tw for Traditional Chinese).
 */
export const language = _current.language;
