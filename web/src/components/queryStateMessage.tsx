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

export function queriesStateMessage(
  isLoading: boolean,
  failures: { label: string; error: unknown }[],
): ReactNode | null {
  if (isLoading) return queryStateMessage(true, null, "");
  const failed = failures.find((f) => f.error);
  return failed ? queryStateMessage(false, failed.error, failed.label) : null;
}
