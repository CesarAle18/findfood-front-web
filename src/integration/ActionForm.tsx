import { useEffect, useId, useRef, useState } from "react";
import { Drawer, Field, Select } from "../components/ui";
import { apiRequest, errorMessage } from "./http";
import type { Action, Input, Row, Source, Values } from "./actions";
import { useSession } from "./session-context";
import { addActivity } from "./activity";
import { PlaceField } from "./PlaceField";

export function OptionsField({
  field,
  value,
  disabled,
  change,
}: {
  field: Input;
  value: string;
  disabled: boolean;
  change: (v: string) => void;
}) {
  const [options, setOptions] = useState<Row[] | null>(null),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const source = field.source!;
  useEffect(() => {
    const controller = new AbortController();
    async function load(s: Source) {
      let rows: Row[] = [];
      let offset = 0;
      while (!controller.signal.aborted) {
        const endpoint = s.key
          ? s.endpoint
          : `${s.endpoint}${s.endpoint.includes("?") ? "&" : "?"}limite=100&desplazamiento=${offset}`;
        const result = await apiRequest<unknown>(endpoint, {
          signal: controller.signal,
        });
        const record = result as Row;
        const batch = (
          s.key ? record[s.key] : Array.isArray(result) ? result : record.datos
        ) as Row[];
        if (!Array.isArray(batch))
          throw new Error("La API no devolvió las opciones esperadas.");
        rows = rows.concat(batch);
        if (
          s.key ||
          Array.isArray(result) ||
          !batch.length ||
          rows.length >= Number(record.total)
        )
          break;
        offset += batch.length;
      }
      if (!controller.signal.aborted)
        setOptions(
          rows.filter((r) => !s.states || s.states.includes(String(r.estado))),
        );
    }
    load(source).catch((err) => {
      if (!controller.signal.aborted) setError(errorMessage(err));
    });
    return () => controller.abort();
  }, [source, retry]);
  const label = (r: Row) =>
    String(r.nombre ?? r.codigo ?? r.titulo ?? r.nombres ?? r.id);
  if (error)
    return (
      <div className="form-stack">
        <p role="alert" className="integration-error">
          {error}
        </p>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setError("");
            setRetry((n) => n + 1);
          }}
        >
          Reintentar opciones
        </button>
      </div>
    );
  if (!options)
    return <p role="status">Cargando {field.label.toLowerCase()}…</p>;
  if (!options.length)
    return (
      <p role="alert">
        No hay opciones disponibles para {field.label.toLowerCase()}.
      </p>
    );
  if (field.type === "multi") {
    const selected: string[] = JSON.parse(value || "[]");
    return (
      <fieldset className="form-stack">
        <legend>{field.label}</legend>
        {options.map((r) => (
          <label key={String(r.id)} className="check-field">
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(String(r.id))}
              onChange={(e) =>
                change(
                  JSON.stringify(
                    e.target.checked
                      ? [...selected, String(r.id)]
                      : selected.filter((id) => id !== String(r.id)),
                  ),
                )
              }
            />
            {label(r)}
          </label>
        ))}
      </fieldset>
    );
  }
  return (
    <Select
      label={field.label}
      required={field.required}
      value={value}
      disabled={disabled}
      onChange={(e) => change(e.target.value)}
    >
      <option value="">Selecciona una opción</option>
      {options.map((r) => (
        <option key={String(r.id)} value={String(r.id)}>
          {label(r)}
        </option>
      ))}
    </Select>
  );
}
export function ActionForm({
  action,
  onClose,
  onSaved,
}: {
  action: Action;
  onClose: () => void;
  onSaved: () => void;
}) {
  const auth = useSession()!;
  const formId = useId();
  const lock = useRef(false);
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(
      action.fields.map((f) => [
        f.key,
        action.initial?.[f.key] || (f.type === "checkbox" ? "false" : ""),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const allowed = action.roles.some((r) => auth.profile?.roles.includes(r));
  return (
    <Drawer
      title={action.label}
      close={window.location.hash}
      onClose={() => {
        if (!lock.current) onClose();
      }}
      footer={
        <>
          <button
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="button"
            form={formId}
            type="submit"
            disabled={busy || !allowed}
          >
            {busy ? "Guardando…" : "Confirmar"}
          </button>
        </>
      }
    >
      {action.description && <p>{action.description}</p>}
      <form
        id={formId}
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current || !allowed) return;
          setError("");
          try {
            for (const field of action.fields) {
              const v = values[field.key];
              if (
                field.required &&
                (!v.trim() ||
                  (field.type === "multi" && !JSON.parse(v || "[]").length))
              )
                throw new Error(`Completa ${field.label.toLowerCase()}.`);
              if (
                v &&
                field.min !== undefined &&
                field.type !== "number" &&
                v.trim().length < field.min
              )
                throw new Error(
                  `${field.label} debe tener al menos ${field.min} caracteres.`,
                );
            }
            const body = action.body
              ? action.body(values)
              : Object.fromEntries(
                  action.fields
                    .filter((f) => values[f.key].trim())
                    .map((f) => [f.key, values[f.key].trim()]),
                );
            lock.current = true;
            setBusy(true);
            await apiRequest(action.endpoint, {
              method: action.method,
              body: JSON.stringify(body),
            });
            if (action.key === "verify-approve" && auth?.session?.user.id) {
              const verificationId = action.endpoint.split("/").at(-2);
              addActivity(auth.session.user.id, {
                id: `volunteer:${verificationId}`,
                titulo: "Se aceptó a un nuevo voluntario",
                cuerpo: "La solicitud de voluntariado fue aprobada correctamente.",
                href: "#/voluntarios",
              });
            }
            window.dispatchEvent(new Event("findfood:data-changed"));
            onSaved();
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        {action.fields.map((field) => {
          const change = (v: string) =>
            setValues((previous) => ({ ...previous, [field.key]: v }));
          if (field.source)
            return (
              <OptionsField
                key={field.key}
                field={field}
                value={values[field.key]}
                disabled={busy}
                change={change}
              />
            );
          if (field.type === "place")
            return (
              <PlaceField
                key={field.key}
                field={field}
                value={values[field.key]}
                point={
                  values.lat && values.lng
                    ? { lat: Number(values.lat), lng: Number(values.lng) }
                    : null
                }
                disabled={busy}
                change={change}
                onPlace={(direccion, p) =>
                  setValues((previous) => ({
                    ...previous,
                    [field.key]: direccion,
                    lat: String(p.lat),
                    lng: String(p.lng),
                  }))
                }
                onPoint={(p) =>
                  setValues((previous) => ({
                    ...previous,
                    lat: String(p.lat),
                    lng: String(p.lng),
                  }))
                }
              />
            );
          if (field.type === "checkbox")
            return (
              <label key={field.key} className="check-field">
                <input
                  type="checkbox"
                  checked={values[field.key] === "true"}
                  disabled={busy}
                  onChange={(e) => change(String(e.target.checked))}
                />
                {field.label}
              </label>
            );
          if (field.type === "select")
            return (
              <Select
                key={field.key}
                label={field.label}
                required={field.required}
                disabled={busy}
                value={values[field.key]}
                onChange={(e) => change(e.target.value)}
              >
                <option value="">Selecciona una opción</option>
                {field.options?.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            );
          if (field.type === "textarea")
            return (
              <label key={field.key} className="field">
                <span>{field.label}</span>
                <textarea
                  aria-label={field.label}
                  required={field.required}
                  minLength={field.min}
                  maxLength={field.maxLength}
                  disabled={busy}
                  value={values[field.key]}
                  onChange={(e) => change(e.target.value)}
                />
              </label>
            );
          return (
            <Field
              key={field.key}
              label={field.label}
              type={field.type === "number" ? "number" : "text"}
              step={field.step}
              min={field.type === "number" ? field.min : undefined}
              max={field.max}
              minLength={field.type !== "number" ? field.min : undefined}
              maxLength={field.maxLength}
              required={field.required}
              disabled={busy}
              value={values[field.key]}
              onChange={(e) => change(e.target.value)}
            />
          );
        })}
        {!action.fields.length && (
          <p>Confirma la operación sobre el registro seleccionado.</p>
        )}
        {error && (
          <p className="integration-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Drawer>
  );
}
export function ActionButtons({
  actions,
  onSaved,
}: {
  actions: Action[];
  onSaved: () => void;
}) {
  const auth = useSession()!,
    [selected, setSelected] = useState<Action | null>(null),
    [saved, setSaved] = useState(false);
  return (
    <>
      <div className="card-actions">
        {actions
          .filter((a) => a.roles.some((r) => auth.profile?.roles.includes(r)))
          .map((a) => (
            <button
              className="button secondary"
              key={a.key}
              onClick={() => {
                setSaved(false);
                setSelected(a);
              }}
            >
              {a.label}
            </button>
          ))}
      </div>
      {saved && <p role="status">Operación completada.</p>}
      {selected && (
        <ActionForm
          action={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSaved(true);
            onSaved();
          }}
        />
      )}
    </>
  );
}
