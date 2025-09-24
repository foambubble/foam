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
        const [, target, section, alias] = this.wikilinkRegex.exec(
          link.rawText
        );

        // For wikilinks with resolved definitions, parse target and section from definition URL
        if (ResourceLink.isResolvedReference(link)) {
          const definitionUri = URI.parse(link.definition.url, 'tmp');
          return {
            target: definitionUri.path, // Base path from definition
            section: definitionUri.fragment, // Fragment from definition
            alias: alias ?? '', // Alias from rawText
          };
        }

        return {
          target: target?.replace(/\\/g, '') ?? '',
          section: section ?? '',
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
          return {
            target: definitionUri.path, // Base path from definition
            section: definitionUri.fragment, // Fragment from definition
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
            alias: alias,
          };
        }
        const [, alias, target, section] = match;
        return {
          target: target ?? '',
          section: section ?? '',
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
    const { target, section, alias } = MarkdownLink.analyzeLink(link);
    const newTarget = delta.target ?? target;
    const newSection = delta.section ?? section ?? '';
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
