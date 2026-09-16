.PHONY: build test check fmt vet run demo web-install web-test

build:
	go build ./...

test:
	go test ./... -race -cover

fmt:
	gofmt -w .

vet:
	go vet ./...

# The one command to run before trusting a change.
check: vet test
	@out="$$(gofmt -l .)"; \
	if [ -n "$$out" ]; then echo "gofmt needs to be run on:"; echo "$$out"; exit 1; fi

run:
	go run ./cmd/okrd

# A worked example in a throwaway database, so there is something to look
# at before you have typed anything in. Refuses to touch a database that
# already has teams.
demo:
	QUARTERMARK_DB=demo.db go run ./cmd/okrd -demo

web-install:
	cd web && npm install

web-test:
	cd web && npm run typecheck && npm run lint && npm test && npm run build
