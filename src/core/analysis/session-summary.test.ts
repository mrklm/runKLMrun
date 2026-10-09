import { describe, expect, it } from 'vitest';
import { groupHistory, isoWeek, statistics, totals, validSessionDate } from './session-summary';
import type { RunningSession } from '../../types/session';
import { contrast, THEMES, themeVariables } from '../../themes/themes';
let sequence = 0;
function session(date: string, values: Partial<RunningSession> = {}): RunningSession {
  return { id: `synthetic-${sequence++}`, title: 'Sortie synthétique', date, durationSeconds: 1800, ...values };
}

describe('historique chronologique', () => {
  it('classe années et mois du plus récent au plus ancien', () => {
    const result = groupHistory([session('2024-01-03'), session('2025-02-01'), session('2024-12-01'), session('2025-01-05')]);
    expect(result.years.map(g => g.year)).toEqual(['2025', '2024']);
    expect(result.years[0].months.map(g => g.key)).toEqual(['2025-02', '2025-01']);
    expect(result.years[1].months.map(g => g.label)).toEqual(['décembre', 'janvier']);
  });
  it('classe les séances par date et heure sans modifier le tableau fourni', () => {
    const early = session('2025-02-02', { startTime: '2025-02-02T08:00:00' }), late = session('2025-02-02', { startTime: '2025-02-02T18:00:00' }), first = session('2025-02-01');
    const input = Object.freeze([early, first, late]);
    expect(groupHistory(input).years[0].months[0].sessions.map(s => s.id)).toEqual([late.id, early.id, first.id]);
    expect(input.map(s => s.id)).toEqual([early.id, first.id, late.id]);
  });
  it('calcule les totaux annuels et mensuels sans arrondir prématurément', () => {
    const { years } = groupHistory([session('2025-01-01', { distanceMeters: 1200.5 }), session('2025-01-02', { distanceMeters: 2300.25 }), session('2025-02-02', { distanceMeters: 1000 })]);
    expect(years[0].totals.count).toBe(3); expect(years[0].totals.distance.value).toBe(4500.75);
    expect(years[0].months[1].totals.distance.value).toBe(3500.75);
  });
  it('isole les dates invalides sans perdre les séances', () => {
    const invalid = session('2025-02-30');
    const result = groupHistory([invalid, session('2025-02-01')]);
    expect(result.undated).toEqual([invalid]); expect(result.years[0].totals.count).toBe(1);
  });
  it('traite un historique vide', () => { expect(groupHistory([])).toEqual({ years: [], undated: [] }); });
});

describe('semaines ISO et dates civiles', () => {
  it.each([
    ['2020-12-28', '2020-S53', '2020-12-28'], ['2021-01-01', '2020-S53', '2020-12-28'],
    ['2021-01-03', '2020-S53', '2020-12-28'], ['2021-01-04', '2021-S01', '2021-01-04'],
    ['2018-12-31', '2019-S01', '2018-12-31'], ['2024-12-30', '2025-S01', '2024-12-30'],
    ['2024-02-29', '2024-S09', '2024-02-26'], ['2025-03-30', '2025-S13', '2025-03-24'],
  ])('%s appartient à %s', (date, key, monday) => { expect(isoWeek(date)).toEqual({ key, monday }); });
  it('groupe une semaine à cheval sur deux années sans la dupliquer', () => {
    const data = statistics([session('2020-12-31', { distanceMeters: 1000 }), session('2021-01-01', { distanceMeters: 2000 })]);
    expect(data.weeks).toHaveLength(1); expect(data.weeks[0].totals.distance.value).toBe(3000);
    expect(data.weeks[0].totals.count).toBe(2);
  });
  it('filtre l’année civile avant de regrouper les semaines ISO', () => {
    const entries = [session('2020-12-31', { distanceMeters: 1000 }), session('2021-01-01', { distanceMeters: 2000 })];
    const year2021 = statistics(entries, '2021'), year2020 = statistics(entries, '2020');
    expect(year2021.totals.count).toBe(1); expect(year2021.weeks[0].key).toBe('2020-12-28');
    expect(year2021.weeks[0].totals.distance.value).toBe(2000);
    expect(year2020.weeks.at(-1)?.totals.distance.value).toBe(1000);
    expect(year2021.months.every(p => p.key.startsWith('2021-'))).toBe(true);
  });
  it('ne convertit pas la date civile en fonction du décalage UTC de la séance', () => {
    const data = statistics([session('2021-01-04', { startTime: '2021-01-04T00:30:00+14:00' })]);
    expect(data.weeks[0].key).toBe('2021-01-04');
  });
  it.each(['2025-02-30', '2025-13-01', 'not-a-date', '2025-1-01'])('refuse la date %s', date => { expect(validSessionDate(date)).toBe(false); });
});

