# PTM Chat — Real-Time Chat Application

A scalable real-time chat application built with **Node.js**, **Express**, **Socket.IO**, **MongoDB**, **Redis**, and **React**.

![Tech Stack](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socket.io&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)

---

## Features

### Authentication & Authorization
- User registration with validation
- JWT-based login with access + refresh tokens
- Secure logout with Redis token blacklisting
- Token refresh endpoint for seamless session management
- Protected API routes with middleware

### Chat Features
- **One-to-one** real-time messaging via Socket.IO
- Message persistence in MongoDB
- Paginated chat history loading
- **Typing indicators** (live typing/stop-typing events)
- **Online/Offline status** with real-time updates
- **Last seen** timestamps
- **Read receipts** (single/double check marks)
- Message timestamps with smart date grouping

### Redis Usage (4 use-cases)
| Use Case | Data Structure | Details |
|----------|---------------|---------|
| Online presence | `SET online_users` | Track active users |
| Socket session mapping | `HASH socket_sessions` | Map `userId → socketId` |
| Recent messages cache | `LIST chat:{id}:messages` | Cache last 50 messages/conversation |
| Rate limiting | `STRING ratelimit:{ip}:{endpoint}` | Throttle login & message spam |

### Database Design
- **Users** — with soft delete, online status, last seen, refresh token
- **Conversations** — participant references, last message tracking
- **Messages** — conversation-scoped, read receipts, soft delete
- Proper indexing (compound indexes on hot query paths)

---

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────────┐
│   React App  │ ◄─────────────────► │  Socket.IO Server│
│  (Vite Dev)  │     HTTP REST      │                  │
│  Port 5173   │ ◄─────────────────► │  Express Server  │
└──────────────┘                    │  Port 4400       │
                                    └────────┬─────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                         ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
                         │ MongoDB │   │   Redis   │  │  JWT    │
                         │         │   │           │  │ Auth    │
                         └─────────┘   └───────────┘  └─────────┘
```

---

## Project Structure

```
PTM Chat/
├── backend/
│   ├── src/
│   │   ├── app.js                    # Express + Socket.IO server
│   │   ├── config/
│   │   │   └── redis.js              # Redis client singleton
│   │   ├── db/
│   │   │   └── connection.js         # MongoDB connection
│   │   ├── middleware/
│   │   │   ├── auth-middleware.js     # JWT verification + Redis blacklist
│   │   │   ├── rate-limiter.js       # Redis-based rate limiting
│   │   │   ├── admin-middleware.js
│   │   │   └── id-checker-middleware.js
│   │   ├── routes/
│   │   │   ├── auth/                 # Register, Login, Logout, Refresh
│   │   │   ├── user/                 # User CRUD
│   │   │   ├── conversation/         # Conversation create/list
│   │   │   ├── message/              # Send, History, Read receipts
│   │   │   └── permission/           # Permission management
│   │   ├── socket/
│   │   │   └── socket.js             # Socket.IO event handlers
│   │   ├── helper/
│   │   └── services/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Router + Providers
│   │   ├── main.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       # Auth state management
│   │   │   └── SocketContext.jsx     # Socket.IO connection
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── AuthPages.css
│   │   │   └── ChatPage.css
│   │   ├── components/
│   │   │   ├── Sidebar.jsx           # Conversation list
│   │   │   ├── ChatWindow.jsx        # Message display
│   │   │   ├── MessageInput.jsx      # Input + typing events
│   │   │   ├── UserList.jsx          # New chat modal
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── *.css
│   │   └── utils/
│   │       └── api.js                # Axios with JWT interceptor
│   ├── index.html
│   └── package.json
│
└── README.md
```

---

## Setup & Installation

### Prerequisites
- **Node.js** v18+
- **MongoDB** (local or Atlas)
- **Redis** (local or cloud) — [Install Redis](https://redis.io/download)

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Environment Variables

Create `backend/.env` from the example:

```bash
cp backend/.env.example backend/.env
```

Then fill in:

```env
MONGODB_URI=mongodb://localhost:27017/ptm-chat
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here
REDIS_URL=redis://localhost:6379
PORT=4400
CLIENT_URL=http://localhost:5173
```

### 3. Start Services

```bash
# Start MongoDB (if local)
mongod

# Start Redis (if local)
redis-server
```

### 4. Run the Application

```bash
# Terminal 1 — Backend
cd backend
npm start

# Terminal 2 — Frontend
cd frontend
npm run dev
```

The app will be available at **http://localhost:5173**

---

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login (rate-limited) | No |
| POST | `/auth/logout` | Logout + blacklist token | Yes |
| POST | `/auth/refresh` | Refresh access token | No |
| GET | `/auth/profile` | Get own profile | Yes |

### Users
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/user/getAllUsers` | List all users | Yes |
| GET | `/user/getUserById/:id` | Get user by ID | Yes |

### Conversations
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/conversation` | Create/get 1-to-1 conversation | Yes |
| GET | `/conversation` | List user's conversations | Yes |

### Messages
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/message` | Send message (rate-limited) | Yes |
| GET | `/message/:conversationId?page=1&limit=30` | Get chat history | Yes |
| PUT | `/message/read/:conversationId` | Mark messages as read | Yes |

### Socket.IO Events

**Client → Server:**
- `joinConversation(conversationId)`
- `leaveConversation(conversationId)`
- `sendMessage({ conversationId, content })`
- `typing({ conversationId })`
- `stopTyping({ conversationId })`
- `messageRead({ conversationId, messageIds })`

**Server → Client:**
- `newMessage(message)` — new message in conversation
- `conversationUpdated({ conversationId, lastMessage })`
- `userOnline({ userId })`
- `userOffline({ userId, lastSeen })`
- `onlineUsers([userId, ...])` — initial list on connect
- `userTyping({ userId, conversationId })`
- `userStopTyping({ userId, conversationId })`
- `messagesRead({ conversationId, readBy, messageIds })`

---

## Deployment

### Docker (Optional)

```yaml
# docker-compose.yml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "4400:4400"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/ptm-chat
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"

volumes:
  mongo-data:
```

### Production
```bash
# Build frontend
cd frontend
npm run build

# Serve with any static file server or integrate with Express
```

---

## License

ISC
