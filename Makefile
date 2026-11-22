.PHONY: dev-up dev-down

COMPOSE = compose.yaml
COMPOSE_DEV = compose.dev.yaml
COMPOSE_PROD = compose.prod.yaml

dev-up:
	docker compose --env-file .env.dev -f $(COMPOSE) -f $(COMPOSE_DEV) up --build

dev-up-nostart:
	docker compose --env-file .env.dev -f $(COMPOSE) -f $(COMPOSE_DEV) up --build --no-start

dev-down:
	docker compose --env-file .env.dev -f $(COMPOSE) -f $(COMPOSE_DEV) down --timeout 30

prod-up:
	docker compose --env-file .env -f $(COMPOSE) -f $(COMPOSE_PROD) up -d --build

prod-down:
	docker compose --env-file .env -f $(COMPOSE) -f $(COMPOSE_PROD) down --timeout 30

clear-db:
	rm -r db/*