import matter from 'gray-matter';

export function extractFoamTemplateFrontmatterMetadata(
  contents: string
): [Map<string, string>, string] {
  // Need to pass in empty options object, in order to bust a cache
  // See https://github.com/jonschlinkert/gray-matter/issues/124
  const parsed = matter(contents, {});
  let metadata = new Map<string, string>();

  if (parsed.language !== 'yaml') {
    // We might allow this in the future, once it has been tested adequately.
    // But for now we'll be safe and prevent people from using anything else.
    return [metadata, contents];
  }

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
      const anotherFrontmatter = matter(newContents.trimStart()).matter !== '';
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
    /^\s*foam_template:.*?\n(?:\s*(?:filepath|name|description):.*\n)+/gm,
    ''
  );
}
