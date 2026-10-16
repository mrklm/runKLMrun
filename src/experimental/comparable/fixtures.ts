import type { RunningSession } from '../../types/session';
export const synthetic = (id: string, distanceMeters: number, ascentMeters?: number): RunningSession => ({ id, title:'Fictif', date:'2020-01-01', durationSeconds:1800, distanceMeters, ascentMeters, averageHeartRate:140, polarId:id });
export const fixtures: RunningSession[] = [
  synthetic('5-A',5000,0),synthetic('5-B',5100,0),synthetic('5-C',4900,2),
  synthetic('8-A',8100,75),synthetic('8-B',8000,79),synthetic('8-C',8200,72),synthetic('8-D',8100,250),
  synthetic('10-A',10000,150),synthetic('10-B',10100,155),synthetic('10-C',10200,160),
  synthetic('absent',8000),synthetic('atypique',30000,75),synthetic('limite',8400,90),
  { ...synthetic('estime',8050,77), source:'tcx', polarId:undefined, ascentEstimate:{method:'hysteresis-3m-v1',quality:'complete',meters:77} },
  { ...synthetic('partiel',8050,30), source:'tcx', polarId:undefined, ascentEstimate:{method:'hysteresis-3m-v1',quality:'partial',meters:30} },
];
