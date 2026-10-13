export type JsonTokenType =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punctuation'
  | 'variable'
  | 'whitespace'
  | 'text';

export interface JsonToken {
  type: JsonTokenType;
  value: string;
}

/**
 * Robust, zero-dependency lexical tokenizer for JSON text.
 * Handles keys, strings, numbers, booleans, null, variables ({{...}}), and punctuation.
 */
export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    // 1. Check for {{variable}} or {{$dynamicVar}}
    if (text[i] === '{' && text[i + 1] === '{') {
      const end = text.indexOf('}}', i + 2);
      if (end !== -1) {
        tokens.push({
          type: 'variable',
          value: text.slice(i, end + 2),
        });
        i = end + 2;
        continue;
      }
    }

    // 2. Whitespace
    if (/\s/.test(text[i])) {
      let j = i;
      while (j < n && /\s/.test(text[j])) j++;
      tokens.push({ type: 'whitespace', value: text.slice(i, j) });
      i = j;
      continue;
    }

    // 3. String (could be key or string value)
    if (text[i] === '"') {
      let j = i + 1;
      let escaped = false;
      while (j < n) {
        if (text[j] === '\\' && !escaped) {
          escaped = true;
          j++;
        } else if (text[j] === '"' && !escaped) {
          j++;
          break;
        } else {
          escaped = false;
          j++;
        }
      }
      const strVal = text.slice(i, j);

      // Look ahead past whitespace to see if followed by colon ':'
      let k = j;
      while (k < n && /\s/.test(text[k])) k++;
      const isKey = k < n && text[k] === ':';

      tokens.push({
        type: isKey ? 'key' : 'string',
        value: strVal,
      });
      i = j;
      continue;
    }

    // 4. Numbers
    if (/[0-9\-]/.test(text[i])) {
      const match = text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (match && match[0]) {
        tokens.push({ type: 'number', value: match[0] });
        i += match[0].length;
        continue;
      }
    }

    // 5. Booleans & Null
    if (text.startsWith('true', i)) {
      tokens.push({ type: 'boolean', value: 'true' });
      i += 4;
      continue;
    }
    if (text.startsWith('false', i)) {
      tokens.push({ type: 'boolean', value: 'false' });
      i += 5;
      continue;
    }
    if (text.startsWith('null', i)) {
      tokens.push({ type: 'null', value: 'null' });
      i += 4;
      continue;
    }

    // 6. Punctuation
    if (['{', '}', '[', ']', ':', ','].includes(text[i])) {
      tokens.push({ type: 'punctuation', value: text[i] });
      i++;
      continue;
    }

    // 7. Fallback single character
    tokens.push({ type: 'text', value: text[i] });
    i++;
  }

  return tokens;
}

/**
 * Tokenize a line of JSON into colored tokens.
 */
export function tokenizeJsonLine(line: string): JsonToken[] {
  return tokenizeJson(line);
}
