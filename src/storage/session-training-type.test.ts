import 'fake-indexeddb/auto';
import { afterEach,expect,it,vi } from 'vitest';
import { deleteDB } from 'idb';
import { createTrainingTypeRepository,TrainingTypeConflictError } from './session-training-type';
import { createSessionRepository } from './database';
import { storageChanges } from './changes';
import { activitySportSignatureV2 } from '../core/coach/persistence-foundations-v2';
import { createBackup,verifyBackup } from '../backup/format';
import { createBackupService,prepareNative,readBackupSnapshot } from './backup';
import type { BackupData } from '../types/backup';

const names:string[]=[];const name=()=>{const value=`training-type-${crypto.randomUUID()}`;names.push(value);return value;};
const session={id:'run',title:'Course',date:'2026-10-10',sport:'RUNNING',durationSeconds:2400,source:'tcx' as const,ascentMeters:120};
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(names.splice(0).map(value=>deleteDB(value)));});
async function setup(){const n=name(),sessions=createSessionRepository(n),repository=createTrainingTypeRepository(n);await sessions.addImported(session);return {n,sessions,repository};}

it('ajoute, modifie et retire le type sans modifier la signature sportive',async()=>{
  const {repository}=await setup();expect((await repository.get('run'))?.trainingType).toBeUndefined();
  const original=activitySportSignatureV2((await repository.get('run'))!);
  await repository.save('run','long-run',undefined);expect((await repository.get('run'))?.trainingType).toBe('long-run');
  expect(activitySportSignatureV2((await repository.get('run'))!)).toBe(original);
  await repository.save('run','intervals','long-run');await repository.save('run',undefined,'intervals');
  expect((await repository.get('run'))?.trainingType).toBeUndefined();
});

it('valide la valeur, préserve une activité importée et refuse un conflit',async()=>{
  const {repository}=await setup();await expect(repository.save('run','unknown' as never,undefined)).rejects.toThrow(/invalide/);
  await repository.save('run','hills',undefined);await expect(repository.save('run','steady-run',undefined)).rejects.toBeInstanceOf(TrainingTypeConflictError);
  expect((await repository.get('run'))).toMatchObject({...session,trainingType:'hills'});
});

it('notifie les sessions seulement en cas de changement',async()=>{
  const {n,repository}=await setup(),spy=vi.spyOn(storageChanges,'committed');
  await repository.save('run','easy-endurance',undefined);expect(spy).toHaveBeenCalledWith(n,['sessions']);spy.mockClear();
  await repository.save('run','easy-endurance','easy-endurance');expect(spy).not.toHaveBeenCalled();
});

it('sauvegarde, restaure et conserve le type local lors d’un conflit de fusion',async()=>{
  const {n,repository}=await setup();await repository.save('run','hills',undefined);
  const processor={export:async(data:BackupData)=>{const document=await createBackup(data,'0.12.0');const text=JSON.stringify(document);return {file:new Blob([text]),jsonBytes:text.length};},parse:async(file:Blob)=>verifyBackup(JSON.parse(await file.text())),prepare:(preview:Parameters<typeof prepareNative>[0],options:Parameters<typeof prepareNative>[1])=>prepareNative(preview,options,new Date('2026-10-12T00:00:00.000Z'))};
  const service=createBackupService(processor,n),exported=await service.exportData();
  expect((await processor.parse(exported.file)).data.sessions[0].trainingType).toBe('hills');
  const incoming=await readBackupSnapshot(n);incoming.sessions[0]={...incoming.sessions[0],trainingType:'intervals'};
  const document=await createBackup(incoming,'0.12.0');const preview=await service.preview(new Blob([JSON.stringify(document)]));
  const report=await service.restore(preview,{mode:'merge',profile:'keep'});
  expect(report.conflicts).toBeGreaterThan(0);expect((await repository.get('run'))?.trainingType).toBe('hills');
  await service.restore(await service.preview(exported.file),{mode:'replace',profile:'restore'});
  expect((await repository.get('run'))?.trainingType).toBe('hills');
});
