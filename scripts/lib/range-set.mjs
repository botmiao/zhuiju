export function normalizeRanges(ranges = []) {
  const sorted = ranges
    .map((range) => ({ from: Number(range.from), to: Number(range.to) }))
    .filter((range) => Number.isInteger(range.from) && Number.isInteger(range.to) && range.from >= 1 && range.to >= range.from)
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const result = [];
  for (const range of sorted) {
    const previous = result.at(-1);
    if (previous && range.from <= previous.to + 1) {
      previous.to = Math.max(previous.to, range.to);
    } else {
      result.push({ ...range });
    }
  }
  return result;
}

export function subtractRanges(left = [], right = []) {
  const excluded = normalizeRanges(right);
  const output = [];
  for (const source of normalizeRanges(left)) {
    let cursor = source.from;
    for (const cut of excluded) {
      if (cut.to < cursor) continue;
      if (cut.from > source.to) break;
      if (cut.from > cursor) output.push({ from: cursor, to: Math.min(source.to, cut.from - 1) });
      cursor = Math.max(cursor, cut.to + 1);
      if (cursor > source.to) break;
    }
    if (cursor <= source.to) output.push({ from: cursor, to: source.to });
  }
  return output;
}

export function rangeContains(ranges = [], value) {
  return normalizeRanges(ranges).some((range) => value >= range.from && value <= range.to);
}

export function latestMissing(ranges = []) {
  return normalizeRanges(ranges).at(-1)?.to ?? null;
}

export function expandRanges(ranges = []) {
  const values = [];
  for (const range of normalizeRanges(ranges)) {
    for (let value = range.from; value <= range.to; value += 1) values.push(value);
  }
  return values;
}

export function formatRanges(ranges = []) {
  return normalizeRanges(ranges).map(({ from, to }) => from === to ? `${from}` : `${from}–${to}`).join(', ');
}
