import { detectPlatform, isNative, isWeb, isWindows } from './platform';

describe('detectPlatform', () => {
  it('classifies a Node.js environment from process.platform', () => {
    const info = detectPlatform({
      process: { platform: 'darwin' },
    });
    expect(info.isMacintosh).toBe(true);
    expect(info.isWindows).toBe(false);
    expect(info.isLinux).toBe(false);
    expect(info.isNative).toBe(true);
    expect(info.isWeb).toBe(false);
    expect(info.isReactNative).toBe(false);
  });

  it('classifies Windows and Linux Node.js environments', () => {
    expect(detectPlatform({ process: { platform: 'win32' } }).isWindows).toBe(
      true
    );
    expect(detectPlatform({ process: { platform: 'linux' } }).isLinux).toBe(
      true
    );
  });

  it('prefers Node classification when both process and navigator exist (Node >= 21 defines navigator)', () => {
    // Node 21+ ships a global navigator with userAgent "Node.js/21"; it must
    // still be classified as native, not web.
    const info = detectPlatform({
      process: { platform: 'win32' },
      navigator: { userAgent: 'Node.js/22' },
    });
    expect(info.isNative).toBe(true);
    expect(info.isWeb).toBe(false);
    expect(info.isWindows).toBe(true);
  });

  it('classifies a browser environment from navigator.userAgent', () => {
    const info = detectPlatform({
      navigator: {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        language: 'en-GB',
      },
    });
    expect(info.isWeb).toBe(true);
    expect(info.isMacintosh).toBe(true);
    expect(info.isNative).toBe(false);
    expect(info.isReactNative).toBe(false);
    expect(info.language).toBe('en-GB');
  });

  it('classifies React Native via navigator.product without crashing on missing userAgent', () => {
    // React Native (Hermes) provides a navigator object whose userAgent is
    // undefined; reading userAgent.indexOf would crash at module load.
    const info = detectPlatform({
      navigator: { product: 'ReactNative' },
    });
    expect(info.isReactNative).toBe(true);
    expect(info.isWeb).toBe(false);
    expect(info.isNative).toBe(false);
    expect(info.isWindows).toBe(false);
  });

  it('classifies React Native even when a process-like global is present', () => {
    // RN polyfills a minimal process global; ReactNative detection must win.
    const info = detectPlatform({
      process: {},
      navigator: { product: 'ReactNative' },
    });
    expect(info.isReactNative).toBe(true);
    expect(info.isNative).toBe(false);
  });

  it('does not crash on a navigator object with no userAgent and no product', () => {
    const info = detectPlatform({ navigator: {} });
    expect(info.isWeb).toBe(false);
    expect(info.isNative).toBe(false);
    expect(info.isReactNative).toBe(false);
  });

  it('returns safe defaults in an unknown environment', () => {
    const info = detectPlatform({});
    expect(info.isWindows).toBe(false);
    expect(info.isMacintosh).toBe(false);
    expect(info.isLinux).toBe(false);
    expect(info.isWeb).toBe(false);
    expect(info.isNative).toBe(false);
    expect(info.isReactNative).toBe(false);
    expect(info.language).toBe('en');
  });
});

describe('platform module evaluation', () => {
  it('exposes boolean platform flags computed from the real environment', () => {
    // The test runner is Node, so the module-level constants must classify
    // this environment as native.
    expect(typeof isWindows).toBe('boolean');
    expect(isNative).toBe(true);
    expect(isWeb).toBe(false);
  });
});
