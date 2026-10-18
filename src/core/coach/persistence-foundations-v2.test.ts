import { describe,expect,it,vi } from 'vitest';
import { canonicalSessionContentV2,civilDate,contentFingerprintV2,ianaTimeZone,instantIso,observePresentationV2,
  occurrenceId,presentationKeyV2,selectCandidateV2,structureDurationSeconds,validateCandidateV2,validateOccurrenceV2,
  validateSessionContentV2,type CandidateV2,type ImmutableSessionContentV2,type PresentationMomentV2,
  type PresentationOpportunityV2 } from './persistence-foundations-v2';

const free:ImmutableSessionContentV2={type:'easy-endurance',totalDurationSeconds:1800,intensity:'easy',terrain:'flat',
  shortSummary:'Endurance facile · 30 min'};
const structured:ImmutableSessionContentV2={type:'intervals',totalDurationSeconds:1800,intensity:'controlled-hard',terrain:'flat',
  shortSummary:'Fractionné · 30 min',optionalInstructions:['Restez maître de l’effort.'],structure:{
    warmUp:{durationSeconds:600,intensity:'easy',instruction:'Échauffement.'},
    efforts:[{repetitions:4,durationSeconds:120,intensity:'controlled-hard',instruction:'Effort.'}],
    recoveries:[{repetitions:4,durationSeconds:120,intensity:'very-easy',instruction:'Récupération.'}],
    coolDown:{durationSeconds:240,intensity:'easy',instruction:'Retour au calme.'},
  }};
const opportunity=(generation=1):PresentationOpportunityV2=>({contractVersion:1,goal:'speed',suggestedFor:civilDate('2026-10-20'),
  anchor:{kind:'activity',id:'run-1',date:civilDate('2026-10-18')},availability:{weekday:'tuesday',maximumSeconds:3600},generation});
