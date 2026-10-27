# ---- Stage 1: build the Vite app ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Stage 2: serve with nginx ----
FROM nginx:stable-alpine AS final
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback: return index.html for any unknown path so client-side routing works.
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

