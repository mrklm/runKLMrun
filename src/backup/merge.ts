import { nextCoachRevision } from '../core/coach/configuration';
import { classifyDetails } from '../core/analysis/detail-retention';
import type { BackupData, BackupSourceData, RestoreOptions, RestoreReport } from '../types/backup';
import { canonicalJson } from './format';
import { absoluteStart, isTcxDuplicate } from '../importers/session-duplicate';
import type { RunningSession } from '../types/session';

/** Signale des ressemblances interformats sans supprimer ni rapprocher les identifiants. */
export function ambiguousSessions(sessions: RunningSession[]): number {
  const buckets = new Map<number, RunningSession[]>();
  let count = 0;
  for (const session of sessions) {
    const time = absoluteStart(session);
    if (time === undefined) continue;
    const key = Math.floor(time / 1000);
    if ([key - 1, key, key + 1].some(k => buckets.get(k)?.some(other => other.id !== session.id && isTcxDuplicate(session, other)))) count++;
    const bucket = buckets.get(key) ?? []; bucket.push(session); buckets.set(key, bucket);
  }
  return count;
}
export function prepareRestore(local: BackupData, incoming: BackupSourceData, options: RestoreOptions, now: string): { data: BackupData; report: RestoreReport } {
  const reference = new Date(now);
  const categories = new Map(incoming.sessions.map(s => [s.id, classifyDetails(s, reference)]));
  const retention = { recentDetails: 0, ignoredDetails: 0, uncertainDetails: 0, uncertainSessions: 0 };
  for (const category of categories.values()) if (category === 'uncertain') retention.uncertainSessions++;
  for (const detail of incoming.details) {
    const category = categories.get(detail.id);
    if (category === 'expired') retention.ignoredDetails++;
    else if (category === 'keep') retention.recentDetails++;
    else retention.uncertainDetails++;
  }
  const report: RestoreReport = { shoesAdded: 0, assignmentsAdded: 0, retention, added: 0, retained: 0, conflicts: 0, detailsAdded: 0, profile: 'kept', warnings: [] };
  const sessions = new Map((options.mode === 'merge' ? local.sessions : []).map(s => [s.id, s]));
  const details = new Map((options.mode === 'merge' ? local.details : []).map(d => [d.id, d]));
  const incomingDetails = new Map(incoming.details.map(d => [d.id, d]));
  const sessionConflicts = new Set<string>();
  for (const source of incoming.sessions) {
    // Ne jamais normaliser le document signé en place. L’interface attend une chaîne.
    const session: RunningSession = source.date === undefined ? { ...source, date: '' } : source as RunningSession;
    const existing = sessions.get(session.id), detail = incomingDetails.get(session.id);
    const eligible = categories.get(session.id) !== 'expired';
    if (existing) {
      report.retained++;
      if (canonicalJson(existing) !== canonicalJson(session)) {
        sessionConflicts.add(session.id); report.conflicts++; continue; // Le couple local résumé/détails est conservé.
      }
      const oldDetail = details.get(session.id);
      if (oldDetail && detail && canonicalJson(oldDetail) !== canonicalJson(detail)) report.conflicts++;
      else if (!oldDetail && detail && eligible) { details.set(session.id, detail); report.detailsAdded++; }
    } else {
      sessions.set(session.id, session); report.added++;
      if (detail && eligible) { details.set(session.id, detail); report.detailsAdded++; }
    }
  }
  const shoes = new Map((options.mode === 'merge' ? local.shoes ?? [] : []).map(shoe => [shoe.id, shoe]));
  const assignments = new Map((options.mode === 'merge' ? local.shoeAssignments ?? [] : []).map(a => [a.sessionId, a]));
  const shoeConflicts = new Set<string>();
  let hasDefault = [...shoes.values()].some(s => s.isDefault);
  for (const shoe of incoming.shoes ?? []) {
    const existing = shoes.get(shoe.id);
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(shoe)) { report.conflicts++; shoeConflicts.add(shoe.id); }
      continue;
    }
    let restored = shoe.isDefault && hasDefault ? { ...shoe, isDefault: false } : shoe;
    const previous = options.mode === 'replace' ? local.shoes?.find(s => s.id === shoe.id) : undefined;
    if (previous) restored = { ...restored, revision: Math.max(previous.revision, restored.revision) + 1 };
    if (restored.isDefault) hasDefault = true;
    else if (shoe.isDefault) report.warnings.push('La paire locale par défaut est conservée ; la paire importée n’est pas définie par défaut.');
    shoes.set(shoe.id, restored); report.shoesAdded++;
  }
  for (const association of incoming.shoeAssignments ?? []) {
    const existing = assignments.get(association.sessionId);
    if (existing) { if (existing.shoeId !== association.shoeId) report.conflicts++; continue; }
    if (sessionConflicts.has(association.sessionId) || shoeConflicts.has(association.shoeId)) {
      report.warnings.push('Une association du fichier n’a pas été ajoutée car sa séance ou sa paire présente un conflit local.'); continue;
    }
    assignments.set(association.sessionId, association); report.assignmentsAdded++;
  }
  let shoeSettings = options.mode === 'replace' || (!local.shoeSettings && !local.shoes?.length && !local.shoeAssignments?.length) ? incoming.shoeSettings : local.shoeSettings;
  if (options.mode === 'replace' && shoeSettings && local.shoeSettings) shoeSettings = { ...shoeSettings, revision: Math.max(shoeSettings.revision, local.shoeSettings.revision) + 1 };
  if (options.mode === 'merge' && incoming.shoeSettings?.mode !== undefined && incoming.shoeSettings.mode !== (shoeSettings?.mode ?? 'manual')) report.warnings.push('Le mode local de suivi des chaussures est conservé.');
  let coachProfile = local.coachProfile;
  if (options.mode === 'replace' || options.profile === 'restore') {
    coachProfile = incoming.coachProfile ? structuredClone(incoming.coachProfile) : null;
    report.profile = coachProfile ? 'restored' : 'removed';
    if (coachProfile && local.coachProfile) {
      // Ne pas réutiliser une ancienne révision déjà chargée dans un autre onglet.
      coachProfile.revision = Math.max(local.coachProfile.revision, coachProfile.revision) + 1;
      coachProfile.updatedAt = now;
    }
  }
  // La fusion conserve tout état local, y compris une suppression explicite.
  let evolvingCoach = options.mode === 'merge' && local.evolvingCoach ? structuredClone(local.evolvingCoach)
    : incoming.evolvingCoach ? structuredClone(incoming.evolvingCoach) : undefined;
  if (options.mode === 'merge' && local.evolvingCoach && incoming.evolvingCoach
    && canonicalJson(local.evolvingCoach.configuration) !== canonicalJson(incoming.evolvingCoach.configuration)) {
    report.conflicts++;
    report.warnings.push('La configuration locale du Coach évolutif est conservée, sans écrasement.');
  }
  if (options.mode === 'replace' && local.evolvingCoach) {
    // Même après disparition de la configuration, invalider les brouillons des autres onglets.
    evolvingCoach = {
      ...(evolvingCoach ?? { id: 'local' as const, configuration: null, createdAt: local.evolvingCoach.createdAt }),
      revision: nextCoachRevision(Math.max(local.evolvingCoach.revision, evolvingCoach?.revision ?? 0)),
      updatedAt: now,
    };
  }
  let coachPlanning = options.mode === 'merge' && local.coachPlanning ? structuredClone(local.coachPlanning)
    : incoming.coachPlanning ? structuredClone(incoming.coachPlanning) : undefined;
  if (options.mode === 'merge' && local.coachPlanning && incoming.coachPlanning) {
    for (const session of incoming.coachPlanning.sessions) {
      const existing = coachPlanning!.sessions.find(s => s.id === session.id || s.proposalKey === session.proposalKey);
      if (existing) {
        if (canonicalJson(existing) !== canonicalJson(session)) {
          report.conflicts++; report.warnings.push('Une séance du planning local est conservée, y compris ses modifications ou son annulation.');
        }
      } else coachPlanning!.sessions.push(structuredClone(session));
    }
    coachPlanning!.dismissed = [...new Set([...coachPlanning!.dismissed,...incoming.coachPlanning.dismissed])];
  }
  if (local.coachPlanning && (options.mode === 'replace' || incoming.coachPlanning)) {
    coachPlanning = {
      ...(coachPlanning ?? { id: 'local' as const, sessions: [], dismissed: [], createdAt: local.coachPlanning.createdAt }),
      revision: nextCoachRevision(Math.max(local.coachPlanning.revision, coachPlanning?.revision ?? 0)), updatedAt: now,
    };
  }
  const suggestions = new Map((options.mode === 'merge' ? local.coachSuggestions ?? [] : []).map(s => [s.id, structuredClone(s)]));
  for (const suggestion of incoming.coachSuggestions ?? []) {
    const existing = suggestions.get(suggestion.id);
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(suggestion)) {
        report.conflicts++; report.warnings.push('Une suggestion locale est conservée avec son état et son association, sans écrasement.');
      }
      continue;
    }
    if (suggestion.activityId && sessionConflicts.has(suggestion.activityId)) {
      report.conflicts++; report.warnings.push('Une suggestion du fichier n’a pas été ajoutée : son activité associée présente un conflit local.'); continue;
    }
    const previous = options.mode === 'replace' ? local.coachSuggestions?.find(s => s.id === suggestion.id) : undefined;
    suggestions.set(suggestion.id, previous ? {...suggestion, revision:nextCoachRevision(Math.max(previous.revision,suggestion.revision)), updatedAt:now} : structuredClone(suggestion));
  }
  const suggestionsV2=new Map((options.mode==='merge'?local.coachSuggestionsV2??[]:[]).map(value=>[value.id,structuredClone(value)]));
  const presentationKeys=new Map([...suggestionsV2.values()].map(value=>[value.presentationKey,value.id]));
  const activityOwners=new Map([...suggestionsV2.values()].flatMap(value=>value.activityId?[[value.activityId,value.id] as const]:[]));
  for(const occurrence of incoming.coachSuggestionsV2??[]) {
    const sameId=suggestionsV2.get(occurrence.id),keyOwner=presentationKeys.get(occurrence.presentationKey),activityOwner=occurrence.activityId?activityOwners.get(occurrence.activityId):undefined;
    if(sameId) {
      if(canonicalJson(sameId)!==canonicalJson(occurrence)) {
        report.conflicts++;report.warnings.push('Une occurrence V2 locale est conservée : son identifiant possède un contenu différent dans la sauvegarde.');
      }
      continue;
    }
    if(keyOwner!==undefined) {
      report.conflicts++;report.warnings.push('Une occurrence V2 locale est conservée : sa clé de présentation appartient à un autre identifiant.');continue;
    }
    if(activityOwner!==undefined||occurrence.activityId&&sessionConflicts.has(occurrence.activityId)) {
      report.conflicts++;report.warnings.push('Une occurrence V2 du fichier n’a pas été ajoutée : son association à une activité est contradictoire.');continue;
    }
    suggestionsV2.set(occurrence.id,structuredClone(occurrence));presentationKeys.set(occurrence.presentationKey,occurrence.id);
    if(occurrence.activityId)activityOwners.set(occurrence.activityId,occurrence.id);
  }
  if (report.conflicts) report.warnings.push(`${report.conflicts} conflit(s) : les résumés, détails, chaussures et associations locaux concernés sont conservés, sans écrasement. Gardez le fichier pour consulter les variantes.`);
  const allSessions = [...sessions.values()];
  const ambiguous = ambiguousSessions(allSessions);
  if (ambiguous) report.warnings.push(`${ambiguous} ressemblance(s) Polar/TCX entre identifiants différents : les séances sont conservées séparément.`);
  return { data: { ...(suggestions.size ? { coachSuggestions:[...suggestions.values()] } : {}),
    ...(suggestionsV2.size||incoming.coachSuggestionsV2!==undefined?{coachSuggestionsV2:[...suggestionsV2.values()]}:{}),
    ...(coachPlanning ? { coachPlanning } : {}), ...(evolvingCoach ? { evolvingCoach } : {}), sessions: allSessions, details: [...details.values()], coachProfile, ...(shoes.size || assignments.size || shoeSettings ? { ...(shoeSettings ? { shoeSettings } : {}), shoes: [...shoes.values()], shoeAssignments: [...assignments.values()] } : {}) }, report };
}
