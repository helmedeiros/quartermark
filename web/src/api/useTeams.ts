import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: () => api.listTeams(),
  });
}
