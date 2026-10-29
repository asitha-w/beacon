BIN := bin/beacon

.PHONY: run build test vet fmt tidy docker

run: ## run the console on :8080 (scripted mode unless ANTHROPIC_API_KEY is set)
	go run ./cmd/beacon

build: ## build a self-contained binary into bin/
	CGO_ENABLED=0 go build -ldflags="-s -w" -o $(BIN) ./cmd/beacon

test: vet
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w cmd internal web

tidy:
	go mod tidy

docker: ## build the container image
	docker build -t beacon:dev .
