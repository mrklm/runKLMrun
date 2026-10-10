import { describe, expect, it, vi } from 'vitest';
import { loadSessionDetails, type DetailsState } from './load-session-details';
import type { SessionDetails } from '../types/session';
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
describe('lecture ciblée des détails', () => {
  it('ne demande que la séance consultée et accepte des détails absents', async () => {
    const getDetails = vi.fn().mockResolvedValue(undefined); const publish = vi.fn();
    loadSessionDetails({ getDetails }, 'one', publish); await flush();
    expect(getDetails.mock.calls).toEqual([['one']]);
    expect(publish.mock.calls).toEqual([[{ status: 'loading' }], [{ status: 'ready', details: undefined }]]);
  });
  it('signale les erreurs de stockage', async () => {
    const publish = vi.fn(); loadSessionDetails({ getDetails: vi.fn().mockRejectedValue(new Error('storage')) }, 'one', publish);
    await flush(); expect(publish).toHaveBeenLastCalledWith({ status: 'error' });
  });
  it.each([false, true])('ignore une ancienne réponse après navigation rapide (erreur : %s)', async fail => {
    let resolve!: (d: SessionDetails) => void; let reject!: (e: Error) => void;
    const old = new Promise<SessionDetails>((yes, no) => { resolve = yes; reject = no; });
    const getDetails = vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce({ id: 'new' });
    const states: DetailsState[] = []; const publish = (s: DetailsState) => states.push(s);
    const cancel = loadSessionDetails({ getDetails }, 'old', publish); await flush(); cancel();
    loadSessionDetails({ getDetails }, 'new', publish); await flush();
    if (fail) reject(new Error('late')); else resolve({ id: 'old' });
    await flush(); expect(states.at(-1)).toEqual({ status: 'ready', details: { id: 'new' } });
    expect(states).toHaveLength(3); expect(getDetails.mock.calls).toEqual([['old'], ['new']]);
  });
});
