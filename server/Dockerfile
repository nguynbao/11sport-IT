# Base image: node:20-alpine, cài tzdata để hỗ trợ TZ=Asia/Ho_Chi_Minh (chấm công).
# Dependencies & Assets: Copy eng.traineddata và vie.traineddata phục vụ fallback OCR (tesseract.js).
# Healthcheck: Dùng /api/v1/health theo server/src/app.ts và render.yaml.

# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache tzdata

ENV NODE_ENV=production
ENV PORT=4000
ENV TZ=Asia/Ho_Chi_Minh

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY eng.traineddata vie.traineddata ./

RUN chown -R node:node /app
USER node

EXPOSE 4000

CMD ["npm", "run", "start:migrate"]
