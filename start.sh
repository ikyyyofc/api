echo "🚀 Starting Plugin REST API..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create necessary directories
mkdir -p public plugins logs scripts

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env 2>/dev/null || echo "Warning: .env.example not found"
fi

echo "🎯 Starting server on port 7680..."
npm run dev

# start.bat - Script untuk Windows
@echo off
echo 🚀 Starting Plugin REST API...

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
)

REM Create necessary directories
if not exist "public" mkdir public
if not exist "plugins" mkdir plugins
if not exist "logs" mkdir logs
if not exist "scripts" mkdir scripts

REM Check if .env exists
if not exist ".env" (
    echo 📝 Creating .env file...
    copy ".env.example" ".env" 2>nul
)

echo 🎯 Starting server on port 7680...
call npm run dev

pause