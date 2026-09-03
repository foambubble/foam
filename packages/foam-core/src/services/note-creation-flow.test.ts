import { Foam } from '../model/foam';
import { URI } from '../model/uri';
import { FoamWorkspace } from '../model/workspace';
import { TriggerFactory } from '../templates/note-creation-triggers';
import { Template } from '../templates/note-creation-types';
import { Resolver } from '../templates/variable-resolver';
import {
  DEFAULT_NEW_NOTE_TEXT,
  NoteCreationHooks,
  createNote,
  isNoteTargetAllowed,
} from './note-creation-flow';

const root = URI.file('/ws');

/** A markdown template as `TemplateLoader` would load it from a file. */
const markdown = (body: string, filepath?: string): Template => ({
  type: 'markdown',
  content: filepath
    ? `---\nfoam_template:\n  filepath: '${filepath}'\n---\n${body}`
    : body,
  metadata: new Map(filepath ? [['filepath', filepath]] : []),
});

/**
 * In-memory hooks: `existing` lists the files already on disk, `writes` and
 * `created` record what the flow did.
 */
function makeHooks(
  template: Template | undefined,
  overrides: Partial<NoteCreationHooks> = {},
  existing: string[] = []
) {
  const writes: [URI, string][] = [];
  const created: URI[] = [];
  const existsCalls: URI[] = [];
  const hooks: NoteCreationHooks = {
    loadTemplate: async () => template,
    fileExists: async uri => {
      existsCalls.push(uri);
      return existing.includes(uri.path);
    },
    onFileExists: async () => undefined,
    writeNote: async (uri, content) => {
      writes.push([uri, content]);
    },
    onDidCreate: async uri => {
      created.push(uri);
    },
    ...overrides,
  };
  return { hooks, writes, created, existsCalls };
}

function request(title = 'My Note', extra = {}) {
  return {
    foam: { workspace: new FoamWorkspace([root]) } as Foam,
    trigger: TriggerFactory.createCommandTrigger('foam.create-note'),
    resolver: new Resolver(new Map(), new Date(), title),
    ...extra,
  };
}

