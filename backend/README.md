# Gather Python API - Backend

Python FastAPI backend for the Gather AI Assistant Platform.

## 🚀 Quick Start

### Option 1: Automatic Setup
```bash
cd backend
python start.py
```

### Option 2: Manual Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Run tests
pytest tests/ -v

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Option 3: Docker
```bash
cd backend

# Copy your environment variables
cp .env.example .env
# Edit .env with your API keys

# Start with Docker Compose
docker-compose up --build
```

## 📍 Endpoints

- **Health Check**: `GET /health`
- **API Health**: `GET /api/v1/health/`
- **Supabase Health**: `GET /api/v1/health/supabase`
- **External APIs Health**: `GET /api/v1/health/external-apis`
- **Detailed Health**: `GET /api/v1/health/detailed`
- **API Documentation**: `GET /docs` (development only)

## 🔧 Configuration

Copy `.env.example` to `.env` and configure:

```env
# Supabase (required)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# External APIs
GOOGLE_API_KEY=your_google_api_key
NOTION_CLIENT_ID=your_notion_client_id
# ... etc
```

## 🧪 Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=app

# Test specific endpoints
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/health/detailed
```

## 🚢 Deployment

### Railway
1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically

### Docker Production
```bash
docker build -t gather-api .
docker run -p 8000:8000 --env-file .env gather-api
```

## 📁 Project Structure

```
backend/
├── app/
│   ├── core/          # Configuration, auth
│   ├── api/v1/        # API routes
│   ├── services/      # Business logic (Stage 2+)
│   └── utils/         # Utilities
├── tests/             # Test files
├── requirements.txt   # Dependencies
├── Dockerfile        # Docker configuration
└── start.py          # Development startup script
```

## 🔄 Migration Stages

- **Stage 1** (Current): Foundation setup with health checks
- **Stage 2**: Performance-heavy operations (documents, AI)
- **Stage 3**: Business logic migration (integrations, voice)
- **Stage 4**: Database migration (Supabase → PostgreSQL)

## 🐛 Troubleshooting

### Common Issues

1. **Import Errors**: Make sure you're in the `backend/` directory
2. **Port 8000 in use**: Kill existing processes or change port
3. **Missing .env**: Copy from `.env.example` and configure
4. **Supabase connection**: Check URL and keys in health endpoint

### Health Check Failed
```bash
# Check detailed health status
curl http://localhost:8000/api/v1/health/detailed

# Check logs
docker-compose logs api
```