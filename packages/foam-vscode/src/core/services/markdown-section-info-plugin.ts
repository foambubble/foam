import { PluginSimple } from 'markdown-it';

export interface SectionInfo {
  id: string; // slug or block ID (no caret)
  blockId?: string; // caret-prefixed block ID, if present
  isHeading: boolean;
  label: string;
  line: number;
}

export const sectionInfoPlugin: PluginSimple = md => {
  md.core.ruler.push('section_info', state => {
    const tokens = state.tokens;
    const sections: SectionInfo[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      // Headings
      if (t.type === 'heading_open') {
        const content = tokens[i + 1]?.content || '';
        const slug = content
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
        // Look for block ID in the heading line
        const match = content.match(/\^(\S+)/);
        const blockId = match ? match[1] : undefined;
        sections.push({
          id: slug,
          blockId: blockId ? `^${blockId}` : undefined,
          isHeading: true,
          label: content,
          line: t.map ? t.map[0] : -1,
        });
      }
      // Block IDs in paragraphs, list items, etc.
      if (t.type === 'inline' && t.content) {
        const match = t.content.match(/\^(\S+)/);
        if (match) {
          sections.push({
            id: match[1],
            blockId: `^${match[1]}`,
            isHeading: false,
            label: t.content,
            line: t.map ? t.map[0] : -1,
          });
        }
      }
    }
    // Attach to env for downstream use
    (state.env as any).sections = sections;
  });
};
