import type { RunningSession } from '../../types/session';
import { analyzeTrainingHistory, type TrainingWeeks, type CoveredMeasure } from '../analysis/training-history';
export function compareTraining(sessions: readonly RunningSession[], weeks: TrainingWeeks, today: string) {
  const current = analyzeTrainingHistory(sessions, weeks, today);
  const previousEnd = new Date(Date.parse(`${current.startDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const previous = analyzeTrainingHistory(sessions, weeks, previousEnd);
  const complete = (m: CoveredMeasure) => m.known === m.total;
  const comparable = current.sessionCount > 0 && previous.sessionCount > 0;
  return { current, previous, changes: {
    sessions: comparable ? current.sessionCount - previous.sessionCount : null,
    frequency: comparable ? current.sessionsPerWeek - previous.sessionsPerWeek : null,
    distance: comparable && complete(current.distance) && complete(previous.distance) ? current.distance.value! - previous.distance.value! : null,
    duration: comparable && complete(current.duration) && complete(previous.duration) ? current.duration.value! - previous.duration.value! : null,
    weeklyDistance: comparable && complete(current.distance) && complete(previous.distance) ? current.distance.weeklyAverage! - previous.distance.weeklyAverage! : null,
  } };
}
export type TrainingComparison = ReturnType<typeof compareTraining>;
