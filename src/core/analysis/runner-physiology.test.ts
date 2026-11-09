import { describe, expect, it } from 'vitest';
import { estimatedCardioLoad, heartRateSettingsErrors } from './runner-physiology';

const male = { restingHeartRate: 55, maxHeartRate: 175, loadCoefficients: 'male' as const };
const hour = { durationSeconds: 3600, averageHeartRate: 145 }; // réserve 0,75

describe('charge cardiaque estimée (TRIMP de Banister)', () => {
  it('applique les coefficients publiés et la moyenne des deux courbes pour « non précisé »', () => {
    const x = 0.75, m = 60 * x * 0.64 * Math.exp(1.92 * x), f = 60 * x * 0.86 * Math.exp(1.67 * x);
    expect(estimatedCardioLoad(hour, male)).toBeCloseTo(m, 6);
    expect(estimatedCardioLoad(hour, { ...male, loadCoefficients: 'female' })).toBeCloseTo(f, 6);
    expect(estimatedCardioLoad(hour, { ...male, loadCoefficients: 'unspecified' })).toBeCloseTo((m + f) / 2, 6);
  });
  it('ne calcule rien sans réglages complets, sans FC, avec FC exclue ou hors réserve', () => {
    expect(estimatedCardioLoad(hour, { ...male, loadCoefficients: undefined })).toBeUndefined();
    expect(estimatedCardioLoad(hour, { ...male, maxHeartRate: undefined })).toBeUndefined();
    expect(estimatedCardioLoad({ durationSeconds: 3600 }, male)).toBeUndefined();
    expect(estimatedCardioLoad({ ...hour, heartRateIgnored: true }, male)).toBeUndefined();
    expect(estimatedCardioLoad({ ...hour, averageHeartRate: 50 }, male)).toBeUndefined();
    expect(estimatedCardioLoad({ ...hour, averageHeartRate: 180 }, male)).toBeUndefined();
    expect(estimatedCardioLoad(hour, { ...male, restingHeartRate: 180 })).toBeUndefined();
  });
  it('contrôle les saisies sans imposer de seuil sportif', () => {
    expect(heartRateSettingsErrors({})).toEqual([]);
    expect(heartRateSettingsErrors(male)).toEqual([]);
    expect(heartRateSettingsErrors({ restingHeartRate: 20 })).toHaveLength(1);
    expect(heartRateSettingsErrors({ maxHeartRate: 175.5 })).toHaveLength(1);
    expect(heartRateSettingsErrors({ restingHeartRate: 110, maxHeartRate: 105 })).toHaveLength(1);
    expect(heartRateSettingsErrors({ loadCoefficients: 'autre' as never })).toHaveLength(1);
  });
});
