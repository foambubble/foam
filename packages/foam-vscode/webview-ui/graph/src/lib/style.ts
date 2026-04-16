import type { StylePayload } from '../protocol';
import type { ResolvedStyle } from './types';

/**
 * Merges two StylePayloads, with `patch` taking precedence over `base`.
 */
export function mergeStylePayloads(
  base: StylePayload | null,
  patch: StylePayload
): StylePayload {
  return {
    ...base,
    ...patch,
    style: { ...base?.style, ...patch?.style },
  };
}

/**
 * Resolves a StylePayload into a fully-populated ResolvedStyle by merging
 * user-supplied values on top of the provided defaults.
 */
export function resolveStyle(
  payload: StylePayload | null,
  defaults: ResolvedStyle
): ResolvedStyle {
  if (!payload) return defaults;
  return {
    ...defaults,
    ...payload.style,
    lineColor:
      payload.style?.lineColor ||
      payload.style?.node?.note ||
      defaults.lineColor,
    node: {
      ...defaults.node,
      ...payload.style?.node,
    },
    colorMode: payload.colorMode ?? defaults.colorMode,
    groups: payload.groups ?? defaults.groups,
  };
}
