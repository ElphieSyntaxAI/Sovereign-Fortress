# MSGF Pulse Guard downloads

Place packaged extension artifacts here for the Hobby tier download button:

- `msgf-pulse-guard.zip` — preferred
- `msgf-pulse-guard.vsix` — also supported

Build from the monorepo root:

```bash
npm run package:pulse-guard
```

Production Docker builds run the same script before `next build`.

The route `GET /api/downloads/pulse-guard` also searches sibling `packages/msgf-pulse-guard/*.vsix`.
