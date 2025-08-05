import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_basic_health_check():
    """Test basic health endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "gather-api"

def test_api_health_check():
    """Test API health endpoint"""
    response = client.get("/api/v1/health/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["stage"] == "1 - Foundation"

def test_supabase_health_check():
    """Test Supabase connection health check"""
    response = client.get("/api/v1/health/supabase")
    assert response.status_code == 200
    data = response.json()
    # Should be healthy or unhealthy depending on config
    assert data["status"] in ["healthy", "unhealthy"]

def test_external_apis_health_check():
    """Test external APIs health check"""
    response = client.get("/api/v1/health/external-apis")
    assert response.status_code == 200
    data = response.json()
    assert "checks" in data
    assert "google" in data["checks"]
    assert "supabase" in data["checks"]

def test_detailed_health_check():
    """Test detailed health check"""
    response = client.get("/api/v1/health/detailed")
    assert response.status_code == 200
    data = response.json()
    assert "checks" in data
    assert "app" in data["checks"]
    assert "environment" in data["checks"]
    assert "total_check_time_ms" in data