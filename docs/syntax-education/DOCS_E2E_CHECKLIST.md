# Syntax Education — Google Docs E2E checklist

Run after migrations through `20260713210000_education_classroom_effort_cert.sql` and with:

```bash
EDUCATION_DEMO_BOOTSTRAP=1
EDUCATION_OPEN_LESSON_API=1
```

## 1. Bootstrap

1. Open Education SPA `/demo`.
2. Click **Bootstrap demo (disclosure pre-accepted)**.
3. Confirm: `Vault strength seed: yes`, assignment + instance IDs shown.
4. Open **sandbox** from the links.

## 2. Disclosure → HAL → milestones (sandbox / Docs)

1. If disclosure forced: accept Utah copy before tools unlock.
2. Paste a long block without typing → HAL Lite should raise `PASTE_INJECTION` / lower confidence.
3. Write claim-only CER → milestone check shows **evidence** bottleneck + Socratic unlock.
4. Ask tutor: “How do I write evidence?” — reply should reference **Weather chart sorting** (demo Vault strength).
5. Complete CER (claim + evidence + reasoning) → milestones complete.

## 3. Docs add-on (Workspace test domain)

1. Install / sideload `apps/syntax-educates/addons/google-workspace`.
2. Set MSGF base URL + assignment instance id + entity token from `/demo`.
3. Sync HAL Lite from sidebar.
4. Run milestone check.
5. **Turn in** → sidebar shows Turn-In Lockout + certificate id / HAL score.
6. Confirm document treated as submitted (lockout messaging).

## 4. Classroom launch

- **QA:** Mock Classroom launch from `/demo` → lands in sandbox with instance.
- **Prod:** Set `GOOGLE_CLASSROOM_CLIENT_ID`, `GOOGLE_CLASSROOM_CLIENT_SECRET`, `GOOGLE_CLASSROOM_REDIRECT_URI` (callback = `{MSGF}/api/education/classroom/oauth/callback`). Use **Real Classroom OAuth start** once.

## 5. Teacher board

1. Open `/teacher` with the same assignment id.
2. Student appears with state / effort / stuck flags (no raw draft body).
3. After turn-in, certificate digests are in `education_human_effort_certificates` with `ags_status = classroom_stub`.

## Pass criteria

- [ ] Bootstrap succeeds on target Supabase
- [ ] Tutor cites demo Vault strength at least once
- [ ] Turn-in returns `humanEffortCertificate` with `status: classroom_stub`
- [ ] Mock (or real) Classroom launch reaches sandbox
- [ ] Platform login Education tab accepts student/teacher/admin_it (not Coming Soon)
