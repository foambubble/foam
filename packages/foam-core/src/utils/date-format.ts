// User-facing configuration uses dateformat-library syntax. Internally we use
// dayjs. This map handles the named masks; the regex below handles patterns.
const DATEFORMAT_NAMED_MASKS: Record<string, string> = {
  default: 'ddd MMM DD YYYY HH:mm:ss',
  isoDate: 'YYYY-MM-DD',
  shortDate: 'M/D/YY',
  paddedShortDate: 'MM/DD/YYYY',
  mediumDate: 'MMM D, YYYY',
  longDate: 'MMMM D, YYYY',
  fullDate: 'dddd, MMMM D, YYYY',
};

/**
 * Converts a dateformat-library format string (or named mask) to a dayjs
 * format string. Handles the most common date-only tokens used in Foam configs.
 * (this is to keep compatibility with users' existing filenameFormat configs,
 * which use dateformat syntax)
 *
 * Token mapping (dateformat → dayjs):
 *   yyyy → YYYY, yy → YY
 *   mmmm → MMMM, mmm → MMM, mm → MM, m → M
 *   dddd → dddd, ddd → ddd (day names — same in both)
 *   dd → DD, d → D  (day-of-month; dateformat's 'd' ≠ dayjs 'd' which is dow)
 *   WW → WW, W → W  (ISO week number — same token in both; requires the
 *                     isoWeek + advancedFormat dayjs plugins to be loaded)
 */
export function convertDateformatToDayjs(format: string): string {
  if (DATEFORMAT_NAMED_MASKS[format]) {
    return DATEFORMAT_NAMED_MASKS[format];
  }
  return format.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|WW|W/g, token => {
    switch (token) {
      case 'yyyy':
        return 'YYYY';
      case 'yy':
        return 'YY';
      case 'mmmm':
        return 'MMMM';
      case 'mmm':
        return 'MMM';
      case 'mm':
        return 'MM';
      case 'm':
        return 'M';
      case 'dddd':
        return 'dddd';
      case 'ddd':
        return 'ddd';
      case 'dd':
        return 'DD';
      case 'd':
        return 'D';
      case 'WW':
        return 'WW'; // ISO week number, zero-padded
      case 'W':
        return 'W'; // ISO week number, unpadded
      default:
        return token;
    }
  });
}
