"use client";
import { useMemo, useState } from "react";
import { buildAstraHandoff, type HandoffInput } from "@/lib/astra-handoff";
export function AstraHandoff(
  props: Omit<HandoffInput, "objective" | "origin">,
) {
  const [objective, setObjective] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [message, setMessage] = useState("");
  const prompt = useMemo(
    () =>
      buildAstraHandoff({
        ...props,
        context: includeContext ? props.context : undefined,
        objective,
        origin: typeof location === "undefined" ? "" : location.origin,
      }),
    [props, includeContext, objective],
  );
  return (
    <section className="card">
      <h3>Continue in Astra</h3>
      <p>
        Take the source evidence, your goal and existing work into an Astra
        conversation for deeper work. Review the brief before sharing it.
      </p>
      <label className="stack">
        What should Astra complete?
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          maxLength={4000}
          rows={2}
          placeholder="For example: turn this into a practical experiment and create the files I need to run it."
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={includeContext}
          onChange={(e) => setIncludeContext(e.target.checked)}
        />{" "}
        Include my saved context, active goals and linked project
      </label>
      <p className="muted">
        Preparing this brief makes no model call. Running it in Astra uses that
        conversation’s plan allowance or API billing. Original video files are
        not attached.
      </p>
      <details>
        <summary>Review Astra brief</summary>
        <textarea
          aria-label="Astra handoff prompt"
          value={prompt}
          readOnly
          rows={16}
          style={{ width: "100%" }}
        />
      </details>
      <div className="row">
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              setMessage(
                "Brief copied. Paste it into an Astra conversation and attach the original video if needed.",
              );
            } catch {
              setMessage(
                "Clipboard unavailable. Open Review Astra brief and copy the text, or download the brief.",
              );
            }
          }}
        >
          Copy Astra brief
        </button>
        <button
          className="secondary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([prompt], { type: "text/markdown" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `kdn-astra-${props.capture.id}.md`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage("Brief downloaded. Attach it to an Astra conversation.");
          }}
        >
          Download Astra brief
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
