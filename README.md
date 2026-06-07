# auranest-app-template

Full-stack app template: NestJS 11 backend + Next.js 15 frontend, self-contained with dual auth mode.

## Structure

```
backend/   NestJS + Prisma + PostgreSQL
frontend/  Next.js 15 App Router
```

## Quick start (local auth, no Keycloak needed)

```bash
cp .env.example .env
# edit POSTGRES_PASSWORD

pnpm install          # root dev tools (biome, concurrently)
pnpm -C backend install
pnpm -C frontend install

docker compose up db -d
pnpm -C backend prisma:migrate
pnpm -C backend prisma:seed      # 建立預設 ADMIN 帳號（SEED_USER_* 設定在 backend/.env）
pnpm dev              # backend :3000 + frontend :3001
```

## Auth modes

| Mode | .env | Description |
|------|------|-------------|
| `local` | `AUTH_MODE=local` | Built-in register/login, local JWT |
| `oidc`  | `AUTH_MODE=oidc` + OIDC_* vars | Validates Keycloak (or any OIDC) tokens |

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | public | Register (local mode only) |
| POST | /auth/login | public | Login (local mode only) |
| GET | /auth/me | required | Current user |
| GET | /health | public | Health check |
| GET | /notes | required | List notes |
| POST | /notes | required | Create note |
| GET | /notes/:id | required | Get note |
| PATCH | /notes/:id | required | Update note |
| DELETE | /notes/:id | required | Delete note |

## Docker (production)

```bash
docker compose up -d
```
