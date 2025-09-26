# OCPP MicroService

A TypeScript-based OCPP 1.6-J server for EV charging station backend service.

## 1. Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [Docker](https://www.docker.com/products/docker-desktop/) & Docker Compose

### Quick Start

1. **Clone and setup:**
   ```bash
   git clone https://github.com/hitoriaf/hito-ocpp-service.git
   cd hito-ocpp-service
   npm install
   ```

2. **Environment configuration:**
   Create `.env` file:
   ```env
   PORT=8080
   POSTGRES_DB=ocpp_db
   POSTGRES_USER=user
   POSTGRES_PASSWORD=password
   POSTGRES_PORT=5432
   REDIS_PORT=6379
   DATABASE_URL="postgresql://user:password@localhost:5432/ocpp_db?schema=public"
   ```

3. **Start services:**

   **For Development:**
   ```bash
   # Start database and Redis only
   docker compose up -d timescaledb redis
   
   # Run migrations
   npm run migrate
   
   # Start development server
   npm run dev
   ```

   **For Production (All containers):**
   ```bash
   # Start all services including the application
   docker compose up -d
   ```

The server runs at `ws://localhost:8080/{chargePointId}` for OCPP connections.

## 2. Architecture Overview

**Tech Stack:**
- **Runtime:** Node.js with TypeScript
- **WebSocket:** uWebSockets.js (high performance websocket micro-framework)
- **Database:** TimescaleDB (PostgreSQL + time-series database)
- **Queue:** Redis + Bull for async job processing system
- **ORM:** Prisma for type-safe database operations
- **Validation:** Zod for runtime schema validation

**Project Structure:**
```
src/
├── controllers/
│   ├── index.ts           # Controller exports
│   └── OcppController.ts  # WebSocket message handling
├── services/
│   ├── index.ts           # Service exports  
│   ├── OcppService.ts     # OCPP business logic
│   ├── QueueService.ts    # Redis queue management
│   └── QueueProcessor.ts  # Background job processor
├── utils/                 # Helper functions
├── types.ts              # OCPP & app type definitions
├── validation.ts         # Zod validation schemas
└── server.ts            # Main application entry point
```

**Message Flow:**
1. **Connection:** Charge Point connects via WebSocket (`/TESTCP_001`)
2. **Reception:** `OcppController` receives raw OCPP message
3. **Validation:** Message validated against Zod schemas
4. **Queuing:** Valid messages pushed to Redis queue
5. **Processing:** `QueueProcessor` handles messages asynchronously
6. **Business Logic:** `OcppService` executes OCPP-specific actions
7. **Persistence:** Data stored in TimescaleDB via Prisma ORM

**Key Design Patterns:**
- **Event-driven:** Async processing prevents blocking
- **Type-safe:** End-to-end TypeScript with runtime validation
- **Time-series optimized:** TimescaleDB for efficient meter data queries

**Architecture Diagram:**
![Diagram](architecture.jpg)

## 3. OCPP Implementation

**Protocol:** OCPP 1.6-J (JSON over WebSocket)  
**Message Format:** `[MessageType, MessageId, Action, Payload]`  
**Connection:** `ws://localhost:8080/{chargePointId}`

**Supported Actions:**
- `BootNotification` - Charge point registration
- `Heartbeat` - Keep-alive mechanism  
- `StatusNotification` - Connector status updates
- `Authorize` - User authentication via idTag
- `StartTransaction` / `StopTransaction` - Session management
- `MeterValues` - Energy consumption data

**Key Features:**
- Async message processing via Redis queues
- Type-safe validation with Zod schemas
- Automatic charge point identification from WebSocket path
- Time-series data storage for meter values

## 4. Database Schema

**Core Tables:**
- `ChargePoint` - Station metadata (model, vendor, status)
- `Transaction` - Charging sessions with energy consumption
- `Authorization` - Authorized user idTags
- `StatusNotification` - Connector status history
- `MeterValue` - Time-series energy readings
- `Heartbeat` - Connection monitoring logs

**Design Benefits:**
- TimescaleDB optimizes time-series queries for meter values
- Prisma ensures type safety and easy migrations
- Normalized schema supports multi-connector charge points
- Efficient indexing on chargePointId and timestamp fields

**Database Schema Diagram:**
![ER Diagram](voltron_db.png)