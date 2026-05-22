#!/bin/bash

_start_nodejs_app() {
	echo "Starting Node.js application in the background..."
	cd /app/third/webmcp
	pnpm binary:sync
	cd /app
	pnpm db:migrate:deploy
	node dist/index.js --serve
}

_start_nodejs_app
