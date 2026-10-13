import type { BackupData } from '../types/backup';
export const fixture = (): BackupData => ({
  sessions: [{ id: 'polar:synthetic', title: 'Sortie synthétique', date: '2026-10-01', startTime: '2026-10-01T10:00:00Z', sport: 'RUNNING', durationSeconds: 600, distanceMeters: 1000, heartRateZones: [{ lower: 100, upper: 150 }] }],
  details: [{ id: 'polar:synthetic', cadenceUnit: 'rpm', heartRate: [{ timeSeconds: 0, value: 120 }, { timeSeconds: 2.5, value: null }], altitude: [{ timeSeconds: 1, value: -5 }], gps: [{ timeSeconds: 0, latitude: null, longitude: null }], laps: [{ startTime: '2026-10-01T10:00:00Z', durationSeconds: 600 }] }],
  coachProfile: { id: 'local', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', revision: 1, goal: {}, preferences: {}, availability: { durationMode: 'custom', days: ['monday'], maxMinutesByDay: { monday: 45, sunday: 120 } } },
});
