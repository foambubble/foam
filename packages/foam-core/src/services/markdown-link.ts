import { ResourceLink } from '../model/note';
import { URI } from '../model/uri';
import { TextEdit } from './text-edit';

/**
 * Splits `[[target#section|alias]]`. The wikilink runs from the first `[[` to
 * the last `]]`; the target stops at the first `#` or `|`, the section at the
 * first `|`.
 */
function parseWikilink(text: string) {
  const open = text.indexOf('[[');
  const close = text.lastIndexOf(']]');
  if (open < 0 || close < open + 2) {
    return undefined;
  }
  const inner = text.slice(open + 2, close);
  const pipe = inner.indexOf('|');
  const reference = pipe < 0 ? inner : inner.slice(0, pipe);
  const hash = reference.indexOf('#');
  return {
    target: hash < 0 ? reference : reference.slice(0, hash),
    section: hash < 0 ? '' : reference.slice(hash + 1),
    alias: pipe < 0 ? '' : inner.slice(pipe + 1),
  };
}

export abstract class MarkdownLink {
  private static directLinkRegex = new RegExp(
    /\[(.*)\]\((?:<([^#>]*)(?:#([^>]*))?>\s*|([^#>]*?)(?:#([^)>"']*))?(?:\s+(?:"[^"]*"|'[^']*'))?)\)/
  );

  public static analyzeLink(link: ResourceLink) {
    try {
      if (link.type === 'wikilink') {
        // Wikilinks are always parsed from rawText. Any resolved definition is a
        // Foam-generated rendering artifact, not authoritative content — the user's
        // intent is expressed by the wikilink identifier itself.
        const wikilink = parseWikilink(link.rawText);
        if (!wikilink) {
          throw new Error('No wikilink found');
        }
        const { target, section, alias } = wikilink;
        // A fragment starting with ^ is a block anchor (e.g. #^myblock), not a section
        const blockMatch = section.match(/^\^([a-zA-Z0-9-]+)$/);
        return {
          target: target.replace(/\\/g, ''),
          section: blockMatch ? '' : section,
          blockId: blockMatch?.[1] ?? '',
          alias,
        };
      }
      if (link.type === 'external') {
        const url =
          typeof link.definition === 'string'
            ? link.definition
            : ResourceLink.isResolvedReference(link)
              ? link.definition.url
              : link.rawText;
        return { target: url, section: '', blockId: '', alias: '' };
      }
      if (link.type === 'link') {
        // For reference-style links with resolved definitions, parse target and section from definition URL
        if (ResourceLink.isResolvedReference(link)) {
          // Extract alias from rawText for reference-style links
          const referenceMatch = /^\[([^\]]*)\]/.exec(link.rawText);
          const alias = referenceMatch ? referenceMatch[1] : '';

          // Parse target and section from definition URL
          const definitionUri = URI.parse(link.definition.url, 'tmp');
          const defFragment = definitionUri.fragment;
          const defBlockMatch = defFragment?.match(/^\^([a-zA-Z0-9-]+)$/);
          return {
            target: definitionUri.path, // Base path from definition
            section: defBlockMatch ? '' : defFragment ?? '',
            blockId: defBlockMatch?.[1] ?? '',
            alias: alias, // Alias from rawText
          };
        }

        const match = this.directLinkRegex.exec(link.rawText);
        if (!match) {
          // This might be a reference-style link that wasn't resolved
          // Try to extract just the alias text for reference-style links
          const referenceMatch = /^\[([^\]]*)\]/.exec(link.rawText);
          const alias = referenceMatch ? referenceMatch[1] : '';
          return {
            target: '',
            section: '',
            blockId: '',
            alias: alias,
          };
        }
        const [, alias, angleTarget, angleSection, plainTarget, plainSection] =
          match;
        const target = angleTarget ?? plainTarget ?? '';
        const section = angleSection ?? plainSection ?? '';
        const blockMatch = section?.match(/^\^([a-zA-Z0-9-]+)$/);
        return {
          target,
          section: blockMatch ? '' : section,
          blockId: blockMatch?.[1] ?? '',
          alias: alias ?? '',
        };
      }
      throw new Error(`Link of type ${link.type} is not supported`);
    } catch (e) {
      throw new Error(`Couldn't parse link ${link.rawText} - ${e}`);
    }
  }

  public static createUpdateLinkEdit(
    link: ResourceLink,
    delta: {
      target?: string;
      section?: string;
      alias?: string;
      type?: 'wikilink' | 'link';
      isEmbed?: boolean;
    }
  ): TextEdit {
    if (link.type === 'external') {
      throw new Error('Cannot update an external link');
    }
    const { target, section, blockId, alias } = MarkdownLink.analyzeLink(link);
    const newTarget = delta.target ?? target;
    // Preserve the existing fragment (section or block anchor) when not overriding.
    const existingFragment = blockId ? `^${blockId}` : section;
    const newSection = delta.section ?? existingFragment ?? '';
    const newAlias = delta.alias ?? alias ?? '';
    const sectionDivider = newSection ? '#' : '';
    const aliasDivider = newAlias ? '|' : '';
    const embed = delta.isEmbed ?? link.isEmbed ? '!' : '';
    const type = delta.type ?? link.type;
    if (type === 'wikilink') {
      return {
        newText: `${embed}[[${newTarget}${sectionDivider}${newSection}${aliasDivider}${newAlias}]]`,
        range: link.range,
      };
    }
    if (type === 'link') {
      const defaultAlias = () => {
        return `${newTarget}${sectionDivider}${newSection}`;
      };
      const useAngles =
        newTarget.includes(' ') || newSection.includes(' ');
      return {
        newText: `${embed}[${newAlias ? newAlias : defaultAlias()}](${
          useAngles ? '<' : ''
        }${newTarget}${sectionDivider}${newSection}${useAngles ? '>' : ''})`,
        range: link.range,
      };
    }
    throw new Error(`Unexpected state: link of type ${type} is not supported`);
  }
}
