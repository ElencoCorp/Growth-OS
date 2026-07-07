# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and prisma schema
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies including devDependencies for build
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Compile css using tailwind
RUN npm run build:css

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install Alpine compatibility libraries required by Prisma (OpenSSL and libc6-compat)
RUN apk add --no-cache openssl libc6-compat

# Set node env
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json* ./

# Install ONLY production dependencies
RUN npm install --production && npm cache clean --force

# Copy prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy application files
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/views ./views

# Ensure /data directory exists for SQLite
RUN mkdir -p /data && chown -R node:node /data

EXPOSE 3000

# Default command to push DB schema and start server
CMD npx prisma db push && npm start
