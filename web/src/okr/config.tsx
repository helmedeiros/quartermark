import { createContext, type ReactNode, useContext, useMemo } from "react";
import { DEFAULT_EXPORT_COLUMNS, type ExportColumn } from "./okrExport";

// What a host application can change about the module without forking it.
//
// A context rather than a mutable module global: the configuration is
// read during render, and a global set at boot is invisible in tests and
// impossible to vary between two mounts.
export interface OkrConfig {
  // Columns the quarter export produces. Organisations paste this sheet
  // into their own planning template, so the default set is neutral and
  // anyone with a template supplies their own.
  exportColumns: ExportColumn[];
}

const DEFAULTS: OkrConfig = { exportColumns: DEFAULT_EXPORT_COLUMNS };

const OkrConfigContext = createContext<OkrConfig>(DEFAULTS);

export function OkrConfigProvider({
  children,
  ...overrides
}: Partial<OkrConfig> & { children: ReactNode }) {
  const value = useMemo(
    () => ({ ...DEFAULTS, ...overrides }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overrides.exportColumns],
  );
  return (
    <OkrConfigContext.Provider value={value}>
      {children}
    </OkrConfigContext.Provider>
  );
}

// Defaults apply when no provider is mounted, so the module works
// standalone and a host opts in only to what it wants to change.
export function useOkrConfig(): OkrConfig {
  return useContext(OkrConfigContext);
}
