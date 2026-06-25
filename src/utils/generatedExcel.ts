const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getISOWeekNumber(date = new Date()): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));

  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
}

export function getGeneratedExcelFileName(date = new Date()): string {
  const week = String(getISOWeekNumber(date)).padStart(2, '0');
  return `Seguimiento Proyectos OffMan W${week}.xlsx`;
}
