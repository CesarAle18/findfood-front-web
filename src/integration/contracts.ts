export type Role = "ADMIN" | "ASESOR_BANCO" | "DONANTE" | "VOLUNTARIO";
export type UserStatus =
  "ACTIVO" | "INACTIVO" | "SUSPENDIDO" | "PENDIENTE_CONFIRMACION";
export interface Profile {
  id: string;
  email: string;
  nombres: string;
  apellidos: string | null;
  telefono: string | null;
  estado: UserStatus;
  roles: Role[];
  debe_cambiar_password: boolean;
  pendientes: string[];
  email_verificado: boolean;
}
export interface ApiUser {
  id: string;
  email: string;
  nombres: string;
  apellidos: string | null;
  telefono: string | null;
  estado: UserStatus;
  roles: Role[];
  roles_inactivos: Role[];
  ultimo_acceso_at: string | null;
  created_at: string;
}
export interface Page<T> {
  datos: T[];
  total: number;
  limite: number;
  desplazamiento: number;
}
export interface UserFilters {
  q: string;
  rol: string;
  estado: string;
  limite: number;
  desplazamiento: number;
}
export interface Kpis {
  desde: string;
  hasta: string;
  donaciones: { creadas: number; recibidas: number; kg_recuperados: number };
  asignacion: { ofertas: number; tasa_aceptacion: number | null };
  inventario: { kg_merma: number; kg_distribuidos: number };
  por_sede: {
    id: string;
    nombre: string;
    tipo: string;
    recepciones: number;
    kg_recibidos: number;
    kg_rechazados: number;
  }[];
}
export interface Problem {
  status: number;
  type: string;
  title: string;
  detail?: string;
  errores?: string[];
}
export const roleLabels: Record<Role, string> = {
  ADMIN: "Administrador",
  ASESOR_BANCO: "Asesor del banco",
  DONANTE: "Donante",
  VOLUNTARIO: "Voluntario",
};
export const statusLabels: Record<UserStatus, string> = {
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  SUSPENDIDO: "Suspendido",
  PENDIENTE_CONFIRMACION: "Pendiente de confirmación",
};
