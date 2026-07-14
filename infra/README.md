# Deployment

Continuous delivery for Eco-Balance is a straight line:

1. `git push origin main` triggers `.github/workflows/ci.yml` (lint + typecheck + build).
2. On green CI, `.github/workflows/deploy.yml` builds Docker images for `web` and
   `api` and pushes them to **GitHub Container Registry** as
   `ghcr.io/kamoliddinibrohimov/eco-balance-{web,api}:sha-<full-sha>` (plus
   `:latest`).
3. The workflow then SSHes to the VPS as the `deploy` user, `cd`s into
   `/opt/eco-balance`, and runs `bash scripts/deploy.sh sha-<full-sha>`.
4. `deploy.sh` pulls the new images, refreshes infra services, syncs the Prisma
   schema, and rolls the app containers.

The site is served over plain HTTP on port **8890**:
<http://62.171.187.218:8890>.

## First-time bootstrap

1. SSH to the server as root:

   ```bash
   ssh root@62.171.187.218
   ```

2. Run the bootstrap script from your workstation (pipes the script over SSH):

   ```bash
   ssh root@62.171.187.218 'bash -s' < infra/scripts/setup-server.sh
   ```

   If you already have a workstation SSH key you want to use for CI, pass it
   inline so `deploy` can log in immediately:

   ```bash
   ssh root@62.171.187.218 \
       "SSH_PUBLIC_KEY='ssh-ed25519 AAAA... deploy@ci' bash -s" \
       < infra/scripts/setup-server.sh
   ```

3. Grab the private key that pairs with the public key above (either the one
   from `/home/deploy/.ssh/id_ed25519` if you generated it on the server, or the
   one from your workstation), and paste it into the GitHub secret **`SSH_KEY`**.

4. Configure GitHub repository secrets
   (Settings → Secrets and variables → Actions → *New repository secret*):

   | Secret     | Value                                                |
   | ---------- | ---------------------------------------------------- |
   | `HOST`     | `62.171.187.218`                                     |
   | `USERNAME` | `deploy`                                             |
   | `SSH_KEY`  | private key matching `deploy`'s `authorized_keys`    |
   | `PORT`     | `22`                                                 |

5. Configure the repository variable (Settings → Secrets and variables →
   Actions → *Variables* tab):

   ```
   DEPLOY_ENABLED = true
   ```

   The deploy workflow refuses to run unless this is `true`, so nothing ships
   accidentally.

6. Make the GHCR packages **public** so the server can pull anonymously:
   <https://github.com/users/KamoliddinIbrohimov/packages/container/eco-balance-api/settings>
   and the matching page for `eco-balance-web` — scroll to *Danger Zone* →
   *Change visibility* → *Public*.

   If you prefer to keep them private, add these secrets and expose them to the
   SSH step in `deploy.yml`:

   - `GHCR_USERNAME` – any GitHub username with read access
   - `GHCR_TOKEN`    – a classic PAT with `read:packages`

   `deploy.sh` already logs into `ghcr.io` when both env vars are present.

7. Trigger the first deploy manually from the **Actions** tab → *Deploy* →
   *Run workflow*. Subsequent pushes to `main` deploy automatically.

## Continuous deploy

Every push to `main` produces a live release in ~5–10 minutes at
<http://62.171.187.218:8890>.

## Manual deploy on the server

```bash
ssh deploy@62.171.187.218
cd /opt/eco-balance
bash scripts/deploy.sh sha-<full-sha>
```

Omit the argument to deploy `:latest`.

## Rollback

Pick an older tag from the GHCR package page, then on the server:

```bash
cd /opt/eco-balance
bash scripts/deploy.sh sha-<older-full-sha>
```

Rolling back is the same code path as rolling forward — no special mode.

## Where things live on the server

```
/opt/eco-balance/
├── docker-compose.prod.yml   ← lives at repo path infra/docker-compose.prod.yml, copied via git pull
├── Caddyfile                 ← lives at repo path infra/Caddyfile, mounted into caddy container
├── .env                       ← never in git — generated once by setup-server.sh (chmod 600)
└── scripts/
    ├── setup-server.sh
    └── deploy.sh
```

The `setup-server.sh` script symlinks the compose file, Caddyfile, and
`deploy.sh` from their `infra/` locations into the app-dir root so both work.

Persistent data lives in named Docker volumes:

- `eco-balance_postgres_data`
- `eco-balance_redis_data`
- `eco-balance_minio_data`
- `eco-balance_caddy_data`
- `eco-balance_caddy_config`

## Isolation from other stacks on this VPS

- Only host port **8890** is bound (by the Caddy container).
- Docker network: **`eco-balance_net`** (private bridge, not shared).
- Volume names all start with **`eco-balance_`** so they never clash with other
  projects' volumes.
- Container names all start with **`eco-balance-`** (e.g. `eco-balance-api`,
  `eco-balance-postgres`).

## Troubleshooting

**`docker compose up` says `network eco-balance_net already exists in use`.**
An orphaned network from a previous half-torn-down stack. Inspect and remove:

```bash
docker network ls | grep eco-balance
docker network rm eco-balance_net   # only if no containers are attached
```

**`prisma db push` errors on the deploy step.** Check the API container logs
(the deploy script prints the last 40 lines automatically on failure):

```bash
cd /opt/eco-balance
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=200 api
```

**Server can't pull from GHCR (`unauthorized` / `denied`).** The packages are
private. Either make them public (see step 6 above) or set `GHCR_USERNAME` and
`GHCR_TOKEN` in the deploy step's environment.

**Compose version.** Requires Docker Compose **2.24+** on the host (for the
`!override` / `!reset` YAML tags — we don't use them in `prod` yet, but noted
for future compatibility). Check with `docker compose version`.

**Port 8890 already in use.** Something else on the VPS is bound to it. Pick a
free port and set `NGINX_HTTP_PORT=<new-port>` in `/opt/eco-balance/.env`, then
re-run `bash scripts/deploy.sh`.
