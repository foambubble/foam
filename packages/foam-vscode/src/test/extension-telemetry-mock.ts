/**
 * Minimal mock of @vscode/extension-telemetry for unit tests.
 * All methods are no-ops; telemetry is not sent in tests.
 */
export class TelemetryReporter {
  constructor(_connectionString: string) {}
  sendTelemetryEvent(_name: string, _props?: Record<string, string>): void {}
  sendTelemetryErrorEvent(_name: string, _props?: Record<string, string>): void {}
  dispose(): Promise<void> { return Promise.resolve(); }
}
