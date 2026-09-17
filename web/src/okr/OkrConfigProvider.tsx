import { type ReactNode, useMemo } from "react";
import {
  OKR_CONFIG_DEFAULTS,
  type OkrConfig,
  OkrConfigContext,
} from "./config";

// Its own file so the module's config hook and context can be imported
// without dragging a component along — which is also what keeps fast
// refresh working.
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
