export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
