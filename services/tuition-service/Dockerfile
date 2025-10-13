FROM node:20-alpine
WORKDIR /app

# Copy and build shared module first
COPY services/shared/ ./shared/
WORKDIR /app/shared
RUN npm i -g pnpm && pnpm install --no-frozen-lockfile
RUN npm run build

# Install tuition-service dependencies
WORKDIR /app
COPY services/tuition-service/package.json ./
RUN npm i -g pnpm && pnpm install --no-frozen-lockfile

# Copy only source files
COPY services/tuition-service/src ./src/
COPY services/tuition-service/tsconfig.json ./

# Build the service
RUN npm run build

# Production deps to ensure runtime can resolve modules
ENV NODE_ENV=production
RUN pnpm install --prod --no-frozen-lockfile

EXPOSE 4006
# Run compiled seed automatically, then start service
CMD ["sh", "-c", "node dist/seed.js || true; node dist/main.js"]