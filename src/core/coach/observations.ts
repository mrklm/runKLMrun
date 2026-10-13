import type { CoachProfileValues, Weekday } from '../../types/coach-profile';
import type { TrainingComparison } from './comparison';
import { formatNumber as n } from '../analysis/session-summary';
import { DAYS, maximumMinutesForDay } from './profile';
export interface Observation { id: string; text: string; source: 'bilan' | 'profil et bilan'; explanation: string[] }
const weekdays: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const weekday = (date: string) => weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];
const dateLabel = (date: string) => date.split('-').reverse().join('/');
/** Classement stable : interruption, écarts personnels, changements, constats stables. */
export function coachObservations({ current: c, previous: p, changes: d }: TrainingComparison, profile?: CoachProfileValues): Observation[] {
  const result: (Observation & { priority: number })[] = [];
  const period = `Période analysée : du ${dateLabel(c.startDate)} au ${dateLabel(c.referenceDate)} (${c.weeks} semaines).`;
  const previous = `Comparaison : du ${dateLabel(p.startDate)} au ${dateLabel(p.referenceDate)}, de même durée.`;
  const caveat = 'Ces constats portent sur les séances enregistrées ; des sorties non importées peuvent modifier le bilan.';
  const add = (id: string, text: string, priority: number, explanation: string[], source: Observation['source'] = 'bilan') => result.push({ id, text, priority, source, explanation: [period, ...explanation, caveat] });
  const gapThreshold = Math.max(7, Math.ceil(2 * p.weeks * 7 / p.sessionCount));
  if (p.sessionCount >= 4 && c.latest && c.latest.daysAgo >= gapThreshold)
    add('interruption', `Votre dernière sortie enregistrée remonte à ${c.latest.daysAgo} jours. La raison de cet intervalle n’est pas connue.`, 100,
      [previous, `${p.sessionCount} sorties précédentes ; dernière sortie le ${dateLabel(c.latest.date)}.`, `Le repère retenu est ${gapThreshold} jours : deux intervalles moyens précédents, arrondis au jour supérieur, avec un minimum de sept jours. Au moins quatre sorties précédentes sont nécessaires. Ce repère n’évalue pas la récupération.`]);
  if (c.sessionCount && profile?.goal.distance && c.longest)
    add('objectif', `Votre distance cible est de ${n(profile.goal.distance.meters / 1000)} km ; votre plus longue sortie connue atteint ${n(c.longest.distanceMeters / 1000)} km. Cela ne permet pas de conclure à votre préparation.`, 50,
      [`Distance cible déclarée : ${n(profile.goal.distance.meters / 1000)} km. Sortie du ${dateLabel(c.longest.date)} : ${n(c.longest.distanceMeters / 1000)} km.`, `Distance exploitable pour ${c.distance.known}/${c.sessionCount} sorties ; le maximum porte uniquement sur ces sorties.`], 'profil et bilan');
  const a = profile?.availability;
  if (c.sessionCount && a?.sessionsPerWeek !== undefined)
    add('frequence-souhaitee', `Vous souhaitez ${n(a.sessionsPerWeek)} sorties par semaine ; vous enregistrez actuellement ${n(c.sessionsPerWeek)} sorties par semaine. Cet écart éventuel n’est pas un échec.`, c.sessionsPerWeek !== a.sessionsPerWeek ? 80 : 20,
      [`Profil : ${a.sessionsPerWeek} sorties souhaitées par semaine. Bilan : ${c.sessionCount} sorties réparties sur ${c.weeks} semaines, y compris les semaines sans sortie.`], 'profil et bilan');
  if (c.sessionCount && a?.days !== undefined) {
    const outside = c.days.filter(day => !a.days!.includes(weekday(day.date)));
    const actual = weekdays.filter(day => c.days.some(entry => weekday(entry.date) === day));
    add('disponibilites', `${outside.length} jour(s) avec une sortie sont hors de vos jours actuellement déclarés disponibles. Ces disponibilités ne sont pas des obligations.`, outside.length ? 70 : 15,
      [`Jours disponibles : ${a.days.map(day => DAYS[day]).join(', ') || 'aucun'}. Jours observés : ${actual.map(day => DAYS[day]).join(', ')}.`, `${outside.length} sur ${c.activeDays} jours d’activité, comptés une seule fois même avec plusieurs sorties. Les préférences actuelles ne décrivent pas forcément vos disponibilités passées.`], 'profil et bilan');
  }
  if (profile && c.sessionCount) {
    if (a?.durationMode === 'custom') {
      const matched = c.days.filter(day => day.durationSeconds !== null && maximumMinutesForDay(profile, weekday(day.date)) !== undefined);
      const over = matched.filter(day => day.durationSeconds! > maximumMinutesForDay(profile, weekday(day.date))! * 60);
      if (matched.length) add('durees-disponibles', `${over.length} jour(s) dépassent la durée maximale actuellement déclarée, parmi ${matched.length} jours comparables. Il s’agit d’un constat, pas d’une consigne.`, over.length ? 65 : 10,
        [`Comparaison des durées cumulées de chaque jour aux maxima du profil : ${a.days?.filter(day => maximumMinutesForDay(profile, day) !== undefined).map(day => `${DAYS[day]} ${maximumMinutesForDay(profile, day)} min`).join(', ')}.`, `${matched.length}/${c.activeDays} jours comparables ; jours sans plafond actif ou avec durée incomplète exclus.`, ...matched.map(day => `${dateLabel(day.date)} : ${n(day.durationSeconds! / 60)} min enregistrées, maximum déclaré ${maximumMinutesForDay(profile, weekday(day.date))} min.`), 'Ces disponibilités sont actuelles, sans historique de leurs modifications.'], 'profil et bilan');
    } else if (a?.minutesPerSession !== undefined && c.duration.known) {
      add('durees-disponibles', `Vos sorties connues durent en moyenne ${n(c.duration.value! / c.duration.known / 60)} min ; vous indiquez ${a.minutesPerSession} min disponibles par séance. Ce temps disponible n’est pas une durée à atteindre.`, c.duration.value! / c.duration.known > a.minutesPerSession * 60 ? 65 : 10,
        [`Durée exploitable pour ${c.duration.known}/${c.sessionCount} sorties : ${n(c.duration.value! / 60)} min au total, divisées par ${c.duration.known} sorties connues.`, `Profil actuel : ${a.minutesPerSession} min par séance. Cette moyenne ne décrit pas chaque sortie et reste partielle si des durées manquent.`], 'profil et bilan');
    }
  }
  if (d.frequency !== null)
    add('regularite', `Vous enregistrez ${n(c.sessionsPerWeek)} sorties par semaine, contre ${n(p.sessionsPerWeek)} précédemment.`, d.frequency !== 0 ? 60 : 5,
      [previous, `${c.sessionCount} sorties actuelles, ${p.sessionCount} précédentes ; moyennes sur ${c.weeks} semaines incluant les semaines sans sortie.`]);
  for (const [id, measure, change, divisor, unit] of [['distance', 'distance', d.distance, 1000, 'km'], ['duree', 'duration', d.duration, 60, 'min']] as const) {
    if (change === null) continue;
    add(id, `Vous avez enregistré ${n(c[measure].value! / divisor)} ${unit}, contre ${n(p[measure].value! / divisor)} ${unit} précédemment. Cette variation ne mesure pas votre condition physique.`, change !== 0 ? 55 : 5,
      [previous, `Mesure connue pour ${c[measure].known}/${c.sessionCount} sorties actuelles et ${p[measure].known}/${p.sessionCount} précédentes.`, `Écart : ${change > 0 ? '+' : ''}${n(change / divisor)} ${unit}. Comparaison autorisée uniquement si cette mesure est complète dans les deux périodes ; l’autre mesure n’est pas nécessaire.`]);
  }
  return result.sort((a, b) => b.priority - a.priority).slice(0, 4).map(({ priority: _priority, ...observation }) => observation);
}
