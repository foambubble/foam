import matter from 'gray-matter';
import { Range } from '../model/range';
import { TextEdit } from '../services/text-edit';
import { getFrontMatterRange } from './md';

export function extractFoamTemplateFrontmatterMetadata(
  contents: string
): [Map<string, string>, string] {
  let metadata = new Map<string, string>();
  // Frontmatter opens with `---` alone, so it is never in another language
  const frontMatterRange = getFrontMatterRange(contents);
  if (frontMatterRange === null) {
    return [metadata, contents];
  }
  // From its opening line, gray-matter closes the block where the parser
  // does. The empty options object busts its cache:
  // https://github.com/jonschlinkert/gray-matter/issues/124
  const parsed = matter(
    TextEdit.apply(contents, {
      range: Range.create(
        0,
        0,
        frontMatterRange.start.line,
        frontMatterRange.start.character
      ),
      newText: '',
    }),
    {}
  );

  const frontmatter = parsed.data;
  const frontmatterKeys = Object.keys(frontmatter);
  const foamMetadata = frontmatter['foam_template'];

  if (typeof foamMetadata !== 'object') {
    return [metadata, contents];
  }

  const containsFoam = foamMetadata !== undefined;
  const onlyFoam = containsFoam && frontmatterKeys.length === 1;
  metadata = new Map<string, string>(
    Object.entries((foamMetadata as object) || {})
  );

  let newContents = contents;
  if (containsFoam) {
    if (onlyFoam) {
      // We'll remove the entire frontmatter block
      newContents = parsed.content;

      // If there is another frontmatter block, we need to remove
      // the leading space left behind.
      const anotherFrontmatter = getFrontMatterRange(newContents) !== null;
      if (anotherFrontmatter) {
        newContents = newContents.trimStart();
      }
    } else {
      // We'll remove only the Foam bits
      newContents = removeFoamMetadata(contents);
    }
  }

  return [metadata, newContents];
}

export function removeFoamMetadata(contents: string) {
  return contents.replace(
    /^[ \t]*foam_template:.*?\r?\n(?:[ \t]*(?:filepath|name|description):.*\r?\n)+/gm,
    ''
  );
}
