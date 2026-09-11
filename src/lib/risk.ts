/**
 * Risk scoring, shared by the register table and the detail drawer.
 *
 * Lives here rather than in data/mock.ts so it survives that file's deletion
 * once the backend serves the register. Note this 0-100 score is a separate
 * scale from the L x I product the matrix bands on.
 */
export const riskScoreOf = (L: number, I: number) => {
  const map: Record<string, number> = {
    "4-5": 95, "3-4": 72, "3-4-2": 68, "4-3": 61, "2-4": 48, "3-3": 44,
    "2-4-2": 41, "2-3": 35, "3-2": 31, "1-4": 22, "2-2": 18, "1-3": 14,
  };
  return map[`${L}-${I}`] ?? L * I * 4;
};
