import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it, expect } from 'vitest';
import { heartRate, ascent } from '../core/analysis/session-format';
import { SessionList } from './SessionList';
import { SessionInformation } from '../pages/Session';
import { createBackup } from '../backup/format';
import { exportGzip, readBackupFile } from '../backup/compression';
import type { RunningSession } from '../types/session';
it('arrondit en français sans remplacer les absences par zéro', () => {
  expect(heartRate(134.28317373461013)).toBe('134 bpm');
  expect(heartRate(170.8)).toBe('171 bpm');
expect(ascent(91.28700000000009)).toBe('91 m');
expect(ascent(172.36599999999993)).toBe('172 m');
expect(ascent(143.258)).toBe('143 m');
  expect(ascent(0)).toBe('0 m'); expect(ascent(undefined)).toBe('—'); expect(heartRate(undefined)).toBe('—');
});
it('conserve la précision source et la mention estimée dans les deux présentations et sauvegardes', async () => {
  const session: RunningSession = { id: 'synthetic', title: 'Test', date: '2026-10-13', source: 'tcx', durationSeconds: 100, averageHeartRate: 134.28317373461013, maximumHeartRate: 170.8, ascentMeters: 91.28700000000009, ascentEstimate: { meters: 91.28700000000009, method: 'hysteresis-3m-v1', quality: 'partial' } };
  const original = structuredClone(session);
  const list = renderToStaticMarkup(createElement(SessionList, { sessions: [session] }));
  const detail = renderToStaticMarkup(createElement(SessionInformation, { session }));
for (const html of [list, detail]) { expect(html).toContain('134 bpm'); expect(html).toContain('91 m'); expect(html).toContain('D+ estimé (partiel)'); }
  expect(detail).toContain('171 bpm'); expect(session).toEqual(original);
  const data = { sessions: [session], details: [], coachProfile: null };
  for (const file of [new Blob([JSON.stringify(await createBackup(data, '0.5.0'))]), (await exportGzip(data, '0.5.0')).file]) {
    expect((await readBackupFile(file)).data.sessions[0]).toEqual(original);
  }
});
