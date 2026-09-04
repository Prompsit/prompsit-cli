# CLI-consumed API contract

The backend OpenAPI document is the full API source of truth. This document records only the routes and ownership boundaries used by this client.

- Route constants: [`src/shared/constants.ts`](../../src/shared/constants.ts)
- Request construction: [`src/api/resources/`](../../src/api/resources/)
- Response validation: [`src/api/models.ts`](../../src/api/models.ts)
- Selected API URL: [`src/config/constants.ts`](../../src/config/constants.ts)

## Connection

The default stand is `https://edge.prompsit.com`; local development uses `http://localhost:8080`. Custom remote API URLs must use HTTPS. Authenticated resources use OAuth2 bearer tokens from `~/.prompsit/credentials.json`.

## Routes

| Method | Route | Client purpose |
|---|---|---|
| POST | `/v1/auth/token` | Secret login and token refresh |
| POST | `/v1/auth/device` | Start device authorization |
| POST | `/v1/auth/device/token` | Poll device authorization |
| POST | `/v1/auth/secret` | Rotate or set the account secret |
| GET | `/health` | Health check |
| GET | `/v1/translation/languages` | Translation language pairs |
| POST | `/v1/translation` | Text translation |
| POST | `/v1/translation/document` | Document translation job |
| GET | `/v1/translation/document/formats` | Translation formats |
| POST | `/v1/quality/score` | Segment quality evaluation |
| POST | `/v1/quality/score/file` | File evaluation job |
| GET | `/v1/quality/score/formats` | Evaluation formats |
| POST | `/v1/quality/tags` | Reference-free tag scoring |
| POST | `/v1/data/score` | Corpus scoring job |
| GET | `/v1/data/score/formats` | Scoring formats |
| GET | `/v1/data/score/languages` | Scoring languages |
| POST | `/v1/data/annotate` | Annotation job |
| GET | `/v1/data/annotate/formats` | Annotation formats |
| GET, DELETE | `/v1/jobs/{job_id}` | Read or cancel a job |
| GET | `/v1/jobs/{job_id}/events` | SSE progress |
| GET | server-provided `result_url` | Download a completed result |
| GET | `/v1/user/usage` | Plan and usage |
| GET | `/v1/translation/memory` | List translation memories |
| POST | `/v1/translation/memory/import` | Import TMX |
| GET | `/v1/translation/memory/segments` | List TM segments |
| POST | `/v1/translation/memory/search` | Search TM segments |

## Client contract

API resources validate responses at the boundary and normalize API failures before command presentation. The server owns job state and `result_url`; the client owns local output naming. `AuthSession` owns bearer authentication and the single refresh-and-retry cycle.

When a consumed route changes, update its constant, resource, schema, behavior tests, and this table in the same change. Do not copy the backend's complete schema here.
