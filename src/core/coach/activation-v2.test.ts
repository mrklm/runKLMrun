import { expect,it } from 'vitest';
import { COACH_V2_PUBLIC_DEPLOYMENT_ENABLED,coachV2ActivationMode,coachV2PublicEnabled } from './activation-v2';

it('active V2 publiquement sans dépendre du navigateur',()=>{
  expect(COACH_V2_PUBLIC_DEPLOYMENT_ENABLED).toBe(true);
  expect(coachV2ActivationMode()).toBe('public');
  expect(coachV2PublicEnabled()).toBe(true);
});

it('permet un rollback uniquement par le drapeau de code',()=>{
  expect(coachV2ActivationMode(false)).toBe('off');
});
