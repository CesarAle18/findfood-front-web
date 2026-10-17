import { useRef, useState } from "react";
import { Card, Field, Select } from "../components/ui";
import { useSession } from "./session-context";
import { useRead } from "./read";
import { apiRequest, errorMessage } from "./http";
import { OptionsField } from "./ActionForm";
import type { Input, Row } from "./actions";
const receiptReason: Input = {
  key: "motivo_id",
  label: "Motivo",
  required: true,
  type: "select",
  source: {
    endpoint: "/catalogos?incluir=motivos&ambito=RECHAZO_RECEPCION",
    key: "motivos",
  },
};
const destinations: Input = {
  key: "tipo_destino_id",
  label: "Tipo de destino",
  required: true,
  type: "select",
  source: {
    endpoint: "/catalogos?incluir=tipos_destino_distribucion",
    key: "tipos_destino_distribucion",
  },
};
const foods: Input = {
  key: "tipo_alimento_id",
  label: "Producto",
  required: true,
  type: "select",
  source: {
    endpoint: "/catalogos?incluir=tipos_alimento",
    key: "tipos_alimento",
  },
};
const units: Input = {
  key: "unidad_medida_id",
  label: "Unidad",
  required: true,
  type: "select",
  source: {
    endpoint: "/catalogos?incluir=unidades_medida",
    key: "unidades_medida",
  },
};
export function ReceptionLive({ id }: { id: string }) {
  const auth = useSession()!,
    read = useRead<Row>(`/donaciones/${encodeURIComponent(id)}`);
  const [status, setStatus] = useState("ACEPTADA"),
    [reason, setReason] = useState(""),
    [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<
    Record<string, { accepted: boolean; quantity: string; weight: string }>
  >({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const items = Array.isArray(read.data?.items)
    ? (read.data.items as Row[])
    : [];
  const allowed = auth.profile?.roles.includes("ASESOR_BANCO");
  if (!allowed)
    return <p>El registro de recepción requiere el rol Asesor del banco.</p>;
  if (read.loading) return <p role="status">Cargando donación…</p>;
  if (read.error) return <p role="alert">{read.error}</p>;
  if (read.data?.estado !== "ENTREGADA")
    return (
      <Card title="Recepción no disponible">
        <p role="alert">
          Solo se recibe una donación ENTREGADA en la sede. Estado actual:{" "}
          {String(read.data?.estado || "No disponible")}.
        </p>
      </Card>
    );
  const itemState = (item: Row) =>
    quantities[String(item.id)] || {
      accepted: true,
      quantity: String(item.cantidad ?? 0),
      weight: String(item.peso_real_kg ?? item.peso_estimado_kg ?? 0),
    };
  return (
    <Card title="Registrar recepción">
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current) return;
          setError("");
          try {
            if (status !== "ACEPTADA" && !reason)
              throw new Error("Selecciona el motivo.");
            const accepted = items
              .filter((item) => itemState(item).accepted)
              .map((item) => ({
                donacion_item_id: String(item.id),
                cantidad_aceptada: Number(itemState(item).quantity),
                peso_aceptado_kg: Number(itemState(item).weight),
              }));
            if (status === "ACEPTADA_PARCIAL" && !accepted.length)
              throw new Error("Selecciona al menos un producto aceptado.");
            lock.current = true;
            setBusy(true);
            await apiRequest("/recepciones", {
              method: "POST",
              body: JSON.stringify({
                donacion_id: id,
                estado: status,
                ...(status !== "ACEPTADA" ? { motivo_id: Number(reason) } : {}),
                ...(status === "ACEPTADA_PARCIAL" ? { items: accepted } : {}),
                ...(notes.trim() ? { observaciones: notes.trim() } : {}),
              }),
            });
            window.dispatchEvent(new Event("findfood:data-changed"));
            window.location.hash = "/recepciones";
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <Select
          label="Resultado de recepción"
          value={status}
          disabled={busy}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ACEPTADA">Aceptada</option>
          <option value="ACEPTADA_PARCIAL">Aceptada parcialmente</option>
          <option value="RECHAZADA">Rechazada</option>
        </Select>
        {status !== "ACEPTADA" && (
          <OptionsField
            field={receiptReason}
            value={reason}
            disabled={busy}
            change={setReason}
          />
        )}
        {status === "ACEPTADA_PARCIAL" &&
          items.map((item) => {
            const current = itemState(item);
            const update = (values: Partial<typeof current>) =>
              setQuantities((previous) => ({
                ...previous,
                [String(item.id)]: { ...current, ...values },
              }));
            return (
              <fieldset key={String(item.id)} className="form-stack">
                <legend>
                  {String(
                    (item.tipo_alimento as Row)?.nombre ??
                      item.descripcion ??
                      "Producto",
                  )}
                </legend>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={current.accepted}
                    disabled={busy}
                    onChange={(e) => update({ accepted: e.target.checked })}
                  />
                  Aceptar producto
                </label>
                {current.accepted && (
                  <>
                    <Field
                      label="Cantidad aceptada"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={current.quantity}
                      disabled={busy}
                      onChange={(e) => update({ quantity: e.target.value })}
                    />
                    <Field
                      label="Peso aceptado (kg)"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={current.weight}
                      disabled={busy}
                      onChange={(e) => update({ weight: e.target.value })}
                    />
                  </>
                )}
              </fieldset>
            );
          })}
        <Field
          label="Observaciones"
          maxLength={2000}
          value={notes}
          disabled={busy}
          onChange={(e) => setNotes(e.target.value)}
        />
        {read.error && <p role="alert">{read.error}</p>}
        {error && (
          <p role="alert" className="integration-error">
            {error}
          </p>
        )}
        <button
          className="button"
          disabled={busy || read.loading || !!read.error}
          type="submit"
        >
          {busy ? "Guardando…" : "Registrar recepción"}
        </button>
      </form>
    </Card>
  );
}
export function DistributionCreate({ onSaved }: { onSaved: () => void }) {
  const auth = useSession()!;
  const [open, setOpen] = useState(false),
    [destination, setDestination] = useState(""),
    [name, setName] = useState("");
  const [lines, setLines] = useState([
    { key: crypto.randomUUID(), food: "", unit: "", quantity: "" },
  ]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  if (!auth.profile?.roles.includes("ASESOR_BANCO")) return null;
  return (
    <>
      <button className="button" disabled={busy} onClick={() => setOpen(!open)}>
        {open ? "Cerrar formulario" : "Nueva distribución"}
      </button>
      {open && (
        <Card title="Nueva distribución">
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (lock.current) return;
              setError("");
              try {
                if (
                  !destination ||
                  lines.some(
                    (line) => !line.food || !line.unit || !line.quantity,
                  )
                )
                  throw new Error("Completa el destino y todos los productos.");
                lock.current = true;
                setBusy(true);
                await apiRequest("/distribuciones", {
                  method: "POST",
                  body: JSON.stringify({
                    tipo_destino_id: Number(destination),
                    nombre_destino: name.trim(),
                    lineas: lines.map((line) => ({
                      tipo_alimento_id: Number(line.food),
                      unidad_medida_id: Number(line.unit),
                      cantidad: Number(line.quantity),
                    })),
                  }),
                });
                setOpen(false);
                setName("");
                setDestination("");
                setLines([
                  {
                    key: crypto.randomUUID(),
                    food: "",
                    unit: "",
                    quantity: "",
                  },
                ]);
                window.dispatchEvent(new Event("findfood:data-changed"));
                onSaved();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            <OptionsField
              field={destinations}
              value={destination}
              disabled={busy}
              change={setDestination}
            />
            <Field
              label="Nombre del destino"
              required
              minLength={2}
              maxLength={150}
              disabled={busy}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {lines.map((line, index) => {
              const update = (values: Partial<typeof line>) =>
                setLines((previous) =>
                  previous.map((item) =>
                    item.key === line.key ? { ...item, ...values } : item,
                  ),
                );
              return (
                <fieldset key={line.key} className="form-stack">
                  <legend>Producto {index + 1}</legend>
                  <OptionsField
                    field={foods}
                    value={line.food}
                    disabled={busy}
                    change={(food) => update({ food })}
                  />
                  <OptionsField
                    field={units}
                    value={line.unit}
                    disabled={busy}
                    change={(unit) => update({ unit })}
                  />
                  <Field
                    label="Cantidad"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    disabled={busy}
                    value={line.quantity}
                    onChange={(e) => update({ quantity: e.target.value })}
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        setLines((previous) =>
                          previous.filter((item) => item.key !== line.key),
                        )
                      }
                    >
                      Quitar producto
                    </button>
                  )}
                </fieldset>
              );
            })}
            <button
              type="button"
              className="button secondary"
              disabled={busy || lines.length >= 50}
              onClick={() =>
                setLines((previous) => [
                  ...previous,
                  {
                    key: crypto.randomUUID(),
                    food: "",
                    unit: "",
                    quantity: "",
                  },
                ])
              }
            >
              Añadir producto
            </button>
            {error && (
              <p className="integration-error" role="alert">
                {error}
              </p>
            )}
            <button className="button" disabled={busy} type="submit">
              {busy ? "Guardando…" : "Crear distribución"}
            </button>
          </form>
        </Card>
      )}
    </>
  );
}