const candidate=(content:ImmutableSessionContentV2=free,generation=1):CandidateV2=>({phase:'candidate',content,opportunity:opportunity(generation)});
const moment:PresentationMomentV2={presentedAt:instantIso('2026-10-18T08:30:00.000Z'),presentedOn:civilDate('2026-10-18'),
  timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'};
const provenance={engine:'coach-v2' as const,contractVersion:1 as const,referenceConfidence:'confirmed' as const,
  referenceSourceIds:['run-1'],limitationCodes:[]};

describe('fondations de persistance V2 en mémoire',()=>{
  it('canonicalise sans dépendre de l’ordre des propriétés',()=>{
    const reordered={shortSummary:free.shortSummary,terrain:free.terrain,intensity:free.intensity,
      totalDurationSeconds:free.totalDurationSeconds,type:free.type};
    expect(canonicalSessionContentV2(reordered)).toBe(canonicalSessionContentV2(free));
  });

  it('ignore les représentations facultatives vides mais conserve l’ordre des blocs',async()=>{
    expect(await contentFingerprintV2({...free,optionalInstructions:[]})).toBe(await contentFingerprintV2(free));
    const reversed={...structured,structure:{...structured.structure!,efforts:[...structured.structure!.efforts].reverse(),
      recoveries:[...structured.structure!.recoveries!].reverse()}};
    // Deux blocs distincts rendent l'ordre observable sans changer la somme.
    const ordered={...structured,structure:{...structured.structure!,efforts:[
      {durationSeconds:120,intensity:'controlled-hard' as const,instruction:'A.'},
      {durationSeconds:360,intensity:'controlled-hard' as const,instruction:'B.'}],recoveries:structured.structure!.recoveries}};
    const swapped={...ordered,structure:{...ordered.structure!,efforts:[...ordered.structure!.efforts].reverse()}};
    expect(await contentFingerprintV2(ordered)).not.toBe(await contentFingerprintV2(swapped));
    expect(await contentFingerprintV2(reversed)).toBe(await contentFingerprintV2(structured));
  });

  it('produit la même empreinte pour le même contenu et une autre si le contenu change',async()=>{
    expect(await contentFingerprintV2(structuredClone(free))).toBe(await contentFingerprintV2(free));
    expect(await contentFingerprintV2({...free,totalDurationSeconds:2100})).not.toBe(await contentFingerprintV2(free));
  });

  it('valide les dates, instants et fuseaux réels',()=>{
    expect(civilDate('2024-02-29')).toBe('2024-02-29');expect(()=>civilDate('2026-02-30')).toThrow(/date civile/);
    expect(()=>instantIso('2026-10-18 08:30')).toThrow(/instant ISO/);expect(()=>ianaTimeZone('Mars/Olympus')).toThrow(/IANA/);
  });

  it('valide la somme et la présence des blocs structurés',()=>{
    expect(structureDurationSeconds(structured.structure!)).toBe(1800);expect(()=>validateSessionContentV2(structured)).not.toThrow();
    expect(()=>validateSessionContentV2({...structured,totalDurationSeconds:1801})).toThrow(/somme des blocs/);
    expect(()=>validateSessionContentV2({...free,type:'intervals'})).toThrow(/blocs requis/);
    expect(()=>validateSessionContentV2({...free,structure:structured.structure})).toThrow(/blocs interdits/);
  });

  it('rejette explicitement dimensions et propriétés inconnues',()=>{
    expect(()=>validateSessionContentV2({...free,intensity:'maximale'})).toThrow(/intensité/);
    expect(()=>validateCandidateV2({...candidate(),surprise:true})).toThrow(/propriété inconnue/);
  });

  it('sépare identité, empreinte et clé de présentation',async()=>{
    const selected=selectCandidateV2(candidate()),result=await observePresentationV2({selection:selected,moment,provenance,existing:[],createId:()=> 'occurrence-1'});
    expect(result.status).toBe('created');expect(result.occurrence.id).toBe(occurrenceId('occurrence-1'));
    expect(result.occurrence.id).not.toBe(result.occurrence.contentFingerprint);
    expect(result.occurrence.id).not.toBe(result.occurrence.presentationKey);
    await expect(validateOccurrenceV2(result.occurrence)).resolves.toBeUndefined();
  });

  it('déduplique les présentations concurrentes ou répétées',async()=>{
    const selected=selectCandidateV2(candidate()),first=await observePresentationV2({selection:selected,moment,provenance,existing:[],createId:()=> 'first'});
    const createId=vi.fn(()=> 'second'),again=await observePresentationV2({selection:selected,moment,provenance,existing:[first.occurrence],createId});
    expect(again).toEqual({status:'existing',occurrence:first.occurrence});expect(createId).not.toHaveBeenCalled();
  });

  it('signale une révision de contenu sans écraser l’occurrence présentée',async()=>{
    const first=await observePresentationV2({selection:selectCandidateV2(candidate()),moment,provenance,existing:[],createId:()=> 'first'});
    const changed=selectCandidateV2(candidate({...free,totalDurationSeconds:2100}));
    const result=await observePresentationV2({selection:changed,moment,provenance,existing:[first.occurrence],createId:()=> 'forbidden'});
    expect(result).toEqual({status:'content-conflict',occurrence:first.occurrence});
  });

  it('autorise une nouvelle occurrence par génération explicite',async()=>{
    const first=await observePresentationV2({selection:selectCandidateV2(candidate()),moment,provenance,existing:[],createId:()=> 'first'});
    const replacement=await observePresentationV2({selection:selectCandidateV2(candidate({...free,totalDurationSeconds:2100},2)),moment,provenance,
      existing:[first.occurrence],createId:()=> 'replacement'});
    expect(replacement.status).toBe('created');expect(replacement.occurrence.presentationKey).not.toBe(first.occurrence.presentationKey);
  });

  it('ne dépend ni de l’instant de consultation ni du contenu pour la clé',async()=>{
    expect(await presentationKeyV2(opportunity())).toBe(await presentationKeyV2(structuredClone(opportunity())));
    expect((await observePresentationV2({selection:selectCandidateV2(candidate()),moment,provenance,existing:[],createId:()=> 'one'})).occurrence.presentationKey)
      .toBe((await observePresentationV2({selection:selectCandidateV2(candidate(structured)),moment:{...moment,presentedAt:instantIso('2026-10-18T17:00:00.000Z')},provenance,
        existing:[],createId:()=> 'two'})).occurrence.presentationKey);
  });

  it('une sélection seule ne crée aucune occurrence et aucune écriture',()=>{
    const source=candidate(),copy=structuredClone(source),selected=selectCandidateV2(source);
    expect(selected.phase).toBe('selected');expect(source).toEqual(copy);expect(selected).not.toHaveProperty('id');
    expect(selected).not.toHaveProperty('presentation');
  });
});
