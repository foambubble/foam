import { FoamTags } from '../src/model/tags';
import { createTestNote, createTestWorkspace } from './core.test';

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
        ['primary', [{ uri: pageA.uri }, { uri: pageB.uri }]],
        ['secondary', [{ uri: pageA.uri }]],
        ['third', [{ uri: pageB.uri }]],
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
    expect(tags.tags).toEqual(new Map([['primary', [{ uri: page.uri }]]]));

    const newPage = createTestNote({
      uri: '/page-b.md',
      title: 'Page B',
      tags: ['primary'],
    });

    tags.updateResourceWithinTagIndex(taglessPage, newPage);

    expect(tags.tags).toEqual(
      new Map([['primary', [{ uri: page.uri }, { uri: newPage.uri }]]])
    );
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
    expect(tags.tags).toEqual(new Map([['primary', [{ uri: page.uri }]]]));

    const pageEdited = createTestNote({
      uri: '/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['new'],
    });

    tags.updateResourceWithinTagIndex(page, pageEdited);

    expect(tags.tags).toEqual(new Map([['new', [{ uri: page.uri }]]]));
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
    expect(tags.tags).toEqual(new Map([['primary', [{ uri: page.uri }]]]));

    const pageEdited = createTestNote({
      uri: '/new-place/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary'],
    });

    tags.updateResourceWithinTagIndex(page, pageEdited);

    expect(tags.tags).toEqual(
      new Map([['primary', [{ uri: pageEdited.uri }]]])
    );
  });

  it('Updates the metadata of a tag when a note is delete', () => {
    const ws = createTestWorkspace();

    const page = createTestNote({
      uri: '/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary'],
    });
    ws.set(page);

    const tags = FoamTags.fromWorkspace(ws);
    expect(tags.tags).toEqual(new Map([['primary', [{ uri: page.uri }]]]));

    tags.removeResourceFromTagIndex(page);

    expect(tags.tags).toEqual(new Map());
  });
});
