# Restaurant Ordering System

A modern restaurant ordering system with AI-powered dietary recommendations, MongoDB integration, and multi-language support.

## Features

- 🍽️ Dynamic menu management (MongoDB)
- 🤖 AI chatbot for dietary recommendations (Qwen3)
- 🌍 Multi-language support (English, Cantonese, Mandarin)
- 🎤 Voice input support
- 📱 Progressive Web App (PWA)
- 🛒 Shopping cart functionality
- 🏷️ Dietary tags, allergens, and restrictions

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Seed Database

```bash
python seed_database.py
```

### 3. Start Backend Server

```bash
python menu_server.py
```

Server runs on: http://localhost:5000

### 4. Start Frontend

Open a new terminal:

```bash
python -m http.server 8000
```

### 5. Open Website

Go to: http://localhost:8000

## Configuration

### MongoDB Connection

The MongoDB connection string is configured in:
- `menu_server.py` (line ~27)
- `seed_database.py` (line ~13)

To change it, edit the `MONGODB_URI_DEFAULT` variable in these files.

### Qwen API Key

Set your Qwen API key in `recommendation.js` (line ~14).

## Project Structure

```
├── index.html          # Main HTML file
├── script.js           # Menu and cart functionality
├── recommendation.js   # AI chatbot and recommendations
├── translations.js     # Multi-language support
├── style.css           # Styling
├── menu_server.py      # Backend server (Flask + MongoDB)
├── seed_database.py    # Database seeding script
├── requirements.txt    # Python dependencies
├── Procfile            # Railway deployment config
├── manifest.json       # PWA manifest
└── sw.js              # Service worker (PWA)
```

## API Endpoints

- `GET /api/menu` - Get all dishes
- `GET /api/menu?category=mains` - Get dishes by category
- `GET /api/menu/<id>` - Get single dish
- `POST /api/menu` - Create dish
- `PUT /api/menu/<id>` - Update dish
- `DELETE /api/menu/<id>` - Delete dish
- `POST /api/qwen` - Qwen AI proxy
- `GET /health` - Health check

## Deployment

### Railway

1. Add environment variables:
   - `MONGODB_URI` - Your MongoDB connection string
   - `QWEN_API_KEY` - Your Qwen API key

2. Update `Procfile`:
   ```
   web: python menu_server.py
   ```

3. Deploy!

## Documentation

- `MONGODB_SCHEMA.md` - Database schema documentation

## License

MIT

