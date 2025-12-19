# Life Counter - Deployment Guide

## Quick Start (Development)

For local development without SSL:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access locally at:
- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`

---

## Production Deployment with Automatic SSL

Production uses `nginxproxy/nginx-proxy` and `nginxproxy/acme-companion` for automatic SSL certificate management with Let's Encrypt.

### Prerequisites
- Docker & Docker Compose installed
- Domain name pointing to your server
- Ports 80 and 443 open on your server

---

## Production Deployment

### 1. Create Environment File

Create a `.env` file in the project root:

```env
# Domain for the frontend (without protocol)
FRONTEND_HOST=lifecount.example.com

# Domain for the API (without protocol)  
API_HOST=api.lifecount.example.com

# Full URL for the API (used by frontend)
NUXT_PUBLIC_API_URL=https://api.lifecount.example.com

# Full URL for the frontend (used for CORS)
FRONTEND_URL=https://lifecount.example.com

# MongoDB (optional - defaults to local container)
# MONGODB_URI=mongodb://mongo:27017/lifecount
```

### 2. DNS Configuration

Point your domains to your server:
- `lifecount.example.com` → Your server IP
- `api.lifecount.example.com` → Your server IP

### 3. Deploy

```bash
# Build and start with production config
docker-compose -f docker-compose.prod.yml up -d --build

# View logs to monitor SSL certificate generation
docker-compose -f docker-compose.prod.yml logs -f acme-companion

# Check all services are running
docker-compose -f docker-compose.prod.yml ps
```

### 4. Verify SSL

After a few minutes, Let's Encrypt will issue certificates automatically. Check:
- `https://lifecount.example.com` - Frontend
- `https://api.lifecount.example.com` - API

---

## How It Works

1. **nginx-proxy** automatically discovers containers with `VIRTUAL_HOST` environment variable and routes traffic to them.

2. **acme-companion** monitors containers with `LETSENCRYPT_HOST` and automatically obtains/renews SSL certificates from Let's Encrypt.

3. Certificates are stored in the `certs` volume and automatically renewed before expiration.

---

## Individual Service Builds

**API only:**
```bash
cd api
docker build -t lifecount-api .
docker run -p 3001:3001 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/lifecount \
  -e FRONTEND_URL=http://localhost:3000 \
  lifecount-api
```

**Frontend only:**
```bash
cd frontend
docker build -t lifecount-frontend \
  --build-arg NUXT_PUBLIC_API_URL=http://localhost:3001 .
docker run -p 3000:3000 lifecount-frontend
```

---

## Useful Commands

```bash
# Rebuild a specific service
docker-compose -f docker-compose.prod.yml up -d --build frontend

# View service status
docker-compose -f docker-compose.prod.yml ps

# View nginx-proxy logs
docker-compose -f docker-compose.prod.yml logs nginx-proxy

# View certificate status
docker-compose -f docker-compose.prod.yml exec acme-companion /app/cert_status

# Shell into a container
docker-compose -f docker-compose.prod.yml exec api sh

# View MongoDB data
docker-compose -f docker-compose.prod.yml exec mongo mongosh lifecount

# Remove all data (including volumes)
docker-compose -f docker-compose.prod.yml down -v
```

---

## Troubleshooting

### SSL Certificate Not Generated

1. Check DNS is properly configured:
   ```bash
   nslookup lifecount.example.com
   ```

2. Check acme-companion logs:
   ```bash
   docker-compose -f docker-compose.prod.yml logs acme-companion
   ```

3. Ensure ports 80 and 443 are open and not blocked by firewall.

### WebSocket Connection Issues

If Socket.IO connections fail, you may need to add WebSocket support to nginx-proxy. Create `vhost.d/api.lifecount.example.com`:

```
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Container Not Being Proxied

Ensure the container has:
- `VIRTUAL_HOST` environment variable set
- `VIRTUAL_PORT` if not using port 80
- Connected to the same Docker network as nginx-proxy

---

## Health Checks

- API: `GET https://api.lifecount.example.com/api/health`
- MongoDB: Automatic via docker-compose healthcheck

---

## Scaling

The API is stateless (except for Socket.IO connections). For horizontal scaling:
1. Use Redis adapter for Socket.IO
2. Use MongoDB replica set
3. Load balance API instances

---

## Security Notes

- SSL is automatically handled by Let's Encrypt
- Change default MongoDB credentials in production
- Use secrets management for sensitive env vars
- Enable MongoDB authentication for production
- Set proper CORS origins in API
