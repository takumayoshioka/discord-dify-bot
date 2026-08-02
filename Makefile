.PHONY: dev-up dev-down

COMPOSE = compose.yaml
COMPOSE_DEV = compose.dev.yaml
COMPOSE_PROD = compose.prod.yaml

dev-up:
	docker compose -f $(COMPOSE) -f $(COMPOSE_DEV) up --build

dev-down:
	docker compose -f $(COMPOSE) -f $(COMPOSE_DEV) down --timeout 30

prod-up:
	docker compose -f $(COMPOSE) -f $(COMPOSE_PROD) up -d

prod-down:
	docker compose -f $(COMPOSE) -f $(COMPOSE_PROD) down --timeout 30

