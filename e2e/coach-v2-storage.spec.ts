import { expect,test,type Page } from '@playwright/test';

const modules='/runKLMrun/src/';
async function record(page:Page,database:string,id:string,generation=1,duration=1800) {
  return page.evaluate(async input=>{
    const core=await import(/* @vite-ignore */ input.modules+'core/coach/persistence-foundations-v2.ts');
    const {createSuggestionV2Repository}=await import(/* @vite-ignore */ input.modules+'storage/coach-suggestions-v2.ts');
    const candidate={phase:'candidate' as const,content:{type:'easy-endurance' as const,totalDurationSeconds:input.duration,
      intensity:'easy' as const,terrain:'flat' as const,shortSummary:'Endurance facile'},opportunity:{contractVersion:1 as const,
      goal:'endurance' as const,suggestedFor:core.civilDate('2026-10-20'),anchor:{kind:'bootstrap' as const,referenceDate:core.civilDate('2026-10-18')},
      availability:{weekday:'tuesday' as const,maximumSeconds:3600},generation:input.generation}};
    return createSuggestionV2Repository(input.database).recordPresented({selection:core.selectCandidateV2(candidate),
      moment:{presentedAt:core.instantIso('2026-10-18T08:00:00.000Z'),presentedOn:core.civilDate('2026-10-18'),
        timeZone:core.ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'},
      provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:[],limitationCodes:[]},createId:()=>input.id});
  },{modules,database,id,generation,duration});
}

test('transactions V2 concurrentes dans deux onglets et réouverture',async({page,context})=>{
  const database=`browser-v2-${Date.now()}`;await page.goto('./');const other=await context.newPage();await other.goto('./');
  const [left,right]=await Promise.all([record(page,database,'left'),record(other,database,'right')]);
  expect([left.status,right.status].sort()).toEqual(['created','existing']);expect(left.occurrence.id).toBe(right.occurrence.id);
  const original=left.occurrence;

  const replace=async(target:Page,id:string)=>target.evaluate(async input=>{
    const core=await import(/* @vite-ignore */ input.modules+'core/coach/persistence-foundations-v2.ts');
    const {createSuggestionV2Repository}=await import(/* @vite-ignore */ input.modules+'storage/coach-suggestions-v2.ts');
    const candidate={phase:'candidate' as const,content:{type:'easy-endurance' as const,totalDurationSeconds:2100,
      intensity:'easy' as const,terrain:'flat' as const,shortSummary:'Endurance révisée'},opportunity:{contractVersion:1 as const,
      goal:'endurance' as const,suggestedFor:core.civilDate('2026-10-20'),anchor:{kind:'bootstrap' as const,referenceDate:core.civilDate('2026-10-18')},
      availability:{weekday:'tuesday' as const,maximumSeconds:3600},generation:2}};
    try {const result=await createSuggestionV2Repository(input.database).replacePresented({previousId:input.previousId,expectedRevision:1,
      selection:core.selectCandidateV2(candidate),moment:{presentedAt:core.instantIso('2026-10-19T08:00:00.000Z'),presentedOn:core.civilDate('2026-10-19'),
        timeZone:core.ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'},
      provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:[],limitationCodes:[]},createId:()=>input.id});
      return {status:result.status,id:result.occurrence.id};} catch(error) {return {status:'conflict',message:(error as Error).message};}
  },{modules,database,previousId:original.id,id});
  const replacements=await Promise.all([replace(page,'replacement-left'),replace(other,'replacement-right')]);
  expect(replacements.filter(value=>value.status==='created')).toHaveLength(1);
  expect(replacements.filter(value=>value.status==='conflict')).toHaveLength(1);

  const activeId=replacements.find(value=>value.status==='created')!.id;
  await record(page,database,'second-active',3,2400);
  await page.evaluate(async input=>{const {openDatabase}=await import(/* @vite-ignore */ input.modules+'storage/database-connection.ts');
    const db=await openDatabase(input.database);await db.put('sessions',{id:'real-run',title:'Course réelle',date:'2026-10-20',durationSeconds:2400});db.close();},{modules,database});
  const associate=async(target:Page,id:string)=>target.evaluate(async input=>{
    const core=await import(/* @vite-ignore */ input.modules+'core/coach/persistence-foundations-v2.ts');
    const {createSuggestionV2Repository}=await import(/* @vite-ignore */ input.modules+'storage/coach-suggestions-v2.ts');
    try {const value=await createSuggestionV2Repository(input.database).associateActivity({occurrenceId:input.id,expectedRevision:1,
      activityId:'real-run',updatedAt:core.instantIso('2026-10-20T18:00:00.000Z')});return {status:'associated',id:value.id};}
    catch(error) {return {status:'conflict',message:(error as Error).message};}
  },{modules,database,id});
  const associations=await Promise.all([associate(page,activeId),associate(other,'second-active')]);
  expect(associations.filter(value=>value.status==='associated')).toHaveLength(1);
  expect(associations.filter(value=>value.status==='conflict')).toHaveLength(1);

  await Promise.all([page.close(),other.close()]);const reopened=await context.newPage();await reopened.goto('./');
  const snapshot=await reopened.evaluate(async input=>{const {createSuggestionV2Repository}=await import(/* @vite-ignore */ input.modules+'storage/coach-suggestions-v2.ts');
    return createSuggestionV2Repository(input.database).listPresentedBetween('2026-10-01','2026-10-31');},{modules,database});
  expect(snapshot).toHaveLength(3);expect(snapshot.filter(value=>value.state==='associated')).toHaveLength(1);
  expect(snapshot.filter(value=>value.state==='obsolete')).toHaveLength(1);
});

