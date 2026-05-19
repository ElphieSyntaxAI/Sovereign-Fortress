# Syntax Education — External Ecosystem Add-Ons

Per pillars [§3 Universal external ecosystem integration](../../../docs/syntax-education/syntax_education_pillars.md#3-universal-external-ecosystem-integration), this directory holds the native add-on wrappers that extend P4 telemetry + P6 lineage into the document hosts students already use.

## Layout

```
addons/
├── shared/
│   └── the-call-client.ts        # host-agnostic POST surface for /api/msgf/p4/state-ledger + citation-check
├── google-workspace/             # Google Apps Script add-on (Docs · Sheets · Slides)
│   ├── appsscript.json           # add-on manifest (oauthScopes, runtime, sidebar)
│   ├── Code.gs                   # onEdit() / onChange() triggers, focus monitor, citation hooks
│   └── Sidebar.html              # HTMLService sidebar: research portal + citation anchor button
├── microsoft-365/                # MS 365 add-in (Word · Excel · PowerPoint)
│   ├── manifest.xml              # Office add-in manifest
│   └── src/taskpane/
│       ├── taskpane.html         # task pane shell
│       └── taskpane.ts           # Office.context.document.addHandlerAsync wiring
└── browser-extension/            # MV3 wrapper (port of apps/author-ecosystem/extension)
    ├── manifest.json             # MV3 manifest
    └── src/
        ├── content.js            # keydown / keyup / paste capture (Docs + Word Online)
        ├── background.js         # side panel + tab focus broker
        ├── panel.html / .js      # research portal + citation anchor UI
        └── writing-surface.js    # host detection (Docs / Sheets / Word / Excel)
```

## Ecosystem tagging

Every add-on calls **`postTheCall(...)`** from `shared/the-call-client.ts` with the matching `ecosystemSource`:

| Host | `ecosystemSource` | Default `telemetryMode` |
| :--- | :--- | :--- |
| Google Docs | `GOOGLE_EDIT` | `KEYSTROKE` (via sidebar key hooks) |
| Google Sheets | `GOOGLE_EDIT` | `CELL_MUTATION` (`onEdit()` deltas) |
| Google Slides | `GOOGLE_EDIT` | `FOCUS_DURATION` |
| Word Online | `MS_OFFICE_EDIT` | `KEYSTROKE` |
| Excel Online | `MS_OFFICE_EDIT` | `CELL_MUTATION` |
| PowerPoint Online | `MS_OFFICE_EDIT` | `FOCUS_DURATION` |
| Native sandbox | `SANDBOX_NATIVE` | `KEYSTROKE` |

The MSGF P4 controller switches HAL surrogates automatically (pillars §2.4.1).

## Auth

Add-ons authenticate against MSGF using the **de-identified entity token** issued by the LTI privacy gate (`packages/msgf/lib/education/privacy-gate.ts`). They never see the student's real name.

- Browser-side (extension, sidebar): `POST` with cookie auth.
- Server-side BFF (Apps Script `UrlFetchApp`, Office BFF): `PUT` with `x-msgf-entity-id` + service-role token.

## Citation Hall Engine

When the student lifts text from the embedded research portal **and** then pastes into the host doc, the add-on calls `postCitationCheck(...)`. The MSGF Citation Hall Engine classifies as:

- `ANCHORED` → Vault row at `3.1.1_ANCHORED_SOURCE_STRING`
- `UNATTRIBUTED` → Hall row at `3.1.2_UNATTRIBUTED_SOURCE_STRING`
- `UNTRUSTED_DOMAIN` → Hall row at `3.1.3_UNTRUSTED_DOMAIN`
- `NO_MATCH` → no persistence (paste was not from the research portal)
