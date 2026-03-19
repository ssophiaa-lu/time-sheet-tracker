export function getWeekStart(inputDate) {
  const date = new Date(inputDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function toISODate(inputDate) {
  const date = new Date(inputDate);
  return date.toISOString().slice(0, 10);
}

export function formatDate(inputDate) {
  return new Date(inputDate).toLocaleDateString();
}
