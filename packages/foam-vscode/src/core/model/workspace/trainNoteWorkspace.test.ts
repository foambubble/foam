import {
  createTestNote,
  createTestTrainNote,
  createTestWorkspace,
} from '../../../test/test-utils';
import { Phase } from '.././phase';
import { TrainNoteWorkspace } from './trainNoteWorkspace';
import { URI } from '.././uri';

describe('Synced trie', () => {
  it('Added', () => {
    const ws = createTestWorkspace();
    ws.set(createTestTrainNote({ uri: '/page-a.md' }));
    ws.set(createTestTrainNote({ uri: '/page-c.md' }));
    ws.set(createTestNote({ uri: '/page-b.md' }));

    expect(
      ws.trainNoteWorkspace
        .list()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/page-a.md', '/page-c.md']);
  });

  it('Updated', () => {
    const ws = createTestWorkspace();
    ws.set(createTestTrainNote({ uri: '/page-a.md', title: 'foo' }));
    ws.set(createTestTrainNote({ uri: '/page-c.md', title: 'bar' }));
    ws.set(createTestNote({ uri: '/page-b.md', title: 'Fred' }));

    ws.set(createTestTrainNote({ uri: '/page-c.md', title: 'Mani' }));

    expect(
      ws.trainNoteWorkspace
        .list()
        .map(n => ({ path: n.uri.path, title: n.title }))
        .sort((a, b) => a.path.localeCompare(b.path))
    ).toEqual([
      { path: '/page-a.md', title: 'foo' },
      { path: '/page-c.md', title: 'Mani' },
    ]);
  });

  it('Deleted', () => {
    const ws = createTestWorkspace();
    ws.set(createTestTrainNote({ uri: '/page-a.md' }));

    ws.set(createTestTrainNote({ uri: '/page-c.md' }));
    ws.set(createTestNote({ uri: '/page-b.md' }));
    ws.delete(URI.parse('/page-a.md', null));

    expect(
      ws.trainNoteWorkspace
        .list()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/page-c.md']);
  });
});

describe('validate Trainnote', () => {
  it('validation Check', () => {
    const ws = createTestWorkspace();
    const trainNote = createTestTrainNote({ uri: '/page-a.md' });
    expect(trainNote.currentPhase).toBeUndefined();

    ws.set(trainNote);
    expect(ws.trainNoteWorkspace.list()[0].currentPhase.name).toBe('Phase 1');
  });
});

describe('time filter', () => {
  it('today', () => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    expect(TrainNoteWorkspace.isToday(tomorrow)).toBeFalsy();
    expect(TrainNoteWorkspace.isToday(today)).toBeTruthy();
  });

  it('late', () => {
    const today = new Date();
    const tomorrow = new Date();
    const yesterday = new Date();
    const lastYear = new Date();

    tomorrow.setDate(today.getDate() + 1);
    yesterday.setDate(today.getDate() - 1);
    lastYear.setDate(today.getDate() - 360);

    expect(TrainNoteWorkspace.isLate(tomorrow)).toBeFalsy();
    expect(TrainNoteWorkspace.isLate(yesterday)).toBeTruthy();
    expect(TrainNoteWorkspace.isLate(today)).toBeFalsy();
    expect(TrainNoteWorkspace.isLate(lastYear)).toBeTruthy();
  });

  it('Trainotes for today', () => {
    const ws = createTestWorkspace();

    const tomorrow = new Date();
    const yesterday = new Date();
    tomorrow.setDate(new Date().getDate() + 2);
    yesterday.setDate(new Date().getDate() - 1);

    ws.set(
      createTestTrainNote({
        uri: '/page-a.md',
        nextReminder: tomorrow,
        currentPhase: new Phase('Test', 2),
      })
    );
    ws.set(
      createTestTrainNote({
        uri: '/page-b.md',
        nextReminder: new Date(),
        currentPhase: new Phase('Test', 2),
      })
    );
    ws.set(
      createTestTrainNote({
        uri: '/page-c.md',
        nextReminder: yesterday,
        currentPhase: new Phase('Test', 2),
      })
    );

    expect(
      ws.trainNoteWorkspace
        .today()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/page-b.md']);
  });

  it('late Trainotes', () => {
    const today = new Date();
    const tomorrow = new Date();
    const lastYear = new Date();
    const ws = createTestWorkspace();

    tomorrow.setDate(today.getDate() + 1);
    lastYear.setDate(today.getDate() - 360);

    ws.set(
      createTestTrainNote({
        uri: '/page-a.md',
        nextReminder: tomorrow,
        currentPhase: new Phase('Test', 2),
      })
    );
    ws.set(
      createTestTrainNote({
        uri: '/page-b.md',
        nextReminder: today,
        currentPhase: new Phase('Test', 2),
      })
    );
    ws.set(
      createTestTrainNote({
        uri: '/page-c.md',
        nextReminder: lastYear,
        currentPhase: new Phase('Test', 2),
      })
    );

    expect(
      ws.trainNoteWorkspace
        .late()
        .map(n => n.uri.path)
        .sort()
    ).toEqual(['/page-c.md']);
  });
});
