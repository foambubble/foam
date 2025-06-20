// Based on https://github.com/svsool/vscode-memo/blob/master/src/test/config/jestSetup.ts
import { Logger, ConsoleLogger } from '../../core/utils/log';

jest.mock('vscode', () => (global as any).vscode, { virtual: true });

// Revert to default ConsoleLogger for tests
Logger.setDefaultLogger(new ConsoleLogger());
Logger.setLevel('debug'); // Ensure debug logs are visible in test output
