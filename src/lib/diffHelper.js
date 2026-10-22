/**
 * Efficient Line-by-Line Diff Engine (LCS-based)
 * Computes additions, deletions, and unchanged lines between two code strings.
 */

export function computeLineDiff(oldText = '', newText = '') {
  const oldLines = oldText ? oldText.split(/\r?\n/) : [];
  const newLines = newText ? newText.split(/\r?\n/) : [];

  const n = oldLines.length;
  const m = newLines.length;

  // Edge cases
  if (n === 0 && m === 0) {
    return { unified: [], sideBySide: [], stats: { additions: 0, deletions: 0, unchanged: 0 } };
  }

  // If one of them is empty
  if (n === 0) {
    const unified = newLines.map((line, idx) => ({
      type: 'added',
      oldLineNumber: null,
      newLineNumber: idx + 1,
      content: line
    }));
    const sideBySide = newLines.map((line, idx) => ({
      left: null,
      right: { lineNumber: idx + 1, content: line, type: 'added' }
    }));
    return {
      unified,
      sideBySide,
      stats: { additions: m, deletions: 0, unchanged: 0 }
    };
  }

  if (m === 0) {
    const unified = oldLines.map((line, idx) => ({
      type: 'removed',
      oldLineNumber: idx + 1,
      newLineNumber: null,
      content: line
    }));
    const sideBySide = oldLines.map((line, idx) => ({
      left: { lineNumber: idx + 1, content: line, type: 'removed' },
      right: null
    }));
    return {
      unified,
      sideBySide,
      stats: { additions: 0, deletions: n, unchanged: 0 }
    };
  }

  // LCS Matrix computation
  // Optimization: For very large files, limit matrix or use trimmed ranges
  // For standard calculator files (up to thousands of lines), we do LCS with space-saving where possible.
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get unified edit operations
  const edits = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.push({
        type: 'unchanged',
        oldLineNumber: i,
        newLineNumber: j,
        content: oldLines[i - 1]
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.push({
        type: 'added',
        oldLineNumber: null,
        newLineNumber: j,
        content: newLines[j - 1]
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      edits.push({
        type: 'removed',
        oldLineNumber: i,
        newLineNumber: null,
        content: oldLines[i - 1]
      });
      i--;
    }
  }

  edits.reverse();

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  edits.forEach(e => {
    if (e.type === 'added') additions++;
    else if (e.type === 'removed') deletions++;
    else unchanged++;
  });

  // Construct Side-by-Side rows
  const sideBySide = [];
  let editIdx = 0;

  while (editIdx < edits.length) {
    const current = edits[editIdx];

    if (current.type === 'unchanged') {
      sideBySide.push({
        left: { lineNumber: current.oldLineNumber, content: current.content, type: 'unchanged' },
        right: { lineNumber: current.newLineNumber, content: current.content, type: 'unchanged' }
      });
      editIdx++;
    } else {
      // Collect contiguous block of removals and additions
      const removals = [];
      const additionsList = [];

      while (editIdx < edits.length && edits[editIdx].type !== 'unchanged') {
        if (edits[editIdx].type === 'removed') {
          removals.push(edits[editIdx]);
        } else if (edits[editIdx].type === 'added') {
          additionsList.push(edits[editIdx]);
        }
        editIdx++;
      }

      const maxLen = Math.max(removals.length, additionsList.length);
      for (let k = 0; k < maxLen; k++) {
        const rem = removals[k];
        const add = additionsList[k];
        sideBySide.push({
          left: rem ? { lineNumber: rem.oldLineNumber, content: rem.content, type: 'removed' } : null,
          right: add ? { lineNumber: add.newLineNumber, content: add.content, type: 'added' } : null
        });
      }
    }
  }

  return {
    unified: edits,
    sideBySide,
    stats: { additions, deletions, unchanged }
  };
}
