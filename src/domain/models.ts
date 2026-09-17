export type ModuleKey =
  | "donaciones"
  | "usuarios"
  | "almacenes"
  | "voluntarios"
  | "inventario"
  | "recepciones"
  | "reportes";
/** Modelos de presentación. Los DTO HTTP se definirán al integrar el backend. */
export interface Entity {
  id: string;
  name: string;
  status: string;
  [field: string]: string;
}
export interface Notice {
  id: string;
  title: string;
  detail: string;
  time: string;
  group: string;
  important?: boolean;
  unread?: boolean;
}
export interface WebData {
  entities: Record<ModuleKey, Entity[]>;
  notices: Notice[];
}
