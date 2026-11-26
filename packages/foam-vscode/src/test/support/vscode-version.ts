/** The VS Code build the e2e and UI test tiers download and run. */
export const VSCODE_TEST_VERSION = '1.136.0';

/** `@vscode/test-electron`'s name for this machine's VS Code build. */
export function getVSCodePlatform(): string {
  switch (process.platform) {
    case 'darwin':
      return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin';
    case 'win32':
      return process.arch === 'arm64'
        ? 'win32-arm64-archive'
        : 'win32-x64-archive';
    default: // linux
      return process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  }
}