describe('createNote', () => {
  describe('template and content', () => {
    it('writes the template content at the template filepath', async () => {
      const { hooks, writes } = makeHooks(
        markdown('# ${FOAM_TITLE}\n\nbody', '/notes/${FOAM_TITLE_SAFE}.md')
      );
      const outcome = await createNote(request(), hooks);
      expect(outcome).toEqual({
        status: 'created',
        uri: root.joinPath('notes', 'My Note.md'),
      });
      expect(writes).toEqual([
        [root.joinPath('notes', 'My Note.md'), '# My Note\n\nbody'],
      ]);
    });

    it('uses the default text when no template is loaded', async () => {
      const { hooks, writes } = makeHooks(undefined);
      await createNote(
        request('Hello', { fallbackFilepath: root.joinPath('hello.md') }),
        hooks
      );
      expect(DEFAULT_NEW_NOTE_TEXT).toContain('${FOAM_TITLE}');
      expect(writes).toEqual([[root.joinPath('hello.md'), '# Hello\n\n']]);
    });

    it('uses fallbackFilepath only when the template has no filepath', async () => {
      const fallback = root.joinPath('fallback.md');
      const withPath = makeHooks(markdown('x', '/own.md'));
      await createNote(request('T', { fallbackFilepath: fallback }), withPath.hooks);
      expect(withPath.writes[0][0]).toEqual(root.joinPath('own.md'));

      const withoutPath = makeHooks(markdown('x'));
      await createNote(request('T', { fallbackFilepath: fallback }), withoutPath.hooks);
      expect(withoutPath.writes[0][0]).toEqual(fallback);
    });

    it('does not ask for a title when fallbackFilepath decides the target', async () => {
      let titleRequests = 0;
      const resolver = new Resolver(new Map(), new Date(), undefined, 'default', {
        resolveTitle: async () => {
          titleRequests++;
          return 'Prompted';
        },
        resolveSelectedText: () => '',
        resolveCurrentDir: () => '/ws',
      });
      const { hooks, writes } = makeHooks(markdown('body'));
      await createNote(
        request('', { resolver, fallbackFilepath: root.joinPath('known.md') }),
        hooks
      );
      expect(writes).toEqual([[root.joinPath('known.md'), 'body']]);
      expect(titleRequests).toBe(0);
    });

    it('resolves Foam variables in JavaScript template content', async () => {
      const template: Template = {
        type: 'javascript',
        createNote: async () => ({
          filepath: URI.parse('js.md', 'file'),
          content: '# ${FOAM_TITLE}',
        }),
      };
      const { hooks, writes } = makeHooks(template);
      await createNote(request('JS'), hooks);
      expect(writes).toEqual([[root.joinPath('js.md'), '# JS']]);
    });
  });

  describe('relative targets', () => {
    it('resolves a relative target against the first root by default', async () => {
      const { hooks, writes } = makeHooks(markdown('x', 'rel/note.md'));
      await createNote(request(), hooks);
      expect(writes[0][0]).toEqual(root.joinPath('rel', 'note.md'));
    });

    it('asks onRelativePath until it returns an absolute target', async () => {
      const asked: string[] = [];
      const { hooks, writes } = makeHooks(markdown('x', 'a.md'), {
        onRelativePath: async uri => {
          asked.push(uri.path);
          return uri.path === 'a.md'
            ? URI.parse('b.md', 'file')
            : root.joinPath('dir', uri.path);
        },
      });
      await createNote(request(), hooks);
      expect(asked).toEqual(['a.md', 'b.md']);
      expect(writes[0][0]).toEqual(root.joinPath('dir', 'b.md'));
    });

    it('returns cancelled without writing when onRelativePath returns undefined', async () => {
      const { hooks, writes, created } = makeHooks(markdown('x', 'a.md'), {
        onRelativePath: async () => undefined,
      });
      expect(await createNote(request(), hooks)).toEqual({
        status: 'cancelled',
      });
      expect(writes).toEqual([]);
      expect(created).toEqual([]);
    });
  });

  describe('existing targets', () => {
    it('asks onFileExists until it returns a free target', async () => {
      const asked: URI[] = [];
      const { hooks, writes } = makeHooks(
        markdown('x', '/a.md'),
        {
          onFileExists: async uri => {
            asked.push(uri);
            return uri.path === '/ws/a.md'
              ? root.joinPath('b.md')
              : root.joinPath('c.md');
          },
        },
        ['/ws/a.md', '/ws/b.md']
      );
      await createNote(request(), hooks);
      expect(asked).toEqual([root.joinPath('a.md'), root.joinPath('b.md')]);
      expect(writes[0][0]).toEqual(root.joinPath('c.md'));
    });

    it('returns exists without writing when onFileExists returns undefined', async () => {
      const { hooks, writes } = makeHooks(markdown('x', '/a.md'), {}, [
        '/ws/a.md',
      ]);
      expect(await createNote(request(), hooks)).toEqual({
        status: 'exists',
        uri: root.joinPath('a.md'),
      });
      expect(writes).toEqual([]);
    });

    it('re-runs relative resolution on a relative retry target', async () => {
      const { hooks, writes } = makeHooks(
        markdown('x', '/a.md'),
        { onFileExists: async () => URI.parse('sub/a.md', 'file') },
        ['/ws/a.md']
      );
      await createNote(request(), hooks);
      expect(writes[0][0]).toEqual(root.joinPath('sub', 'a.md'));
    });
  });

  describe('workspace containment', () => {
    it('rejects an absolute template filepath that escapes the workspace', async () => {
      const { hooks, writes } = makeHooks(markdown('x', '/../etc/x.md'));
      await expect(createNote(request(), hooks)).rejects.toMatchObject({
        code: 'invalid_input',
      });
      expect(writes).toEqual([]);
    });

    it('rejects a relative template filepath that escapes the workspace', async () => {
      const { hooks } = makeHooks(markdown('x', '../outside.md'));
      await expect(createNote(request(), hooks)).rejects.toMatchObject({
        code: 'invalid_input',
      });
    });

    it('rejects an absolute fallbackFilepath outside the workspace', async () => {
      const { hooks, writes } = makeHooks(undefined);
      await expect(
        createNote(
          request('shell', {
            fallbackFilepath: URI.file('/etc/cron.hourly/shell.md'),
          }),
          hooks
        )
      ).rejects.toMatchObject({ code: 'invalid_input' });
      expect(writes).toEqual([]);
    });

    it('rejects a relative fallbackFilepath that escapes the workspace', async () => {
      const { hooks } = makeHooks(undefined);
      await expect(
        createNote(
          request('shell', {
            fallbackFilepath: URI.parse('../../etc/shell.md', 'file'),
          }),
          hooks
        )
      ).rejects.toMatchObject({ code: 'invalid_input' });
    });

    it('rejects an escaping retry target before checking whether it exists', async () => {
      const { hooks, existsCalls } = makeHooks(
        markdown('x', '/a.md'),
        { onFileExists: async () => URI.file('/etc/x.md') },
        ['/ws/a.md']
      );
      await expect(createNote(request(), hooks)).rejects.toMatchObject({
        code: 'invalid_input',
      });
      expect(existsCalls).toEqual([root.joinPath('a.md')]);
    });

    it('allows a target outside the workspace when trusted', async () => {
      const { hooks, writes } = makeHooks(markdown('x', '/../elsewhere/x.md'));
      await createNote(request('T', { isTrusted: true }), hooks);
      expect(writes[0][0]).toEqual(URI.file('/elsewhere/x.md'));
    });
  });

  it('calls onDidCreate after the note is written', async () => {
    const order: string[] = [];
    const { hooks } = makeHooks(markdown('x', '/a.md'), {
      writeNote: async () => {
        order.push('write');
      },
      onDidCreate: async () => {
        order.push('didCreate');
      },
    });
    await createNote(request(), hooks);
    expect(order).toEqual(['write', 'didCreate']);
  });
});

