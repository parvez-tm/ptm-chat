# PTM Chat — Real-Time Chat Application

A production-ready, real-time one-on-one chat application built with **Node.js/Express 5**, **Socket.IO**, **MongoDB**, **Redis**, and **React 19**. Features JWT authentication with refresh token rotation, Redis-powered token blacklisting, online presence tracking, typing indicators, read receipts, message caching, and rate limiting.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socket.io&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite_7-646CFF?style=flat&logo=vite&logoColor=white)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [Redis Usage](#redis-usage)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Socket.IO Events](#socketio-events)
- [Frontend Overview](#frontend-overview)
- [Security](#security)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [License](#license)

---

## Features

### Authentication & Authorization
- User registration with duplicate email/username validation
- JWT-based login with **access token** (1 day) + **refresh token** (7 day) rotation
- Secure logout with **Redis token blacklisting** — revoked tokens are rejected instantly
- Password hashing with bcryptjs (salt rounds: 10)
- Protected routes with `token_middleware` on all sensitive endpoints

### Real-Time Chat
- **One-on-one** real-time messaging via Socket.IO (WebSocket + polling fallback)
- Message persistence in MongoDB with soft delete support
- **Infinite scroll** pagination for chat history (default 30 messages/page)
- **Typing indicators** — live typing/stop-typing events with 2-second debounce
- **Online/Offline presence** — real-time status updates via Redis sets
- **Last seen** timestamps with human-readable formatting (e.g., "5m ago", "2h ago")
- **Date separators** — messages grouped by day (Today, Yesterday, full date)
- Real-time conversation sidebar updates when messages arrive

### User Management
- Paginated user listing with search and sort support
- Profile management — edit name, username, phone, address, date of birth
- Profile image upload via Multer (stored to `public/profileImage/`)


### Security & Performance
- **Redis-based rate limiting** — configurable per-endpoint (login: 5/min, messages: 20/10s)
- **Input sanitization** — recursive HTML tag stripping on all user inputs
- **CORS** — configurable origin with credentials support
- **MongoDB ID validation** — middleware checks for valid 24-char ObjectIds
- **Socket.IO authentication** — JWT verification on WebSocket handshake
- Health check endpoint at `GET /health`

---

## Architecture

```
┌──────────────────┐        WebSocket         ┌───────────────────────┐
│                  │ ◄───────────────────────► │   Socket.IO Server    │
│   React 19 App   │                           │   (real-time events)  │
│   (Vite 7 Dev)   │        HTTP REST          │                       │
│   Port 5173      │ ◄───────────────────────► │   Express 5 Server   │
│                  │                           │   Port 4400           │
└──────────────────┘                           └─────────┬─────────────┘
                                                         │
                                          ┌──────────────┼──────────────┐
                                          │              │              │
                                     ┌────▼────┐   ┌─────▼─────┐  ┌────▼────────┐
                                     │ MongoDB │   │   Redis   │  │ JWT Auth    │
                                     │ Mongo 7 │   │  7-alpine │  │ Access +    │
                                     │ :27017  │   │  :6379    │  │ Refresh     │
                                     └─────────┘   └───────────┘  └─────────────┘
                                      Persistent     In-Memory      Stateless
                                      Data Store     Cache/State    Token Auth
```

### Production Architecture (Nginx)

```
                        ┌─────────────────────────────────────┐
   Internet ──────────► │        Nginx :443 (SSL)              │
                        ├─────────────────────────────────────┤
                        │  /chat/*             → static dist/  │
                        │  /ptm-chat-api/*     → Node :4400    │
                        │  /ptm-chat-socket.io/* → Node :4400  │
                        └──────────┬──────────┬───────────────┘
                                   │          │
                           ┌───────▼──┐  ┌────▼──────┐
                           │ Frontend │  │  Backend   │
                           │ (static) │  │ PM2 :4400  │
                           └──────────┘  └──┬─────┬──┘
                                            │     │
                                      ┌─────▼─┐ ┌─▼─────┐
                                      │MongoDB│ │ Redis  │
                                      │Docker │ │ Docker │
                                      │:27017 │ │:6379   │
                                      └───────┘ └────────┘
```

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Runtime |
| Express | 5.2.1 | HTTP framework |
| Socket.IO | 4.8.3 | Real-time WebSocket layer |
| Mongoose | 9.2.4 | MongoDB ODM |
| ioredis | 5.10.0 | Redis client |
| jsonwebtoken | 9.0.3 | JWT access & refresh tokens |
| bcryptjs | 3.0.3 | Password hashing |
| multer | 2.1.1 | File upload handling |
| express-validator | 7.3.1 | Input validation |
| cookie-parser | 1.4.7 | Cookie parsing |
| dotenv | 17.3.1 | Environment variable management |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.0 | UI framework |
| Vite | 7.3.1 | Build tool & dev server |
| React Router DOM | 7.13.1 | Client-side routing |
| Axios | 1.13.6 | HTTP client with interceptors |
| Socket.IO Client | 4.8.3 | Real-time WebSocket client |
| ESLint | 9.39.1 | Code linting |

### Infrastructure
| Technology | Version | Purpose |
|---|---|---|
| MongoDB | 7 | Primary database |
| Redis | 7-alpine | Caching, presence, rate limiting, token blacklisting |
| Docker Compose | 3.9 | Service orchestration |
| Nginx | Latest | Reverse proxy & SSL termination (production) |
| PM2 | Latest | Process manager (production) |

---

## Project Structure

```
PTM Chat/
├── README.md
├── db_design_documentation.md          # Detailed database schema docs
├── deployment_guide.md                 # Production deployment guide
├── nginx_configuration.md              # Nginx reverse proxy config
├── redis_documentation.md              # Redis usage & architecture docs
├── fixes_documentation.md              # Bug fixes changelog
├── walkthrough.md                      # Complete code flow walkthrough
│
├── backend/
│   ├── package.json                    # Dependencies & scripts
│   ├── docker-compose.yml              # MongoDB + Redis containers
│   ├── public/                         # Static files & uploads
│   │   └── profileImage/               # User profile pictures
│   └── src/
│       ├── app.js                      # Express + Socket.IO server entry
│       ├── config/
│       │   └── redis.js                # Redis client singleton (ioredis)
│       ├── db/
│       │   └── connection.js           # MongoDB connection via Mongoose
│       ├── middleware/
│       │   ├── auth-middleware.js       # JWT verification + Redis blacklist check
│       │   ├── admin-middleware.js      # roleId === 1 check
│       │   ├── id-checker-middleware.js # MongoDB ObjectId validation (24 chars)
│       │   └── rate-limiter.js         # Redis-based rate limiter factory
│       ├── routes/
│       │   ├── auth/
│       │   │   ├── auth-api.js         # Auth route definitions
│       │   │   └── auth-controller.js  # Register, Login, Logout, Refresh, Profile, Password
│       │   ├── user/
│       │   │   ├── user-api.js         # User CRUD route definitions
│       │   │   ├── user-controller.js  # User CRUD with pagination, search, sort
│       │   │   └── user-model.js       # Mongoose User schema
│       │   ├── conversation/
│       │   │   ├── conversation-api.js         # Conversation route definitions
│       │   │   ├── conversation-controller.js  # Create/get & list conversations
│       │   │   └── conversation-model.js       # Mongoose Conversation schema
│       │   ├── message/
│       │   │   ├── message-api.js         # Message route definitions
│       │   │   ├── message-controller.js  # Send, paginated history, mark-as-read
│       │   │   └── message-model.js       # Mongoose Message schema
│       │   ├── permission/
│       │   │   ├── permission-api.js         # Permission route definitions
│       │   │   ├── permission-controller.js  # Permission CRUD
│       │   │   └── permission-model.js       # Mongoose Permission schema
│       │   └── user-permission/
│       │       └── user-permission-model.js  # Mongoose UserPermission schema
│       ├── services/
│       │   ├── multer-service.js        # File upload config (profileImage)
│       │   └── sanitize-service.js      # Recursive HTML tag stripping
│       ├── helper/
│       │   └── validator.js             # Express-validator rules
│       └── socket/
│           └── socket.js                # Socket.IO event handlers & auth
│
├── frontend/
│   ├── package.json                     # Dependencies & scripts
│   ├── index.html                       # HTML template
│   ├── vite.config.js                   # Vite config (base: /ptm-chat/)
│   ├── eslint.config.js                 # ESLint flat config
│   └── src/
│       ├── main.jsx                     # React DOM entry point
│       ├── App.jsx                      # Router + AuthProvider + SocketProvider
│       ├── App.css
│       ├── index.css                    # Global styles (Inter font, CSS variables)
│       ├── context/
│       │   ├── AuthContext.jsx          # Auth state, login, register, logout, profile
│       │   └── SocketContext.jsx        # Socket.IO connection, events, online tracking
│       ├── pages/
│       │   ├── LoginPage.jsx            # Login form with validation
│       │   ├── RegisterPage.jsx         # Registration form with password confirmation
│       │   ├── ChatPage.jsx             # Main chat page (sidebar + chat window)
│       │   ├── AuthPages.css            # Auth page styles
│       │   └── ChatPage.css             # Chat layout styles
│       ├── components/
│       │   ├── Sidebar.jsx              # Conversation list, user profile, new chat
│       │   ├── Sidebar.css
│       │   ├── ChatWindow.jsx           # Message display, infinite scroll, typing, receipts
│       │   ├── ChatWindow.css
│       │   ├── MessageInput.jsx         # Message input with typing indicator emission
│       │   ├── MessageInput.css
│       │   ├── UserList.jsx             # User search modal for starting new chats
│       │   ├── UserList.css
│       │   ├── ProfileModal.jsx         # Profile editor + password change (tabbed)
│       │   ├── ProfileModal.css
│       │   └── ProtectedRoute.jsx       # Auth guard — redirects to /login
│       ├── utils/
│       │   └── api.js                   # Axios instance with JWT interceptor + auto refresh
│       └── assets/
│           └── react.svg
└──
```

---

## Database Design

Five MongoDB collections connected through ObjectId references:

```
User ──┬── participates in ──► Conversation ──── contains ──► Message
       │                              │
       ├── sends ────────────────────►│ (lastMessage ref)
```

### Collections

| Collection | Key Fields | Indexes | Purpose |
|---|---|---|---|
| **User** | `userName`, `firstName`, `lastName`, `email`, `password`, `roleId` (1-4), `pic`, `isOnline`, `lastSeen`, `isDeleted`, `refreshToken` | `email` (unique), `isOnline`, `isDeleted`, `{isDeleted, isOnline}` compound | User accounts with soft-delete & real-time presence |
| **Conversation** | `participants[]` (User refs), `lastMessage` (Message ref), `isDeleted` | `participants`, `updatedAt: -1` | 1-on-1 chat threads |
| **Message** | `conversationId`, `sender`, `content`, `readBy[]`, `isDeleted` | `conversationId`, `{conversationId, createdAt: -1}` compound | Individual messages with read receipts |

### Design Decisions
- **Soft delete** on Users, Conversations, and Messages — no data is physically removed
- **`lastMessage` denormalization** on Conversation — avoids N+1 queries for sidebar previews
- **`readBy` array** on Message — scales to group chats if needed
- **Compound index `{conversationId, createdAt: -1}`** — critical for paginated chat history performance
- **`isOnline`/`lastSeen` dual storage** — Redis for real-time, MongoDB as fallback across restarts

> See [db_design_documentation.md](db_design_documentation.md) for the full ER diagram and detailed schema documentation.

---

## Redis Usage

Redis serves as a complementary in-memory layer for speed-critical, short-lived data. If Redis goes down, the app degrades gracefully — requests fall through to MongoDB.

| # | Use Case | Redis Type | Key Pattern | Details |
|---|---|---|---|---|
| 1 | **Token Blacklisting** | `STRING` | `bl:{jwt_token}` | Revoked tokens stored with TTL matching token expiry. Every auth request checks Redis first. |
| 2 | **Online Presence** | `SET` | `online_users` | O(1) add/remove/check. Broadcast on connect/disconnect. |
| 3 | **Socket Session Mapping** | `HASH` | `socket_sessions` | Maps `userId → socketId` for targeted message delivery. |
| 4 | **Message Cache** | `LIST` | `chat:{conversationId}:messages` | Last 50 messages per conversation, 1-hour TTL. Page 1 served from cache. |
| 5 | **Rate Limiting** | `STRING` | `rl:{prefix}:{ip}` | Atomic `INCR` with auto-expiring keys. Login: 5 req/min, Messages: 20 req/10s. |

> See [redis_documentation.md](redis_documentation.md) for full implementation details with sequence diagrams.

---

## Setup & Installation

### Prerequisites
- **Node.js** v18+ (v20 LTS recommended)
- **MongoDB 7** (local, Docker, or Atlas)
- **Redis 7** (local or Docker)
- **Docker & Docker Compose** (optional, for MongoDB + Redis containers)

### 1. Clone the Repository

```bash
git clone <your-repo-url> ptm-chat
cd ptm-chat
```

### 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Start Infrastructure (Docker)

```bash
cd backend
docker compose up -d
```

This starts:
- **MongoDB 7** on port `27017` (with authentication)
- **Redis 7** on port `6379` (with password, AOF persistence, 256MB max memory)

Or start MongoDB and Redis manually if not using Docker.

---

## Environment Variables

Create `backend/.env`:

```env
# MongoDB
MONGODB_URI=mongodb://username:password@localhost:27017/ptm-chat?authSource=admin

# JWT
JWT_SECRET=your_64_char_hex_secret
JWT_REFRESH_SECRET=your_64_char_hex_refresh_secret

# Redis
REDIS_URL=redis://:your_redis_password@localhost:6379

# Server
PORT=4400
NODE_ENV=development

# CORS
CLIENT_URL=http://localhost:5173
```

Frontend environment (optional `frontend/.env`):

```env
VITE_API_URL=http://localhost:4400       # Defaults to /ptm-chat-api in production
VITE_SOCKET_URL=http://localhost:4400    # Defaults to window.location.origin
VITE_SOCKET_PATH=/socket.io             # Socket.IO path
```

---

## Running the Application

```bash
# Terminal 1 — Backend
cd backend
npm start
# Server starts on http://localhost:4400

# Terminal 2 — Frontend
cd frontend
npm run dev
# App available at http://localhost:5173/ptm-chat/
```

### Available Scripts

| Location | Command | Description |
|---|---|---|
| `backend/` | `npm start` | Start the Express + Socket.IO server |
| `frontend/` | `npm run dev` | Start Vite dev server with HMR |
| `frontend/` | `npm run build` | Production build to `dist/` |
| `frontend/` | `npm run preview` | Preview production build locally |
| `frontend/` | `npm run lint` | Run ESLint |

---

## API Reference

### Authentication — `/auth`

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/auth/register` | No | — | Register new user (userName, firstName, lastName, email, password) |
| POST | `/auth/login` | No | 5/min | Login → returns access + refresh tokens |
| POST | `/auth/logout` | Yes | — | Logout → blacklists token in Redis |
| POST | `/auth/refresh` | No | — | Refresh token → rotates both tokens |
| GET | `/auth/profile` | Yes | — | Get authenticated user's profile |
| PUT | `/auth/profile` | Yes | — | Update profile (firstName, lastName, userName, phone, address, dateOfBirth) |
| PUT | `/auth/change-password` | Yes | — | Change password (requires currentPassword + newPassword) |

### Users — `/user`

| Method | Endpoint | Auth | Middleware | Description |
|--------|----------|------|------------|-------------|
| GET | `/user/getAllUsers` | Yes | — | Paginated user list with search & sort (query param: `data` JSON) |
| GET | `/user/getUserById/:id` | Yes | idChecker | Get single user by ID |
| POST | `/user/addUser` | Yes | multer | Create user (supports profile image upload) |
| PUT | `/user/updateUser/:id` | Yes | idChecker, multer | Update user (supports profile image upload) |
| DELETE | `/user/deleteUser/:id` | Yes | idChecker | Soft delete user |

### Conversations — `/conversation`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/conversation` | Yes | Create new conversation or return existing one (body: `participantId`) |
| GET | `/conversation` | Yes | List authenticated user's conversations (sorted by most recent) |

### Messages — `/message`

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/message` | Yes | 20/10s | Send message (body: `conversationId`, `content`) |
| GET | `/message/:conversationId` | Yes | — | Paginated message history (query: `page`, `limit`) |
| PUT | `/message/read/:conversationId` | Yes | — | Mark all unread messages as read |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Returns `{ status: 'ok', timestamp }` |

---

## Socket.IO Events

### Authentication
Socket connections require a JWT token in the handshake:
```javascript
const socket = io(SOCKET_URL, {
    auth: { token: 'your_jwt_token' }
});
```
The server verifies the token, checks Redis blacklist, and loads the user before allowing the connection.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `joinConversation` | `conversationId` | Join a conversation room to receive messages |
| `leaveConversation` | `conversationId` | Leave a conversation room |
| `sendMessage` | `{ conversationId, content }` | Send a message (persists to DB + cache + broadcasts) |
| `typing` | `{ conversationId }` | Notify others that user is typing |
| `stopTyping` | `{ conversationId }` | Notify others that user stopped typing |
| `messageRead` | `{ conversationId, messageIds }` | Mark specific messages as read |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `newMessage` | `{ _id, conversationId, sender, content, readBy, createdAt }` | New message in a joined conversation |
| `conversationUpdated` | `{ conversationId, lastMessage }` | Sidebar update for participants not in the room |
| `userOnline` | `{ userId }` | A user came online |
| `userOffline` | `{ userId, lastSeen }` | A user went offline |
| `onlineUsers` | `[userId, ...]` | Full online users list (sent on connect) |
| `userTyping` | `{ userId, conversationId }` | Someone is typing in a conversation |
| `userStopTyping` | `{ userId, conversationId }` | Someone stopped typing |
| `messagesRead` | `{ conversationId, readBy, messageIds }` | Messages were read by a user |
| `newConversation` | `conversation` | A new conversation was created with you |
| `error` | `{ message }` | Socket error (e.g., failed message send) |

---

## Frontend Overview

### Routing

| Path | Component | Auth Required | Description |
|------|-----------|---------------|-------------|
| `/login` | LoginPage | No | Email + password login form |
| `/register` | RegisterPage | No | Registration with password confirmation |
| `/chat` | ChatPage | Yes (ProtectedRoute) | Main chat interface |
| `/*` | — | — | Redirects to `/chat` |

Base path: `/ptm-chat/` (configured in Vite and React Router)

### Context Providers
- **AuthProvider** — manages user state, tokens (localStorage), login/register/logout/profile actions
- **SocketProvider** — manages Socket.IO connection lifecycle, online user tracking, and provides `joinConversation`, `leaveConversation`, `sendMessage`, `emitTyping`, `emitStopTyping`, `markMessagesRead` functions

### Key Components
- **Sidebar** — conversation list with online indicators, last message preview, time formatting, skeleton loading, empty state, user profile section with logout
- **ChatWindow** — message display with infinite scroll (IntersectionObserver), auto-scroll to bottom, date separators, typing indicator bubbles, read receipt icons, "last seen" formatting
- **MessageInput** — text input with Enter-to-send, typing indicator emission with 2s debounce timeout
- **UserList** — modal for starting new chats with user search/filter and online status
- **ProfileModal** — tabbed modal for profile editing and password change
- **ProtectedRoute** — redirects unauthenticated users to `/login` with loading spinner

### API Client (`utils/api.js`)
- Axios instance with base URL (`VITE_API_URL` or `/ptm-chat-api`)
- Request interceptor: attaches `Authorization: Bearer {token}` from localStorage
- Response interceptor: on 401 → attempts token refresh → retries original request; on failure → clears storage, redirects to login

### Styling
- **CSS Variables** — theme tokens (colors, fonts, radius) in `:root`
- **Inter font** — loaded from Google Fonts
- **Light theme** — clean whites, subtle borders, indigo (#4f46e5) accent
- **Responsive** — mobile sidebar with full-width slide-in, back button in chat header
- **Custom scrollbar** — thin 5px scrollbar with rounded thumb

---

## Security

| Layer | Implementation |
|---|---|
| **Authentication** | JWT access tokens (1d) + refresh tokens (7d) with rotation |
| **Token Revocation** | Redis blacklist — revoked tokens checked on every request |
| **Password Storage** | bcryptjs with salt rounds of 10 |
| **Rate Limiting** | Redis-backed per-IP rate limiting (login: 5/min, messages: 20/10s) |
| **Input Sanitization** | Recursive HTML tag stripping (`sanitize-service.js`) on all user-submitted data |
| **CORS** | Configurable origin with credentials support |
| **Socket Auth** | JWT verified on WebSocket handshake; blacklist checked before connection |
| **ID Validation** | Middleware validates MongoDB ObjectId format before DB queries |
| **Soft Delete** | Users and messages are never physically deleted — audit trail preserved |
| **Security Headers** | X-Frame-Options, X-Content-Type-Options, HSTS, XSS-Protection (via Nginx) |

---

## Deployment

### Docker Compose (Development)

The included `docker-compose.yml` starts MongoDB and Redis:

```bash
cd backend
docker compose up -d
```

Services:
- **MongoDB 7** — port 27017 (bound to `10.0.0.252`), authenticated, data persisted to `./data`
- **Redis 7-alpine** — port 6379 (bound to `10.0.0.252`), password-protected, AOF enabled, 256MB max with LRU eviction

### Production

1. **Build frontend**: `cd frontend && npm run build`
2. **Serve static files** via Nginx from `frontend/dist/`
3. **Run backend** via PM2: `pm2 start backend/src/app.js --name ptm-chat`
4. **Configure Nginx** as reverse proxy with SSL termination

> See [deployment_guide.md](deployment_guide.md) for the complete production deployment walkthrough including server setup, PM2 configuration, SSL certificates, firewall rules, and backup strategy.

> See [nginx_configuration.md](nginx_configuration.md) for the full Nginx config that merges PTM Chat into an existing server block.

---

## Documentation

| Document | Description |
|---|---|
| [db_design_documentation.md](db_design_documentation.md) | Full database schema with ER diagram, field definitions, indexes, and design decisions |
| [redis_documentation.md](redis_documentation.md) | Redis architecture, all 5 use-cases with sequence diagrams and key patterns |
| [deployment_guide.md](deployment_guide.md) | Step-by-step production deployment (Ubuntu, Docker, Nginx, PM2, SSL, backups) |
| [nginx_configuration.md](nginx_configuration.md) | Complete Nginx reverse proxy configuration with merged server block |
