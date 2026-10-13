import { describe, it, expect } from 'vitest';
import { tokenizeJson } from './jsonTokenizer';

describe('jsonTokenizer', () => {
  it('tokenizes key-value pair correctly', () => {
    const tokens = tokenizeJson('{"name": "Alice", "age": 30}');
    const types = tokens.map(t => t.type);
    expect(types).toContain('key');
    expect(types).toContain('string');
    expect(types).toContain('number');
  });

  it('distinguishes keys from string values', () => {
    const tokens = tokenizeJson('{"orderId": "ORD-1001"}');
    const key = tokens.find(t => t.type === 'key');
    const str = tokens.find(t => t.type === 'string');
    expect(key?.value).toBe('"orderId"');
    expect(str?.value).toBe('"ORD-1001"');
  });

  it('tokenizes variables inside JSON', () => {
    const tokens = tokenizeJson('{"userId": {{userId}}, "uuid": "{{$uuid}}"}');
    const vars = tokens.filter(t => t.type === 'variable');
    expect(vars.length).toBeGreaterThan(0);
    expect(vars[0].value).toBe('{{userId}}');
  });

  it('tokenizes booleans, null, and numbers', () => {
    const tokens = tokenizeJson('[true, false, null, -12.5]');
    const bools = tokens.filter(t => t.type === 'boolean');
    const nulls = tokens.filter(t => t.type === 'null');
    const nums = tokens.filter(t => t.type === 'number');
    expect(bools.length).toBe(2);
    expect(nulls.length).toBe(1);
    expect(nums[0].value).toBe('-12.5');
  });
});
