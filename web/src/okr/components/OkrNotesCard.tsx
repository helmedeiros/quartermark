import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import { sortedNotes, updateNode } from "../domain/tree";
import type { OkrNode, OkrNote, TeamOkrsData } from "../domain/model";

export function OkrNotesCard({
  teamSlug,
  data,
  quarterId,
  node,
}: {
  teamSlug: string;
  data: TeamOkrsData;
  quarterId: string;
  node: OkrNode;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [learnings, setLearnings] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  const saveNote = useMutation({
    mutationFn: async (note: OkrNote) => {
      const quarters = data.quarters.map((q) =>
        q.quarterId === quarterId
          ? {
              ...q,
              objectives: updateNode(q.objectives, node.id, (n) => ({
                ...n,
                notes: [...(n.notes ?? []), note],
              })),
            }
          : q,
      );
      await api.putTeamBlob(teamSlug, "okrs", { ...data, quarters });
    },
    onSuccess: () => {
      setComment("");
      setLearnings("");
      setNextSteps("");
      void queryClient.invalidateQueries({
        queryKey: ["teamBlob", teamSlug, "okrs"],
      });
    },
  });

  const notes = sortedNotes(node);
  const canSave = !!(comment.trim() || learnings.trim() || nextSteps.trim());

  return (
    <div className="card">
      <h3>Comments, Learnings & Next Steps</h3>
      <div className="okr-note-form">
        <label className="small muted">
          Comment
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <label className="small muted">
          Learnings
          <textarea
            rows={3}
            value={learnings}
            onChange={(e) => setLearnings(e.target.value)}
          />
        </label>
        <label className="small muted">
          Next steps
          <textarea
            rows={3}
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="timeline-nav-btn"
          disabled={!canSave || saveNote.isPending}
          onClick={() =>
            saveNote.mutate({
              date: new Date().toISOString().slice(0, 10),
              comment: comment.trim() || undefined,
              learnings: learnings.trim() || undefined,
              nextSteps: nextSteps.trim() || undefined,
            })
          }
        >
          {saveNote.isPending ? "Saving…" : "Save entry"}
        </button>
        {saveNote.isError && (
          <p className="small" style={{ color: "var(--status-critical)" }}>
            Failed to save: {String(saveNote.error)}
          </p>
        )}
      </div>

      {!notes.length ? (
        <p className="small muted" style={{ marginTop: 12 }}>
          Nothing logged yet.
        </p>
      ) : (
        <div style={{ marginTop: 16 }}>
          {notes.map((n, i) => (
            <div key={i} className="timeline-item">
              <div className="date">
                {n.date}
                {n.author ? ` · ${n.author}` : ""}
              </div>
              {n.comment && (
                <p className="small" style={{ margin: "4px 0 0" }}>
                  <strong>Comment: </strong>
                  {n.comment}
                </p>
              )}
              {n.learnings && (
                <p className="small" style={{ margin: "4px 0 0" }}>
                  <strong>Learnings: </strong>
                  {n.learnings}
                </p>
              )}
              {n.nextSteps && (
                <p className="small" style={{ margin: "4px 0 0" }}>
                  <strong>Next steps: </strong>
                  {n.nextSteps}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
