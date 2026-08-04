import * as assert from 'node:assert/strict';

import {
  continueList,
  indentList,
  insertLink,
  pasteUrlOverSelection,
  wrapSelection,
} from '../../src/webview/markdownEditing';

suite('Markdown editing', () => {
  test('continues unordered lists', () => {
    assert.deepEqual(continueList('- item', 6), {
      value: '- item\n- ',
      selectionStart: 9,
      selectionEnd: 9,
    });
  });

  test('increments ordered lists', () => {
    assert.deepEqual(continueList('9. item', 7), {
      value: '9. item\n10. ',
      selectionStart: 12,
      selectionEnd: 12,
    });
  });

  test('exits an empty list item', () => {
    assert.deepEqual(continueList('- ', 2), {
      value: '',
      selectionStart: 0,
      selectionEnd: 0,
    });
  });

  test('indents and outdents selected list lines', () => {
    const indented = indentList('- one\n- two', 0, 11, false);
    assert.deepEqual(indented, {
      value: '  - one\n  - two',
      selectionStart: 2,
      selectionEnd: 15,
    });

    assert.deepEqual(indentList(indented!.value, 2, 15, true), {
      value: '- one\n- two',
      selectionStart: 0,
      selectionEnd: 11,
    });
  });

  test('wraps and preserves selected text', () => {
    assert.deepEqual(wrapSelection('hello', 0, 5, '**', '**'), {
      value: '**hello**',
      selectionStart: 2,
      selectionEnd: 7,
    });
  });

  test('inserts a link and selects its URL placeholder', () => {
    assert.deepEqual(insertLink('hello', 0, 5), {
      value: '[hello](https://)',
      selectionStart: 8,
      selectionEnd: 16,
    });
  });

  test('turns an HTTP URL pasted over selected text into a Markdown link', () => {
    assert.deepEqual(pasteUrlOverSelection('OpenAI', 0, 6, 'https://openai.com'), {
      value: '[OpenAI](https://openai.com)',
      selectionStart: 28,
      selectionEnd: 28,
    });
  });

  test('uses normal paste for invalid URLs or empty selections', () => {
    assert.equal(pasteUrlOverSelection('OpenAI', 0, 6, 'not a URL'), undefined);
    assert.equal(pasteUrlOverSelection('OpenAI', 6, 6, 'https://openai.com'), undefined);
  });
});
