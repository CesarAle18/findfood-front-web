export function isIdSearch(query: string): boolean {
  return /^(?:\d+|(?:[a-z][\w-]*:)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(query.trim());
}

export function matchesId(value: unknown, query: string): boolean {
  const expected = query.trim().toLocaleLowerCase("es");
  if (!expected) return true;
  function find(item: unknown): boolean {
    if (Array.isArray(item)) return item.some(find);
    if (!item || typeof item !== "object") return false;
    return Object.entries(item).some(([key, field]) =>
      ((key === "id" || key.endsWith("_id")) && (typeof field === "string" || typeof field === "number") && String(field).toLocaleLowerCase("es") === expected) ||
      (field !== null && typeof field === "object" && find(field)));
  }
  return find(value);
}
