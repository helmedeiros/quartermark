import type { ReactNode } from "react";
import { queryStateMessage } from "./queryStateMessage";

export function SidebarShell({
  isLoading,
  error,
  label,
  before,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  label: string;
  before?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside className="sidebar">
      {before}
      {queryStateMessage(isLoading, error, label) ?? children}
    </aside>
  );
}
