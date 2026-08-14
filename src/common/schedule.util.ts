/**
 * Fenêtre de diffusion d'un planning.
 *
 * Règle : une playlist **sans** planning se diffuse en continu ; une playlist
 * **avec** planning ne se diffuse que dans sa fenêtre. Cette fonction est la
 * seule autorité sur « la fenêtre est-elle ouverte maintenant ? » et doit être
 * appelée par tous les chemins qui poussent une playlist vers une TV, sans quoi
 * un contenu hors plage peut arriver à l'écran par une porte dérobée.
 */
export type ScheduleWindow = {
  isActive?: boolean;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek?: number[] | null;
};

const MINUTES_IN_DAY = 24 * 60;

/** "HH:mm" → minutes depuis minuit. */
const toMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export function isScheduleOpen(
  schedule: ScheduleWindow,
  now: Date = new Date(),
): boolean {
  if (!schedule) return false;
  if (schedule.isActive === false) return false;

  // ── Plage de dates ──
  if (schedule.startDate) {
    const start = new Date(schedule.startDate);
    start.setHours(0, 0, 0, 0);
    if (start > now) return false;
  }

  if (schedule.endDate) {
    const end = new Date(schedule.endDate);
    end.setHours(23, 59, 59, 999);
    if (end < now) return false;
  }

  // ── Jours et horaires ──
  const days = schedule.daysOfWeek ?? [];
  // Aucun jour coché = tous les jours
  const runsOn = (day: number) => days.length === 0 || days.includes(day);

  const today = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startMinutes = schedule.startTime ? toMinutes(schedule.startTime) : 0;
  const endMinutes = schedule.endTime
    ? toMinutes(schedule.endTime)
    : MINUTES_IN_DAY;

  if (startMinutes <= endMinutes) {
    return (
      runsOn(today) &&
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes
    );
  }

  // Fenêtre à cheval sur minuit (ex. 22:00 → 02:00) : elle est ouverte en fin
  // de journée pour les jours cochés, et en début de journée suivante — le jour
  // à vérifier est alors celui où la diffusion a commencé, donc la veille.
  const yesterday = (today + 6) % 7;
  return (
    (runsOn(today) && currentMinutes >= startMinutes) ||
    (runsOn(yesterday) && currentMinutes < endMinutes)
  );
}

/**
 * Une playlist est diffusable si elle n'a aucun planning (diffusion continue)
 * ou si au moins un de ses plannings est ouvert maintenant.
 */
export function canPlayNow(
  schedules: ScheduleWindow[] | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!schedules?.length) return true;
  return schedules.some((schedule) => isScheduleOpen(schedule, now));
}
