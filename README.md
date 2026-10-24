# TaskTracker

## Run locally with Docker

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). From the repo root:

```bash
docker compose up --build
```

- **API:** http://localhost:8080 (OpenAPI spec: http://localhost:8080/openapi/v1.json)
- **PostgreSQL:** `localhost:5433`, database / user / password: `tasktracker`

On startup the API applies migrations and seeds test users (Development only), all with password `Dev@123456`:
`admin@local.test` (Admin), `user1@local.test` and `user2@local.test` (Member).

Stop with `docker compose down` (add `-v` to also wipe the database). To change ports or credentials, copy `.env.example` to `.env` and edit it.
