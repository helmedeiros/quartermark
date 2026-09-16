import type { ReactNode } from "react";

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
  if (isLoading) return <p>Loading…</p>;
  if (error) {
    return (
      <p>
        Failed to load {label}: {String(error)}
      </p>
    );
  }
  return <>{children}</>;
}
