import type { Row } from "./actions";

export function donationDetails(value: unknown): unknown {
  return nonEmptyDetails(value, ["metadata", "registros", "historial"]);
}

export function nonEmptyDetails(value: unknown, excluded: string[] = []): unknown {
  if (Array.isArray(value)) return value.map((item) => nonEmptyDetails(item, excluded)).filter(hasContent);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Row)
    .filter(([key]) => !excluded.includes(key))
    .map(([key, item]) => [key, nonEmptyDetails(item, excluded)])
    .filter(([, item]) => hasContent(item)));
}

function hasContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function donationHistory(value: unknown): unknown {
  if (!Array.isArray(value)) return [];
  const rows = value.filter((row): row is Row => !!row && typeof row === "object" && row.ambito === "DONACION");
  return ["ENTREGADA", "RECIBIDA"].flatMap((state) => {
    const latest = rows.filter((row) => row.estado_nuevo === state)
      .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)) || Number(b.id) - Number(a.id))[0];
    return latest ? [donationDetails(latest)] : [];
  });
}

export function canAssignDonation(row: Row): boolean {
  return ["PUBLICADA", "ASIGNADA"].includes(String(row.estado));
}
