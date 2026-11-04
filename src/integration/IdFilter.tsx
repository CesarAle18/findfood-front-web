export function IdFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="id-filter">ID<input type="search" aria-label="Buscar por ID" placeholder="Pega un ID…" maxLength={200} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
