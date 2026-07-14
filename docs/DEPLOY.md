# Deployment Runbook

Auto-deploy pipeline for Eco-Balance:
1. Push to `main` on GitHub
2. GitHub Actions builds `api` and `web` Docker images
3. Images are pushed to **GHCR** (`ghcr.io/kamoliddinibrohimov/ecobalance-{api,web}`)
4. Actions SSHes to the VPS, runs `docker compose pull && up -d`
5. Smoke test polls `/api/v1/health`

Target server: **`62.171.187.218`** (shared VPS — other Docker stacks may be running, must not interfere).

Isolation guarantees (no impact on neighbouring containers):
- Only **one host port** exposed: `8890` (nginx) — everything else is on the internal `eco` bridge network.
- Container names are `eco-*` prefixed.
- Volumes are prefixed with `eco-balance_` (from `COMPOSE_PROJECT_NAME`).

---

## One-time server setup

Run these commands **once** on the VPS as `root`.

### 1. Install Docker (skip if already installed)

```bash
curl -fsSL https://get.docker.com | sh
docker version
docker compose version   # must be v2.24+ for !override / !reset YAML tags
```

### 2. Generate a deploy SSH key on your local machine

```bash
# On your workstation (NOT the server):
ssh-keygen -t ed25519 -C "eco-balance-deploy" -f ~/.ssh/eco_balance_deploy -N ""

# Copy the PUBLIC key to the server
ssh-copy-id -i ~/.ssh/eco_balance_deploy.pub root@62.171.187.218

# The PRIVATE key content goes to GitHub as DEPLOY_SSH_KEY secret
cat ~/.ssh/eco_balance_deploy   # copy this whole output
```

### 3. Add GitHub repository secrets

Go to https://github.com/KamoliddinIbrohimov/EcoBalance/settings/secrets/actions and add:

| Secret name       | Value                                          |
|-------------------|------------------------------------------------|
| `DEPLOY_HOST`     | `62.171.187.218`                               |
| `DEPLOY_SSH_KEY`  | *(paste the whole private key from step 2)*    |

Optional (all have safe defaults):

| Secret name        | Default             | When to set                       |
|--------------------|---------------------|-----------------------------------|
| `DEPLOY_USER`      | `root`              | If using a non-root SSH user      |
| `DEPLOY_PATH`      | `/root/eco-balance` | If using a different directory    |
| `DEPLOY_SSH_PORT`  | `22`                | If SSH is on a non-standard port  |
| `DEPLOY_HTTP_PORT` | `8890`              | If nginx runs on a different port |

### 4. Clone the repo on the server

```bash
ssh root@62.171.187.218
cd ~
git clone https://github.com/KamoliddinIbrohimov/EcoBalance.git eco-balance
cd eco-balance
```

### 5. Create the production .env

```bash
cp .env.production.example .env
vi .env    # replace every CHANGE_ME_* with a real value
```

Generate strong secrets with:

```bash
openssl rand -base64 48   # for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
openssl rand -base64 24   # for POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, SUPER_ADMIN_PASSWORD
```

### 6. First boot (manual, for the initial run only)

```bash
# Login to GHCR so the server can pull private images
echo "<YOUR_GITHUB_PAT_WITH_read:packages>" | docker login ghcr.io -u KamoliddinIbrohimov --password-stdin

# Pull images (they must already be built — push once to trigger the workflow)
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Start the stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Then check:
```bash
docker compose ps
curl http://localhost:8890/api/v1/health
```

Everything after this — every `git push` to `main` — will redeploy automatically.

---

## Verifying the deployment

After a successful GitHub Actions run:

- Web UI: **http://62.171.187.218:8890**
- API health: **http://62.171.187.218:8890/api/v1/health**
- Swagger: **http://62.171.187.218:8890/api/docs**

Default super admin (from `.env`):
- email: `admin@eco-balance.uz`
- pass: the value you set in `SUPER_ADMIN_PASSWORD`

---

## Common operations

```bash
# View live logs (all services)
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=200

# Restart a single service
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart api

# Full stop
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Wipe DB and start fresh (DANGEROUS — deletes all data)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

---

## Rollback

To revert to a previous image tag, set the `GHCR_IMAGE_API` / `GHCR_IMAGE_WEB`
env vars to a specific SHA tag:

```bash
# On the server, in ~/eco-balance:
sed -i 's|:latest|:<PREVIOUS_SHA>|g' .env
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Every build tags images with both `:latest` and `:<short-sha>`, so any past
commit is one env-var away.

---

## Troubleshooting

**GitHub Actions can't SSH into the server.**
Check: the SSH key in `DEPLOY_SSH_KEY` matches a public key in
`~/.ssh/authorized_keys` on the server, and the private key you pasted
includes the full `-----BEGIN OPENSSH PRIVATE KEY-----` / `END` lines.

**Docker compose complains about `!reset` / `!override` tags.**
Upgrade Docker Compose to v2.24+:
```bash
apt-get update && apt-get install --only-upgrade docker-compose-plugin
docker compose version
```

**Port 8890 clashes with another container.**
Change `NGINX_HTTP_PORT` in `~/eco-balance/.env` on the server, then
`docker compose up -d` — no code change required.

**Web can't reach the API.**
The api container is reachable at `http://api:4000` from other containers
in the `eco` network, and at `http://<host>:8890/api/*` from the outside
(nginx proxies `/api/*` → `api:4000`).
