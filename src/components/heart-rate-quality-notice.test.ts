import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { deleteDB } from 'idb';
import { afterEach } from 'vitest';
import { HeartRateQualityNotice } from './HeartRateQualityNotice';
import { ImportReportView } from './ImportReportView';
import { analyzeHeartRateQuality, type HeartRateIssue } from '../core/analysis/heart-rate-quality';
import { heartRateIssueMessage, heartRateQualityDetails, heartRateQualitySummary } from '../core/analysis/heart-rate-quality-messages';
import { emptyTcxReport, importTcxFiles } from '../importers/tcx-files';
import { tcxReport } from '../importers/polar-selection';
import type { XmlReader } from '../importers/tcx';
import { createSessionRepository } from '../storage/database';
import type { RunningSession, Sample } from '../types/session';

// Données entièrement synthétiques ; aucune activité réelle.
const session: RunningSession = { id: 'tcx:synthetic', title: 'Course à pied', date: '2026-01-01', durationSeconds: 600 };
const series = (count: number, value = (i: number) => 140 + (i % 7)): Sample[] => Array.from({ length: count }, (_, i) => ({ timeSeconds: i, value: value(i) }));
const render = (heartRate?: Sample[], value = session) => renderToStaticMarkup(createElement(HeartRateQualityNotice, { session: value, details: { id: value.id, heartRate } }));
const informal = /\b(tu|te|ton|ta|tes|toi)\b/i;

describe('messages de qualité de la fréquence cardiaque', () => {
  it('ne signale rien pour une série plausible', () => {
    expect(heartRateQualitySummary(analyzeHeartRateQuality(series(100)))).toBeUndefined();
  });
  it('distingue l’absence totale de la courbe manquante avec valeurs résumées', () => {
    expect(heartRateQualitySummary(analyzeHeartRateQuality(undefined))).toBe('Aucune fréquence cardiaque n’a été enregistrée. La durée, la distance et le parcours restent utilisables.');
    expect(heartRateQualitySummary(analyzeHeartRateQuality(undefined), true)).toContain('seules les valeurs résumées sont affichées');
  });
  it('arrondit la couverture vers le bas pour ne jamais l’exagérer', () => {
    expect(heartRateQualitySummary(analyzeHeartRateQuality(series(1000, i => i < 799 ? 140 + (i % 7) : null as unknown as number))))
      .toBe('La fréquence cardiaque n’a été enregistrée que sur 79 % des points de l’activité.');
  });
  it.each<[HeartRateIssue, string]>([
    [{ code: 'out-of-range', certainty: 'certain', count: 1, timesSeconds: [5] }, '1 valeur inférieure à 25 bpm ou supérieure à 250 bpm.'],
    [{ code: 'out-of-range', certainty: 'certain', count: 3, timesSeconds: [5] }, '3 valeurs inférieures à 25 bpm ou supérieures à 250 bpm.'],
    [{ code: 'isolated-spike', certainty: 'suspected', count: 2, timesSeconds: [1, 2] }, '2 pics isolés : un seul point s’écarte de plus de 40 bpm des mesures voisines.'],
    [{ code: 'flat-signal', certainty: 'suspected', count: 1, longestSeconds: 199 }, 'Valeur identique pendant 3 min 19 s.'],
    [{ code: 'interruption', certainty: 'suspected', count: 2, longestSeconds: 180 }, 'Mesure interrompue pendant 3 min alors que l’enregistrement continue (2 interruptions).'],
    [{ code: 'summary-mismatch', certainty: 'suspected', summaryAverage: 170, measuredAverage: 150.99 }, 'Moyenne indiquée par les tours : 170 bpm ; moyenne de la courbe : 151 bpm.'],
  ])('formule le motif %#', (issue, text) => expect(heartRateIssueMessage(issue)).toBe(text));
  it('sépare erreurs certaines et anomalies suspectées, toujours au vouvoiement', () => {
    const quality = analyzeHeartRateQuality(series(100, i => i === 10 ? 300 : i === 50 ? 210 : i > 60 ? null as unknown as number : 145));
    const { certain, suspected } = heartRateQualityDetails(quality);
    expect(certain).toHaveLength(2); expect(suspected).toHaveLength(1);
    for (const text of [...certain, ...suspected, heartRateQualitySummary(quality)!]) expect(text).not.toMatch(informal);
  });
});

