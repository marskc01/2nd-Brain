"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AstraHandoff } from "@/components/astra-handoff";
import { browserDb } from "@/lib/browser-db";

type Capture = {
  id: string;
  title: string;
  source_url: string | null;
  input_data?: { text?: string; attachments?: { url?: string }[] };
  source_kind: string;
  owner_note: string | null;
  state: string;
  content_state: string;
  result_summary: string | null;
  coverage: Record<string, string>;
  project_id: string | null;
  created_at: string;
  understanding: {
    summary: string;
    reason: string;
    inferredIntent: string;
    evidence: {
      kind: string;
      text: string;
      sourceId: string;
      atMs: number | null;
    }[];
    uncertainties: string[];
    research?: { text: string; sources: { url: string; title: string }[] };
  } | null;
};
type Artifact = {
  id: string;
  capture_id: string;
  title: string;
  kind: string;
  content: string;
};
type Action = {
  id: string;
  capture_id: string;
  type: string;
  intended_result: string;
  status: string;
};
type ContextItem = {
  id: string;
  title: string;
  description: string;
  status: string;
};
type Data = {
  captures: Capture[];
  artifacts: Artifact[];
  actions: Action[];
  goals: ContextItem[];
  projects: ContextItem[];
  profile: {
    display_name: string;
    context: { notes?: string };
    automation_paused: boolean;
  };
  heartbeat: { last_seen: string }[];
  budget: { amount_usd: number }[];
  configuration: {
    openai: string;
    instagram: string;
    notifications: string;
    dailyBudget: string;
    captureBudget: string;
  };
};
const empty: Data = {
  captures: [],
  artifacts: [],
  actions: [],
  goals: [],
  projects: [],
  profile: { display_name: "Kaden", context: {}, automation_paused: false },
  heartbeat: [],
  budget: [],
  configuration: {
    openai: "missing",
    instagram: "missing",
    notifications: "not_enabled",
    dailyBudget: "5",
    captureBudget: "2",
  },
};
const nav = [
  ["today", "Today", "◈"],
  ["inbox", "Inbox", "▤"],
  ["actions", "Actions", "✓"],
  ["projects", "Projects & goals", "⌘"],
  ["experiments", "Experiments", "◇"],
  ["ask", "Ask Brain", "✳"],
  ["settings", "Settings", "⚙"],
  ["guide", "How to use", "?"],
] as const;
function demoData(): Data {
  const now = new Date().toISOString();
  const captures: Capture[] = [
    {
      id: "demo-brief",
      title: "A 30-second property walkthrough",
      source_url: null,
      source_kind: "demo_text",
      owner_note: "Turn this into an experiment.",
      state: "completed",
      content_state: "METADATA_ONLY",
      result_summary:
        "Example experiment brief created from supplied text. No video or provider was used.",
      coverage: {
        video: "unavailable",
        audio: "unavailable",
        transcription: "not_attempted",
        visuals: "not_attempted",
        onScreenText: "not_attempted",
        caption: "unavailable",
        ownerNote: "available",
      },
      project_id: null,
      created_at: now,
      understanding: {
        summary:
          "Example source text proposes starting a property tour with its strongest visual feature, then showing layout and details.",
        reason: "The example instruction asks for a small experiment.",
        inferredIntent:
          "Test two opening shots; this is an example, not a confirmed personal goal.",
        evidence: [
          {
            kind: "source_claim",
            text: "Open with the property’s strongest visual feature.",
            sourceId: "demo-brief",
            atMs: null,
          },
        ],
        uncertainties: [
          "Audience response and commercial demand have not been measured.",
        ],
      },
    },
    {
      id: "demo-link",
      title: "Reel waiting for content",
      source_url: "https://www.instagram.com/",
      source_kind: "demo_share",
      owner_note: "Research this.",
      state: "needs_content",
      content_state: "URL_ONLY",
      result_summary:
        "Example fallback: the shared link did not provide a playable video. Attach a recording or transcript to continue.",
      coverage: {
        video: "unavailable",
        audio: "unavailable",
        transcription: "not_attempted",
        visuals: "not_attempted",
        onScreenText: "not_attempted",
        caption: "unavailable",
        ownerNote: "available",
      },
      project_id: null,
      created_at: now,
      understanding: null,
    },
  ];
  const artifact: Artifact = {
    id: "demo-output",
    capture_id: "demo-brief",
    title: "Test two opening shots",
    kind: "experiment",
    content:
      "# Example experiment brief\n\nHypothesis\nA distinctive opening shot may keep viewers watching longer than a generic exterior opening. This is a hypothesis, not evidence of demand.\n\nMake\nUse one authorised property and the same 30-second edit. Version A opens on the exterior; version B opens on its strongest visual feature. Keep the remaining shots, music and captions identical.\n\nMeasure\nCompare three-second retention and average viewing time over the same observation period, if your distribution platform provides those measures. Record reach and audience differences.\n\nSuccess criterion\nSet a minimum improvement before publishing; for example, a 10% relative improvement in three-second retention. Treat a small sample as inconclusive.\n\nBudget and permission\nAllocate one hour of editing using existing footage. Publishing and any spend require a separate approved action.\n\nOutput\nTwo private draft cuts and a measurement sheet. This example has not edited or published footage.",
  };
  return {
    ...empty,
    captures,
    artifacts: [artifact],
    actions: [
      {
        id: "demo-action",
        capture_id: "demo-brief",
        type: "create_experiment",
        intended_result: "Prepare a private experiment brief",
        status: "completed",
      },
    ],
  };
}
function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`badge ${value === "completed" ? "good" : value === "needs_content" || value === "failed" ? "warning" : ""}`}
    >
      {label(value)}
    </span>
  );
}
function safeLink(value: string | null | undefined) {
  return value && /^https?:\/\//i.test(value) ? value : undefined;
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
function download(filename: string, text: string, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export default function Brain() {
  const db = useMemo(() => browserDb(), []);
  const [verified, setVerified] = useState(false);
  const [token, setToken] = useState(""),
    [demo, setDemo] = useState(false),
    [data, setData] = useState<Data>(empty),
    [tab, setTab] = useState("today"),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false),
    [filter, setFilter] = useState(""),
    [pendingUpload, setPendingUpload] = useState<{
      captureId: string;
      assetId: string;
      requestId: string;
    } | null>(null);
  const [search, setSearch] = useState<{
    answer: string;
    records: { id: string; capture_id: string; title: string; body: string }[];
  } | null>(null);
  const selectedItem = data.captures.find((c) => c.id === selected);
  const api = useCallback(
    async (body?: unknown, path = "/api/brain") => {
      const response = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: body ? undefined : AbortSignal.timeout(35000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed");
      return result;
    },
    [token],
  );
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (token && !demo && !refreshing.current) {
      refreshing.current = true;
      try {
        const value = await api();
        setData(value);
        setVerified(true);
        setLoadError("");
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : "Unable to load your saved data.",
        );
        throw e;
      } finally {
        refreshing.current = false;
      }
    }
  }, [token, demo, api]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setDemo(params.get("demo") === "1");
    setSelected(params.get("item"));
    const hash = location.hash.slice(1);
    if (nav.some((n) => n[0] === hash) || hash === "capture") setTab(hash);
    setReady(true);
    if (db) {
      void db.auth
        .getSession()
        .then(({ data }) => setToken(data.session?.access_token || ""));
      const { data } = db.auth.onAuthStateChange((_event, session) => {
        setToken(session?.access_token || "");
        if (!session) {
          setData(empty);
          setVerified(false);
        }
      });
      return () => data.subscription.unsubscribe();
    }
  }, [db]);
  useEffect(() => {
    if (demo) {
      try {
        const saved = localStorage.getItem("kdn-demo-v2");
        setData(saved ? JSON.parse(saved) : demoData());
      } catch {
        setData(demoData());
      }
    }
  }, [demo]);
  useEffect(() => {
    if (demo && data !== empty)
      localStorage.setItem("kdn-demo-v2", JSON.stringify(data));
  }, [data, demo]);
  useEffect(() => {
    if (!token || demo) return;
    void refresh().catch(() => {});
    const interval = setInterval(() => {
      void refresh().catch(() => {});
    }, 7000);
    return () => clearInterval(interval);
  }, [token, demo, refresh]);
  function go(next: string, item: string | null = null) {
    setTab(next);
    setSelected(item);
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "instant" });
    history.replaceState(
      null,
      "",
      `${location.pathname}?${demo ? "demo=1&" : ""}${item ? `item=${encodeURIComponent(item)}` : ""}#${next}`,
    );
  }
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  async function command(body: unknown) {
    await api(body);
    await refresh();
  }
  function viewItem(c: Capture) {
    go("inbox", c.id);
  }
  async function upload(captureId: string, file: File) {
    if (!db) throw new Error("Configure Supabase before uploading.");
    const mime =
      file.type ||
      (/\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4");
    const requestId = crypto.randomUUID();
    const prepared = await api({
      command: "prepare_upload",
      captureId,
      requestId,
      mime,
      bytes: file.size,
    });
    const { error } = await db.storage
      .from("kdn-media")
      .uploadToSignedUrl(prepared.path, prepared.token, file, {
        contentType: mime,
      });
    if (error)
      throw new Error(
        "Upload failed. Check private storage setup and your connection.",
      );
    const finish = { captureId, assetId: prepared.assetId, requestId };
    setPendingUpload(finish);
    await api({ command: "finish_upload", ...finish });
    setPendingUpload(null);
  }
  async function submitCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    await work(async () => {
      const text = String(fields.get("text") || ""),
        url = String(fields.get("url") || ""),
        note = String(fields.get("note") || ""),
        projectId = String(fields.get("project") || "") || null,
        file = fields.get("file") as File;
      if (demo) {
        if (file?.size)
          throw new Error(
            "Demo mode cannot analyse uploaded media. Connect Supabase and OpenAI to run the real pipeline.",
          );
        const id = crypto.randomUUID(),
          hasText = Boolean(text.trim()),
          save = /\/save|just save/i.test(note);
        const c: Capture = {
          id,
          title: text.slice(0, 70) || "Saved link",
          source_url: url || null,
          source_kind: "demo",
          owner_note: note,
          state: hasText || save ? "completed" : "needs_content",
          content_state: hasText ? "METADATA_ONLY" : "URL_ONLY",
          result_summary: hasText
            ? "Demo reference saved in this browser. AI analysis and research did not run."
            : "Demo link saved. No video was analysed.",
          coverage: {
            video: "unavailable",
            audio: "unavailable",
            visuals: "not_attempted",
            transcription: "not_attempted",
            ownerNote: note ? "available" : "unavailable",
          },
          understanding: null,
          project_id: projectId,
          created_at: new Date().toISOString(),
        };
        setData((d) => ({
          ...d,
          captures: [c, ...d.captures],
          artifacts: hasText
            ? [
                {
                  id: crypto.randomUUID(),
                  capture_id: id,
                  title: "Demo reference",
                  kind: "reference",
                  content:
                    text +
                    "\n\nSaved locally in demo mode; not assessed by a model.",
                },
                ...d.artifacts,
              ]
            : d.artifacts,
        }));
        go("inbox", id);
        return;
      }
      const result = await api({
        command: "capture",
        requestId: crypto.randomUUID(),
        text,
        url,
        note: note || (file?.size ? "Understand this uploaded content." : ""),
        projectId,
      });
      go("inbox", result.captureId);
      await refresh();
      if (file?.size) {
        await upload(result.captureId, file);
        await refresh();
      }
      setNotice("Capture saved and queued. The worker will process it.");
      form.reset();
    });
  }
  const completed = data.captures.filter((c) => c.state === "completed");
  const needs = data.captures.filter((c) =>
    ["needs_content", "failed", "awaiting_approval"].includes(c.state),
  );
  const heartbeat = data.heartbeat[0]?.last_seen;
  const workerLive = Boolean(
    heartbeat && Date.now() - Date.parse(heartbeat) < 90000,
  );
  const filtered = data.captures.filter((c) =>
    `${c.title} ${c.owner_note || ""}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const captureForm = (
    <form className="stack" onSubmit={submitCapture}>
      <div className="form-grid">
        <label>
          Source URL <span>optional</span>
          <input
            name="url"
            type="url"
            placeholder="https://www.instagram.com/reel/…"
          />
        </label>
        <label>
          Project <span>optional</span>
          <select name="project">
            <option value="">No project</option>
            {data.projects
              .filter((p) => p.status === "active")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label>
        Source text or transcript
        <textarea
          name="text"
          rows={6}
          maxLength={20000}
          placeholder="Paste the actual content here. Keep your instruction in the field below."
        />
      </label>
      <label>
        What would you like from this?
        <textarea
          name="note"
          rows={2}
          maxLength={4000}
          placeholder="Compare the tools, create a script, research the claim, or just save this…"
        />
      </label>
      <label className="upload">
        Attach a video or image
        <input
          name="file"
          type="file"
          accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
        />
        <small>
          MP4, MOV, WebM, JPG or PNG · 25 MB · video up to 2 minutes · maximum 3
          assets per item
        </small>
      </label>
      <div className="row">
        <small>
          Only the available content is analysed. Shared URLs may need an
          upload.
        </small>
        <button disabled={busy}>{busy ? "Saving…" : "Save & process →"}</button>
      </div>
    </form>
  );
  if (!ready)
    return (
      <main className="welcome">
        <p>Loading KDN Brain…</p>
      </main>
    );
  if (!demo && !token)
    return (
      <div className="welcome">
        <p className="brand">
          KDN <span>Brain</span>
        </p>
        <p className="eyebrow">YOUR IDEAS, PUT TO WORK</p>
        <h1>
          Keep the spark.
          <br />
          Make something of it.
        </h1>
        <p className="intro">
          A private place for the things you find—and the useful work that
          follows.
        </p>
        <div className="welcome-grid">
          <section className="card">
            <h2>Owner sign in</h2>
            <p>Use the single owner account created in Supabase.</p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void work(async () => {
                  if (!db)
                    throw new Error(
                      "Supabase is not configured yet. Follow the setup guide below.",
                    );
                  const { error } = await db.auth.signInWithPassword({
                    email: String(f.get("email")),
                    password: String(f.get("password")),
                  });
                  if (error)
                    throw new Error(
                      "Sign-in failed. Check your owner account email and password.",
                    );
                });
              }}
            >
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button disabled={busy || !db}>
                {busy ? "Signing in…" : "Sign in →"}
              </button>
            </form>
            {!db && (
              <p className="callout">
                Setup required: Supabase application credentials have not been
                configured.
              </p>
            )}
            {!demo && !verified && !loadError && (
              <p role="status">Loading your saved items…</p>
            )}
            {loadError && (
              <div role="alert" className="error">
                {loadError}{" "}
                <button
                  className="secondary"
                  onClick={() => void refresh().catch(() => {})}
                >
                  Retry loading
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </section>
          <section className="card">
            <span className="badge">NO CONNECTIONS NEEDED</span>
            <h2>Explore the demo</h2>
            <p>
              See an example output, an unavailable Reel, and the workflow.
              Sample data stays in this browser. No AI or Instagram integration
              runs in demo mode.
            </p>
            <button
              className="secondary"
              onClick={() => {
                setDemo(true);
                history.replaceState(null, "", "?demo=1");
              }}
            >
              Open demo →
            </button>
            <hr />
            <h3>Start the real application</h3>
            <ol>
              <li>Configure Supabase and create your owner account.</li>
              <li>Add an OpenAI API key for content analysis.</li>
              <li>Run the web app and persistent worker.</li>
              <li>Test a manual capture, then connect Meta.</li>
            </ol>
            <button
              className="text-button"
              onClick={() => {
                setDemo(true);
                setTab("guide");
                history.replaceState(null, "", "?demo=1#guide");
              }}
            >
              Read the full usage guide →
            </button>
          </section>
        </div>
      </div>
    );
  return (
    <div className="shell">
      <aside>
        <button className="brand" onClick={() => go("today")}>
          KDN <span>Brain</span>
        </button>
        <p className="workspace-label">PERSONAL WORKSPACE</p>
        <nav>
          {nav.map(([key, title, icon]) => (
            <button
              key={key}
              className={tab === key ? "nav-item active" : "nav-item"}
              onClick={() => go(key)}
            >
              <span>{icon}</span>
              {title}
              {key === "inbox" && <b>{data.captures.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            <i
              className={demo ? "dot amber" : workerLive ? "dot" : "dot amber"}
            />
            {demo
              ? "Demo workspace"
              : !verified
                ? "Checking worker…"
                : workerLive
                  ? "Worker active"
                  : "Worker not detected"}
          </p>
          <small>Single owner · private outputs</small>
          <button
            className="text-button"
            onClick={() => {
              if (demo) {
                setDemo(false);
                setData(empty);
                history.replaceState(null, "", "/");
              } else void db?.auth.signOut();
            }}
          >
            {" "}
            {demo ? "Exit demo" : "Sign out"} ↗
          </button>
        </div>
      </aside>
      <main>
        {demo && (
          <div className="demo-banner">
            <span>
              <b>DEMO MODE</b> Example data and local saves. No AI, Instagram,
              or external actions.
            </span>
            <button
              onClick={() => {
                localStorage.removeItem("kdn-demo-v2");
                setData({ ...empty });
                setSelected(null);
                setNotice("Demo data removed from this browser.");
              }}
              className="text-button"
            >
              Remove demo data
            </button>
          </div>
        )}
        <header>
          <div>
            <p className="eyebrow">
              {new Date()
                .toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
                .toUpperCase()}
            </p>
            <h1>
              {selectedItem
                ? "Capture"
                : tab === "capture"
                  ? "Quick capture"
                  : nav.find((n) => n[0] === tab)?.[1]}
            </h1>
            <p>
              {selectedItem
                ? "Content, evidence, and the work that followed."
                : tab === "today"
                  ? "A little less collecting. A little more creating."
                  : tab === "inbox"
                    ? "Everything you send, with an honest account of what was understood."
                    : tab === "capture"
                      ? "Send something interesting. Give it a direction."
                      : "Your private workspace, with the sources kept close."}
            </p>
          </div>
          <button onClick={() => go("capture")}>＋ Quick capture</button>
        </header>
        {!demo && !verified && !loadError && (
          <p role="status">Loading your saved items…</p>
        )}
        {loadError && (
          <div role="alert" className="error">
            {loadError}{" "}
            <button
              className="secondary"
              onClick={() => void refresh().catch(() => {})}
            >
              Retry loading
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {tab === "today" && !selectedItem && (
          <>
            <section className="metrics">
              <article>
                <label>In your inbox</label>
                <strong>
                  {data.captures.length}
                  <span> captures</span>
                </strong>
                <small>Ideas with a place to go</small>
              </article>
              <article>
                <label>Outputs ready</label>
                <strong>
                  {data.artifacts.length}
                  <span> artifacts</span>
                </strong>
                <small>Open, read, and use them</small>
              </article>
              <article>
                <label>Needs your attention</label>
                <strong>
                  {needs.length}
                  <span> items</span>
                </strong>
                <small>Missing content or a decision</small>
              </article>
            </section>
            <div className="section-title">
              <h2>Your next useful steps</h2>
              <span>UP TO THREE</span>
            </div>
            <section className="cards">
              {needs.slice(0, 2).map((c, i) => (
                <article className="card" key={c.id}>
                  <div className="row">
                    <span className="number">0{i + 1}</span>
                    <Badge value={c.state} />
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.result_summary}</p>
                  <button className="secondary" onClick={() => viewItem(c)}>
                    Open capture ↗
                  </button>
                </article>
              ))}
              {data.artifacts
                .slice(0, 3 - Math.min(2, needs.length))
                .map((a) => (
                  <article className="card" key={a.id}>
                    <span className="badge good">ARTIFACT CREATED</span>
                    <h3>{a.title}</h3>
                    <p>
                      A private {label(a.kind)} is ready to read. Creating the
                      draft does not mean its proposed steps were executed.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => go("inbox", a.capture_id)}
                    >
                      Read output ↗
                    </button>
                  </article>
                ))}
              {!data.captures.length && (
                <article className="card">
                  <h3>Your first useful capture</h3>
                  <p>
                    Add source text or a short video and tell Brain what you
                    want to do with it.
                  </p>
                  <button onClick={() => go("capture")}>Add a capture →</button>
                </article>
              )}
            </section>
            <div className="section-title">
              <h2>Recently completed</h2>
              <button className="text-button" onClick={() => go("inbox")}>
                View inbox →
              </button>
            </div>
            <section className="list">
              {completed.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  className="list-row"
                  onClick={() => viewItem(c)}
                >
                  <span>
                    <b>{c.title}</b>
                    <small>{c.result_summary}</small>
                  </span>
                  <Badge value={c.content_state} />
                </button>
              ))}
              {!completed.length && (
                <p className="empty">
                  Completed work will appear here. You can leave this page while
                  a deployed worker processes captures.
                </p>
              )}
            </section>
          </>
        )}
        {tab === "capture" && <section className="card">{captureForm}</section>}
        {tab === "inbox" && !selectedItem && (
          <>
            <input
              aria-label="Search captures"
              className="search"
              placeholder="Filter captures by title or instruction…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <section className="list">
              {filtered.map((c) => (
                <button
                  className="list-row"
                  key={c.id}
                  onClick={() => viewItem(c)}
                >
                  <span className="item-icon">
                    {c.content_state === "URL_ONLY" ? "↗" : "▤"}
                  </span>
                  <span className="grow">
                    <b>{c.title}</b>
                    <small>{c.owner_note || c.result_summary}</small>
                  </span>
                  <Badge value={c.state} />
                  <time>{formatDate(c.created_at)}</time>
                </button>
              ))}
              {!filtered.length && (
                <p className="empty">
                  No captures here yet. Use Quick capture to add one.
                </p>
              )}
            </section>
            <small>
              Shows the latest 200 captures. Export records from Settings for
              the full history.
            </small>
          </>
        )}
        {selectedItem && (
          <>
            <button className="text-button" onClick={() => go("inbox")}>
              ← All captures
            </button>
            <section className="card detail">
              <div className="row">
                <Badge value={selectedItem.state} />
                <Badge value={selectedItem.content_state} />
              </div>
              <h2>{selectedItem.title}</h2>
              <p>{selectedItem.result_summary}</p>
              {safeLink(
                selectedItem.source_url ||
                  selectedItem.input_data?.attachments?.find((a) => a.url)?.url,
              ) && (
                <a
                  href={safeLink(
                    selectedItem.source_url ||
                      selectedItem.input_data?.attachments?.find((a) => a.url)
                        ?.url,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original source ↗
                </a>
              )}
              <div className="note">
                <small>YOUR EXPLICIT INSTRUCTION</small>
                <p>{selectedItem.owner_note || "No instruction supplied."}</p>
              </div>
              <h3>Content coverage</h3>
              <div className="coverage">
                {Object.entries(selectedItem.coverage).map(([key, value]) => (
                  <div key={key}>
                    <small>{label(key)}</small>
                    <b>{label(value)}</b>
                  </div>
                ))}
              </div>
              <p className="muted">
                Sampled frames cover selected moments. A URL-only capture has
                not been watched.
              </p>
              {selectedItem.understanding && (
                <>
                  <h3>Understanding</h3>
                  <p>{selectedItem.understanding.summary}</p>
                  <p className="muted">
                    Workflow choice: {selectedItem.understanding.reason}
                  </p>
                  <details>
                    <summary>Evidence and uncertainty</summary>
                    {selectedItem.understanding.evidence.map((e, i) => (
                      <div className="evidence" key={i}>
                        <Badge value={e.kind} />
                        {e.atMs !== null && <small> {e.atMs / 1000}s</small>}
                        <p>{e.text}</p>
                        <small>Source record: {e.sourceId}</small>
                      </div>
                    ))}
                    <ul>
                      {selectedItem.understanding.uncertainties.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </details>
                  {selectedItem.understanding.research && (
                    <details>
                      <summary>Research sources</summary>
                      <pre>{selectedItem.understanding.research.text}</pre>
                      {selectedItem.understanding.research.sources.map((s) => (
                        <p key={s.url}>
                          <a
                            target="_blank"
                            rel="noreferrer"
                            href={safeLink(s.url)}
                          >
                            {s.title} ↗
                          </a>
                        </p>
                      ))}
                    </details>
                  )}
                </>
              )}
              <h3>Outputs</h3>
              {data.artifacts
                .filter((a) => a.capture_id === selectedItem.id)
                .map((a) => (
                  <article className="output" key={a.id}>
                    <div className="row">
                      <Badge value="artifact_created" />
                      <button
                        className="secondary"
                        onClick={() =>
                          download(`${a.kind}.md`, a.content, "text/markdown")
                        }
                      >
                        Download Markdown ↓
                      </button>
                    </div>
                    <h3>{a.title}</h3>
                    <pre>{a.content}</pre>
                  </article>
                ))}
              {!data.artifacts.some(
                (a) => a.capture_id === selectedItem.id,
              ) && <p className="muted">No artifact has been created yet.</p>}
              <AstraHandoff
                key={selectedItem.id}
                capture={selectedItem}
                artifacts={data.artifacts}
                actions={data.actions}
                demo={demo}
                context={{
                  notes: data.profile.context.notes,
                  goals: data.goals,
                  projects: data.projects,
                }}
              />
              <h3>Add content to this capture</h3>
              <p className="muted">
                Use this form for missing media or a transcript. It resumes this
                item and refreshes its matching output.
              </p>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void work(async () => {
                    if (demo)
                      throw new Error(
                        "Resume uses the real worker. Exit demo and configure the application to test it.",
                      );
                    const text = String(f.get("text") || "");
                    const file = f.get("file") as File;
                    if (file?.size) await upload(selectedItem.id, file);
                    else if (text.trim())
                      await api({
                        command: "resume",
                        captureId: selectedItem.id,
                        requestId: crypto.randomUUID(),
                        text,
                      });
                    else throw new Error("Add a transcript or select a file.");
                    await refresh();
                    setNotice("Content attached. Processing will resume.");
                  });
                }}
              >
                <textarea
                  name="text"
                  aria-label="Additional transcript"
                  rows={3}
                  placeholder="Paste a transcript or additional source material…"
                />
                <input
                  type="file"
                  name="file"
                  aria-label="Additional media"
                  accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
                />
                <button disabled={busy}>Attach & resume</button>
              </form>
              {pendingUpload && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void work(async () => {
                      await api({ command: "finish_upload", ...pendingUpload });
                      setPendingUpload(null);
                      await refresh();
                    })
                  }
                >
                  Finish upload
                </button>
              )}
              {data.projects.length > 0 && (
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const projectId = String(
                      new FormData(e.currentTarget).get("project"),
                    );
                    void work(async () => {
                      if (demo) {
                        setData((d) => ({
                          ...d,
                          captures: d.captures.map((c) =>
                            c.id === selectedItem.id
                              ? { ...c, project_id: projectId }
                              : c,
                          ),
                        }));
                      } else
                        await command({
                          command: "project_link",
                          captureId: selectedItem.id,
                          projectId,
                        });
                      setNotice(
                        "Project linked. Retry if processing was waiting for a destination.",
                      );
                    });
                  }}
                >
                  <select
                    name="project"
                    aria-label="Destination project"
                    defaultValue={selectedItem.project_id || ""}
                    required
                  >
                    <option value="">Choose a project</option>
                    {data.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <button className="secondary" disabled={busy}>
                    Link project
                  </button>
                </form>
              )}
              {["failed", "retrying"].includes(selectedItem.state) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void work(async () => {
                      if (demo)
                        throw new Error(
                          "Retry is available in the connected application.",
                        );
                      await command({
                        command: "retry",
                        captureId: selectedItem.id,
                      });
                      setNotice("Queued for retry.");
                    })
                  }
                >
                  Retry processing
                </button>
              )}
            </section>
          </>
        )}
        {tab === "actions" && (
          <>
            <p className="callout">
              A completed action here means its private artifact was produced.
              Publishing, messages, purchases, and paid generation have no
              executor enabled in this version.
            </p>
            <section className="list">
              {data.actions.map((a) => (
                <button
                  className="list-row"
                  key={a.id}
                  onClick={() => go("inbox", a.capture_id)}
                >
                  <span>
                    <b>{a.intended_result}</b>
                    <small>{label(a.type)}</small>
                  </span>
                  <Badge value={a.status} />
                </button>
              ))}
              {!data.actions.length && (
                <p className="empty">
                  Executed private work will appear here with a link to its
                  result.
                </p>
              )}
            </section>
          </>
        )}
        {tab === "projects" && (
          <>
            <section className="card">
              <h2>Add personal context</h2>
              <p>
                Only information you save here is treated as your context.
                Prompt examples are not personal facts.
              </p>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  void work(async () => {
                    const kind = String(f.get("kind")),
                      title = String(f.get("title")),
                      description = String(f.get("description"));
                    if (demo)
                      setData((d) => ({
                        ...d,
                        [kind === "goal" ? "goals" : "projects"]: [
                          ...d[kind === "goal" ? "goals" : "projects"],
                          {
                            id: crypto.randomUUID(),
                            title,
                            description,
                            status: "active",
                          },
                        ],
                      }));
                    else
                      await command({
                        command: "context",
                        kind,
                        title,
                        description,
                      });
                    form.reset();
                    setNotice("Context saved.");
                  });
                }}
              >
                <select name="kind" aria-label="Context type">
                  <option value="project">Project</option>
                  <option value="goal">Goal</option>
                </select>
                <input
                  name="title"
                  aria-label="Title"
                  required
                  maxLength={150}
                  placeholder="Title"
                />
                <textarea
                  name="description"
                  aria-label="Description"
                  rows={3}
                  maxLength={4000}
                  placeholder="What matters, current status, and useful constraints"
                />
                <button disabled={busy}>Save context</button>
              </form>
            </section>
            {(["goals", "projects"] as const).map((kind) => (
              <section key={kind}>
                <h2 className="capitalize">{kind}</h2>
                {data[kind].map((p) => (
                  <details className="card context-card" key={p.id}>
                    <summary>
                      {p.title} <Badge value={p.status} />
                    </summary>
                    <form
                      className="stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void work(async () => {
                          const updated = {
                            ...p,
                            title: String(f.get("title")),
                            description: String(f.get("description")),
                            status: String(f.get("status")),
                          };
                          if (demo)
                            setData((d) => ({
                              ...d,
                              [kind]: d[kind].map((v) =>
                                v.id === p.id ? updated : v,
                              ),
                            }));
                          else
                            await command({
                              command: "context",
                              kind: kind === "goals" ? "goal" : "project",
                              ...updated,
                            });
                          setNotice("Context updated.");
                        });
                      }}
                    >
                      <input
                        name="title"
                        aria-label="Edit title"
                        defaultValue={p.title}
                        required
                      />
                      <textarea
                        name="description"
                        aria-label="Edit description"
                        defaultValue={p.description}
                      />
                      <select
                        name="status"
                        defaultValue={p.status}
                        aria-label="Context status"
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                      <button disabled={busy}>Save changes</button>
                    </form>
                    {kind === "projects" &&
                      data.captures
                        .filter((c) => c.project_id === p.id)
                        .map((c) => (
                          <button
                            className="text-button"
                            key={c.id}
                            onClick={() => viewItem(c)}
                          >
                            {c.title} →
                          </button>
                        ))}
                  </details>
                ))}
                {!data[kind].length && (
                  <p className="empty">No {kind} added yet.</p>
                )}
              </section>
            ))}
          </>
        )}
        {tab === "experiments" && (
          <>
            <p className="callout">
              Experiment plans are private artifacts. Running a test and
              recording its results are separate work.
            </p>
            {data.artifacts
              .filter((a) => a.kind === "experiment")
              .map((a) => (
                <article className="card" key={a.id}>
                  <Badge value="experiment_proposed" />
                  <h2>{a.title}</h2>
                  <button onClick={() => go("inbox", a.capture_id)}>
                    Open experiment brief →
                  </button>
                </article>
              ))}
            {!data.artifacts.some((a) => a.kind === "experiment") && (
              <p className="empty">
                Capture an idea with “Turn this into an experiment” to create a
                test plan.
              </p>
            )}
          </>
        )}
        {tab === "ask" && (
          <section className="card">
            <h2>Find the evidence you saved</h2>
            <p>
              This version retrieves matching stored records using keyword
              search. It does not invent a personal-memory answer when no
              records match.
            </p>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const query = String(
                  new FormData(e.currentTarget).get("query"),
                );
                void work(async () => {
                  if (demo) {
                    const found = data.artifacts.filter((a) =>
                      (a.title + " " + a.content)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    );
                    setSearch({
                      answer: found.length
                        ? "Matching demo records"
                        : "No demo records matched.",
                      records: found.map((a) => ({ ...a, body: a.content })),
                    });
                  } else setSearch(await api({ command: "search", query }));
                });
              }}
            >
              <input
                name="query"
                aria-label="Search stored knowledge"
                required
                placeholder="A subject, tool, or project…"
              />
              <button disabled={busy}>Search →</button>
            </form>
            {search && (
              <>
                <p>{search.answer}</p>
                {search.records.map((r) => (
                  <article className="note" key={r.id}>
                    <button
                      className="text-button"
                      onClick={() => go("inbox", r.capture_id)}
                    >
                      {r.title} ↗
                    </button>
                    <p>{r.body.slice(0, 500)}</p>
                  </article>
                ))}
              </>
            )}
          </section>
        )}
        {tab === "settings" && (
          <>
            <section className="card">
              <h2>Connections & health</h2>
              <div className="health-grid">
                <div>
                  <small>Database</small>
                  <b>
                    {demo
                      ? "Demo only"
                      : verified
                        ? "Authenticated queries succeeded"
                        : "Not verified"}
                  </b>
                </div>
                <div>
                  <small>OpenAI</small>
                  <b>{label(data.configuration.openai)}</b>
                </div>
                <div>
                  <small>Instagram</small>
                  <b>{label(data.configuration.instagram)}</b>
                </div>
                <div>
                  <small>Worker</small>
                  <b>
                    {demo
                      ? "Not used in demo"
                      : workerLive
                        ? "Heartbeat received"
                        : "No recent heartbeat"}
                  </b>
                </div>
                <div>
                  <small>Instagram replies</small>
                  <b>Not enabled</b>
                </div>
                <div>
                  <small>External actions</small>
                  <b>No executor enabled</b>
                </div>
              </div>
              <p className="muted">
                Configured credentials do not prove a working integration. Live
                provider and Instagram tests must pass separately.
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void work(async () => {
                    if (!demo) await refresh();
                    setNotice(
                      demo
                        ? "Demo has no live connections."
                        : "Health refreshed.",
                    );
                  })
                }
              >
                Refresh health
              </button>
            </section>
            <section className="card">
              <h2>Your context & automation</h2>
              <form
                className="stack"
                key={data.profile.context.notes || "profile"}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void work(async () => {
                    const displayName = String(f.get("name")),
                      context = String(f.get("context")),
                      paused = f.get("paused") === "on";
                    if (demo)
                      setData((d) => ({
                        ...d,
                        profile: {
                          display_name: displayName,
                          context: { notes: context },
                          automation_paused: paused,
                        },
                      }));
                    else
                      await command({
                        command: "profile",
                        displayName,
                        context,
                        paused,
                      });
                    setNotice(
                      "Settings saved. A pause stops new claims; a job already running may finish.",
                    );
                  });
                }}
              >
                <label>
                  Name
                  <input
                    name="name"
                    required
                    defaultValue={data.profile.display_name}
                  />
                </label>
                <label>
                  Skills, interests, tools, ambitions, markets, time,
                  constraints, and things you do not want
                  <textarea
                    name="context"
                    maxLength={8000}
                    rows={7}
                    defaultValue={data.profile.context.notes || ""}
                    placeholder="Add only facts you want Brain to use. Leave blank until you are ready."
                  />
                </label>
                <label className="check">
                  <input
                    name="paused"
                    type="checkbox"
                    defaultChecked={data.profile.automation_paused}
                  />{" "}
                  Pause new automated work
                </label>
                <button disabled={busy}>Save settings</button>
              </form>
            </section>
            <section className="card">
              <h2>Operating budget</h2>
              <p>
                Daily limit: ${data.configuration.dailyBudget} · Per-capture
                limit: ${data.configuration.captureBudget}
              </p>
              <p>
                Reserved today: $
                {data.budget
                  .reduce((sum, b) => sum + Number(b.amount_usd), 0)
                  .toFixed(2)}{" "}
                USD
              </p>
              <p className="muted">
                Reservations are conservative estimates, not reconciled provider
                invoices. Each processing attempt reserves budget atomically
                before calling OpenAI. Limits are configured in the server
                environment; the day resets at 00:00 UTC.
              </p>
            </section>
            <section className="card">
              <h2>Your data</h2>
              <button
                disabled={busy}
                className="secondary"
                onClick={() =>
                  void work(async () => {
                    const exported = demo
                      ? data
                      : await api(undefined, "/api/export");
                    download(
                      "kdn-brain-records.json",
                      JSON.stringify(exported, null, 2),
                      "application/json",
                    );
                    setNotice(
                      "Records exported. Original media bytes and raw webhook logs are separate.",
                    );
                  })
                }
              >
                Export records ↓
              </button>
              {demo && (
                <button
                  className="secondary"
                  onClick={() => setData(demoData())}
                >
                  Reload demo examples
                </button>
              )}
              <p className="muted">
                Owner-facing deletion and automatic retention are not
                implemented yet. See the guide for deployment limitations.
              </p>
            </section>
          </>
        )}
        {tab === "guide" && <UsageGuide />}
        <footer>
          KDN Brain <span>Capture → understand → make something useful</span>
        </footer>
      </main>
    </div>
  );
}
function UsageGuide() {
  return (
    <section className="card guide">
      <span className="badge">USAGE GUIDE · V0.2</span>
      <h2>Start with a manual capture</h2>
      <ol>
        <li>
          <b>Sign in.</b> Use the owner email and password created in your
          Supabase project. There is no public registration.
        </li>
        <li>
          <b>Add your context.</b> In Projects & goals, add current work and
          goals. In Settings, describe your skills, tools, interests,
          constraints and available time.
        </li>
        <li>
          <b>Open Quick capture.</b> Paste a URL, source text or transcript, or
          upload a short video/image.
        </li>
        <li>
          <b>Give an instruction.</b> Keep what the source says separate from
          what you want Brain to do.
        </li>
        <li>
          <b>Save & process.</b> The capture is stored before the worker starts.
          Watch Inbox for progress, or leave the page and return later.
        </li>
        <li>
          <b>Open the item.</b> Check content coverage, evidence, research
          links, and the completed artifact. Download the Markdown output if
          useful.
        </li>
      </ol>
      <h3>Instructions to try</h3>
      <div className="instruction-list">
        <p>
          <code>/research</code> Check the main claim against current sources.
        </p>
        <p>
          <code>/compare</code> Compare these tools for the workflow described.
        </p>
        <p>
          <code>/experiment</code> Turn this into a small test with success
          criteria.
        </p>
        <p>
          <code>/script</code> Write a 30-second script using this structure.
        </p>
        <p>
          <code>/project</code> Add this to the project selected in the form.
        </p>
        <p>
          <code>/save</code> Keep this as a reference without manufacturing
          work.
        </p>
      </div>
      <p>
        Natural language works too. With no instruction, the model chooses a
        private workflow from the available content and your saved context.
      </p>
      <h3>When a Reel cannot be accessed</h3>
      <p>
        The item remains in your Inbox with “URL only” or “Needs content.” Open
        it and use Add content to attach a recording, image or transcript. This
        resumes the original capture and updates the matching output. If
        uploading finishes while a job is running, wait and use Finish upload.
      </p>
      <h3>What “completed” means</h3>
      <p>
        It means the indicated private output was created. An experiment brief
        is a plan; it does not mean the experiment ran. A script is a draft; it
        has not been published. Research includes sources, but a claim is not
        automatically verified because a search ran.
      </p>
      <h3>Connect Instagram after the manual test</h3>
      <p>
        Use an owner-controlled professional Instagram account and a Meta app.
        Configure the signed webhook, the receiving account and the allowed
        sender’s Instagram-scoped ID. Send a text, a shared Reel, a shared post
        and direct media separately. Receiving a share does not guarantee access
        to playable media.
      </p>
      <p>
        Send a Reel to @kdn_brain only after live webhook delivery is verified.
        A separate follow-up DM is not automatically attached to an older
        capture in this version. Use the item’s Add content form to avoid
        ambiguity.
      </p>
      <h3>Set up the application</h3>
      <pre>{`cd "/Users/kadencondie/Documents/ChatGPT/2nd Brain"\nnpm ci\ncp .env.example .env.local\n# Fill application credentials in .env.local.\n# Apply migrations 001 and 002 in order.\nnpm run setup:owner\nnpm run doctor\nnpm run dev\n\n# In another terminal, same directory:\nnpm run worker`}</pre>
      <p>
        For continuous operation, deploy the web application and a separate Node
        worker with FFmpeg. Your laptop can then be closed. This local demo does
        not create a deployed service.
      </p>
      <h3>If processing stops</h3>
      <ul>
        <li>
          <b>No worker heartbeat:</b> start or restart the worker with the same
          Supabase credentials.
        </li>
        <li>
          <b>Missing API key:</b> add OPENAI_API_KEY to the worker environment,
          restart it, then Retry the item.
        </li>
        <li>
          <b>Budget declined:</b> check reservations and configured limits.
          Retry after fixing the limit or after the UTC day resets.
        </li>
        <li>
          <b>Media failure:</b> use MP4/MOV/WebM or JPG/PNG, maximum 25 MB,
          maximum 2 minutes and 4096 pixels per side.
        </li>
        <li>
          <b>Project needed:</b> select the project on the item, link it, then
          Retry.
        </li>
      </ul>
      <h3>Current boundaries</h3>
      <p>
        Real-provider analysis, deployed Supabase access, and live Instagram
        delivery require explicit application credentials. Automated DMs,
        external actions, paid generation, owner deletion controls, scheduled
        reviews and MCP are not enabled in this version. Ask Brain currently
        returns keyword-matched records. See the repository README for the
        verified test results and deployment checklist.
      </p>
    </section>
  );
}
