export const DEFAULT_TITLE_MAX_LENGTH = 24;

/**
 * Shortens a node label for display. The graph model keeps full titles
 * (group rules match on them), so truncation happens only at paint time.
 * A maxLength of 0 or less disables truncation.
 */
export function truncateLabel(label: string, maxLength: number): string {
  if (maxLength > 0 && label.length > maxLength) {
    return label.substring(0, maxLength).concat('...');
  }
  return label;
}
