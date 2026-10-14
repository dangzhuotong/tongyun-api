/**
 * 橦云接口 · 纯文本响应差分算法 (Line Diff Engine)
 * 用于双响应对比 (Dual Response Diff) 与前后快照比对
 */

export type DiffChangeType = 'equal' | 'add' | 'delete' | 'modify';

export interface DiffLineItem {
  type: DiffChangeType;
  oldLineNumber?: number;
  newLineNumber?: number;
  oldContent?: string;
  newContent?: string;
}

export interface DiffSummary {
  items: DiffLineItem[];
  addedCount: number;
  deletedCount: number;
  modifiedCount: number;
  isIdentical: boolean;
}

/**
 * 格式化对比文本（若为有效 JSON 则先格式化展开再进行对比）
 */
export function normalizeDiffText(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

/**
 * 基于最长公共子序列 (LCS) 计算两段文本的逐行差分
 */
export function computeLineDiff(oldText: string, newText: string, maxLines = 1200): DiffSummary {
  const normOld = normalizeDiffText(oldText);
  const normNew = normalizeDiffText(newText);

  if (normOld === normNew) {
    const lines = normOld ? normOld.split('\n') : [];
    return {
      items: lines.map((line, idx) => ({
        type: 'equal',
        oldLineNumber: idx + 1,
        newLineNumber: idx + 1,
        oldContent: line,
        newContent: line,
      })),
      addedCount: 0,
      deletedCount: 0,
      modifiedCount: 0,
      isIdentical: true,
    };
  }

  let linesA = normOld ? normOld.split('\n') : [];
  let linesB = normNew ? normNew.split('\n') : [];

  // 防止超大文本卡死 UI
  if (linesA.length > maxLines) linesA = linesA.slice(0, maxLines);
  if (linesB.length > maxLines) linesB = linesB.slice(0, maxLines);

  const m = linesA.length;
  const n = linesB.length;

  // 构建 LCS 动态规划矩阵
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (linesA[i] === linesB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // 回溯生成 Diff 序列
  let i = m;
  let j = n;
  const rawItems: { type: 'equal' | 'delete' | 'add'; oldLine?: number; newLine?: number; text: string }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      rawItems.push({
        type: 'equal',
        oldLine: i,
        newLine: j,
        text: linesA[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawItems.push({
        type: 'add',
        newLine: j,
        text: linesB[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawItems.push({
        type: 'delete',
        oldLine: i,
        text: linesA[i - 1],
      });
      i--;
    }
  }

  rawItems.reverse();

  // 合并连续的 delete + add 为 modify，提升左右对比的可读性
  const alignedItems: DiffLineItem[] = [];
  let addedCount = 0;
  let deletedCount = 0;
  let modifiedCount = 0;

  let idx = 0;
  while (idx < rawItems.length) {
    const current = rawItems[idx];
    if (current.type === 'delete' && idx + 1 < rawItems.length && rawItems[idx + 1].type === 'add') {
      const next = rawItems[idx + 1];
      alignedItems.push({
        type: 'modify',
        oldLineNumber: current.oldLine,
        newLineNumber: next.newLine,
        oldContent: current.text,
        newContent: next.text,
      });
      modifiedCount++;
      idx += 2;
    } else if (current.type === 'equal') {
      alignedItems.push({
        type: 'equal',
        oldLineNumber: current.oldLine,
        newLineNumber: current.newLine,
        oldContent: current.text,
        newContent: current.text,
      });
      idx++;
    } else if (current.type === 'add') {
      alignedItems.push({
        type: 'add',
        newLineNumber: current.newLine,
        newContent: current.text,
      });
      addedCount++;
      idx++;
    } else if (current.type === 'delete') {
      alignedItems.push({
        type: 'delete',
        oldLineNumber: current.oldLine,
        oldContent: current.text,
      });
      deletedCount++;
      idx++;
    }
  }

  return {
    items: alignedItems,
    addedCount,
    deletedCount,
    modifiedCount,
    isIdentical: addedCount === 0 && deletedCount === 0 && modifiedCount === 0,
  };
}
