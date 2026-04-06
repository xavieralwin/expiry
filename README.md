# URL Expiry Tracker

React + Vite frontend with an Express + SQLite backend.

## Local development

```bash
npm install
npm run dev
```

This starts:

- frontend on `http://localhost:5173`
- backend on `http://localhost:3001`

The Vite dev server proxies `/api` to the local backend.

## Self-hosted deployment

This repo is now configured to run both frontend and backend on your own server with Docker Compose.

### How it works

- `frontend` builds the Vite app and serves it with Nginx
- Nginx proxies `/api` to the private `backend` container
- `backend` runs the Express API with SQLite persisted from [`server/database.sqlite`](D:/VsProj/Tool/url-expiry-tracker/server/database.sqlite)
- the frontend uses `VITE_API_BASE_URL=/api`, so both app and API can live on the same domain

### Deploy on your server

Install Docker and Docker Compose, then run:

```bash
docker compose up -d --build
```

This starts:

- frontend on port `80`
- backend only inside the Docker network

Open your server IP or domain in the browser. API requests will go to the same host under `/api`.

### Updating after code changes

```bash
docker compose up -d --build
```

### Optional HTTPS

If you want HTTPS, put Nginx Proxy Manager, Caddy, or your own reverse proxy in front of this stack and forward traffic to port `80`.
