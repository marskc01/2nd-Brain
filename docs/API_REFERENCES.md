# API documentation checked

Checked 2026-09-14. These links support the adapter design; they are not evidence of live account access.

- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs): Responses parsing with a Zod schema. Invalid/refused/missing parsed results fail the stage.
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini): configured reasoning/vision model; account availability remains unverified.
- [Speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text): segment timestamp granularities require `whisper-1` in this adapter. The code does not assume timestamp support for the mini-transcribe model from the earlier environment example.
- [Whisper model](https://developers.openai.com/api/docs/models/whisper-1): timestamped file transcription.
- [Responses create reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create): max output tokens and `max_tool_calls` bounds. The installed TypeScript SDK omits `max_tool_calls` from its generated input type; the adapter passes the documented field through a typed object spread. Provider acceptance still requires the live smoke test.
- [Web search](https://developers.openai.com/api/docs/guides/tools-web-search): built-in search and response URL citations. The worker uses actual citation annotations for its source list.
- [Embeddings](https://developers.openai.com/api/docs/guides/embeddings): `text-embedding-3-small`, 1536 dimensions. Failure falls back to keyword retrieval.
- [Supabase clients/Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs): official clients; this version uses bearer tokens and `auth.getUser` on the API rather than cookie-based SSR.
- [Supabase uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads): storage SDK upload path. The app uses exact-path signed uploads and the installed SDK's `info()` metadata before queueing.

Meta documentation and live-account limitations are documented separately in `INSTAGRAM_FEASIBILITY.md`.
