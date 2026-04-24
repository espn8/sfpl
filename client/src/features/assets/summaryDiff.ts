export type DiffOp = "same" | "add" | "remove";

export type DiffToken = {
  text: string;
  op: DiffOp;
};

/**
 * Word-level LCS diff between two strings.
 * Splits on whitespace (keeping whitespace tokens so spacing is preserved in rendering).
 * Returns a sequence of tokens marking each word as unchanged, added, or removed.
 */
export function diffWords(original: string, suggestion: string): DiffToken[] {
  const a = original.split(/(\s+)/);
  const b = suggestion.split(/(\s+)/);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ text: a[i], op: "same" });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ text: a[i], op: "remove" });
      i += 1;
    } else {
      result.push({ text: b[j], op: "add" });
      j += 1;
    }
  }
  while (i < n) {
    result.push({ text: a[i], op: "remove" });
    i += 1;
  }
  while (j < m) {
    result.push({ text: b[j], op: "add" });
    j += 1;
  }
  return result;
}
