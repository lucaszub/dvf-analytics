# ── Stage 1 : build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
# Résultat : /app/dist/ — fichiers statiques HTML/CSS/JS

# ── Stage 2 : nginx ───────────────────────────────────────────────────────────
FROM nginx:alpine

# Fichiers statiques buildés
COPY --from=build /app/dist /usr/share/nginx/html

# Config nginx : sert le frontend + proxifie les appels API
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
