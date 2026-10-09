/**
 * A student's progress on one assignment: total submissions, and the
 * points-weighted average of their best score per question (unanswered
 * questions count as 0). The same score is stored on completion.
 */
export function assignmentProgress(
  questions: { points: number; submissions: { score: number | null }[] }[],
): { attempts: number; bestScore: number } {
  const attempts = questions.reduce((sum, q) => sum + q.submissions.length, 0);
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0) || 1;
  const bestScore =
    questions.reduce((sum, q) => sum + q.points * Math.max(0, ...q.submissions.map((s) => s.score ?? 0)), 0) /
    totalPoints;
  return { attempts, bestScore };
}
