import { createContext, useContext } from "react";
import type { WebData } from "../domain/models";
import { demoData } from "../data/demo";
export const DataContext = createContext<WebData>(demoData);
export const useData = () => useContext(DataContext);
