import { useEffect, useRef, useState } from 'react';
import { createEvolvingCoachRepository } from '../storage/evolving-coach';
import { subscribeStorage } from '../storage/changes';
import { resolveCoachTemperament } from '../core/coach/configuration';
import type { CoachTemperament, EvolvingCoachRecord } from '../types/evolving-coach';

const repository = createEvolvingCoachRepository();
const choices: { value: CoachTemperament; label: string; description: string }[] = [
  { value: 'pas-a-pas', label: 'Pas à Pas', description: 'Le Coach privilégie une progression douce, la régularité et l’observation.' },
  { value: 'evolution-active', label: 'Évolution Active', description: 'Le Coach recherche une progression volontaire et diversifie les exercices selon ta forme.' },
  { value: 'rentre-dedans', label: 'Rentre dedans', description: 'Le Coach privilégie une progression ambitieuse tout en respectant ta récupération.' },
];

export function CoachTemperamentSettings() {
  const [record, setRecord] = useState<EvolvingCoachRecord>();
  const [selected, setSelected] = useState(0), [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const generation = useRef(0), busy = useRef(false);
  async function reload() {
    const token = ++generation.current;
    try {
      const value = await repository.get();
      if (token !== generation.current) return;
      setRecord(value); setSelected(choices.findIndex(choice => choice.value === resolveCoachTemperament(value)));
      setReady(true); setError('');
    } catch { if (token === generation.current) { setReady(false); setError('Le type de Coach n’a pas pu être lu.'); } }
  }
  useEffect(() => {
    void reload();
    const unsubscribe = subscribeStorage(['configuration'], () => { if (!busy.current) void reload(); });
    return () => { generation.current++; unsubscribe(); };
  }, []);
  async function select(index: number) {
    if (busy.current || !ready || index === selected) return;
    busy.current = true; setSaving(true); setSelected(index); setError(''); setMessage('');
    const token = ++generation.current;
    try {
      const saved = await repository.saveTemperament(choices[index].value, record?.revision);
      if (token !== generation.current) return;
      setRecord(saved); setMessage('Préférence enregistrée.');
    } catch {
      if (token !== generation.current) return;
      setSelected(choices.findIndex(choice => choice.value === resolveCoachTemperament(record)));
      setReady(false); setError('Le choix n’a pas pu être enregistré. Recharge les préférences avant de réessayer.');
    } finally { busy.current = false; if (token === generation.current) setSaving(false); }
  }
  return <section className="panel settings-panel coach-temperament" aria-labelledby="coach-temperament-title">
    <h2 id="coach-temperament-title">Type de Coach</h2>
    <p className="coach-temperament-current">Tempérament choisi : <strong>{choices[selected].label}</strong></p>
    <div className="coach-temperament-choices" role="group" aria-label="Choisir le tempérament du Coach" aria-describedby="coach-temperament-description coach-temperament-note">
      {choices.map((choice,index) => <button key={choice.value} type="button" className={index === selected ? 'selected' : undefined}
        disabled={!ready || saving} aria-pressed={index === selected} onClick={() => { void select(index); }}>
        <strong>{choice.label}</strong><span>{index === 0 ? 'Progression douce' : index === 1 ? 'Progression volontaire' : 'Progression ambitieuse'}</span>
      </button>)}
    </div>
    <p id="coach-temperament-description">{choices[selected].description}</p>
    <p id="coach-temperament-note"><small>Ce réglage définit la manière dont le Coach accompagne ta progression, pas ton niveau sportif.</small></p>
    <p><small>Ce choix s’applique aux nouveaux calculs du Coach V2. Une suggestion déjà présentée reste conservée si elle est compatible.</small></p>
    <p role="status">{saving ? 'Enregistrement…' : message}</p>
    {error && <p role="alert">{error} <button type="button" className="button" onClick={() => { void reload(); }}>Recharger les préférences</button></p>}
  </section>;
}
