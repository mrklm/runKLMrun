import { describe, expect, it } from 'vitest';
import { reviewableBatch } from './created-activity-batch';
describe('seuil du bilan sur les créations confirmées', () => {
  it.each([0, 1, 2, 5, 6, 500])('%i créations', count => {
    const batch = { id: 'lot', database: 'synthetic', activityIds: Array.from({ length: count }, (_, index) => `id-${index}`) };
    expect(Boolean(reviewableBatch(batch))).toBe(count >= 1 && count <= 5);
  });
  it('ne compte pas deux fois un identifiant et ne mélange pas les lots', () => {
    const first = reviewableBatch({ id: 'a', database: 'profile-a', activityIds: ['one', 'one'] });
    expect(first?.activityIds).toEqual(['one']);
    expect(reviewableBatch({ id: 'b', database: 'profile-b', activityIds: ['two'] })).toEqual({ id: 'b', database: 'profile-b', activityIds: ['two'] });
    expect(first?.activityIds).toEqual(['one']);
  });
  it('ne déduit aucun bilan d’un arrêt brutal, même avec des créations connues', () => {
    expect(reviewableBatch({ id: 'a', database: 'synthetic', activityIds: ['one'] }, false)).toBeUndefined();
  });
});
