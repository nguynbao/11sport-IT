# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ARG NEXT_PUBLIC_CMS_URL=http://localhost:3001
ARG NEXT_PUBLIC_APP_NAME="11Sport CMS"

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}
ENV NEXT_PUBLIC_CMS_URL=${NEXT_PUBLIC_CMS_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json next.config.mjs postcss.config.js tailwind.config.js next-env.d.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./

RUN chown -R node:node /app
USER node

EXPOSE 3001

CMD ["npm", "start"]
