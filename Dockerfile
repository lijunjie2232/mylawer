FROM node:24.15.0-bookworm-slim

# mkdir /app
RUN mkdir /app

WORKDIR /app

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y curl libatomic1 git

# Install Node.js
RUN npm install -g corepack \
    && corepack enable pnpm \
    && pnpm -v

# COPY ./scripts/dump-las-202605191426.sql /docker-entrypoint-initdb.d/dump-las-202605191426.sql
RUN git clone https://github.com/lijunjie2232/mylawer.git /app \
    && cd /app \
    && git config --global url."https://github.com/".insteadOf "git@github.com:" \
    && git submodule update --init --recursive

RUN cd frontend \
    && pnpm i \
    && pnpm build \
    && cd .. \
    && pnpm i \
    && pnpm db:generate \
    && pnpm build

RUN apt-get clean && rm -rf /var/lib/apt/lists/* && rm -rf /tmp/* /var/tmp/* && pnpm store prune

EXPOSE 3000

CMD ["pnpm", "db:migrate:deploy", "&&", "pnpm", "start:server"]
