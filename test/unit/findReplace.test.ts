import * as assert from 'node:assert/strict';

import { findMatches, matchIndexFrom, replaceMatches } from '../../src/webview/findReplace';

suite('findReplace', () => {
  test('finds plain-text matches, treating regex characters literally', () => {
    assert.deepEqual(findMatches('a.b a+b a.b', 'a.b', true), [
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ]);
  });

  test('ignores case unless match case is on', () => {
    assert.equal(findMatches('Note note NOTE', 'note', false).length, 3);
    assert.deepEqual(findMatches('Note note NOTE', 'note', true), [{ start: 5, end: 9 }]);
  });

  test('returns no matches for an empty query', () => {
    assert.deepEqual(findMatches('abc', '', false), []);
  });

  test('reports offsets in the original text for multi-unit characters', () => {
    assert.deepEqual(findMatches('😀筆記 筆記', '筆記', false), [
      { start: 2, end: 4 },
      { start: 5, end: 7 },
    ]);
  });

  test('picks the first match at or after a position, wrapping around', () => {
    const matches = findMatches('x x x', 'x', false);
    assert.equal(matchIndexFrom(matches, 1), 1);
    assert.equal(matchIndexFrom(matches, 5), 0);
  });

  test('replaces every given match literally', () => {
    const text = 'cat Cat cat';
    const matches = findMatches(text, 'cat', false);
    assert.equal(replaceMatches(text, matches, '$1'), '$1 $1 $1');
    assert.equal(replaceMatches(text, matches.slice(1, 2), 'dog'), 'cat dog cat');
  });
});
