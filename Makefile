NOPROXY=HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy=""

build:
	$(NOPROXY) docker compose build

up:
	$(NOPROXY) docker compose up -d

logs:
	docker compose logs -f

up-d:
	$(NOPROXY) docker compose up -d

down:
	docker compose down

reset:
	docker compose down -v && $(NOPROXY) docker compose up

.PHONY: build up up-d down reset
