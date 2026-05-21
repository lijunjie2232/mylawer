#!/bin/bash

_start_nodejs_app() {
	echo "Starting Node.js application in the background..."
	if [ -d "/app" ]; then
		(
			cd /app
			# Redirect output to Docker logs so you can see what Node is doing
			npx prisma migrate deploy
            npx prisma generate
			node dist/index.js --serve
		)
		echo "Node.js application triggered."
	else
		echo "Warning: /app directory not found. Skipping Node.js start." >&2
	fi
}

#_start_nodejs_app
cd /app
node dist/index.js --server
