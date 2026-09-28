import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import type { TeamOkrsData } from "../domain/model";
import { useOkrTreeMutations } from "./useOkrTreeMutations";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const data: TeamOkrsData = {
  team: "Acme Squad",
  schemaVersion: 1,
  quarters: [
    {
      quarterId: "2026-q3",
      label: "Q3 2026",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      objectives: [],
    },
  ],
};

describe("useOkrTreeMutations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("carries schemaVersion through to the saved payload", async () => {
    const put = vi.spyOn(api, "putTeamBlob").mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useOkrTreeMutations("acme", data, "2026-q3"),
      { wrapper },
    );
    result.current.create(null, "objective", "Ship it");

    await waitFor(() => expect(put).toHaveBeenCalled());
    const [, section, payload] = put.mock.calls[0];
    expect(section).toBe("okrs");
    expect((payload as TeamOkrsData).schemaVersion).toBe(1);
  });
});
