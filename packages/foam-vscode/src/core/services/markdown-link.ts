import { ResourceLink } from '../model/note';
import { URI } from '../model/uri';
import { TextEdit } from './text-edit';

export abstract class MarkdownLink {
  private static wikilinkRegex = new RegExp(
    /\[\[([^#|]+)?#?([^|]+)?\|?(.*)?\]\]/
  );
  private static directLinkRegex = new RegExp(
    /\[(.*)\]\(<?([^#>]*?)(?:#([^>\s"'()]*))?(?:\s+(?:"[^"]*"|'[^']*'))?>?\)/
  );

  public static analyzeLink(link: ResourceLink) {
    try {
      if (link.type === 'wikilink') {
        // Wikilinks are always parsed from rawText. Any resolved definition is a
        // Foam-generated rendering artifact, not authoritative content — the user's
        // intent is expressed by the wikilink identifier itself.
        const [, target, section, alias] = this.wikilinkRegex.exec(
          link.rawText
        );
        // A fragment starting with ^ is a block anchor (e.g. #^myblock), not a section
        const blockMatch = section?.match(/^\^([a-zA-Z0-9-]+)$/);
        return {
          target: target?.replace(/\\/g, '') ?? '',
          section: blockMatch ? '' : section ?? '',
          blockId: blockMatch?.[1] ?? '',
          alias: alias ?? '',
        };
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
        const [, alias, target, section] = match;
        const blockMatch = section?.match(/^\^([a-zA-Z0-9-]+)$/);
        return {
          target: target ?? '',
          section: blockMatch ? '' : section ?? '',
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
        newTarget.indexOf(' ') > 0 || newSection.indexOf(' ') > 0;
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
