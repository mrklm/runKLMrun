const zonedTime = /(?:Z|[+-]\d{2}:\d{2})$/;

export function formatActivityTime(startTime: string, seconds = false, timeZone?: string): string {
  if (!zonedTime.test(startTime) || !Number.isFinite(Date.parse(startTime))) return startTime.slice(11, seconds ? 19 : 16);
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}),
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(startTime));
}

/** Date civile de la source : son décalage explicite prévaut sur celui du navigateur. */
export function civilDateFromActivityStart(startTime: string, timezoneOffsetMinutes?: number, timeZone?: string): string {
  const sourceDate = startTime.slice(0, 10);
  if (!zonedTime.test(startTime) || !Number.isFinite(Date.parse(startTime)) || !startTime.endsWith('Z')) return sourceDate;
  const instant = new Date(startTime);
  if (timezoneOffsetMinutes !== undefined) return new Date(instant.getTime() + timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
  if (timeZone) {
    const values = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
    const part = (type: string) => values.find(value => value.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  return `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, '0')}-${String(instant.getDate()).padStart(2, '0')}`;
}