describe('fiche de séance : qualité de la fréquence cardiaque', () => {
  it('reste silencieuse lorsque la série est plausible', () => expect(render(series(100))).toBe(''));
  it('signale l’absence sans annoncer de modification des mesures', () => {
    const html = render(undefined);
    expect(html).toContain('Qualité de la fréquence cardiaque'); expect(html).toContain('data-heart-rate-quality="absent"');
    expect(html).toContain('Aucune fréquence cardiaque n’a été enregistrée'); expect(html).not.toContain('mesures d’origine');
  });
  it('présente les anomalies suspectées avec prudence et rappelle la conservation des mesures', () => {
    const html = render(series(100, i => i === 50 ? 200 : 145));
    expect(html).toContain('data-heart-rate-quality="suspect"'); expect(html).toContain('Anomalies possibles, à interpréter avec prudence');
    expect(html).toContain('1 pic isolé'); expect(html).not.toContain('Valeurs erronées');
    expect(html).toContain('Les mesures d’origine sont conservées sans modification.');
  });
  it('présente les valeurs certainement erronées à part', () => {
    const html = render(series(100, i => i === 50 ? 300 : 145));
    expect(html).toContain('data-heart-rate-quality="invalid"'); expect(html).toContain('Valeurs erronées ou mesures manquantes');
    expect(html).not.toMatch(informal);
  });
});

describe('import TCX : remarques de fréquence cardiaque', () => {
  const names: string[] = [];
  afterEach(async () => { await Promise.all(names.splice(0).map(name => deleteDB(name))); });
  const readXml: XmlReader = text => new DOMParser().parseFromString(text, 'application/xml') as unknown as Document;
  const stamp = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 10, 0, 0) + seconds * 1000).toISOString();
  const tcx = (heart: (i: number) => number | null, count = 300) => `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>${stamp(0)}</Id><Lap StartTime="${stamp(0)}"><TotalTimeSeconds>${count}</TotalTimeSeconds><DistanceMeters>${count * 3}</DistanceMeters><Track>${Array.from({ length: count }, (_, i) => {
    const value = heart(i);
    return `<Trackpoint><Time>${stamp(i)}</Time><Position><LatitudeDegrees>45.${1000 + i}</LatitudeDegrees><LongitudeDegrees>4.${1000 + i}</LongitudeDegrees></Position><DistanceMeters>${i * 3}</DistanceMeters>${value === null ? '' : `<HeartRateBpm><Value>${value}</Value></HeartRateBpm>`}</Trackpoint>`;
  }).join('')}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

  it('importe la séance sans FC, ajoute une remarque et aucun motif de rejet', async () => {
    const name = `hr-quality-${crypto.randomUUID()}`; names.push(name);
    const repository = createSessionRepository(name);
    const files = [new File([tcx(() => null)], 'poche.tcx'), new File([tcx(i => 140 + (i % 7), 200)], 'normale.tcx')];
    const report = await importTcxFiles(files, repository, () => {}, readXml, new Date('2026-01-02T00:00:00Z'));
    expect(report).toMatchObject({ imported: 2, invalid: 0, issues: [] });
    expect(report.notices).toEqual(['Fichier n°1 : Aucune fréquence cardiaque n’a été enregistrée. La durée, la distance et le parcours restent utilisables.']);
    const stored = await repository.list();
    expect(stored.map(value => value.durationSeconds).sort()).toEqual([200, 300]);
  });

  it('affiche les remarques à part des motifs de rejet', () => {
    const html = renderToStaticMarkup(createElement(ImportReportView, { report: tcxReport({ ...emptyTcxReport(1), processed: 1, imported: 1, notices: ['Fichier n°1 : remarque synthétique.'] }), busy: false }));
    expect(html).toContain('Remarques sur les séances ajoutées'); expect(html).toContain('Fichier n°1 : remarque synthétique.');
    expect(html).not.toContain('Motifs des rejets');
  });
});
