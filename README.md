# GasGuard — Virtual Gas Leakage Detection & Real-Time SMS Alert System

## What this project does

This is a software-only simulation of an IoT gas leakage monitoring system.

There is no physical MQ sensor or ESP32 required for the software demo.

The virtual sensor continuously generates realistic gas readings. When the reading crosses the configured danger threshold, the frontend automatically calls the backend and the backend can send an SMS through Twilio.

## Project structure

```text
gas-leakage-system/
├── frontend/
│   ├── public/
│   │   └── assets/
│   │       └── circuit.png
│   └── src/
│       ├── components/
│       ├── services/
│       ├── simulation/
│       ├── App.jsx
│       ├── main.jsx
│       └── index.css
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── firebase/
│   └── database-rules.json
└── README.md
```

## 1. Install backend

Open a terminal:

```bash
cd backend
npm install
copy .env.example .env
npm start
```

The backend runs at:

http://localhost:5000

## 2. Install frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

http://localhost:5173

## 3. 3D circuit image

Put your Tinkered/Tinkercad circuit screenshot here:

```text
frontend/public/assets/circuit.png
```

The supplied screenshot should show the ESP32, MQ gas sensor, breadboard, LED/resistors and wiring.

## 4. Demo SMS

By default:

```env
DEMO_SMS=true
```

When the virtual gas level crosses 60%, the frontend calls the backend and the backend returns:

DEMO SENT

No real SMS is sent in demo mode.

## 5. Real SMS

Put your Twilio credentials in:

```text
backend/.env
```

Example:

```env
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_twilio_number
REGISTERED_MOBILE_NUMBER=+91XXXXXXXXXX
DEMO_SMS=false
```

Never commit `.env` to GitHub.

## Important

This is a virtual sensor simulation. It does not physically detect gas. A future hardware version can replace `virtualSensor.js` with ESP32/MQ-series sensor readings.
last documentation: 18 October 2026