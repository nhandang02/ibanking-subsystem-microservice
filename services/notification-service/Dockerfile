FROM node:20-alpine
WORKDIR /app

# Copy and build shared module first
COPY services/shared/ ./shared/
WORKDIR /app/shared
RUN npm i -g pnpm && pnpm install --no-frozen-lockfile
RUN npm run build

# Install notification-service dependencies
WORKDIR /app
COPY services/notification-service/package.json ./
RUN npm i -g pnpm && pnpm install --no-frozen-lockfile

# Copy only source files
COPY services/notification-service/src ./src/
COPY services/notification-service/tsconfig.json ./

# Build the service
RUN npm run build

# Production deps to ensure runtime can resolve modules
ENV NODE_ENV=production
RUN pnpm install --prod --no-frozen-lockfile

CMD ["node", "dist/main.js"]



