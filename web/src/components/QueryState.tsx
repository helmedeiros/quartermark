import type { ReactNode } from "react";
import { queryStateMessage } from "./queryStateMessage";

export function QueryState({
  isLoading,
  error,
  label,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  label: string;
  children: ReactNode;
}) {
  return <>{queryStateMessage(isLoading, error, label) ?? children}</>;
}
