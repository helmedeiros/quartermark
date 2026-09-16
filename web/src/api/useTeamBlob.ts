import { api } from "./client";
import { useTypedBlob } from "./useTypedBlob";

export function useTeamBlob<T>(teamSlug: string, section: string) {
  return useTypedBlob("teamBlob", teamSlug, section, () =>
    api.getTeamBlob<T>(teamSlug, section),
  );
}