test('identité applicative V2 concurrente dans deux onglets',async({page,context})=>{
  const database=`browser-v2-identity-${Date.now()}`;await page.goto('./');const other=await context.newPage();await other.goto('./');
  const present=async(target:Page,id:string)=>target.evaluate(async input=>{
    const adapter=await import(/* @vite-ignore */ input.modules+'core/coach/application-adapter-v2.ts');
    const core=await import(/* @vite-ignore */ input.modules+'core/coach/persistence-foundations-v2.ts');
    const storage=await import(/* @vite-ignore */ input.modules+'storage/coach-suggestions-v2.ts');
    const sessions=['2026-10-10','2026-10-11','2026-10-12','2026-10-13'].map((date,index)=>
      ({id:`run-${index}`,title:'Course',sport:'RUNNING',date,durationSeconds:2400}));
    const result=adapter.adaptCoachV2Readonly({sessions,occurrences:[],configuration:{goal:{model:'evolving',kind:'endurance'},
      experience:'experienced',structuredPlanningPreference:'accepted'},profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,
      days:['monday','wednesday','friday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'}},'2026-10-18');
    return storage.presentCoachV2Selection({result,referenceDate:'2026-10-18',moment:{presentedAt:core.instantIso('2026-10-18T08:00:00.000Z'),
      presentedOn:core.civilDate('2026-10-18'),timeZone:core.ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,
      civilDateRule:'device-local-at-presentation'},provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'provisional',
      referenceSourceIds:sessions.map(value=>value.id),limitationCodes:[]},createId:()=>input.id},input.database);
  },{modules,database,id});
  const [left,right]=await Promise.all([present(page,'left'),present(other,'right')]);
  expect([left.status,right.status].filter(value=>value==='created')).toHaveLength(1);
  expect([left.status,right.status].filter(value=>value==='existing'||value==='reused-active')).toHaveLength(1);
  expect(left.occurrence.id).toBe(right.occurrence.id);expect(left.occurrence.opportunity.generation).toBe(1);
});

test('cycle V6 réel et restauration ancienne sans association orpheline',async({page})=>{
  await page.goto('./');const result=await page.evaluate(async input=>{
    const core=await import(/* @vite-ignore */ input.modules+'core/coach/persistence-foundations-v2.ts');
    const {createSuggestionV2Repository}=await import(/* @vite-ignore */ input.modules+'storage/coach-suggestions-v2.ts');
    const {createSessionRepository}=await import(/* @vite-ignore */ input.modules+'storage/database.ts');
    const {createBackupService,prepareNative}=await import(/* @vite-ignore */ input.modules+'storage/backup.ts');
    const {exportGzip,readBackupFile}=await import(/* @vite-ignore */ input.modules+'backup/compression.ts');
    const {prepareRestore}=await import(/* @vite-ignore */ input.modules+'backup/merge.ts');
    const source=`v6-source-${Date.now()}`,destination=`v6-destination-${Date.now()}`,oldDestination=`v6-old-${Date.now()}`;
    const sessions=createSessionRepository(source),repository=createSuggestionV2Repository(source);
    await sessions.save({id:'run',title:'Course',date:'2026-10-20',durationSeconds:1800});
    const candidate={phase:'candidate' as const,content:{type:'easy-endurance' as const,totalDurationSeconds:1800,intensity:'easy' as const,
      terrain:'flat' as const,shortSummary:'Endurance'},opportunity:{contractVersion:1 as const,goal:'endurance' as const,
      suggestedFor:core.civilDate('2026-10-20'),anchor:{kind:'bootstrap' as const,referenceDate:core.civilDate('2026-10-18')},
      availability:{weekday:'tuesday' as const},generation:1}};
    const created=await repository.recordPresented({selection:core.selectCandidateV2(candidate),moment:{presentedAt:core.instantIso('2026-10-18T08:00:00.000Z'),
      presentedOn:core.civilDate('2026-10-18'),timeZone:core.ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'},
      provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:[],limitationCodes:[]},createId:()=> 'stable'});
    const associated=await repository.associateActivity({occurrenceId:created.occurrence.id,expectedRevision:1,activityId:'run',
      updatedAt:core.instantIso('2026-10-20T18:00:00.000Z')});
    const processor={export:(data:any)=>exportGzip(data,'0.7.0',undefined,'2026-10-21T08:00:00.000Z'),parse:(file:Blob)=>readBackupFile(file),
      prepare:(preview:any,options:any)=>prepareNative(preview,options,new Date('2026-10-21T08:00:00.000Z'))};
    const exported=await createBackupService(processor,source).exportData(),target=createBackupService(processor,destination),preview=await target.preview(exported.file);
    await target.restore(preview,{mode:'replace',profile:'restore'});const restored=await createSuggestionV2Repository(destination).getById('stable');
    const oldTarget=createBackupService(processor,oldDestination),seedPreview=await oldTarget.preview(exported.file);
    await oldTarget.restore(seedPreview,{mode:'replace',profile:'restore'});
    const oldData={sessions:[],details:[],coachProfile:null};const oldExport=await exportGzip(oldData,'0.6.0',undefined,'2026-10-21T09:00:00.000Z');
    const oldPreview=await oldTarget.preview(oldExport.file);
    await oldTarget.restore(oldPreview,{mode:'replace',profile:'restore'});
    return {before:associated,after:restored,oldCount:(await createSuggestionV2Repository(oldDestination).listPresentedBetween('2026-01-01','2026-12-31')).length,
      format:preview.backup.formatVersion};
  },{modules});
  expect(result.format).toBe(6);expect(result.after).toEqual(result.before);expect(result.oldCount).toBe(0);
});
