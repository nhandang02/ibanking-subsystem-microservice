FROM node:20-alpine
WORKDIR /app

# Copy and build shared module first (safe even if not used)
COPY services/shared/ ./shared/
WORKDIR /app/shared
RUN npm i -g pnpm && pnpm install --no-frozen-lockfile
RUN npm run build

# Install payment-service dependencies
WORKDIR /app
COPY services/payment-service/package.json ./
RUN npm i -g pnpm && pnpm install --no-frozen-lockfile

# Copy only source files
COPY services/payment-service/src ./src/
COPY services/payment-service/tsconfig.json ./

# Build the service
RUN npm run build

# Production deps to ensure runtime can resolve modules
ENV NODE_ENV=production
RUN pnpm install --prod --no-frozen-lockfile

EXPOSE 4007
CMD ["node", "dist/main.js"]