import { afterEach, expect, it, vi } from 'vitest';
import { isSuggestionVisible, watchSuggestionPresentation } from './suggestion-presentation';
function setup() {
  vi.useFakeTimers();
  const frames = new Map<number, FrameRequestCallback>(); let serial=0;
  const frame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(0));};
  vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frames.set(++serial,fn);return serial;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
  let intersect: (entries:unknown[])=>void=()=>{};
  const disconnect=vi.fn();
  vi.stubGlobal('IntersectionObserver',class { constructor(callback:typeof intersect){intersect=callback;} observe(){} disconnect=disconnect; });
  const document=new EventTarget() as EventTarget & {visibilityState:string;elementFromPoint:(x:number,y:number)=>unknown};
  document.visibilityState='visible';
  const style={display:'block',visibility:'visible',opacity:'1'};
  vi.stubGlobal('getComputedStyle',()=>style);vi.stubGlobal('innerWidth',800);vi.stubGlobal('innerHeight',600);vi.stubGlobal('document',document);
  const make=(top:number)=>{const element={parentElement:null,getBoundingClientRect:()=>({top,left:10,right:310,bottom:top+30,width:300,height:30}),contains:(hit:unknown)=>hit===element};return element;};
  const summary=make(80),title={...make(30),nextElementSibling:summary};title.contains=hit=>hit===title;
  let covered=false;
  document.elementFromPoint=(_x,y)=>covered?null:y<80?title:summary;
  const card={isConnected:true,querySelector:()=>title} as unknown as HTMLElement;
  return {card,document,style,frame,disconnect,cover:(v:boolean)=>{covered=v;},intersection:(value=true)=>intersect([{target:card,isIntersecting:value}])};
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('enregistre après deux frames visibles, une seule fois malgré les événements répétés',()=>{
 const env=setup(),present=vi.fn(),stop=watchSuggestionPresentation(env.card,present);
 env.intersection();env.frame();expect(present).not.toHaveBeenCalled();env.frame();expect(present).toHaveBeenCalledTimes(1);
 env.intersection();env.document.dispatchEvent(new Event('visibilitychange'));env.frame();env.frame();expect(present).toHaveBeenCalledTimes(1);stop();
});
it('calcul hors écran et onglet masqué : aucune présentation ; reprise au retour visible',()=>{
 const env=setup(),present=vi.fn(),stop=watchSuggestionPresentation(env.card,present);
 env.intersection(false);env.frame();env.frame();expect(present).not.toHaveBeenCalled();
 env.document.visibilityState='hidden';env.intersection();env.frame();env.frame();expect(present).not.toHaveBeenCalled();
 env.document.visibilityState='visible';env.document.dispatchEvent(new Event('visibilitychange'));env.frame();env.frame();expect(present).toHaveBeenCalledTimes(1);stop();
});
it('splash ou autre recouvrement : attend la visibilité effective ; display:none également exclu',()=>{
 const env=setup(),present=vi.fn();env.cover(true);const stop=watchSuggestionPresentation(env.card,present);
 env.intersection();env.frame();env.frame();expect(present).not.toHaveBeenCalled();
 env.cover(false);env.style.display='none';expect(isSuggestionVisible(env.card)).toBe(false);env.style.display='block';
 vi.advanceTimersByTime(250);env.frame();env.frame();expect(present).toHaveBeenCalledTimes(1);stop();
});
it('montage/cleanup/remontage StrictMode et remplacement avant la deuxième frame',()=>{
 const env=setup(),old=vi.fn(),next=vi.fn();const stop=watchSuggestionPresentation(env.card,old);
 env.intersection();env.frame();stop();env.frame();expect(old).not.toHaveBeenCalled();expect(env.disconnect).toHaveBeenCalled();
 const stopNext=watchSuggestionPresentation(env.card,next);env.intersection();env.frame();env.frame();expect(next).toHaveBeenCalledTimes(1);
 const stillVisible=next.mock.calls[0][0] as ()=>boolean;stopNext();expect(stillVisible()).toBe(false);
});
it('masquage entre les deux frames annule la confirmation',()=>{
 const env=setup(),present=vi.fn(),stop=watchSuggestionPresentation(env.card,present);
 env.intersection();env.frame();env.document.visibilityState='hidden';env.frame();expect(present).not.toHaveBeenCalled();stop();
});
