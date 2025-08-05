#!/usr/bin/env python3
"""
Startup script for Gather Python API
"""
import subprocess
import sys
import os
from pathlib import Path

def check_python_version():
    """Check if Python version is 3.11+"""
    if sys.version_info < (3, 11):
        print("❌ Python 3.11+ is required")
        sys.exit(1)
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")

def install_dependencies():
    """Install Python dependencies"""
    print("📦 Installing dependencies...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                      check=True, capture_output=True)
        print("✅ Dependencies installed")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        sys.exit(1)

def check_env_file():
    """Check if .env file exists"""
    env_file = Path(".env")
    if not env_file.exists():
        print("📋 Creating .env file from template...")
        try:
            import shutil
            shutil.copy(".env.example", ".env")
            print("✅ .env file created from template")
            print("🔧 Please edit .env file with your API keys before running the server")
            return False
        except Exception as e:
            print(f"❌ Failed to create .env file: {e}")
            sys.exit(1)
    return True

def run_tests():
    """Run basic tests"""
    print("🧪 Running tests...")
    try:
        subprocess.run([sys.executable, "-m", "pytest", "tests/", "-v"], 
                      check=True)
        print("✅ Tests passed")
    except subprocess.CalledProcessError:
        print("⚠️ Some tests failed - continuing anyway")

def start_server():
    """Start the FastAPI server"""
    print("🚀 Starting Gather Python API server...")
    print("📍 Server will be available at: http://localhost:8000")
    print("📖 API documentation at: http://localhost:8000/docs")
    print("💚 Health check at: http://localhost:8000/health")
    print("\n🔄 Starting server (Press Ctrl+C to stop)...")
    
    try:
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "app.main:app", 
            "--host", "0.0.0.0", 
            "--port", "8000", 
            "--reload"
        ])
    except KeyboardInterrupt:
        print("\n👋 Server stopped")

def main():
    """Main startup sequence"""
    print("🚀 Gather Python API - Stage 1 Startup")
    print("=" * 50)
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Run startup checks
    check_python_version()
    install_dependencies()
    
    # Check environment
    env_ready = check_env_file()
    if not env_ready:
        print("\n⏸️ Please configure your .env file and run this script again")
        return
    
    # Run tests
    run_tests()
    
    # Start server
    start_server()

if __name__ == "__main__":
    main()