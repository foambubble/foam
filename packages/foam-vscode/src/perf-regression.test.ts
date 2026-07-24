import { definePerfRegressionSuite } from '../../../scripts/perf/regression-suite.mjs';
import { PERF_CURRENT, PERF_BASELINE } from './perf-paths';

// Perf gate for foam-vscode: baseline comparison (cross-run) + scaling shape
// (intra-run). Both read the one `yarn bench` JSON. See scripts/perf/.
definePerfRegressionSuite({ current: PERF_CURRENT, baseline: PERF_BASELINE });
