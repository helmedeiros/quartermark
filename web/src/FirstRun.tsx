import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api/client";
import { DEFAULT_SECTION_ID } from "./sections";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// What a fresh install lands on: no teams yet, so the only useful thing
// to offer is making one. Deliberately the whole page rather than a
// modal — on first run there is nothing behind it to go back to.
export function FirstRun() {
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      api.createTeam({ slug: slugify(name), name: name.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      navigate(`/t/${slugify(name)}/${DEFAULT_SECTION_ID}`);
    },
  });

  const slug = slugify(name);
  const canCreate = slug.length > 0 && !create.isPending;

  return (
    <main className="main" style={{ maxWidth: 560 }}>
      <h2>Name your team</h2>
      <p className="muted">
        Quartermark scopes everything to a team: its quarters, its objectives,
        its Jira connection. You can add more later.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canCreate) create.mutate();
        }}
      >
        <label>
          Team name
          <input
            autoFocus
            value={name}
            placeholder="Platform"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {slug && (
          <p className="muted">
            URL: <code>/t/{slug}/okrs</code>
          </p>
        )}
        <button type="submit" disabled={!canCreate}>
          {create.isPending ? "Creating…" : "Create team"}
        </button>
      </form>

      {create.isError && (
        <p className="error">
          Could not create the team: {String(create.error)}
        </p>
      )}
    </main>
  );
}
