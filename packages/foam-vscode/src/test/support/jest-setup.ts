// Based on https://github.com/svsool/vscode-memo/blob/master/src/test/config/jestSetup.ts
jest.mock('vscode', () => (global as any).vscode, { virtual: true });
