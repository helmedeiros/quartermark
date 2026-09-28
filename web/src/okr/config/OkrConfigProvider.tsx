import { type ReactNode, useMemo } from "react";
import {
  OKR_CONFIG_DEFAULTS,
  type OkrConfig,
  OkrConfigContext,
} from "./okrConfig";

export function OkrConfigProvider({
  children,
  exportColumns,
}: Partial<OkrConfig> & { children: ReactNode }) {
  const value = useMemo(
    () => ({
      ...OKR_CONFIG_DEFAULTS,
      ...(exportColumns ? { exportColumns } : {}),
    }),
    [exportColumns],
  );
  return (
    <OkrConfigContext.Provider value={value}>
      {children}
    </OkrConfigContext.Provider>
  );
}
