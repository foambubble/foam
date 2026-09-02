import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { FoamTags } from './tags';
import { Location } from './location';

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
        [
          'primary',
          [
            Location.forObjectWithRange(pageA.uri, pageA.tags[0]),
            Location.forObjectWithRange(pageB.uri, pageB.tags[0]),
          ],
        ],
        ['secondary', [Location.forObjectWithRange(pageA.uri, pageA.tags[1])]],
        ['third', [Location.forObjectWithRange(pageB.uri, pageB.tags[1])]],
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
    expect(tags.tags).toEqual(
      new Map([
        ['primary', [Location.forObjectWithRange(page.uri, page.tags[0])]],
      ])
    );

    const newPage = createTestNote({
      uri: '/page-b.md',
      title: 'Page B',
      tags: ['primary'],
    });

    ws.set(newPage);
    tags.update();

    expect(tags.tags).toEqual(
      new Map([
        [
          'primary',
          [
            Location.forObjectWithRange(page.uri, page.tags[0]),
            Location.forObjectWithRange(newPage.uri, newPage.tags[0]),
          ],
        ],
      ])
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
    expect(tags.tags).toEqual(
      new Map([
        ['primary', [Location.forObjectWithRange(page.uri, page.tags[0])]],
      ])
    );

    const pageEdited = createTestNote({
      uri: '/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['new'],
    });

    ws.set(pageEdited);
    tags.update();

    expect(tags.tags).toEqual(
      new Map([
        [
          'new',
          [Location.forObjectWithRange(pageEdited.uri, pageEdited.tags[0])],
        ],
      ])
    );
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
    expect(tags.tags).toEqual(
      new Map([
        ['primary', [Location.forObjectWithRange(page.uri, page.tags[0])]],
      ])
    );

    const pageEdited = createTestNote({
      uri: '/new-place/page-a.md',
      title: 'Page A',
      links: [{ slug: 'placeholder-link' }],
      tags: ['primary'],
    });

    ws.delete(page.uri);
    ws.set(pageEdited);
    tags.update();

    expect(tags.tags).toEqual(
      new Map([
        [
          'primary',
          [Location.forObjectWithRange(pageEdited.uri, pageEdited.tags[0])],
        ],
      ])
    );
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
    expect(tags.tags).toEqual(
      new Map([
        ['primary', [Location.forObjectWithRange(page.uri, page.tags[0])]],
      ])
    );

    ws.delete(page.uri);
    tags.update();

    expect(tags.tags.size).toEqual(0);
  });

  it('Honors the debounceFor parameter when monitoring', async () => {
    const ws = createTestWorkspace();
    const tags = FoamTags.fromWorkspace(ws, true, 50);

    ws.set(createTestNote({ uri: '/page-a.md', tags: ['primary'] }));
    // The update is debounced, so it must not have been applied yet
    expect(tags.tags.size).toEqual(0);

    // 150ms is comfortably past the requested 50ms debounce, and well below
    // the 500ms the implementation used to hardcode regardless of the parameter
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(tags.tags.has('primary')).toBe(true);

    tags.dispose();
  });

  it('Stops notifying listeners once disposed', () => {
    const ws = createTestWorkspace();
    ws.set(createTestNote({ uri: '/page-a.md', tags: ['primary'] }));
    const tags = FoamTags.fromWorkspace(ws, true);

    let notified = false;
    tags.onDidUpdate(() => (notified = true));

    tags.dispose();
    ws.set(createTestNote({ uri: '/page-b.md', tags: ['secondary'] }));
    tags.update();

    expect(notified).toBe(false);
  });
});
