# 8Byte Backend

Backend service for the Stock Dashboard application, built with Node.js, Express, and TypeScript.

## Prerequisites

- Node.js
- npm

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/kumarsantosh3914/stock-dashboard-backend.git
   cd stock-dashboard-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Update the environment variables as needed

4. **Run the development server**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── controllers/    # Route controllers
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Helper functions
└── server.ts       # Application entry point
```

## Available Scripts

- `dev`: Start development server with hot-reload
- `build`: Compile TypeScript to JavaScript
- `start`: Start production server
- `test`: Run tests

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
REDIS_HOST='localhost'
REDIS_PORT=6379
DEFAULT_TTL=15
PRICE_TTL=15
METRICS_TTL=15
```
