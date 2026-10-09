// Source officielle : polarofficial/polar-ble-sdk, PolarExerciseSession.SportProfile.
// Voir README : les codes 11, 23 et 103 restent inconnus faute de correspondance vérifiée.
export const POLAR_SPORT_IDS: Readonly<Record<string, string>> = {
  '1': 'RUNNING', '2': 'CYCLING', '16': 'OTHER_OUTDOOR',
};
export const RUNNING_SPORTS = ['RUNNING', 'ROAD_RUNNING', 'TRAIL_RUNNING', 'TREADMILL_RUNNING', 'TRACK_AND_FIELD_RUNNING', 'ULTRARUNNING_RUNNING', 'JOGGING', 'CROSS_COUNTRY_RUNNING'];
// Liste exacte, volontairement limitée ; aucun classement par sous-chaîne/titre.
export const OTHER_SPORTS = ['CYCLING', 'OTHER', 'OTHER_INDOOR', 'OTHER_OUTDOOR', 'WATER_RUNNING', 'WALKING', 'NORDIC_WALKING', 'HIKING', 'SWIMMING', 'POOL_SWIMMING', 'OPEN_WATER_SWIMMING', 'STRENGTH_TRAINING', 'ROAD_BIKING', 'MOUNTAIN_BIKING'];
