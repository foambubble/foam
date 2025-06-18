/**
 * Helper function for intelligent pluralization
 * 
 * @param count - The count to determine singular or plural form
 * @param singular - The singular form of the word
 * @param plural - The plural form of the word (optional, defaults to singular + 's')
 * @returns Formatted string with count and appropriate word form
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return `${count} ${singular}`;
  }
  return `${count} ${plural || singular + 's'}`;
}
