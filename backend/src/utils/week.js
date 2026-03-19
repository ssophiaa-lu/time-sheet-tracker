function getWeekStart(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date provided");
  }

  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toISODate(dateInput) {
  const date = new Date(dateInput);
  return date.toISOString().slice(0, 10);
}

module.exports = {
  getWeekStart,
  toISODate,
};
