import { createContext, useContext } from "react";
import {
  DEFAULT_EXPORT_COLUMNS,
  type ExportColumn,
} from "../adapters/outbound/okrExport";

export interface OkrConfig {
  exportColumns: ExportColumn[];
}

export const OKR_CONFIG_DEFAULTS: OkrConfig = {
  exportColumns: DEFAULT_EXPORT_COLUMNS,
};

export const OkrConfigContext = createContext<OkrConfig>(OKR_CONFIG_DEFAULTS);

export function useOkrConfig(): OkrConfig {
  return useContext(OkrConfigContext);
}
