import {describe,expect,it} from 'vitest';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
import type { RunningSession } from '../../types/session';
import { coachV2ProgressionState } from './progression-state-v2';

const referenceDate='2026-10-18',DAY=86_400_000,origin=Date.parse(`${referenceDate}T00:00:00Z`);
const date=(offset:number)=>new Date(origin+offset*DAY).toISOString().slice(0,10);
const run=(id:string,offset:number,durationSeconds=2400):RunningSession=>({id,title:'Course',sport:'RUNNING',date:date(offset),durationSeconds});
const confirmed:ReferenceBootstrapResult={policy:'hybrid',available:true,confidence:'confirmed',freshness:'current',referenceSeconds:2400,sourceIds:[],reasons:[],excluded:[],artificialDecreaseRisk:false};
const regular=()=>[-26,-21,-16,-11,-6,-1].map((offset,index)=>run(String(index),offset));
const state=(sessions:RunningSession[],reference=confirmed)=>coachV2ProgressionState({sessions,reference,referenceDate});

describe('état de progression V2',()=>{
  it('reste au maintien sans référence confirmée ou pratique régulière',()=>{
    expect(state(regular(),{...confirmed,confidence:'provisional'}).state).toBe('maintien');
    expect(state(regular().slice(0,5)).state).toBe('maintien');
  });
  it('autorise une progression possible sans exiger une progression déjà observée',()=>{
    const result=state(regular());
    expect(result.state).toBe('progression-possible');expect(result.observedDurationProgression).toBe(false);
  });
  it('signale une progression observée comme preuve additionnelle',()=>{
    const sessions=[-35,-30,-25,-20].map((offset,index)=>run(`base-${index}`,offset,1800))
      .concat([-15,-10,-5,-1].map((offset,index)=>run(`up-${index}`,offset,2400)));
    expect(state(sessions).observedDurationProgression).toBe(true);
  });
  it('privilégie la récupération après very-hard récent, sans interpréter les autres ressentis',()=>{
    expect(state([{...run('hard',-1),feeling:{effort:'very-hard'}}]).state).toBe('recuperation');
    for(const effort of [undefined,'easy','moderate','hard'] as const)
      expect(state([{...run('feeling',-1),...(effort?{feeling:{effort}}:{})}]).state).toBe('maintien');
  });
  it('revient au maintien après la fenêtre D3 ou une interruption',()=>{
    expect(state([{...run('old-feeling',-7),feeling:{effort:'very-hard'}}]).state).toBe('maintien');
    expect(state(regular().map(value=>({...value,date:date(-50)})),{...confirmed,freshness:'expired'}).state).toBe('maintien');
  });
  it('ne reçoit ni suggestion ni tempérament : seuls les faits réels déterminent le même état',()=>{
    const first=state(regular()),second=state(structuredClone(regular()));
    expect(first).toEqual(second);expect(first.state).toBe('progression-possible');
  });
});
