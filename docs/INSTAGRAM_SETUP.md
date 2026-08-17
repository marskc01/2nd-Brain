# Instagram / Meta setup

> Meta changes product names and eligibility frequently. Before configuration, compare these steps with Meta's current official [Instagram Platform](https://developers.facebook.com/docs/instagram-platform/) and [Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/) documentation.

1. Convert **@kdn_brain** to a Professional account if Meta currently requires it.
2. Create a Meta developer app and add the Instagram product. Choose **Instagram API with Instagram Login** when offered; do not use unofficial scraping.
3. Add @kdn_brain as the authorised/test account. Configure the current messaging permissions shown by the app dashboard and enable self-messaging if the dashboard offers/requires it.
4. Set callback to `https://YOUR_DOMAIN/api/webhooks/meta/instagram`, choose a random `META_VERIFY_TOKEN`, and subscribe to messaging-related fields supported for the account.
5. Put app ID, app secret, access token and Instagram account ID into server-only environment variables. Never expose them with `NEXT_PUBLIC_`.
6. Meta sends GET verification; this app checks the verify token and returns the challenge. POST requests require `X-Hub-Signature-256` HMAC-SHA256 validation.
7. In development mode, ensure the sending and receiving accounts have tester/admin roles. App Review/live mode may be required for people outside app roles; verify current requirements in the app dashboard.
8. Send a normal DM, then share a Reel. The sender must match `INSTAGRAM_OWNER_IGSID` or `INSTAGRAM_OWNER_IG_ID`; unknown senders are quarantined.
9. Monitor `/settings/system` and `raw_events`. Acknowledgements remain off by default.

## Tokens and troubleshooting

Follow the token expiry/refresh guidance displayed by Meta for the selected login flow. A 403 GET usually means the verify token differs. A 401 POST means the app secret/signature differs. No capture with a stored event usually means owner allow-list mismatch. A URL-only capture is expected when Meta does not provide the underlying media; KDN Brain never pretends it saw unavailable content.
