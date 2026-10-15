# Pomnya Lite: build the three files a GitHub release for the Obsidian community list needs.
.PHONY: build test release
build:
	npm run build
test: build
	npx tsc --noEmit -p .
	npx vitest run
release: test
	rm -rf dist && mkdir -p dist && cp main.js manifest.json styles.css dist/
	@ls -la dist
