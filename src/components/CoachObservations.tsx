import type { TrainingComparison } from '../core/coach/comparison';
import { coachObservations } from '../core/coach/observations';
import type { CoachProfileValues } from '../types/coach-profile';
import { formatNumber as n } from '../core/analysis/session-summary';
export function CoachObservations({ comparison, profile }: { comparison: TrainingComparison; profile?: CoachProfileValues }) {
  const { current: c, previous: p, changes: d } = comparison;
  const observations = coachObservations(comparison, profile);
  const measure = (value: number | null, divisor = 1) => value === null ? '—' : n(value / divisor);
  const variation = (value: number | null, divisor = 1) => value === null ? 'Comparaison insuffisante' : `${value > 0 ? '+' : ''}${n(value / divisor)}`;
  const rows = [
    ['Sorties', c.sessionCount, p.sessionCount, d.sessions, 1],
    ['Distance (km)', c.distance.value, p.distance.value, d.distance, 1000],
    ['Durée (min)', c.duration.value, p.duration.value, d.duration, 60],
    ['Sorties par semaine', c.sessionsPerWeek, p.sessionsPerWeek, d.frequency, 1],
    ['Distance par semaine (km)', c.distance.weeklyAverage, p.distance.weeklyAverage, d.weeklyDistance, 1000],
  ] as const;
  const date = (s: string) => s.split('-').reverse().join('/');
  return <section className="panel settings-panel" aria-labelledby="coach-observations">
    <h2 id="coach-observations">Observations du coach</h2>
    <p>Deux périodes consécutives de {c.weeks} semaines : actuelle du {date(c.startDate)} au {date(c.referenceDate)}, précédente du {date(p.startDate)} au {date(p.referenceDate)}.</p>
    <dl className="training-metrics">{rows.map(([label, current, previous, change, divisor]) => <div key={label}><dt>{label}</dt><dd>Actuelle : {measure(current, divisor)} · Précédente : {measure(previous, divisor)}</dd><dd>Variation : {variation(change, divisor)}</dd></div>)}</dl>
    <p>Couverture actuelle : distance {c.distance.known}/{c.sessionCount}, durée {c.duration.known}/{c.sessionCount}. Couverture précédente : distance {p.distance.known}/{p.sessionCount}, durée {p.duration.known}/{p.sessionCount}.</p>
    <p>Les totaux incomplets sont partiels. Sans séances dans les deux périodes, ou avec des mesures manquantes, les variations concernées ne sont pas interprétées. Une hausse ou une baisse n’est pas un jugement.</p>
    {observations.length ? <ul>{observations.map(o => <li key={o.id}><p>{o.text} <small>Source : {o.source}.</small></p><details><summary>Pourquoi cette observation ?</summary><ul>{o.explanation.map((text, index) => <li key={index}>{text}</li>)}</ul></details></li>)}</ul> : <p>Les données disponibles ne permettent pas encore de produire une observation personnalisée fiable.</p>}
  </section>;
}
