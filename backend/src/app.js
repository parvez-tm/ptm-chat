import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import 'dotenv/config';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './db/connection.js';
import { initializeSocket } from './socket/socket.js';

// Route imports
import authRoute from './routes/auth/auth-api.js';
import userRoute from './routes/user/user-api.js';
import permissionRoute from './routes/permission/permission-api.js';
import conversationRoute from './routes/conversation/conversation-api.js';
import messageRoute from './routes/message/message-api.js';

const app = express();
const server = createServer(app);
const port = process.env.PORT || 4400;

// CORS configuration
const corsOptions = {
   origin: process.env.CLIENT_URL || '*',
   methods: ['GET', 'POST', 'PUT', 'DELETE'],
   credentials: true
};

// Socket.IO setup
const io = new Server(server, {
   cors: corsOptions,
   pingTimeout: 60000,
   pingInterval: 25000
});

// Connect to MongoDB
connectDB();

// Initialize Socket.IO handlers
initializeSocket(io);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use('/public', express.static('./public'));

// Routes
app.use('/auth', authRoute);
app.use('/user', userRoute);
app.use('/permission', permissionRoute);
app.use('/conversation', conversationRoute);
app.use('/message', messageRoute);

// Health check
app.get('/health', (req, res) => {
   res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
server.listen(port, () => {
   console.log(`🚀 PTM Chat server running on port ${port}`);
});

// Make io accessible to routes if needed
export { io };