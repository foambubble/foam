import MarkdownIt from 'markdown-it';
import { FoamWorkspace, URI } from 'foam-core';
import { createTestNote } from '../test/test-utils';
import { markdownItWithFoamLinks } from './preview-navigation';

describe('Link generation in preview', () => {
  const noteA = createTestNote({
    uri: 'note-a.md',
    title: 'My note title',
    links: [{ slug: 'placeholder' }],
  });
  const ws = new FoamWorkspace().set(noteA);
  const md = markdownItWithFoamLinks(MarkdownIt(), ws);

  it('generates a link to a note', () => {
    expect(md.render(`[[note-a]]`)).toEqual(
      `<p><a class='foam-note-link' title='${noteA.title}' href='${URI.toFsPath(
        noteA.uri
      )}'>note-a</a></p>\n`
    );
  });

  it('generates a link to a placeholder resource', () => {
    expect(md.render(`[[placeholder]]`)).toEqual(
      `<p><a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">placeholder</a></p>\n`
    );
  });

  it('generates a placeholder link to an unknown slug', () => {
    expect(md.render(`[[random-text]]`)).toEqual(
      `<p><a class='foam-placeholder-link' title="Link to non-existing resource" href="javascript:void(0);">random-text</a></p>\n`
    );
  });
});
