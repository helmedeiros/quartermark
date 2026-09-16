import { useQuery } from "@tanstack/react-query";
import { ApiError } from "./client";

export function useTypedBlob<T>(
  queryKeyPrefix: string,
  key: string,
  section: string,
  fetcher: () => Promise<T>,
) {
  return useQuery<T | null>({
    queryKey: [queryKeyPrefix, key, section],
    queryFn: async () => {
      try {
        return await fetcher();
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}
