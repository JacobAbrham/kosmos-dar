# Claude Instructions: Production Deployment

## Current State
- Server: 47.91.123.78 (Alibaba Cloud)
- Docker: Installed (v29.1.3)
- Repo: Cloned to /opt/kosmos
- Status: Needs .env configuration and container startup

## SSH Access
```bash
ssh -i C:\Users\JacobVM\Downloads\kosmos-key root@47.91.123.78
```

## Remaining Tasks

### 1. Configure Environment (on server)
```bash
cd /opt/kosmos
PG_PASS=$(openssl rand -hex 16)
SEC_KEY=$(openssl rand -hex 32)
JWT_SEC=$(openssl rand -hex 32)

cat > .env << EOF
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://47.91.123.78:8000
NEXT_PUBLIC_WS_URL=ws://47.91.123.78:8000/ws
NEXT_PUBLIC_APP_URL=http://47.91.123.78
DATABASE_URL=postgresql://kosmos:${PG_PASS}@postgres:5432/kosmos
POSTGRES_PASSWORD=${PG_PASS}
REDIS_URL=redis://redis:6379/0
SECRET_KEY=${SEC_KEY}
JWT_SECRET=${JWT_SEC}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
LOG_LEVEL=INFO
DOMAIN=47.91.123.78
EOF
```

### 2. Build and Start Frontend
```bash
cd /opt/kosmos
docker build -t kosmos-frontend:latest -f docker/Dockerfile.frontend ./implementation/frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

### 3. Configure Firewall
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable
```

### 4. Verify
```bash
docker ps
curl -I http://localhost:80
```

## Expected Result
Frontend accessible at http://47.91.123.78

## Files Reference
- Dockerfile: docker/Dockerfile.frontend
- Compose: docker-compose.prod.yml
- Nginx: docker/nginx.conf