describe('agrégations statistiques', () => {
  it('additionne distances, heures et dénivelés sans consulter les détails', () => {
    const data = statistics([session('2025-01-01', { distanceMeters: 1500, durationSeconds: 1800, ascentMeters: 10 }), session('2025-01-02', { distanceMeters: 2500, durationSeconds: 5400, ascentMeters: 25 })]);
    expect(data.totals.count).toBe(2); expect(data.totals.distance.value! / 1000).toBe(4);
    expect(data.totals.duration.value! / 3600).toBe(2); expect(data.totals.ascent.value).toBe(35);
    expect(data.weeks[0].totals.ascent.value).toBe(35); expect(data.months[0].totals.count).toBe(2);
  });
  it('distingue une mesure absente, un total partiel et un vrai zéro', () => {
    const data = statistics([session('2025-01-01', { distanceMeters: 1000, ascentMeters: 0 }), session('2025-01-02')]);
    expect(data.totals.distance).toEqual({ value: 1000, known: 1, total: 2 });
    expect(data.totals.ascent).toEqual({ value: 0, known: 1, total: 2 });
    const absent = statistics([session('2025-01-01')]);
    expect(absent.totals.distance).toEqual({ value: null, known: 0, total: 1 });
    expect(absent.weeks[0].totals.ascent.value).toBeNull();
  });
  it('écarte les nombres invalides et conserve le compteur de couverture', () => {
    expect(totals([session('2025-01-01', { distanceMeters: NaN, ascentMeters: -3, durationSeconds: Infinity })])).toMatchObject({
      distance: { value: null, known: 0 }, ascent: { value: null, known: 0 }, duration: { value: null, known: 0 },
    });
  });
  it('affiche les mois et semaines sans séance comme périodes sans enregistrement', () => {
    const data = statistics([session('2025-01-01'), session('2025-03-01')]);
    expect(data.months.map(m => m.key)).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(data.months[1].totals.distance).toEqual({ value: 0, known: 0, total: 0 });
    expect(data.weeks.some(w => w.totals.count === 0)).toBe(true);
  });
  it('produit douze mois pour une année choisie et un ordre croissant', () => {
    const data = statistics([session('2025-07-01')], '2025');
    expect(data.months).toHaveLength(12); expect(data.months[0].key).toBe('2025-01'); expect(data.months.at(-1)?.key).toBe('2025-12');
    expect(data.weeks.map(p => p.key)).toEqual(data.weeks.map(p => p.key).sort());
  });
  it('garde des mois distincts sur plusieurs années', () => {
    const data = statistics([session('2024-01-01'), session('2025-01-01')]);
    expect(data.months).toHaveLength(13);
    expect(data.months[0].totals.count).toBe(1); expect(data.months[12].totals.count).toBe(1);
  });
  it('traite une période vide et les dates inutilisables', () => {
    expect(statistics([])).toMatchObject({ weeks: [], months: [], totals: { count: 0 } });
    expect(statistics([session('2025-01-01')], '2024').totals.count).toBe(0);
    expect(statistics([session('bad')])).toMatchObject({ excludedDates: 1, weeks: [], totals: { count: 0 } });
  });
  it('conserve la cohérence entre historique, indicateurs et séries', () => {
    const entries = [session('2024-12-31', { distanceMeters: 1000, ascentMeters: 20 }), session('2025-01-01', { distanceMeters: 2000 }), session('2025-02-05', { distanceMeters: 3500, ascentMeters: 50 })];
    for (const year of groupHistory(entries).years) {
      const data = statistics(entries, year.year);
      expect(data.totals).toEqual(year.totals);
      expect(data.weeks.reduce((sum, p) => sum + (p.totals.distance.value ?? 0), 0)).toBe(year.totals.distance.value);
      expect(data.months.reduce((sum, p) => sum + p.totals.count, 0)).toBe(year.totals.count);
      expect(year.months.reduce((sum, m) => sum + (m.totals.distance.value ?? 0), 0)).toBe(data.totals.distance.value);
    }
  });
  it('agrège plusieurs milliers de résumés sans modifier les données', () => {
    const entries = Array.from({ length: 10000 }, (_, i) => Object.freeze(session(`2025-${String(i % 12 + 1).padStart(2, '0')}-01`, { distanceMeters: 1000 })));
    const data = statistics(Object.freeze(entries));
    expect(data.totals.count).toBe(10000); expect(data.totals.distance.value).toBe(10000000);
    expect(groupHistory(entries).years[0].totals).toEqual(data.totals);
  });
});

describe('couleurs des graphiques sur les thèmes sombres, clairs et Pouêt', () => {
  it.each(THEMES)('$name : ligne, texte et grille dérivent de la palette et restent contrastés', theme => {
    const vars = themeVariables(theme);
    expect(contrast(theme.colors.PANEL, vars['--chart-line'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.PANEL, vars['--panel-fg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.PANEL, vars['--chart-grid'])).toBeGreaterThanOrEqual(4.5);
  });
});
