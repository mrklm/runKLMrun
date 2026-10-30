import { test as base, expect } from '@playwright/test';
/** Contextes Playwright neufs uniquement ; toute tentative historique est bloquée et fait échouer le test. */
export const test = base.extend<{ historicalGuard: void }>({
  historicalGuard: [async ({ context }, use) => {
    const forbidden: string[] = [];
    await context.exposeBinding('__historicalAccess', (_source, operation: string) => { forbidden.push(operation); });
    await context.addInitScript(() => {
      const factory = IDBFactory.prototype;
      const originalOpen = factory.open, originalDelete = factory.deleteDatabase;
      const guard = (name: string, operation: string) => {
        if (name !== 'runklmrun') return;
        void (globalThis as unknown as { __historicalAccess: (value: string) => Promise<void> }).__historicalAccess(operation);
        throw new Error('Accès à la base historique interdit pendant les tests.');
      };
      factory.open = function (name, version) { guard(name, 'open'); return originalOpen.call(this, name, version); };
      factory.deleteDatabase = function (name) { guard(name, 'delete'); return originalDelete.call(this, name); };
    });
    await use();
    expect(forbidden).toEqual([]);
  }, { auto: true }],
});
export { expect };
