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

# no-cache after new commit
ARG CACHEBUST=-1
RUN echo building for commit "$CACHEBUST"
# Clone the repository
RUN git clone https://github.com/lijunjie2232/mylawer.git /app \
    && cd /app \
    && git config --global url."https://github.com/".insteadOf "git@github.com:" \
    && git submodule update --init --recursive

RUN cd frontend \
    && pnpm i \
    && pnpm build \
    && cd .. \
    && cd third/legal-mcp/js_legal \
    && pnpm install \
    && pnpm build \
    && cd ../../.. \
    && pnpm i \
    && pnpm db:generate \
    && pnpm build

RUN apt-get clean && rm -rf /var/lib/apt/lists/* && rm -rf /tmp/* /var/tmp/* && pnpm store prune

EXPOSE 3000
