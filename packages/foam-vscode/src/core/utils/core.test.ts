import { getShortestIdentifier } from './core';
import { extractHashtags } from './index';
import { Logger } from './log';

Logger.setLevel('error');

describe('getShortestIdentifier', () => {
  const needle = '/project/car/todo';

  test.each([
    [['/project/home/todo', '/other/todo', '/something/else'], 'car/todo'],
    [['/family/car/todo', '/other/todo'], 'project/car/todo'],
    [[], 'todo'],
  ])('Find shortest identifier', (haystack, id) => {
    expect(getShortestIdentifier(needle, haystack)).toEqual(id);
  });

  it('should ignore same string in haystack', () => {
    const haystack = [
      needle,
      '/project/home/todo',
      '/other/todo',
      '/something/else',
    ];

    expect(getShortestIdentifier(needle, haystack)).toEqual('car/todo');
  });

  it('should return best guess when no solution is possible', () => {
    /**
     * In this case there is no way to uniquely identify the element,
     * our fallback is to just return the "least wrong" result, basically
     * a full identifier
     * This is an edge case that should never happen in a real repo
     */
    const haystack = [
      '/parent/' + needle,
      '/project/home/todo',
      '/other/todo',
      '/something/else',
    ];

    expect(getShortestIdentifier(needle, haystack)).toEqual('project/car/todo');
  });
});
