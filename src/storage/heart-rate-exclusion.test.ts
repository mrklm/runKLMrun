import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { deleteDB } from 'idb';
import { createHeartRateExclusionRepository, HeartRateExclusionConflictError } from './heart-rate-exclusion';
import { createSessionRepository } from './database';
import { subscribeStorage } from './changes';
import { createBackup, parseBackup } from '../backup/format';
import { validateBackup } from '../backup/validation';
import { observeHistory } from '../core/coach/foundations';
import { activitySportSignatureV2 } from '../core/coach/persistence-foundations-v2';
import { SessionCurves, SessionInformation } from '../pages/Session';
import { SessionList } from '../components/SessionList';
import { HeartRateQualityNotice } from '../components/HeartRateQualityNotice';
import type { RunningSession, SessionDetails } from '../types/session';

// Bases et séances synthétiques uniquement ; jamais la base historique.
const names: string[] = [];
afterEach(async () => { await Promise.all(names.splice(0).map(name => deleteDB(name))); });
const session: RunningSession = { id: 'tcx:hr', title: 'Course à pied', date: '2026-01-02', durationSeconds: 600, distanceMeters: 1800,
  averageHeartRate: 151, maximumHeartRate: 178, cardioLoad: 42, heartRateZones: [{ lower: 120, upper: 140, durationSeconds: 300 }] };
const details: SessionDetails = { id: 'tcx:hr', heartRate: [{ timeSeconds: 0, value: 150 }, { timeSeconds: 1, value: 152 }], speed: [{ timeSeconds: 0, value: 3 }, { timeSeconds: 1, value: 3 }] };
async function stored() {
  const name = `hr-exclusion-${crypto.randomUUID()}`; names.push(name);
  const sessions = createSessionRepository(name);
  await sessions.addImported(structuredClone(session), structuredClone(details));
  return { name, sessions, repository: createHeartRateExclusionRepository(name) };
}

describe('exclusion manuelle des données cardiaques', () => {
  it('ignore puis rétablit sans modifier les mesures ni les détails', async () => {
    const { name, sessions, repository } = await stored();
    const scopes: string[] = [];
    const unsubscribe = subscribeStorage(['sessions'], () => scopes.push('sessions'), name);
    expect((await repository.save(session.id, true, false)).heartRateIgnored).toBe(true);
    const [ignored] = await sessions.list();
    expect(ignored).toEqual({ ...session, heartRateIgnored: true });
    expect(await sessions.getDetails(session.id)).toEqual(details);
    await repository.save(session.id, false, true);
    expect((await sessions.list())[0]).toEqual(session);
    await new Promise(resolve => setTimeout(resolve, 10)); unsubscribe();
    expect(scopes.length).toBeGreaterThan(0);
  });
  it('refuse un état attendu périmé et une activité absente, sans écriture', async () => {
    const { sessions, repository } = await stored();
    await expect(repository.save(session.id, false, true)).rejects.toBeInstanceOf(HeartRateExclusionConflictError);
    await expect(repository.save('absente', true, false)).rejects.toThrow('n’est plus disponible');
    expect((await sessions.list())[0]).toEqual(session);
  });
  it('n’écrit rien lorsque l’état demandé est déjà en place', async () => {
    const { sessions, repository } = await stored();
    await repository.save(session.id, false, false);
    expect((await sessions.list())[0]).toEqual(session);
  });
});

describe('sauvegarde de l’exclusion', () => {
  const data = (value: RunningSession) => ({ sessions: [value], details: [], coachProfile: null });
  it('utilise le format 8 seulement lorsqu’une exclusion existe et la restitue', async () => {
    expect((await createBackup(data(session), '1.2.0')).formatVersion).toBe(1);
    const backup = await createBackup(data({ ...session, heartRateIgnored: true }), '1.2.0');
    expect(backup.formatVersion).toBe(8);
    expect((await parseBackup(JSON.stringify(backup))).data.sessions[0].heartRateIgnored).toBe(true);
  });
  it('refuse une exclusion dans un format antérieur ou une valeur autre que true', async () => {
    const backup = await createBackup(data({ ...session, heartRateIgnored: true }), '1.2.0');
    expect(() => validateBackup({ ...backup, formatVersion: 7 })).toThrow('format 8');
    const invalid = await createBackup(data(session), '1.2.0');
    expect(() => validateBackup({ ...invalid, formatVersion: 8, data: { ...invalid.data, sessions: [{ ...session, heartRateIgnored: false }] } })).toThrow();
  });
});

describe('effets de l’exclusion', () => {
  const ignored: RunningSession = { ...session, heartRateIgnored: true };
  it('retire la FC moyenne des faits du Coach sans changer la signature sportive', () => {
    expect(observeHistory([session], '2026-01-10').activities[0].averageHeartRate).toMatchObject({ status: 'available', value: 151 });
    expect(observeHistory([ignored], '2026-01-10').activities[0].averageHeartRate).toEqual({ status: 'absent' });
    expect(activitySportSignatureV2(ignored)).toBe(activitySportSignatureV2(session));
  });
  it('masque FC, charge cardio et zones dans la fiche, et propose le contrôle fourni', () => {
    const html = renderToStaticMarkup(createElement(SessionInformation, { session: ignored, heartRateControl: createElement('p', null, 'contrôle synthétique') }));
    expect(html).toContain('Ignorée'); expect(html).not.toContain('151 bpm'); expect(html).not.toContain('178 bpm');
    expect(html).not.toContain('Zones cardiaques Polar'); expect(html).toContain('contrôle synthétique');
    expect(renderToStaticMarkup(createElement(SessionInformation, { session }))).toContain('151 bpm');
  });
  it('retire la courbe cardiaque mais conserve les autres courbes', () => {
    expect(renderToStaticMarkup(createElement(SessionCurves, { details }))).toContain('Fréquence cardiaque');
    const html = renderToStaticMarkup(createElement(SessionCurves, { details, heartRateIgnored: true }));
    expect(html).not.toContain('Fréquence cardiaque'); expect(html).toContain('Allure');
  });
  it('affiche « Ignorée » dans l’historique', () => {
    const html = renderToStaticMarkup(createElement(SessionList, { sessions: [ignored] }));
    expect(html).toContain('Ignorée'); expect(html).not.toContain('151 bpm');
  });
  it('signale l’exclusion sur la fiche, au vouvoiement', () => {
    const html = renderToStaticMarkup(createElement(HeartRateQualityNotice, { session: ignored }));
    expect(html).toContain('data-heart-rate-quality="ignored"');
    expect(html).toContain('Les données cardiaques de cette activité sont ignorées');
    expect(html).not.toMatch(/\b(tu|te|ton|ta|tes|toi)\b/i);
  });
});
