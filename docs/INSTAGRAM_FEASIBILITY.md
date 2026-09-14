# Instagram feasibility

Checked 2026-09-14. **Live DM/Reel verification: not run.** iPhone Mirroring confirmed `@kdn_brain` has account type **Professional**. The account-wide **Allow access to messages** switch was off when inspected; enabling it awaits owner approval. No app token, webhook subscription or real media retrieval has been verified. Facebook is signed in, but Meta developer registration opens a blank page in the setup browser.

## Official sources actually inspected

Meta's [official Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-6fa9ed1d-3310-4844-ad25-f0001ab66f11) was readable. It describes professional-account messaging, Instagram Login permissions and Send API limitations. The collection lists `instagram_business_basic` and `instagram_business_manage_messages` for this path; unrelated publishing/comment permissions in the collection are not required by this app's current ingestion code.

The collection states that shared media/post notifications include the share URL. This does **not** establish a downloadable video file, an expiry duration, access to arbitrary third-party Reels, or entitlement to bypass platform access controls. Group messaging is not supported in that documented flow. A message recipient must have initiated contact. Testers need the appropriate app/account roles and granted permissions.

The [Instagram Platform messaging page](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api) and [message webhook reference](https://developers.facebook.com/docs/instagram-platform/webhooks/reference/messages) failed to load in the documentation tool. Therefore current webhook subtype payloads, exact subscriptions, access-review entitlements, reply-window rules and temporary URL lifetime remain **unconfirmed**, rather than inferred from third-party examples. The official collection's example uses the Instagram Login Send API host `graph.instagram.com`; the separate Facebook Login path uses a different setup/token model. Do not mix them.

## Support and verification matrix

| Topic | Evidence / implementation | Live status |
| --- | --- | --- |
| Account | Professional business/creator account documented in Meta's collection | @kdn_brain Professional account verified in Instagram settings on 2026-09-14 |
| Login/permissions | Instagram Login path and business basic/manage-messages scopes documented; app has no OAuth onboarding UI | Manual setup required |
| Text DM | Defensive `entry[].messaging[].message.text`/`mid` normalisation; synthetic fixture | Live payload unverified |
| Shared Reel/post | Share URL may be present; unknown fields preserved; never treated as playable video automatically | Exact subtype/field shape unverified |
| Direct image/video | Parser preserves attachment type, payload and URL; worker attempts only `image`/`video` with a URL and an explicitly approved hostname | Live direct-media payload unverified |
| Subscriptions | Configure signed webhook endpoint, then consult the actual Meta dashboard/reference for message subscriptions and account subscription | Subscription/review unverified |
| App Review | Tester-role requirements documented; production access and review must be established for the chosen app/account configuration | No App Review completed |
| Media expiry | No fixed lifetime is assumed; retrieval is attempted during worker acquisition | Timing/URL lifetime unverified; queue delay can lose an expiring URL |
| Automated replies | Initial user contact prerequisite documented; current reply window not established here | Replies disabled; no notification executor |

All `tests/fixtures/instagram-*.json` payloads are **simulated examples**, not captured proof of Meta's exact Reel attachment schema. Tests validate parser behaviour, signature handling and durable transaction semantics, not account integration.

## Implemented ingestion and fallback

- GET verifies an explicitly configured nonempty verify token and returns the challenge.
- POST bounds the raw request, validates HMAC-SHA256, and only then parses JSON.
- One service-role-only RPC stores the signed envelope, normalised message records, captures and queued jobs atomically before HTTP success.
- Owner-sender allow-list; unknown senders quarantined; echoes recorded as ignored with no job.
- Event/message IDs deduplicate retries. New message IDs produce distinct captures.
- Unknown fields and multiple attachments are preserved. No scraper, invented Graph lookup or browser-session reuse exists.
- Direct media fetching uses configured exact `META_MEDIA_HOSTS`, public IPv4 DNS validation, address pinning, no redirects, a timeout, byte/MIME limits and private storage. A failed or expired URL falls back to missing content.
- A shared/unknown attachment does not become video merely because it contains a URL.
- The authenticated item page can attach up to three videos/images or supplied text/transcripts. Resume uses the original capture ID, a submission ID and revision; existing private outputs of the same action type update in place.
- Separate follow-up DMs are preserved independently, not silently assigned to an older capture. Dashboard assignment/content entry is the current safe alternative.

## Exact connection sequence

1. Establish access to the intended Supabase project, apply both migrations, and deploy the web app plus persistent worker. First pass a manual text/video test.
2. In the Meta app dashboard, use the chosen Instagram professional-account login product and the current documented permission/review flow. Confirm the account is @kdn_brain (or your configured replacement).
3. Set META_APP_SECRET and a private META_VERIFY_TOKEN on the web service. Set OWNER_USER_ID to the Supabase owner and OWNER_INSTAGRAM_ID to the allowed **sender's Instagram-scoped ID**.
4. Configure the HTTPS callback `https://YOUR_APP/api/webhooks/meta`. Verify the challenge, required message webhook fields and account-level subscription in the current Meta dashboard.
5. From the allow-listed owner, send separate text, Reel share, post share, image and video messages. Confirm raw event records and exactly one queued capture per accepted message. A missing sender ID configuration deliberately quarantines messages; inspect it privately, set the correct ID and send a new test.
6. Inspect redacted live payloads. Only approve exact CDN hostnames in META_MEDIA_HOSTS after confirming they are the supported direct-media delivery hosts. Never paste signed media URLs or access tokens into public issue reports.
7. Confirm byte retrieval, type, duration, timestamps, action output and dashboard links. Then test expired/unavailable media and attach a transcript to the same capture.
8. Record actual results, account/API version, time and limitations below. Do not enable a future reply executor until current messaging rules and the connected account's eligibility are confirmed.

## Live diagnostic record

No rows are marked verified as of 2026-09-14.

| Test | Received | Content accessible | Output visible | Result |
| --- | --- | --- | --- | --- |
| Owner text | — | — | — | Not run |
| Shared Reel | — | — | — | Not run |
| Shared post | — | — | — | Not run |
| Direct image | — | — | — | Not run |
| Direct video | — | — | — | Not run |
| Expired media + authenticated fallback | — | — | — | Local logic tested; live not run |
| Automated reply | — | — | — | Disabled |
