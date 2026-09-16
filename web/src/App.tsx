import { Navigate, NavLink, Route, Routes, useParams } from "react-router-dom";
import { useTeams } from "./api/useTeams";
import { useDefaultTeamSlug } from "./api/useDefaultTeamSlug";
import { FirstRun } from "./FirstRun";
import { DEFAULT_SECTION_ID, SECTIONS } from "./sections";

// Every section nested under /t/:teamSlug/, reading the slug once here
// rather than each page reaching for it.
function TeamLayout() {
  const { teamSlug = "" } = useParams<{ teamSlug: string }>();

  return (
    <Routes>
      {SECTIONS.map((section) => (
        <Route
          key={section.id}
          path={`${section.id}/*`}
          element={
            <div className="layout">
              <section.Sidebar teamSlug={teamSlug} />
              <main className="main">
                <Routes>
                  {section.routes.map((route) => (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={<route.Component teamSlug={teamSlug} />}
                    />
                  ))}
                  <Route
                    index
                    element={
                      section.index.kind === "redirect" ? (
                        <Navigate to={section.index.to} replace />
                      ) : (
                        <section.index.Component teamSlug={teamSlug} />
                      )
                    }
                  />
                </Routes>
              </main>
            </div>
          }
        />
      ))}
      <Route path="*" element={<Navigate to={DEFAULT_SECTION_ID} replace />} />
    </Routes>
  );
}

// Sends you to a team rather than to a URL that needs one. Waits for the
// registry to answer first: bouncing to first-run on every slow load
// would be worse than a moment of nothing.
function LandingRedirect() {
  const { data: teams } = useTeams();
  const teamSlug = useDefaultTeamSlug();

  if (!teams) return null;
  if (!teamSlug) return <Navigate to="/start" replace />;
  return <Navigate to={`/t/${teamSlug}/${DEFAULT_SECTION_ID}`} replace />;
}

function Topbar() {
  const teamSlug = useDefaultTeamSlug();
  return (
    <header className="topbar">
      <NavLink className="topbar-title" to="/">
        Quartermark
      </NavLink>
      {teamSlug && (
        <nav className="topbar-nav">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.id}
              className={({ isActive }) =>
                `topbar-link${isActive ? " active" : ""}`
              }
              to={`/t/${teamSlug}/${section.id}`}
            >
              {section.navLabel}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

export default function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/start" element={<FirstRun />} />
        <Route path="/t/:teamSlug/*" element={<TeamLayout />} />
        <Route path="*" element={<LandingRedirect />} />
      </Routes>
    </>
  );
}
