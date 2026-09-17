import type { WebData } from "../domain/models";
import { demoData } from "../data/demo";
/** Puerto de lectura sustituible por un adaptador HTTP, todavía no implementado. */
export interface WebRepository {
  load(signal?: AbortSignal): Promise<WebData>;
}
export const demoRepository: WebRepository = {
  async load() {
    return demoData;
  },
};
