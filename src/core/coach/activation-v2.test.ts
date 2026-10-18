import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { COACH_V2_INTERNAL_KEY,COACH_V2_PUBLIC_DEPLOYMENT_ENABLED,coachV2ActivationMode,coachV2PublicEnabled } from './activation-v2';

const values=new Map<string,string>();
beforeEach(()=>{values.clear();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,
  setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});});
afterEach(()=>vi.unstubAllGlobals());

it('garde le déploiement public fermé par défaut',()=>{
  expect(COACH_V2_PUBLIC_DEPLOYMENT_ENABLED).toBe(false);
  expect(coachV2PublicEnabled()).toBe(false);
});

it('conserve une activation interne distincte en développement',()=>{
  expect(coachV2ActivationMode()).toBe('off');
  localStorage.setItem(COACH_V2_INTERNAL_KEY,'enabled');
  expect(coachV2ActivationMode()).toBe(import.meta.env.DEV?'internal':'off');
});
