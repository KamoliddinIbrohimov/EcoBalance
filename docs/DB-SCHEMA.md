# Eco-Balance — Database schema (Phase 0)

PostgreSQL 16. All primary keys are UUIDv7 (time-ordered — index-friendly). Timestamps are
`timestamptz`. Deletions cascade to junction tables, `SET NULL` where the relation is
optional (audit logs keep pointing to a user id even after the user is deleted, etc.).

## ER diagram

```mermaid
erDiagram
    users ||--o{ user_roles           : has
    users ||--o{ audit_logs           : creates
    users ||--o{ notifications        : receives
    users ||--o{ refresh_tokens       : owns
    users ||--o{ password_reset_tokens: owns
    users }o--|| organizations        : belongsTo
    organizations ||--o{ organizations : parent_child

    roles       ||--o{ user_roles       : granted
    roles       ||--o{ role_permissions : grants
    permissions ||--o{ role_permissions : granted

    users {
        uuid   id PK
        text   first_name
        text   last_name
        text   email UK
        text   phone UK "nullable"
        text   password_hash
        uuid   organization_id FK
        text   avatar_url
        text   locale "default uz"
        tstz   email_verified_at
        tstz   last_login_at
        text   last_login_ip
        bool   is_active
        tstz   created_at
        tstz   updated_at
    }
    roles {
        uuid   id PK
        enum   slug UK
        text   name_uz
        text   description
    }
    permissions {
        uuid   id PK
        text   slug UK
        text   module
        text   action
        text   name_uz
    }
    user_roles {
        uuid user_id PK,FK
        uuid role_id PK,FK
        tstz created_at
    }
    role_permissions {
        uuid role_id PK,FK
        uuid permission_id PK,FK
        tstz created_at
    }
    organizations {
        uuid   id PK
        uuid   parent_id FK "nullable"
        enum   type "CITY|DISTRICT|MAHALLA|SCHOOL|KINDERGARTEN|UNIVERSITY"
        text   name_uz
        text   code UK
        jsonb  address
        num    latitude
        num    longitude
        tstz   created_at
        tstz   updated_at
    }
    audit_logs {
        uuid   id PK
        uuid   user_id FK "nullable"
        enum   action
        text   subject_type
        uuid   subject_id
        jsonb  changes
        text   ip_address
        text   user_agent
        tstz   created_at
    }
    notifications {
        uuid   id PK
        uuid   user_id FK
        text   type
        text   title_uz
        text   body_uz
        jsonb  data
        tstz   read_at
        tstz   created_at
        tstz   updated_at
    }
    refresh_tokens {
        uuid   id PK
        uuid   user_id FK
        text   token_hash UK "sha256(raw)"
        uuid   family_id
        tstz   revoked_at
        tstz   expires_at
        text   ip_address
        text   user_agent
        tstz   created_at
    }
    password_reset_tokens {
        uuid   id PK
        uuid   user_id FK
        text   token_hash UK
        tstz   used_at
        tstz   expires_at
        tstz   created_at
    }
```

## Indexes

Automatically created by Prisma:

| Table                   | Index                                           | Purpose                        |
|-------------------------|-------------------------------------------------|--------------------------------|
| users                   | (organization_id), (created_at DESC)            | list users per org             |
| organizations           | (parent_id), (type)                             | tree walk, filter by type      |
| audit_logs              | (user_id), (action), (subject_type, subject_id), (created_at DESC) | investigation queries |
| notifications           | (user_id, read_at), (created_at DESC)            | unread badge, feed             |
| refresh_tokens          | (user_id), (family_id), (expires_at)             | rotation & cleanup             |
| password_reset_tokens   | (user_id), (expires_at)                          | cleanup                        |

## Retention & cleanup

- **refresh_tokens**: scheduled job (Phase 2) deletes rows with `expires_at < now() - 30d`.
- **password_reset_tokens**: same, `expires_at < now() - 7d`.
- **audit_logs**: **never deleted** — mandatory for gov compliance.

## Enums

Prisma-native enums, mapped to PostgreSQL:

- `RoleSlug`: `SUPER_ADMIN`, `ADMIN`, `CITY_ADMIN`, `MAHALLA_MANAGER`, `TEACHER`, `STUDENT`, `CITIZEN`
- `OrganizationType`: `CITY`, `DISTRICT`, `MAHALLA`, `SCHOOL`, `KINDERGARTEN`, `UNIVERSITY`
- `AuditAction`: `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `LOGIN_FAILED`, `PASSWORD_RESET_REQUEST`, `PASSWORD_RESET_COMPLETE`, `TOKEN_REFRESH`, `TOKEN_REVOKED`

## Post-Phase-0 additions (planned)

| Phase | New tables                                                                                  |
|-------|---------------------------------------------------------------------------------------------|
| 1     | (organizations CRUD only — schema already in place)                                          |
| 3     | `dashboard_widgets`, `kpi_snapshots`                                                         |
| 4     | `sensors`, `sensor_readings` (partitioned by month), PostGIS `geometry(Point, 4326)` columns  |
| 5     | `courses`, `lessons`, `enrollments`, `assignments`, `submissions`, `certificates`             |
| 6     | `points`, `badges`, `missions`, `mission_progress`, `leaderboards`                            |
| 7     | `ai_conversations`, `ai_messages`, `ai_prompts`                                               |
| 8     | `reports`, `report_runs`                                                                     |
| 9     | `news_posts`, `events`, `event_registrations`                                                |
