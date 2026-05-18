# MSGF Pulse Guard downloads

Place packaged extension artifacts here for the Hobby tier download button:

- `msgf-pulse-guard.zip` — preferred
- `msgf-pulse-guard.vsix` — also supported

Build from the monorepo root:

```bash
npm run compile -w msgf-pulse-guard
cd packages/msgf-pulse-guard && npx vsce package -o ../msgf/public/downloads/msgf-pulse-guard.vsix
```

The route `GET /api/downloads/pulse-guard` also searches sibling `packages/msgf-pulse-guard/*.vsix`.
