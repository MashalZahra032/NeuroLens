# NeuroLens — Deployment Guide

## Local (recommended for dev)

```bash
# Terminal 1 — Flask API
cd neurolens
pip install -r requirements.txt
python app.py              # runs on :5000

# Terminal 2 — Next.js UI
npm install
npm run dev                # runs on :3000
# open http://localhost:3000
```

## Colab (GPU)

### Step 1 — Install & start Flask
```python
!pip install -q flask flask-cors torch torchvision ultralytics Pillow numpy pyngrok
!mkdir -p models
# upload your .pt files to models/

import threading, subprocess, time
from pyngrok import ngrok

ngrok.set_auth_token("YOUR_TOKEN")

def run_flask():
    subprocess.run(["python", "app.py"])

threading.Thread(target=run_flask, daemon=True).start()
time.sleep(4)
flask_url = ngrok.connect(5000)
print("Flask URL:", flask_url)
```

### Step 2 — Set env & run Next.js
```python
import os
os.environ["FLASK_API_URL"] = str(flask_url)   # from step 1

# write to .env.local
with open(".env.local","w") as f:
    f.write(f"FLASK_API_URL={flask_url}\n")

!npm install
!npm run build

def run_next():
    subprocess.run(["npm","start"])

threading.Thread(target=run_next, daemon=True).start()
time.sleep(5)
ui_url = ngrok.connect(3000)
print("NeuroLens UI:", ui_url)
```

## Production (VPS / cloud)

```bash
# 1. Build Next.js
npm run build

# 2. Use PM2 to keep both processes alive
npm install -g pm2
pm2 start "python app.py" --name flask-api
pm2 start "npm start" --name neurolens-ui

# 3. Set env
echo "FLASK_API_URL=http://localhost:5000" >> .env.local

# 4. Nginx reverse proxy (optional)
# → / proxies to :3000 (Next.js)
# → /api/flask proxies to :5000 (optional direct access)
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FLASK_API_URL` | `http://localhost:5000` | Flask backend URL |
| `PORT` (Flask) | `5000` | Flask port |
| `MODELS_DIR` (Flask) | `./models` | Path to .pt model files |
