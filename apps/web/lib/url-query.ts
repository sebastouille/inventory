export function buildPathWithQuery(
  pathname: string,
  current: { toString: () => string },
  updates: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === "string" && value.trim().length > 0) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
