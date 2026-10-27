import { useEffect, useState } from "react";
import { useStore } from "./store";
import { LANDING, PAGES, isPageKey, navFor, pageAllowed, ROLE_LABEL, type PageKey } from "./auth/roles";
import { Toasts, PageHead, Empty } from "./components/ui";
import { Login } from "./pages/Login";
import { Institution } from "./pages/Institution";
import { Aicte } from "./pages/Aicte";
import { StudentPages, VerifierPages } from "./pages/StudentVerifier";
import { ScanPage } from "./pages/Scan";
import { Assistant } from "./assistant/Assistant";
import { checkSeed } from "./data/seed";

// Hash routes: #/<page> or #/<page>/<id>. Keeps every page linkable for screenshots.
export type Route = { page: PageKey | "scan" | "login"; param?: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/");
  const head = parts[0] ?? "";
  if (head === "scan") return { page: "scan", param: parts[1] };
  if (head && isPageKey(head)) return { page: head, param: parts[1] };
  return { page: "login" };
}

export function go(hash: string) {
  window.location.hash = hash;
}

export function App() {
  const { session } = useStore();
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const route = parseRoute(hash);

  const problems = checkSeed();
  if (problems.length) {
    return <div className="card" style={{ margin: 24 }}><b>Demo data check failed:</b><ul>{problems.map(p => <li key={p}>{p}</li>)}</ul></div>;
  }

  // public scan page: opened from the QR code, no sign-in
  if (route.page === "scan") return <><ScanPage id={route.param ?? ""} /><Toasts /></>;

  if (!session) return <><Login /><Toasts /></>;

  const role = session.role;
  const landing = LANDING[role];

  // a signed-in user with no page in the URL goes to their landing page
  if (route.page === "login") {
    go(`#/${landing}`);
    return null;
  }

  const allowed = pageAllowed(role, route.page as PageKey);
  return (
    <>
      <header className="topbar">
        <div className="brand">APAAR Sentinel<small>AICTE · Problem Statement 26263 · synthetic demo data</small></div>
        <div className="who">
          <span className="badge">Signed in as {session.displayName} · {ROLE_LABEL[role]}</span>
          <SignOut />
        </div>
      </header>
      <div className="shell">
        <nav className="side" aria-label="Main navigation">
          {navFor(role).map(g => (
            <div key={g.section}>
              <div className="section">{g.section}</div>
              {g.items.map(p => (
                <a key={p} href={`#/${p}`} className={route.page === p ? "on" : ""} aria-current={route.page === p ? "page" : undefined}>
                  {PAGES[p].label}
                </a>
              ))}
            </div>
          ))}
          <div className="demo-note">Demo build. Sign-on, data and verification are simulated in the browser.</div>
        </nav>
        <main>
          {allowed ? <PageView route={route} /> : <NotPermitted page={route.page as PageKey} landing={landing} />}
        </main>
      </div>
      {(role === "college" || role === "aicte") && allowed && <Assistant />}
      <Toasts />
    </>
  );
}

function SignOut() {
  const { signOut } = useStore();
  return <button onClick={() => { signOut(); go("#/login"); }}>Sign out</button>;
}

function PageView({ route }: { route: Route }) {
  const { session } = useStore();
  const role = session!.role;
  const page = route.page as PageKey;
  if (role === "college") return <Institution page={page} />;
  if (role === "aicte" || role === "sysadmin") return <Aicte page={page} param={route.param} />;
  if (role === "student") return <StudentPages page={page} />;
  if (role === "verifier") return <VerifierPages page={page} />;
  return <Empty title="Nothing to show here." />;
}

// Shown when a signed-in user opens a page outside their role. The attempt is written to the audit trail.
function NotPermitted({ page, landing }: { page: PageKey; landing: PageKey }) {
  const { log, session } = useStore();
  const label = PAGES[page]?.label ?? page;
  useEffect(() => {
    log("access.denied", `${session?.role} tried ${page}`);
    // logged once per attempt; the store is not re-run for this view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  return (
    <section>
      <PageHead
        section="Access control"
        title="Not permitted"
        lead={`Your role (${ROLE_LABEL[session!.role]}) cannot open ${label}. The attempt is recorded in the audit log.`}
      />
      <div className="card">
        <p className="small muted">Access is checked by role for every page. Hidden links are not the only control.</p>
        <button className="primary" onClick={() => go(`#/${landing}`)}>Go to my home page</button>
      </div>
    </section>
  );
}
