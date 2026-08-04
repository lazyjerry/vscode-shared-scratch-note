export interface EditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

interface ListMatch {
  indent: string;
  marker: string;
  body: string;
}

export function continueList(value: string, position: number): EditResult | undefined {
  const lineStart = value.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', position);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const line = value.slice(lineStart, lineEnd);
  const match = parseListLine(line);

  if (!match) {
    return undefined;
  }

  if (match.body.trim() === '' && position === lineEnd) {
    const nextValue = value.slice(0, lineStart) + value.slice(lineEnd);
    return {
      value: nextValue,
      selectionStart: lineStart,
      selectionEnd: lineStart,
    };
  }

  const nextMarker = incrementMarker(match.marker);
  const insertion = `\n${match.indent}${nextMarker} `;
  const nextValue = value.slice(0, position) + insertion + value.slice(position);
  const nextPosition = position + insertion.length;

  return {
    value: nextValue,
    selectionStart: nextPosition,
    selectionEnd: nextPosition,
  };
}

export function indentList(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  outdent: boolean,
): EditResult | undefined {
  const blockStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  let blockEnd = value.indexOf('\n', selectionEnd);
  if (blockEnd === -1) {
    blockEnd = value.length;
  } else if (selectionEnd > selectionStart && value.charAt(selectionEnd - 1) === '\n') {
    blockEnd = selectionEnd - 1;
  }

  const block = value.slice(blockStart, blockEnd);
  const lines = block.split('\n');
  if (!lines.some((line) => parseListLine(line))) {
    return undefined;
  }

  let startDelta = 0;
  let endDelta = 0;
  const updatedLines = lines.map((line, index) => {
    if (!parseListLine(line)) {
      return line;
    }

    if (outdent) {
      const removedLength = line.startsWith('  ') ? 2 : line.startsWith(' ') ? 1 : 0;
      if (index === 0) {
        startDelta -= removedLength;
      }
      endDelta -= removedLength;
      return line.slice(removedLength);
    }

    if (index === 0) {
      startDelta += 2;
    }
    endDelta += 2;
    return `  ${line}`;
  });

  if (updatedLines.every((line, index) => line === lines[index])) {
    return undefined;
  }

  return {
    value: value.slice(0, blockStart) + updatedLines.join('\n') + value.slice(blockEnd),
    selectionStart: Math.max(blockStart, selectionStart + startDelta),
    selectionEnd: Math.max(blockStart, selectionEnd + endDelta),
  };
}

export function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
): EditResult {
  const selectedText = value.slice(selectionStart, selectionEnd);
  const replacement = `${prefix}${selectedText}${suffix}`;
  const nextValue = value.slice(0, selectionStart) + replacement + value.slice(selectionEnd);

  if (selectedText.length === 0) {
    const position = selectionStart + prefix.length;
    return { value: nextValue, selectionStart: position, selectionEnd: position };
  }

  return {
    value: nextValue,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionEnd + prefix.length,
  };
}

export function insertLink(value: string, selectionStart: number, selectionEnd: number): EditResult {
  const selectedText = value.slice(selectionStart, selectionEnd);
  const label = selectedText || 'text';
  const url = 'https://';
  const replacement = `[${label}](${url})`;
  const nextValue = value.slice(0, selectionStart) + replacement + value.slice(selectionEnd);

  if (selectedText) {
    const urlStart = selectionStart + label.length + 3;
    return {
      value: nextValue,
      selectionStart: urlStart,
      selectionEnd: urlStart + url.length,
    };
  }

  return {
    value: nextValue,
    selectionStart: selectionStart + 1,
    selectionEnd: selectionStart + 1 + label.length,
  };
}

export function pasteUrlOverSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  clipboardText: string,
): EditResult | undefined {
  if (selectionStart === selectionEnd || !isHttpUrl(clipboardText)) {
    return undefined;
  }

  const selectedText = value.slice(selectionStart, selectionEnd);
  const replacement = `[${selectedText}](${clipboardText})`;
  const nextPosition = selectionStart + replacement.length;
  return {
    value: value.slice(0, selectionStart) + replacement + value.slice(selectionEnd),
    selectionStart: nextPosition,
    selectionEnd: nextPosition,
  };
}

function parseListLine(line: string): ListMatch | undefined {
  const unordered = /^(\s*)([-+*])\s+(.*)$/.exec(line);
  if (unordered) {
    return { indent: unordered[1], marker: unordered[2], body: unordered[3] };
  }

  const ordered = /^(\s*)(\d+[.)])\s+(.*)$/.exec(line);
  if (ordered) {
    return { indent: ordered[1], marker: ordered[2], body: ordered[3] };
  }

  return undefined;
}

function incrementMarker(marker: string): string {
  const ordered = /^(\d+)([.)])$/.exec(marker);
  if (!ordered) {
    return marker;
  }
  return `${Number(ordered[1]) + 1}${ordered[2]}`;
}

function isHttpUrl(value: string): boolean {
  if (/\s/.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
