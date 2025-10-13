FROM node:20-alpine
WORKDIR /app

# Copy shared module
COPY services/shared/ ./shared/
WORKDIR /app/shared
RUN npm i -g pnpm && pnpm install --no-frozen-lockfile
RUN npm run build

# Copy auth service
WORKDIR /app
COPY services/auth-service/package.json ./
RUN npm i -g pnpm && pnpm install --no-frozen-lockfile

# Copy auth service source code (excluding node_modules)
COPY services/auth-service/src ./src/
COPY services/auth-service/tsconfig.json ./

# Build the application
RUN npm run build

# Production setup
ENV NODE_ENV=production
RUN npm i -g pnpm && pnpm install --prod --no-frozen-lockfile

CMD ["node", "dist/main.js"]



