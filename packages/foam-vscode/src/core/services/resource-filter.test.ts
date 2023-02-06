import { Logger } from '../utils/log';
import { createTestNote, createTestWorkspace } from '../../test/test-utils';
import { createFilter, FilterDescriptor } from './resource-filter';

Logger.setLevel('error');

const complexFilter: FilterDescriptor = {
  and: [
    { tag: '#a' },
    { tag: '#b' },
    {
      or: [
        { type: 'daily-note' },
        { type: 'weekly-note' },
        { include: '/projects/**' },
      ],
      not: {
        type: 'root',
      },
    },
  ],
};

describe('Resource Filter', () => {
  describe('Filter parameters', () => {
    it('should support expressions when code execution is enabled', () => {
      const noteA = createTestNote({
        uri: 'note-a.md',
        type: 'type-1',
      });
      const noteB = createTestNote({
        uri: 'note-b.md',
        type: 'type-2',
      });

      const filter = createFilter(
        {
          expression: 'resource.type === "type-1"',
        },
        true
      );
      expect(filter(noteA)).toBeTruthy();
      expect(filter(noteB)).toBeFalsy();
    });

    it('should not allow expressions when code execution is not enabled', () => {
      const noteA = createTestNote({
        uri: 'note-a.md',
        type: 'type-1',
      });
      const noteB = createTestNote({
        uri: 'note-b.md',
        type: 'type-2',
      });

      const filter = createFilter(
        {
          expression: 'resource.type === "type-1"',
        },
        false
      );
      expect(filter(noteA)).toBeTruthy();
      expect(filter(noteB)).toBeTruthy();
    });

    it('should not allow code execution by default', () => {
      const noteA = createTestNote({
        uri: 'note-a.md',
        type: 'type-1',
      });
      const noteB = createTestNote({
        uri: 'note-b.md',
        type: 'type-2',
      });

      const filter = createFilter({
        expression: 'resource.type === "type-1"',
      });
      expect(filter(noteA)).toBeTruthy();
      expect(filter(noteB)).toBeTruthy();
    });

    it('should support resource type', () => {
      const noteA = createTestNote({
        uri: 'note-a.md',
        type: 'type-1',
      });
      const noteB = createTestNote({
        uri: 'note-b.md',
        type: 'type-2',
      });

      const filter = createFilter({
        type: 'type-1',
      });
      expect(filter(noteA)).toBeTruthy();
      expect(filter(noteB)).toBeFalsy();
    });

    it('should support resource title', () => {
      const noteA = createTestNote({
        uri: 'note-a.md',
        title: 'title-1',
      });
      const noteB = createTestNote({
        uri: 'note-b.md',
        title: 'title-2',
      });
      const noteC = createTestNote({
        uri: 'note-c.md',
        title: 'another title',
      });

      const filter = createFilter({
        title: '^title',
      });
      expect(filter(noteA)).toBeTruthy();
      expect(filter(noteB)).toBeTruthy();
      expect(filter(noteC)).toBeFalsy();
    });
  });

  describe('Filter operators', () => {
    it('should support the OR operator', () => {
      const noteA = createTestNote({
        uri: 'note-a.md',
        type: 'type-1',
      });
      const noteB = createTestNote({
        uri: 'note-b.md',
        type: 'type-2',
      });

      const filter = createFilter({
        or: [{ type: 'type-1' }, { type: 'type-2' }],
      });
      expect(filter(noteA)).toBeTruthy();
      expect(filter(noteB)).toBeTruthy();
    });
  });
});
