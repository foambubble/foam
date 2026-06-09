/**
 * Minimal mock of @vscode/extension-telemetry for unit tests.
 * All methods are no-ops; telemetry is not sent in tests.
 */
export class TelemetryReporter {
  constructor(
    _connectionString: string,
    _replacementOptions?: unknown,
    _initializationOptions?: unknown,
    _customFetcher?: unknown,
    _appInsightsOptions?: unknown
  ) {}
  sendTelemetryEvent(_name: string, _props?: Record<string, string>): void {}
  sendTelemetryErrorEvent(_name: string, _props?: Record<string, string>): void {}
  dispose(): Promise<void> { return Promise.resolve(); }
}
