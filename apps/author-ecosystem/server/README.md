## Author Ecosystem Server

### Docker dev (recommended)

- Bring up DB:

```bash
docker compose up -d db
```

- Initialize/reset schema + seed (DESTRUCTIVE):

```bash
docker compose run --rm db_init
```

- Start API:

```bash
docker compose up --build server
```

### Template-driven author provisioning

Goal: add a new author (required domain + theme + persona) without touching core code.

1) Copy the template:
- `author-template.example.json` → `author-yourname.json`

2) Run provision script inside Docker (uses env-based DB connection):

```bash
docker compose run --rm \
  -e DB_HOST=db -e DB_PORT=5432 -e DB_DATABASE=author_ecosystem -e DB_USER=postgres -e DB_PASSWORD=postgres \
  server node src/scripts/provisionAuthor.js author-yourname.json
```

This creates:
- `users` row (`user_role='author'`)
- `custom_domains` row (domain required)
- `tenants` row (domain → schema mapping used by `tenantResolver`)
- `author_profiles` row (`theme_config` + `persona_config`)

