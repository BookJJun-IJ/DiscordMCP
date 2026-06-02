# Build stage
FROM node:20-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install -g corepack@latest && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack install
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm run build

# Production stage
FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install -g corepack@latest && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack install
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY mcp-announce.cjs ./
COPY web/ ./web/
COPY config.example.json ./config.example.json

RUN mkdir -p /app/data

ENV CONFIG_PATH=/app/data/config.json
ENV PORT=9640

EXPOSE 9640

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9640/api/status || exit 1

CMD ["node", "dist/index.js"]
