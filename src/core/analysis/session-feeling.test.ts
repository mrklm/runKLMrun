import { describe, expect, it } from 'vitest';
import { feelingEffortCategory, feelingRpe, feelingRpeField, LEGACY_EFFORT_RPE, rpeText, sameFeeling } from './session-feeling';
import { requiresBackupV9, backupFormatVersion } from '../../backup/version';
import { createBackup, verifyBackup } from '../../backup/format';
import { fixture } from '../../backup/test-fixture';
import type { LegacySessionEffort } from '../../types/evolving-coach';

describe('effort perçu 0 à 10', () => {
  it('convertit les anciennes catégories selon les libellés CR-10 de Foster', () => {
    expect(LEGACY_EFFORT_RPE).toEqual({ easy: 2, moderate: 3, hard: 5, 'very-hard': 7 });
    expect(feelingRpe({ effort: 'hard' })).toBe(5);
    expect(feelingRpe({ rpe: 0 })).toBe(0);
    expect(feelingRpe({ comment: 'x' })).toBeUndefined();
    expect(feelingRpe(undefined)).toBeUndefined();
    expect(feelingRpeField({ effort: 'very-hard' })).toBe('7');
    expect(rpeText(7)).toBe('7/10 — Très difficile'); expect(rpeText(6)).toBe('6/10 — Nettement difficile'); expect(rpeText(0)).toBe('0/10');
  });
  it('restitue exactement la catégorie d’origine au Coach pour les anciennes saisies', () => {
    for (const effort of Object.keys(LEGACY_EFFORT_RPE) as LegacySessionEffort[]) {
      expect(feelingEffortCategory({ effort })).toBe(effort);
      expect(feelingEffortCategory({ rpe: LEGACY_EFFORT_RPE[effort] })).toBe(effort);
    }
  });
  it('classe chaque valeur 0 à 10 pour les règles existantes', () => {
    const categories = Array.from({ length: 11 }, (_, rpe) => feelingEffortCategory({ rpe }));
    expect(categories).toEqual(['easy', 'easy', 'easy', 'moderate', 'moderate', 'hard', 'hard', 'very-hard', 'very-hard', 'very-hard', 'very-hard']);
    expect(feelingEffortCategory({ comment: 'seul' })).toBeUndefined();
  });
  it('considère une ancienne catégorie et sa conversion comme identiques, sans réécriture', () => {
    expect(sameFeeling({ effort: 'hard', comment: 'a' }, { rpe: 5, comment: 'a' })).toBe(true);
    expect(sameFeeling({ effort: 'hard' }, { rpe: 6 })).toBe(false);
    expect(sameFeeling({ rpe: 5, comment: 'a' }, { rpe: 5 })).toBe(false);
  });
});

describe('sauvegarde format 9', () => {
  it('n’utilise le format 9 qu’en présence d’un effort 0 à 10', async () => {
    const legacy = fixture(); legacy.sessions[0].feeling = { effort: 'hard' };
    expect(requiresBackupV9(legacy)).toBe(false); expect(backupFormatVersion(legacy)).toBeLessThan(9);
    const current = fixture(); current.sessions[0].feeling = { rpe: 6, comment: 'Côtes' };
    expect(backupFormatVersion(current)).toBe(9);
    const document = await createBackup(current, '1.3.0');
    expect(document.formatVersion).toBe(9);
    expect(await verifyBackup(document)).toEqual(document);
  });
});