describe('isNoteTargetAllowed', () => {
  const workspace = URI.file('/workspace');
  const otherRoot = URI.file('/other-workspace');

  describe('in a trusted workspace', () => {
    it('allows a target inside the workspace', () => {
      expect(
        isNoteTargetAllowed(URI.file('/workspace/note.md'), [workspace], true)
      ).toBe(true);
    });

    it('allows a target outside the workspace', () => {
      // Trusting the workspace is the deliberate opt-in: templates are the
      // user's own, and filing a note into a sibling directory is a
      // legitimate thing to want.
      expect(
        isNoteTargetAllowed(URI.file('/elsewhere/note.md'), [workspace], true)
      ).toBe(true);
    });
  });

  describe('in an untrusted workspace', () => {
    it('allows a target inside the workspace', () => {
      expect(
        isNoteTargetAllowed(URI.file('/workspace/note.md'), [workspace], false)
      ).toBe(true);
    });

    it('allows a target nested deeper inside the workspace', () => {
      expect(
        isNoteTargetAllowed(
          URI.file('/workspace/journal/2026/note.md'),
          [workspace],
          false
        )
      ).toBe(true);
    });

    it('denies a target that escapes the workspace', () => {
      // This is the resolved form of a template `filepath: ../../etc/foo.md`
      // once `posix.join` has normalized the traversal away.
      expect(
        isNoteTargetAllowed(URI.file('/etc/foo.md'), [workspace], false)
      ).toBe(false);
    });

    it('denies a sibling directory that merely shares the root prefix', () => {
      expect(
        isNoteTargetAllowed(
          URI.file('/workspace-evil/note.md'),
          [workspace],
          false
        )
      ).toBe(false);
    });

    it('allows a target inside any root of a multi-root workspace', () => {
      expect(
        isNoteTargetAllowed(
          URI.file('/other-workspace/note.md'),
          [workspace, otherRoot],
          false
        )
      ).toBe(true);
    });

    it('denies a target outside every root of a multi-root workspace', () => {
      expect(
        isNoteTargetAllowed(
          URI.file('/elsewhere/note.md'),
          [workspace, otherRoot],
          false
        )
      ).toBe(false);
    });
  });
});
