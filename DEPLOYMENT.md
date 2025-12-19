# Life Counter - Deployment Guide

## Docker Deployment

### Prerequisites
- Docker & Docker Compose installed
- Domain name (for production)

### Quick Start (Development)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Frontend
FRONTEND_PORT=3000
NUXT_PUBLIC_API_URL=http://localhost:3001

# API
API_PORT=3001
FRONTEND_URL=http://localhost:3000

# MongoDB
MONGO_PORT=27017
MONGODB_URI=mongodb://mongo:27017/lifecount
```

### Production Deployment

1. **Update environment variables for your domain:**

```env
FRONTEND_PORT=3000
NUXT_PUBLIC_API_URL=https://api.yourdomain.com
API_PORT=3001
FRONTEND_URL=https://yourdomain.com
MONGODB_URI=mongodb://mongo:27017/lifecount
```

2. **Build and run with production config:**

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

3. **Set up reverse proxy (nginx/traefik) to:**
   - Route `yourdomain.com` → `localhost:3000` (frontend)
   - Route `api.yourdomain.com` → `localhost:3001` (API)
   - Handle SSL termination

### Individual Service Builds

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

### Useful Commands

```bash
# Rebuild a specific service
docker-compose up -d --build api

# View service status
docker-compose ps

# Shell into a container
docker-compose exec api sh

# View MongoDB data
docker-compose exec mongo mongosh lifecount

# Remove all data (including volumes)
docker-compose down -v
```

### Health Checks

- API: `GET http://localhost:3001/api/health`
- MongoDB: Automatic via docker-compose healthcheck

### Scaling

The API is stateless (except for Socket.IO connections). For horizontal scaling:
1. Use Redis adapter for Socket.IO
2. Use MongoDB replica set
3. Load balance API instances

### Security Notes

- Change default MongoDB credentials in production
- Use secrets management for sensitive env vars
- Enable MongoDB authentication
- Use HTTPS in production
- Set proper CORS origins

