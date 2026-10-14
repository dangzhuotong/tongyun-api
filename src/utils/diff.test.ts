import { describe, it, expect } from 'vitest';
import { computeLineDiff, normalizeDiffText } from './diff';

describe('normalizeDiffText', () => {
  it('formats valid compact JSON into multi-line indented string', () => {
    const compact = '{"code":200,"msg":"ok"}';
    const normalized = normalizeDiffText(compact);
    expect(normalized).toContain('\n');
    expect(normalized).toContain('"code": 200');
  });

  it('keeps raw string as-is if not valid json', () => {
    const raw = 'Hello World\nLine 2';
    expect(normalizeDiffText(raw)).toBe(raw);
  });
});

describe('computeLineDiff', () => {
  it('detects identical content', () => {
    const text = 'line 1\nline 2';
    const diff = computeLineDiff(text, text);
    expect(diff.isIdentical).toBe(true);
    expect(diff.addedCount).toBe(0);
    expect(diff.deletedCount).toBe(0);
    expect(diff.items.length).toBe(2);
    expect(diff.items[0].type).toBe('equal');
  });

  it('detects additions and modifications', () => {
    const oldText = '{\n  "status": "pending"\n}';
    const newText = '{\n  "status": "success",\n  "code": 200\n}';
    const diff = computeLineDiff(oldText, newText);
    expect(diff.isIdentical).toBe(false);
    expect(diff.modifiedCount + diff.addedCount).toBeGreaterThan(0);
  });

  it('handles empty old or new content', () => {
    const diff1 = computeLineDiff('', 'line 1\nline 2');
    expect(diff1.addedCount).toBe(2);

    const diff2 = computeLineDiff('line 1\nline 2', '');
    expect(diff2.deletedCount).toBe(2);
  });
});
