import { useState, type CSSProperties, type FormEvent } from "react";
import { useStore } from "../store";
import { checkPassword } from "../auth/session";
import { OTP_DEMO_CODE, type DemoUser } from "../data/seed";
import { LANDING } from "../auth/roles";
import { go } from "../App";

// Sign-on with username and password. Students add a one-time code step.
// Demo accounts are listed in the README, not on this page.
const FLOW = [
  { who: "College", what: "Uploads its intake batch" },
  { who: "AICTE", what: "Reviews the forecast and flags" },
  { who: "Verifier", what: "Asks one yes or no question" },
  { who: "Student", what: "Sees and stops access" },
];

export function Login() {
  const { signIn, log } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<DemoUser | null>(null);
  const [otp, setOtp] = useState("");

  const finish = (u: DemoUser) => {
    signIn(u);
    go(`#/${LANDING[u.role]}`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const user = await checkPassword(username, password);
    if (!user) {
      log("auth.failed", `username ${username.trim().toLowerCase() || "(blank)"}`);
      setError("Wrong username or password.");
      return;
    }
    if (user.role === "student") {
      setPending(user);
      return;
    }
    finish(user);
  };

  const submitOtp = (e: FormEvent) => {
    e.preventDefault();
    if (otp.trim() !== OTP_DEMO_CODE) {
      log("auth.otp_failed", pending?.username ?? "");
      setError("That code is not right. Check the code and try again.");
      return;
    }
    if (pending) finish(pending);
  };

  return (
    <div className="login-wrap">
      <section className="login-left">
        <h1>APAAR Sentinel</h1>
        <p>One place to check admissions against approved intake, explain every flag, and let a verifier confirm one claim without seeing the whole record.</p>
        <ol className="flow" aria-label="How the flow works">
          {FLOW.map((f, i) => (
            <li key={f.who} style={{ ["--i" as string]: i } as CSSProperties}>
              <span className="node">{i + 1}</span>
              <b>{f.who}</b>
              <span className="cap">{f.what}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="login-right">
        {!pending ? (
          <>
            <h2 style={{ marginTop: 0 }}>Sign in</h2>
            <form className="login-form" onSubmit={submit}>
              <label>Username
                <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
              </label>
              <label>Password
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
              </label>
              {error && <div className="small flag" role="alert">{error}</div>}
              <div className="row">
                <button className="primary" type="submit">Sign in</button>
              </div>
            </form>

          </>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>One-time code</h2>
            <p className="small muted">We sent a six-digit code to the mobile number registered with your institution.</p>
            <form className="login-form" onSubmit={submitOtp}>
              <label>Code
                <input value={otp} onChange={e => setOtp(e.target.value)} inputMode="numeric" maxLength={6} autoFocus required />
              </label>
              {error && <div className="small flag" role="alert">{error}</div>}
              <div className="row">
                <button className="primary" type="submit">Verify and continue</button>
                <button type="button" onClick={() => { setPending(null); setError(""); }}>Back</button>
              </div>
            </form>
            <p className="small muted">After sign-in you will see only the student pages: My record, Consent dashboard, Correction request and My credential.</p>
          </>
        )}
      </section>
    </div>
  );
}
