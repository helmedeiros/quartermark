import type { ReactNode } from "react";

export function queryStateMessage(
  isLoading: boolean,
  error: unknown,
  label: string,
): ReactNode | null {
  if (isLoading) return <p>Loading…</p>;
  if (error) {
    return (
      <p>
        Failed to load {label}: {String(error)}
      </p>
    );
  }
  return null;
}
