# Eco-Balance — developer shortcuts
# Usage: make <target>

SHELL := /bin/bash
DC    := docker compose
API   := $(DC) exec api
WEB   := $(DC) exec web

.PHONY: help up down restart install migrate seed fresh test lint fmt \
        sh-api sh-web logs ps rebuild prune

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---------- Lifecycle ----------
up: ## Boot all containers in the background
	$(DC) up -d

down: ## Stop and remove containers
	$(DC) down

restart: ## Restart all containers
	$(DC) restart

rebuild: ## Rebuild all images from scratch
	$(DC) build --no-cache

# ---------- Install / bootstrap ----------
install: ## pnpm install at the workspace root (inside api container)
	$(API) pnpm install --frozen-lockfile

# ---------- Database ----------
migrate: ## Run Prisma migrations
	$(API) pnpm --filter @eco/api prisma migrate deploy

seed: ## Run Prisma seed
	$(API) pnpm --filter @eco/api prisma db seed

fresh: ## Wipe DB, remigrate, reseed
	$(API) pnpm --filter @eco/api prisma migrate reset --force

studio: ## Open Prisma Studio
	$(API) pnpm --filter @eco/api prisma studio

# ---------- Quality ----------
test: ## Run Vitest across all workspaces
	$(API) pnpm test

lint: ## Lint + typecheck all workspaces
	$(API) pnpm lint
	$(API) pnpm typecheck

fmt: ## Prettier auto-format
	$(API) pnpm format

# ---------- Introspection ----------
sh-api: ## Shell into the API container
	$(API) sh

sh-web: ## Shell into the Web container
	$(WEB) sh

logs: ## Tail all container logs
	$(DC) logs -f --tail=200

ps: ## List running containers
	$(DC) ps

# ---------- Danger ----------
prune: ## Delete all containers, volumes, images (DESTRUCTIVE)
	$(DC) down -v --rmi all
