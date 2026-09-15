.PHONY: build test check fmt vet lint run

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
