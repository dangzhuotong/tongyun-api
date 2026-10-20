import { describe, it, expect } from 'vitest';
import { computeLineDiff, normalizeDiffText } from './diff';

describe('normalizeDiffText – 额外场景', () => {
  it('空字符串原样返回空字符串', () => {
    expect(normalizeDiffText('')).toBe('');
  });

  it('格式化 JSON 数组', () => {
    const input = '[1,2,3]';
    const out = normalizeDiffText(input);
    expect(out).toContain('\n');
    expect(out).toContain('1');
    expect(out).toContain('3');
  });

  it('无效 JSON 对象字面量原样保留', () => {
    const notJson = '{broken json}';
    expect(normalizeDiffText(notJson)).toBe(notJson);
  });

  it('纯数字字符串不当作 JSON 处理', () => {
    expect(normalizeDiffText('42')).toBe('42');
  });

  it('已格式化的多行 JSON 再次格式化后结果一致（幂等性）', () => {
    const compact = '{"a":1,"b":2}';
    const once = normalizeDiffText(compact);
    const twice = normalizeDiffText(once);
    expect(once).toBe(twice);
  });
});

describe('computeLineDiff – 额外场景', () => {
  it('单行相同文本得到 1 个 equal 项', () => {
    const diff = computeLineDiff('hello', 'hello');
    expect(diff.isIdentical).toBe(true);
    expect(diff.items).toHaveLength(1);
    expect(diff.items[0].type).toBe('equal');
  });

  it('完全不同的两行文本合并为 modify', () => {
    const diff = computeLineDiff('foo', 'bar');
    expect(diff.isIdentical).toBe(false);
    // 单行 delete + 单行 add 被合并成 modify
    const modItem = diff.items.find(x => x.type === 'modify');
    expect(modItem).toBeDefined();
    expect(modItem?.oldContent).toBe('foo');
    expect(modItem?.newContent).toBe('bar');
    expect(diff.modifiedCount).toBe(1);
  });

  it('在末尾新增一行时 addedCount === 1', () => {
    const diff = computeLineDiff('line1', 'line1\nline2');
    expect(diff.addedCount).toBe(1);
    expect(diff.isIdentical).toBe(false);
  });

  it('删除一行后 deletedCount === 1', () => {
    const diff = computeLineDiff('line1\nline2', 'line1');
    expect(diff.deletedCount).toBe(1);
  });

  it('两个空字符串之间差分为相同且无条目', () => {
    const diff = computeLineDiff('', '');
    expect(diff.isIdentical).toBe(true);
    expect(diff.items).toHaveLength(0);
  });

  it('equal 条目同时携带正确的行号', () => {
    const diff = computeLineDiff('a\nb\nc', 'a\nb\nc');
    expect(diff.items[0].oldLineNumber).toBe(1);
    expect(diff.items[0].newLineNumber).toBe(1);
    expect(diff.items[2].oldLineNumber).toBe(3);
  });

  it('JSON 字符串在比对前会被规范化', () => {
    // 紧凑 vs 缩进——规范化后内容相同，应识别为完全相同
    const compact = '{"x":1}';
    const pretty  = '{\n  "x": 1\n}';
    const diff = computeLineDiff(compact, pretty);
    expect(diff.isIdentical).toBe(true);
  });
});
