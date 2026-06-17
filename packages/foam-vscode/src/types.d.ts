import { ExtensionContext } from 'vscode';
import markdownit from 'markdown-it';
import { Foam } from './core/model/foam';

/**
 * Optional contributions a feature can return at activation time. The
 * extension entrypoint aggregates these across all features:
 * - `extendMarkdownIt` is composed left-to-right and exposed on the public
 *   `extendMarkdownIt` extension export.
 * - `telemetry` keys are merged into the once-per-session `workspace-stats`
 *   event. Values are already-bucketed strings; key collisions across
 *   features last-write-win (caught at PR review).
 */
export interface FoamFeatureResult {
  extendMarkdownIt?: (md: markdownit) => markdownit;
  telemetry?: Record<string, string>;
}

export type FoamFeature = (
  context: ExtensionContext,
  foamPromise: Promise<Foam>
) => Promise<FoamFeatureResult | void> | FoamFeatureResult | void;
