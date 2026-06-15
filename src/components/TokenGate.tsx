import { useState } from "react";

interface Props {
  validating: boolean;
  error: string | null;
  onSubmit: (token: string) => void;
}

const TOKEN_URL =
  "https://github.com/settings/tokens/new?description=Star%20Credibility&scopes=read:user";

/** Gate that collects and validates the user's Personal Access Token. */
export function TokenGate({ validating, error, onSubmit }: Props) {
  const [value, setValue] = useState("");

  return (
    <div className="glass mx-auto max-w-md p-7">
      <p className="kicker">// authenticate</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-100">
        Connect with a GitHub token
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        This app runs entirely in your browser. Paste a GitHub{" "}
        <strong className="text-slate-200">Personal Access Token</strong> —
        it&apos;s stored only in this browser&apos;s localStorage and sent
        directly to GitHub.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-400">
        <li>
          <a
            href={TOKEN_URL}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 underline decoration-cyan-400/40 hover:text-cyan-300"
          >
            Create a token
          </a>{" "}
          (the <code className="rounded bg-white/10 px-1 text-slate-200">read:user</code>{" "}
          scope is enough; classic tokens work).
        </li>
        <li>Paste it below and connect.</li>
      </ol>

      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ghp_…"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-slate-100 outline-none focus:border-cyan-500/60"
        />
        {error && <p className="font-mono text-sm text-rose-400">✗ {error}</p>}
        <button
          type="submit"
          disabled={validating || !value.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2.5 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:shadow-cyan-500/40 disabled:opacity-40 disabled:shadow-none"
        >
          {validating ? "Validating…" : "Connect →"}
        </button>
      </form>
    </div>
  );
}
