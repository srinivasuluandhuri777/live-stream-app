#!/bin/bash

echo "Setting up Aroha Live Streaming App..."

echo "Setting up backend..."
cd mcp-server
npm install
cp .env.example .env
echo "Backend setup complete. Please edit mcp-server/.env with your Supabase credentials."

echo "Setting up frontend..."
cd ../frontend
npm install
cp .env.example .env
echo "Frontend setup complete. Please edit frontend/.env with your Supabase credentials."

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Use your existing Supabase project or create a new one"
echo "2. Run supabase-schema.sql in Supabase SQL editor"
echo "3. Run supabase-storage-setup.sql to create chat-images bucket"
echo "4. Enable Email auth: Authentication > Providers > Email (enable)"
echo "5. Update .env files with your Supabase credentials:"
echo "   - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (frontend)"
echo "   - SUPABASE_URL and SUPABASE_SERVICE_KEY (backend)"
echo "6. Start backend: cd mcp-server && npm start"
echo "7. Start frontend: cd frontend && npm run dev"
echo ""
echo "App will start at /login - use email/password to sign in or sign up"

