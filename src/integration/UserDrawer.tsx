import { useId, useState } from "react";
import { Details, Drawer, Field, Select } from "../components/ui";
import { roleLabels, statusLabels } from "./contracts";
import type { ApiUser } from "./contracts";
import { errorMessage } from "./http";
import { profileService, userService } from "./services";
import type { CreateUserResult } from "./services";
import { useSession } from "./session-context";

export function UserDrawer({
  user,
  onClose,
  onSaved,
}: {
  user: ApiUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const auth = useSession()!;
  const formId = useId();
  const ownProfile = user?.id === auth.profile?.id;
  const creating = !user;
  const [editing, setEditing] = useState(creating);
  const [names, setNames] = useState(user?.nombres || "");
  const [surname, setSurname] = useState(user?.apellidos || "");
  const [phone, setPhone] = useState(user?.telefono || "");
  const [email, setEmail] = useState(user?.email || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [created, setCreated] = useState<CreateUserResult | null>(null);
  const [role, setRole] = useState<"ADMIN" | "ASESOR_BANCO">("ASESOR_BANCO");
  const [status, setStatus] = useState(user?.estado || "ACTIVO");
  const [originalStatus, setOriginalStatus] = useState(user?.estado);
  const statusEditable =
    !ownProfile &&
    (originalStatus === "ACTIVO" || originalStatus === "INACTIVO");
  const canSave = creating || ownProfile || statusEditable;
  const title = creating
    ? "Nuevo usuario"
    : editing
      ? "Editar usuario"
      : "Detalle del usuario";
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Drawer
      title={title}
      close="#/usuarios"
      onClose={close}
      footer={
        <>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Cerrar
          </button>
          {!created && !editing && (
            <button
              type="button"
              className="button"
              onClick={() => {
                setEditing(true);
                setSaved(false);
              }}
            >
              Editar información
            </button>
          )}
          {!created && editing && (
            <button
              type="submit"
              form={formId}
              className="button"
              disabled={busy || !canSave}
            >
              {busy
                ? "Guardando…"
                : creating
                  ? "Crear usuario"
                  : "Guardar cambios"}
            </button>
          )}
        </>
      }
    >
      {created ? (
        <div className="form-stack">
          <p role="status">Usuario creado: {created.email}</p>
          <p>
            {created.correo_enviado
              ? "Se enviaron las instrucciones de acceso al correo del usuario."
              : "El correo no se envió. Entrega al usuario su contraseña temporal; tendrá que cambiarla en el primer ingreso."}
          </p>
          {created.password_temporal && (
            <Field
              label="Contraseña temporal (disponible una sola vez)"
              value={created.password_temporal}
              readOnly
            />
          )}
        </div>
      ) : (
        <>
          {creating && (
            <p>
              La cuenta se creará con el rol interno seleccionado. Recibirá una
              contraseña temporal que deberá cambiar al ingresar.
            </p>
          )}
          {editing && !creating && !ownProfile && (
            <p className="integration-banner" role="status">
              {statusEditable
                ? "Puedes cambiar el estado de esta cuenta. Sus datos de contacto se muestran para consulta."
                : "Las cuentas suspendidas o pendientes no se activan desde este formulario."}
            </p>
          )}
          <form
            id={formId}
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || !canSave || !auth.profile?.roles.includes("ADMIN"))
                return;
              if ((creating || ownProfile) && !names.trim()) {
                setError("Escribe los nombres del usuario.");
                return;
              }
              const cleanPhone = phone.replace(/[\s\-().]/g, "");
              const match = /^(?:\+?57)?(\d{10})$/.exec(cleanPhone);
              if ((creating || ownProfile) && !match) {
                setError(
                  "Escribe un teléfono de 10 dígitos, con +57 opcional.",
                );
                return;
              }
              setBusy(true);
              setError("");
              setSaved(false);
              try {
                const body = {
                  nombres: names.trim(),
                  apellidos: surname.trim(),
                  telefono: match ? `+57${match[1]}` : phone,
                };
                if (creating) {
                  const result = await userService.create({
                    rol: role,
                    ...body,
                    email: email.trim().toLowerCase(),
                  });
                  setCreated(result);
                } else {
                  if (ownProfile) await profileService.update(body);
                  else if (status === "ACTIVO" || status === "INACTIVO") {
                    const result = await userService.changeStatus(
                      user.id,
                      status,
                    );
                    setStatus(result.estado);
                    setOriginalStatus(result.estado);
                  }
                  setEditing(false);
                  setSaved(true);
                  if (ownProfile) await auth.refreshProfile();
                }
                onSaved();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {user &&
              (editing && statusEditable ? (
                <Select
                  label="Estado"
                  value={status}
                  disabled={busy}
                  onChange={(e) =>
                    setStatus(e.target.value as "ACTIVO" | "INACTIVO")
                  }
                >
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </Select>
              ) : (
                <Field
                  label="Estado"
                  value={statusLabels[status] || status}
                  readOnly
                />
              ))}
            <Field
              label={creating || ownProfile ? "Nombres *" : "Nombres"}
              required={creating || ownProfile}
              maxLength={100}
              value={names}
              readOnly={!editing || (!creating && !ownProfile)}
              disabled={busy}
              onChange={(e) => setNames(e.target.value)}
            />
            <Field
              label="Apellidos"
              maxLength={100}
              value={surname}
              readOnly={!editing || (!creating && !ownProfile)}
              disabled={busy}
              onChange={(e) => setSurname(e.target.value)}
            />
            <Field
              label={creating ? "Correo electrónico *" : "Correo electrónico"}
              type="email"
              required
              value={email}
              readOnly={!creating}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label={creating || ownProfile ? "Teléfono *" : "Teléfono"}
              type="tel"
              required={creating || ownProfile}
              title="Celular colombiano de 10 dígitos, con +57 opcional"
              value={phone}
              readOnly={!editing || (!creating && !ownProfile)}
              disabled={busy}
              onChange={(e) => setPhone(e.target.value)}
            />
            {creating ? (
              <Select
                label="Rol"
                value={role}
                disabled={busy}
                onChange={(e) =>
                  setRole(e.target.value as "ADMIN" | "ASESOR_BANCO")
                }
              >
                <option value="ASESOR_BANCO">Asesor del banco</option>
                <option value="ADMIN">Administrador</option>
              </Select>
            ) : (
              <Field
                label="Rol"
                value={user.roles.map((r) => roleLabels[r] || r).join(", ")}
                readOnly
              />
            )}
            {error && (
              <p className="integration-error" role="alert">
                {error}
              </p>
            )}
            {saved && <p role="status">Información actualizada.</p>}
          </form>
          {user && (
            <Details
              items={[
                ["ID", user.id],
                [
                  "Creado",
                  new Date(user.created_at).toLocaleString("es-CO", {
                    timeZone: "America/Bogota",
                  }),
                ],
                [
                  "Último acceso",
                  user.ultimo_acceso_at
                    ? new Date(user.ultimo_acceso_at).toLocaleString("es-CO", {
                        timeZone: "America/Bogota",
                      })
                    : "Sin acceso",
                ],
              ]}
            />
          )}
        </>
      )}
    </Drawer>
  );
}
