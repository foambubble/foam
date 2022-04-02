import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { FoamTags } from './tags';

describe('FoamTags', () => {
  it('Collects tags from a list of resources', () => {
    const ws = createTestWorkspace();

    const pageA = createTestNote({
      uri: '/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary', 'secondary'],
    });

    const pageB = createTestNote({
      uri: '/page-b.md',
      title: 'Page B',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary', 'third'],
    });

    ws.set(pageA);
    ws.set(pageB);

    const tags = FoamTags.fromWorkspace(ws);

    expect(tags.tags).toEqual(
      new Map([
        ['primary', [pageA.uri, pageB.uri]],
        ['secondary', [pageA.uri]],
        ['third', [pageB.uri]],
      ])
    );
  });

  it('Updates an existing tag when a note is tagged with an existing tag', () => {
    const ws = createTestWorkspace();

    const page = createTestNote({
      uri: '/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary'],
    });
    const taglessPage = createTestNote({
      uri: '/page-b.md',
      title: 'Page B',
    });

    ws.set(page);
    ws.set(taglessPage);

    const tags = FoamTags.fromWorkspace(ws);
    expect(tags.tags).toEqual(new Map([['primary', [page.uri]]]));

    const newPage = createTestNote({
      uri: '/page-b.md',
      title: 'Page B',
      tags: ['primary'],
    });

    ws.set(newPage);
    tags.update();

    expect(tags.tags).toEqual(new Map([['primary', [page.uri, newPage.uri]]]));
  });

  it('Replaces the tag when a note is updated with an altered tag', () => {
    const ws = createTestWorkspace();

    const page = createTestNote({
      uri: '/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary'],
    });

    ws.set(page);

    const tags = FoamTags.fromWorkspace(ws);
    expect(tags.tags).toEqual(new Map([['primary', [page.uri]]]));

    const pageEdited = createTestNote({
      uri: '/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['new'],
    });

    ws.set(pageEdited);
    tags.update();

    expect(tags.tags).toEqual(new Map([['new', [page.uri]]]));
  });

  it('Updates the metadata of a tag when the note is moved', () => {
    const ws = createTestWorkspace();

    const page = createTestNote({
      uri: '/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary'],
    });
    ws.set(page);

    const tags = FoamTags.fromWorkspace(ws);
    expect(tags.tags).toEqual(new Map([['primary', [page.uri]]]));

    const pageEdited = createTestNote({
      uri: '/new-place/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary'],
    });

    ws.delete(page.uri);
    ws.set(pageEdited);
    tags.update();

    expect(tags.tags).toEqual(new Map([['primary', [pageEdited.uri]]]));
  });

  it('Updates the metadata of a tag when a note is deleted', () => {
    const ws = createTestWorkspace();

    const page = createTestNote({
      uri: '/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary'],
    });
    ws.set(page);

    const tags = FoamTags.fromWorkspace(ws);
    expect(tags.tags).toEqual(new Map([['primary', [page.uri]]]));

    ws.delete(page.uri);
    tags.update();

    expect(tags.tags).toEqual(new Map());
  });
});
