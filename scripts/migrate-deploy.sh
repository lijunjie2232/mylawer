#!/bin/bash

\. "$HOME/.nvm/nvm.sh"

nvm use 26

cd /app

pnpm i && pnpm db:migrate:deploy

