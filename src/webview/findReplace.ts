export interface TextMatch {
  start: number;
  end: number;
}

export function findMatches(text: string, query: string, matchCase: boolean): TextMatch[] {
  if (query === '') {
    return [];
  }

  // The query is escaped into a literal, so the pattern cannot backtrack catastrophically.
  const pattern = new RegExp(escapeRegExp(query), matchCase ? 'gu' : 'giu');
  const matches: TextMatch[] = [];
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    matches.push({ start, end: start + match[0].length });
  }
  return matches;
}

/** Index of the first match starting at or after `position`, wrapping to the first match. */
export function matchIndexFrom(matches: readonly TextMatch[], position: number): number {
  const index = matches.findIndex((match) => match.start >= position);
  return index === -1 ? 0 : index;
}

export function replaceMatches(
  text: string,
  matches: readonly TextMatch[],
  replacement: string,
): string {
  let result = '';
  let cursor = 0;
  for (const match of matches) {
    result += text.slice(cursor, match.start) + replacement;
    cursor = match.end;
  }
  return result + text.slice(cursor);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
