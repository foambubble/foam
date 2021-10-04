/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// taken from https://github.com/microsoft/vscode/tree/master/src/vs/base/common

const LANGUAGE_DEFAULT = 'en';

let _isWindows = false;
let _isMacintosh = false;
let _isLinux = false;
let _isNative = false;
let _isWeb = false;
let _isIOS = false;
let _locale: string | undefined = undefined;
let _language: string = LANGUAGE_DEFAULT;
let _translationsConfigFile: string | undefined = undefined;
let _userAgent: string | undefined = undefined;

interface NLSConfig {
  locale: string;
  availableLanguages: { [key: string]: string };
  _translationsConfigFile: string;
}

export interface IProcessEnvironment {
  [key: string]: string;
}

export interface INodeProcess {
  platform: 'win32' | 'linux' | 'darwin';
  env: IProcessEnvironment;
  nextTick: Function;
  versions?: {
    electron?: string;
  };
  sandboxed?: boolean; // Electron
  type?: string;
  cwd(): string;
}
declare const process: INodeProcess;
declare const global: any;

interface INavigator {
  userAgent: string;
  language: string;
  maxTouchPoints?: number;
}
declare const navigator: INavigator;
declare const self: any;

const _globals =
  typeof self === 'object'
    ? self
    : typeof global === 'object'
    ? global
    : ({} as any);

let nodeProcess: INodeProcess | undefined = undefined;
if (typeof process !== 'undefined') {
  // Native environment (non-sandboxed)
  nodeProcess = process;
} else if (typeof _globals.vscode !== 'undefined') {
  // Native environment (sandboxed)
  nodeProcess = _globals.vscode.process;
}

const isElectronRenderer =
  typeof nodeProcess?.versions?.electron === 'string' &&
  nodeProcess.type === 'renderer';
export const isElectronSandboxed = isElectronRenderer && nodeProcess?.sandboxed;

// Web environment
if (typeof navigator === 'object' && !isElectronRenderer) {
  _userAgent = navigator.userAgent;
  _isWindows =
    _userAgent.indexOf('Windows') >= 0 || _userAgent.indexOf('win32') >= 0;
  _isMacintosh = _userAgent.indexOf('Macintosh') >= 0;
  _isIOS =
    (_userAgent.indexOf('Macintosh') >= 0 ||
      _userAgent.indexOf('iPad') >= 0 ||
      _userAgent.indexOf('iPhone') >= 0) &&
    !!navigator.maxTouchPoints &&
    navigator.maxTouchPoints > 0;
  _isLinux = _userAgent.indexOf('Linux') >= 0;
  _isWeb = true;
  _locale = navigator.language;
  _language = _locale;
}

// Native environment
else if (typeof nodeProcess === 'object') {
  _isWindows = nodeProcess.platform === 'win32';
  _isMacintosh = nodeProcess.platform === 'darwin';
  _isLinux = nodeProcess.platform === 'linux';
  _locale = LANGUAGE_DEFAULT;
  _language = LANGUAGE_DEFAULT;
  const rawNlsConfig = nodeProcess.env['VSCODE_NLS_CONFIG'];
  if (rawNlsConfig) {
    try {
      const nlsConfig: NLSConfig = JSON.parse(rawNlsConfig);
      const resolved = nlsConfig.availableLanguages['*'];
      _locale = nlsConfig.locale;
      // VSCode's default language is 'en'
      _language = resolved ? resolved : LANGUAGE_DEFAULT;
      _translationsConfigFile = nlsConfig._translationsConfigFile;
    } catch (e) {}
  }
  _isNative = true;
}

// Unknown environment
else {
  console.error('Unable to resolve platform.');
}

export const enum Platform {
  Web,
  Mac,
  Linux,
  Windows,
}
export function PlatformToString(platform: Platform) {
  switch (platform) {
    case Platform.Web:
      return 'Web';
    case Platform.Mac:
      return 'Mac';
    case Platform.Linux:
      return 'Linux';
    case Platform.Windows:
      return 'Windows';
  }
}

let _platform: Platform = Platform.Web;
if (_isMacintosh) {
  _platform = Platform.Mac;
} else if (_isWindows) {
  _platform = Platform.Windows;
} else if (_isLinux) {
  _platform = Platform.Linux;
}

export const isWindows = _isWindows;
export const isMacintosh = _isMacintosh;
export const isLinux = _isLinux;
export const isNative = _isNative;
export const isWeb = _isWeb;
export const isIOS = _isIOS;
export const platform = _platform;
export const userAgent = _userAgent;

/**
 * The language used for the user interface. The format of
 * the string is all lower case (e.g. zh-tw for Traditional
 * Chinese)
 */
export const language = _language;

export namespace Language {
  export function value(): string {
    return language;
  }

  export function isDefaultVariant(): boolean {
    if (language.length === 2) {
      return language === 'en';
    } else if (language.length >= 3) {
      return language[0] === 'e' && language[1] === 'n' && language[2] === '-';
    } else {
      return false;
    }
  }

  export function isDefault(): boolean {
    return language === 'en';
  }
}

/**
 * The OS locale or the locale specified by --locale. The format of
 * the string is all lower case (e.g. zh-tw for Traditional
 * Chinese). The UI is not necessarily shown in the provided locale.
 */
export const locale = _locale;

/**
 * The translatios that are available through language packs.
 */
export const translationsConfigFile = _translationsConfigFile;

export const globals: any = _globals;

interface ISetImmediate {
  (callback: (...args: any[]) => void): void;
}
