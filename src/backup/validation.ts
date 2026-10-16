import { validateCoachPlanning } from '../core/coach/planning';
import { validateEvolvingCoachRecord } from '../core/coach/configuration';
import { validateShoe } from '../core/shoes/shoes';
import type { CoachProfile } from '../types/coach-profile';
import type { BackupData, BackupDocument, BackupSourceData } from '../types/backup';
import { validSessionDate } from '../core/analysis/session-summary';
import { validateProfile } from '../core/coach/profile';

import { BackupError } from './errors';
export { BackupError } from './errors';
function fail(message = 'La sauvegarde contient des données invalides ou non reconnues.'): never { throw new BackupError(message); }
type Obj = Record<string, unknown>;
const object = (value: unknown): value is Obj => value !== null && typeof value === 'object' && !Array.isArray(value);
function fields(value: unknown, allowed: string): asserts value is Obj {
  if (!object(value) || Object.keys(value).some(key => !allowed.split(' ').includes(key))) fail();
}
const text = (value: unknown): value is string => typeof value === 'string';
const id = (value: unknown): value is string => text(value) && value.trim().length > 0 && value.length <= 4096 && !/[\u0000-\u001f]/.test(value);
const number = (value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
function optionalNumbers(o: Obj, keys: string, minimum = 0) {
  for (const key of keys.split(' ')) if (o[key] !== undefined && !number(o[key], minimum)) fail();
}
function timestamp(value: unknown): value is string {
  return text(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)
    && validSessionDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}
function array(value: unknown): asserts value is unknown[] { if (!Array.isArray(value)) fail(); }

export function validateBackupData(value: unknown, source: true): asserts value is BackupSourceData;
export function validateBackupData(value: unknown, source?: false): asserts value is BackupData;
export function validateBackupData(value: unknown, source = false): asserts value is BackupSourceData {
  fields(value, 'sessions details coachProfile shoes shoeAssignments shoeSettings evolvingCoach coachPlanning');
  if (value.coachPlanning !== undefined) {
    try { validateCoachPlanning(value.coachPlanning); } catch { fail('Planning invalide dans la sauvegarde.'); }
  }
  if (value.evolvingCoach !== undefined) {
    try { validateEvolvingCoachRecord(value.evolvingCoach); } catch { fail('Configuration du Coach évolutif invalide dans la sauvegarde.'); }
  }
  array(value.sessions); array(value.details);
  const sessions = new Set<string>(), details = new Set<string>();
  for (const s of value.sessions) {
    fields(s, 'id title date startTime polarId source sport polarSportId timezoneOffsetMinutes distanceMeters durationSeconds averageHeartRate maximumHeartRate ascentMeters ascentEstimate descentMeters averagePaceSecondsPerKm heartRateZones runningIndex cardioLoad');
    if (!id(s.id) || !text(s.title) || !(text(s.date) || (source && s.date === undefined)) || !number(s.durationSeconds)) fail();
    if (sessions.has(s.id)) fail('La sauvegarde contient des identifiants de séances dupliqués.');
    sessions.add(s.id);
    for (const key of ['polarId', 'sport', 'polarSportId']) if (s[key] !== undefined && !text(s[key])) fail();
    if (s.source !== undefined && s.source !== 'tcx') fail();
    // Une date incertaine reste une donnée conservable, jamais un motif de suppression.
    if (s.startTime !== undefined && !text(s.startTime)) fail();
    if (s.timezoneOffsetMinutes !== undefined && !number(s.timezoneOffsetMinutes, -1440, 1440)) fail();
    optionalNumbers(s, 'distanceMeters averageHeartRate maximumHeartRate ascentMeters descentMeters averagePaceSecondsPerKm runningIndex cardioLoad');
    if (s.ascentEstimate !== undefined) {
      fields(s.ascentEstimate, 'method quality meters');
      const e = s.ascentEstimate;
      if (s.source !== 'tcx' || e.method !== 'hysteresis-3m-v1' || !['complete', 'partial'].includes(e.quality as string) || !number(e.meters) || e.meters !== s.ascentMeters) fail();
    }
    if (s.heartRateZones !== undefined) {
      array(s.heartRateZones);
      for (const zone of s.heartRateZones) {
        fields(zone, 'lower upper durationSeconds'); optionalNumbers(zone, 'lower upper durationSeconds');
        if (typeof zone.lower === 'number' && typeof zone.upper === 'number' && zone.lower > zone.upper) fail();
      }
    }
  }
  for (const d of value.details) {
    fields(d, 'id laps cadenceUnit heartRate speed cadence altitude distance gpsStartTime gps');
    if (!id(d.id)) fail();
    if (details.has(d.id)) fail('La sauvegarde contient des identifiants de détails dupliqués.');
    if (!sessions.has(d.id)) fail('Des détails ne sont associés à aucune séance dans la sauvegarde.');
    details.add(d.id);
    if (d.cadenceUnit !== undefined && d.cadenceUnit !== 'rpm' && d.cadenceUnit !== 'source') fail();
    if (d.gpsStartTime !== undefined && !timestamp(d.gpsStartTime)) fail();
    for (const key of ['heartRate', 'speed', 'cadence', 'altitude', 'distance']) {
      if (d[key] === undefined) continue;
      array(d[key]);
      for (const sample of d[key]) {
        fields(sample, 'timeSeconds value');
        // Le schéma Polar historique admet des séries non triées et des valeurs signées.
        if (!number(sample.timeSeconds) || (sample.value !== null && !number(sample.value, -Number.MAX_SAFE_INTEGER))) fail();
      }
    }
    if (d.laps !== undefined) {
      array(d.laps);
      for (const lap of d.laps) {
        fields(lap, 'startTime durationSeconds distanceMeters');
        if (!timestamp(lap.startTime) || !number(lap.durationSeconds)) fail();
        optionalNumbers(lap, 'distanceMeters');
      }
    }
    if (d.gps !== undefined) {
      array(d.gps);
      for (const point of d.gps) {
        fields(point, 'timeSeconds latitude longitude altitudeMeters');
        if (!number(point.timeSeconds) || (point.latitude !== null && !number(point.latitude, -90, 90)) || (point.longitude !== null && !number(point.longitude, -180, 180))) fail();
        optionalNumbers(point, 'altitudeMeters', -Number.MAX_SAFE_INTEGER);
      }
    }
  }
  const shoeIds = new Set<string>(), assigned = new Set<string>();
  let defaults = 0;
  if (value.shoes !== undefined || value.shoeAssignments !== undefined || value.shoeSettings !== undefined) {
    array(value.shoes); array(value.shoeAssignments);
    for (const shoe of value.shoes) {
      try { validateShoe(shoe); } catch { fail('La sauvegarde contient une paire de chaussures invalide.'); }
      if (shoeIds.has(shoe.id)) fail('Identifiant de chaussure dupliqué.');
      shoeIds.add(shoe.id); if (shoe.isDefault) defaults++;
    }
    if (defaults > 1) fail('Plusieurs paires par défaut dans la sauvegarde.');
    for (const association of value.shoeAssignments) {
      fields(association, 'sessionId shoeId');
      if (!id(association.sessionId) || !id(association.shoeId) || !sessions.has(association.sessionId) || !shoeIds.has(association.shoeId) || assigned.has(association.sessionId)) fail('Une association de chaussures est incohérente.');
      assigned.add(association.sessionId);
    }
  }
  if (value.shoeSettings !== undefined) {
    fields(value.shoeSettings, 'id mode revision');
    const settings = value.shoeSettings;
    if (settings.id !== 'local' || typeof settings.mode !== 'string' || !['manual', 'automatic'].includes(settings.mode) || !Number.isSafeInteger(settings.revision) || (settings.revision as number) < 1) fail('Le mode de suivi des chaussures est invalide.');
  }
  const p = value.coachProfile;
  if (p !== null) {
    fields(p, 'id goal availability preferences createdAt updatedAt revision accompanimentMode');
    fields(p.goal, 'kind distance targetDate');
    fields(p.availability, 'sessionsPerWeek days minutesPerSession durationMode maxMinutesByDay');
    fields(p.preferences, 'terrain');
    if (p.goal.distance !== undefined) fields(p.goal.distance, 'kind meters');
    if (p.id !== 'local' || !timestamp(p.createdAt) || !timestamp(p.updatedAt) || !Number.isSafeInteger(p.revision) || (p.revision as number) < 1
      || Object.keys(validateProfile(p as unknown as CoachProfile, '0001-01-01')).length) fail('Le profil contenu dans la sauvegarde est invalide.');
  }
}

export function validateBackup(value: unknown): asserts value is BackupDocument {
  if (!object(value) || value.format !== 'runKLMrun-backup') fail('Ce fichier n’est pas une sauvegarde runKLMrun.');
  if (value.formatVersion !== 1 && value.formatVersion !== 2 && value.formatVersion !== 3 && value.formatVersion !== 4) fail('Cette version de sauvegarde n’est pas prise en charge. Utilisez une version compatible de runKLMrun.');
  fields(value, 'format formatVersion exportedAt appVersion data integrity');
  if (!timestamp(value.exportedAt) || !text(value.appVersion) || !value.appVersion.length) fail();
  fields(value.integrity, 'algorithm digest');
  if (value.integrity.algorithm !== 'SHA-256' || !text(value.integrity.digest) || !/^[a-f0-9]{64}$/.test(value.integrity.digest)) fail('L’empreinte de la sauvegarde est absente ou invalide.');
  validateBackupData(value.data, true);
  if (value.formatVersion < 3 && value.data.evolvingCoach !== undefined) fail('Le Coach évolutif nécessite le format de sauvegarde 3.');
  if (value.formatVersion !== 4 && value.data.coachPlanning !== undefined) fail('Le planning nécessite le format 4.');
  if (value.formatVersion === 4 && value.data.coachPlanning === undefined) fail('Planning absent du format 4.');
  if (value.formatVersion === 3 && value.data.evolvingCoach === undefined) fail('Configuration absente du format de sauvegarde 3.');
  if (value.formatVersion === 1 && (value.data.shoes !== undefined || value.data.shoeAssignments !== undefined || value.data.shoeSettings !== undefined)) fail('Les chaussures nécessitent le format de sauvegarde 2.');
  if (value.formatVersion === 2 && (value.data.shoes === undefined || value.data.shoeAssignments === undefined)) fail('Les chaussures et associations sont absentes du format 2.');
}
