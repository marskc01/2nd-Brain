import Link from "next/link";

export default function DataDeletionPage() {
  return (
    <main className="guide">
      <p className="eyebrow">KDN BRAIN</p>
      <h1>Data-deletion instructions</h1>
      <p>
        KDN Brain is a private application operated by Kaden Condie. Deletion
        requests are handled manually by the operator.
      </p>
      <ol>
        <li>
          Send a message to{" "}
          <a href="https://www.instagram.com/kdn_brain/">@kdn_brain</a> saying
          “Delete my KDN Brain data”. Use the Instagram account whose data you
          want removed.
        </li>
        <li>
          Identify the relevant message or approximate date, or request removal
          of all records associated with your account. Do not send passwords,
          access tokens or identity documents.
        </li>
        <li>
          The operator must verify the request and remove the relevant stored
          message events, captures, media and derived records. The operator will
          confirm the outcome manually; this page does not submit or complete a
          deletion.
        </li>
      </ol>
      <p>
        The application owner can export owner-facing records in Settings before
        requesting removal. Raw events and original media require a separate
        operator export. Complete self-service deletion is not yet available.
      </p>
      <p>
        You can also remove KDN Brain-IG from Instagram’s Apps and websites
        settings to revoke future access. This does not erase stored copies.
        Provider backups and operational logs may persist according to provider
        retention practices. Removing a record here does not delete the original
        Instagram post or conversation.
      </p>
      <footer>
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/">Open KDN Brain</Link>
      </footer>
    </main>
  );
}
