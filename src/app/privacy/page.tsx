import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="guide">
      <p className="eyebrow">KDN BRAIN · UPDATED 14 SEPTEMBER 2026</p>
      <h1>Privacy policy</h1>
      <p>
        KDN Brain is Kaden Condie’s private personal knowledge application. It
        has one authorised owner and no public registration.
      </p>
      <h2>Information processed</h2>
      <p>
        The application stores captures the owner submits, including text,
        links, uploaded media, notes, goals and projects. When the Instagram
        integration is enabled, it receives message events sent to @kdn_brain,
        including sender and message identifiers, timestamps, message text and
        available attachment information.
      </p>
      <p>
        Messages from senders outside the owner allow-list are quarantined for
        diagnosis and do not trigger AI work. Raw delivery events may still be
        retained. Do not send sensitive information to this account.
      </p>
      <h2>Purpose and service providers</h2>
      <p>
        The application uses authorised captures to create private references,
        research, connections and drafts. Supabase provides authentication,
        database and private file storage. Vercel hosts the web application and
        receives operational request logs. Meta provides the Instagram
        connection. When AI processing is configured, relevant capture content,
        sampled video frames, audio and selected personal context may be sent to
        OpenAI for analysis, transcription, embeddings and research.
      </p>
      <p>
        AI-generated conclusions may be inaccurate. Unavailable videos are not
        represented as watched. Captured content is not permission to contact
        others or publish information. Automatic Instagram replies are currently
        disabled.
      </p>
      <h2>Access and retention</h2>
      <p>
        The dashboard requires owner authentication. Database access is
        restricted and uploaded media is stored privately. Integration
        credentials are held in server settings. Application data is not offered
        for sale or made available in a public gallery.
      </p>
      <p>
        Stored captures, raw events and derived outputs remain until the owner
        removes them or the operator carries out a deletion request. Automated
        retention and complete self-service deletion are not yet implemented.
        Provider logs and backups are subject to each provider’s retention
        practices.
      </p>
      <h2>Your controls</h2>
      <p>
        The owner can pause new processing and export owner-facing records in
        Settings. Instagram access can be revoked in Instagram’s Apps and
        websites settings. Revoking access does not itself erase data already
        stored by KDN Brain.
      </p>
      <p>
        For questions or to request deletion, contact the operator through the
        Instagram account{" "}
        <a href="https://www.instagram.com/kdn_brain/">@kdn_brain</a>. Requests
        require manual review by the account owner; no automated response is
        promised. See the{" "}
        <Link href="/data-deletion">data-deletion instructions</Link>.
      </p>
      <footer>
        <Link href="/">Open KDN Brain</Link>
        <span>Private personal workspace</span>
      </footer>
    </main>
  );
}
