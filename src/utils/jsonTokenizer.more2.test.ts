import { describe, it, expect } from 'vitest';
import { tokenizeJson, tokenizeJsonLine } from './jsonTokenizer';

describe('tokenizeJson – punctuation & structure', () => {
  it('空字符串返回空数组', () => {
    expect(tokenizeJson('')).toEqual([]);
  });

  it('花括号和方括号均识别为 punctuation', () => {
    const tokens = tokenizeJson('{}[]');
    const types = tokens.map(t => t.type);
    expect(types).toEqual(['punctuation', 'punctuation', 'punctuation', 'punctuation']);
  });

  it('冒号和逗号识别为 punctuation', () => {
    const tokens = tokenizeJson(':,');
    const types = tokens.map(t => t.type);
    expect(types).toContain('punctuation');
  });

  it('空白字符归为 whitespace', () => {
    const tokens = tokenizeJson('  \t\n');
    expect(tokens.every(t => t.type === 'whitespace')).toBe(true);
  });
});

describe('tokenizeJson – strings & keys', () => {
  it('转义引号不提前终止字符串', () => {
    const tokens = tokenizeJson('{"msg": "say \\"hi\\""}');
    const str = tokens.find(t => t.type === 'string');
    expect(str?.value).toBe('"say \\"hi\\""');
  });

  it('嵌套对象中所有键都标记为 key 类型', () => {
    const tokens = tokenizeJson('{"a":{"b":1}}');
    const keys = tokens.filter(t => t.type === 'key').map(t => t.value);
    expect(keys).toContain('"a"');
    expect(keys).toContain('"b"');
  });

  it('数组中的字符串元素标记为 string 而非 key', () => {
    const tokens = tokenizeJson('["hello","world"]');
    const strs = tokens.filter(t => t.type === 'string').map(t => t.value);
    expect(strs).toContain('"hello"');
    expect(strs).toContain('"world"');
    expect(tokens.filter(t => t.type === 'key')).toHaveLength(0);
  });
});

describe('tokenizeJson – numbers', () => {
  it('科学计数法数字正确标记', () => {
    const tokens = tokenizeJson('[1e10, 2.5E-3]');
    const nums = tokens.filter(t => t.type === 'number').map(t => t.value);
    expect(nums).toContain('1e10');
    expect(nums).toContain('2.5E-3');
  });

  it('零正确识别为 number', () => {
    const tokens = tokenizeJson('[0]');
    const nums = tokens.filter(t => t.type === 'number');
    expect(nums[0]?.value).toBe('0');
  });
});

describe('tokenizeJson – variables', () => {
  it('$dynamic 变量也识别为 variable 类型', () => {
    const tokens = tokenizeJson('{{$timestamp}}');
    expect(tokens[0].type).toBe('variable');
    expect(tokens[0].value).toBe('{{$timestamp}}');
  });

  it('两个相邻变量各自独立识别', () => {
    const tokens = tokenizeJson('{{a}}{{b}}');
    const vars = tokens.filter(t => t.type === 'variable');
    expect(vars).toHaveLength(2);
    expect(vars[0].value).toBe('{{a}}');
    expect(vars[1].value).toBe('{{b}}');
  });
});

describe('tokenizeJsonLine', () => {
  it('与 tokenizeJson 返回相同结果', () => {
    const line = '{"k": true}';
    expect(tokenizeJsonLine(line)).toEqual(tokenizeJson(line));
  });
});
