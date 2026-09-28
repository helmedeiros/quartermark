import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import {
  addOkrNode,
  moveNodeRelativeTo,
  removeNodeWithHistory,
  reparentNode,
  updateNode,
} from "../domain/tree";
import type {
  OkrNode,
  OkrNodeType,
  Quarter,
  TeamOkrsData,
} from "../domain/model";

export function useOkrTreeMutations(
  teamSlug: string,
  data: TeamOkrsData,
  quarterId: string,
) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (quarters: Quarter[]) => {
      await api.putTeamBlob(teamSlug, "okrs", { ...data, quarters });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["teamBlob", teamSlug, "okrs"],
      });
    },
  });

  const withQuarterObjectives = (
    updater: (objectives: OkrNode[]) => OkrNode[],
  ) =>
    data.quarters.map((q) =>
      q.quarterId === quarterId
        ? { ...q, objectives: updater(q.objectives) }
        : q,
    );

  return {
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    create: (
      parentId: string | null,
      type: OkrNodeType,
      title: string,
      extra?: Partial<OkrNode>,
    ) =>
      mutation.mutate(
        addOkrNode(data.quarters, quarterId, parentId, type, title, extra),
      ),
    moveRelative: (
      id: string,
      targetId: string,
      position: "before" | "after",
    ) =>
      mutation.mutate(
        withQuarterObjectives((objs) =>
          moveNodeRelativeTo(objs, id, targetId, position),
        ),
      ),
    moveInto: (id: string, targetId: string) =>
      mutation.mutate(
        withQuarterObjectives((objs) => reparentNode(objs, id, targetId)),
      ),
    remove: (id: string) =>
      mutation.mutate(
        withQuarterObjectives((objs) =>
          removeNodeWithHistory(
            objs,
            id,
            new Date().toISOString().slice(0, 10),
          ),
        ),
      ),
    editField: (id: string, patch: Partial<OkrNode>) =>
      mutation.mutate(
        withQuarterObjectives((objs) =>
          updateNode(objs, id, (n) => ({ ...n, ...patch })),
        ),
      ),
    setQuarterLocked: (locked: boolean) =>
      mutation.mutate(
        data.quarters.map((q) =>
          q.quarterId === quarterId ? { ...q, locked } : q,
        ),
      ),
    editQuarterField: (patch: Partial<Quarter>) =>
      mutation.mutate(
        data.quarters.map((q) =>
          q.quarterId === quarterId ? { ...q, ...patch } : q,
        ),
      ),
    linkJira: async (id: string, keys: string[]) => {
      await mutation.mutateAsync(
        withQuarterObjectives((objs) =>
          updateNode(objs, id, (n) => ({
            ...n,
            jiraKeys: keys.length ? keys : undefined,
          })),
        ),
      );
      try {
        await api.refreshOkrJiraNode(teamSlug, { quarterId, nodeId: id });
      } catch {
      } finally {
        void queryClient.invalidateQueries({
          queryKey: ["teamBlob", teamSlug, "okrs"],
        });
      }
    },
  };
}
