import { HEART_RATE_QUALITY_THRESHOLDS as T, type HeartRateIssue, type HeartRateQuality } from './heart-rate-quality';

/** Textes destinés à l'utilisateur : constats mesurables, sans cause supposée ni correction des données. */
const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;
const percent = (coverage: number) => `${Math.floor(coverage * 100)} %`;
const minutes = (seconds: number) => { const m = Math.floor(seconds / 60), s = Math.round(seconds % 60); return s ? `${m} min ${s} s` : `${m} min`; };

/** Phrase unique pour le compte rendu d'import ; undefined si rien n'est à signaler. */
export function heartRateQualitySummary(quality: HeartRateQuality, hasSummaryAverage = false): string | undefined {
  switch (quality.status) {
    case 'ok': return undefined;
    case 'absent': return hasSummaryAverage
      ? 'Aucune courbe de fréquence cardiaque n’est disponible ; seules les valeurs résumées sont affichées.'
      : 'Aucune fréquence cardiaque n’a été enregistrée. La durée, la distance et le parcours restent utilisables.';
    case 'partial': return `La fréquence cardiaque n’a été enregistrée que sur ${percent(quality.coverage ?? 0)} des points de l’activité.`;
    case 'invalid': return 'Des valeurs de fréquence cardiaque hors des limites plausibles ont été détectées. Les autres mesures restent utilisables.';
    case 'suspect': return 'Des anomalies possibles de fréquence cardiaque ont été détectées. Les autres mesures restent utilisables.';
  }
}

export function heartRateIssueMessage(issue: HeartRateIssue): string {
  switch (issue.code) {
    case 'out-of-range': return `${plural(issue.count, 'valeur', 'valeurs')} inférieure${issue.count > 1 ? 's' : ''} à ${T.minimumBpm} bpm ou supérieure${issue.count > 1 ? 's' : ''} à ${T.maximumBpm} bpm.`;
    case 'partial-coverage': return `Fréquence cardiaque mesurée sur ${percent(issue.coverage)} des points enregistrés.`;
    case 'isolated-spike': return `${plural(issue.count, 'pic isolé', 'pics isolés')} : un seul point s’écarte de plus de ${T.spikeBpm} bpm des mesures voisines.`;
    case 'flat-signal': return `Valeur identique pendant ${minutes(issue.longestSeconds)}${issue.count > 1 ? ` (${issue.count} périodes)` : ''}.`;
    case 'interruption': return `Mesure interrompue pendant ${minutes(issue.longestSeconds)} alors que l’enregistrement continue${issue.count > 1 ? ` (${issue.count} interruptions)` : ''}.`;
    case 'summary-mismatch': return `Moyenne indiquée par les tours : ${Math.round(issue.summaryAverage)} bpm ; moyenne de la courbe : ${Math.round(issue.measuredAverage)} bpm.`;
  }
}

/** Sépare les erreurs certaines des simples anomalies suspectées. */
export function heartRateQualityDetails(quality: HeartRateQuality): { certain: string[]; suspected: string[] } {
  return {
    certain: quality.issues.filter(issue => issue.certainty === 'certain').map(heartRateIssueMessage),
    suspected: quality.issues.filter(issue => issue.certainty === 'suspected').map(heartRateIssueMessage),
  };
}
