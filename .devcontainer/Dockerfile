FROM node:24.13.0-bookworm-slim

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN pnpm add -g @anthropic-ai/claude-code
RUN pnpm add -g @nestjs/cli

WORKDIR /workspace
