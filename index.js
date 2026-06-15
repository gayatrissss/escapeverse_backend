import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import gameRoutes from './routes/game.js';
import roomRoutes from './routes/room.js';
import puzzleRoutes from './routes/puzzle.js';
import inventoryRoutes from './routes/inventory.js';
import leaderboardRoutes from './routes/leaderboard.js';
import shopRoutes from './routes/shop.js';
import achievementRoutes from './routes/achievement.js';
import friendsRoutes from './routes/friends.js';
import chatRoutes from './routes/chat.js';
import dailyRoutes from './routes/daily.js';
import { setupSocket } from './socket/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] }
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased for game interactions + StrictMode double-invokes
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/room', roomRoutes);
app.use('/api/puzzle', puzzleRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/achievement', achievementRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/daily', dailyRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Socket.io
setupSocket(io);

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.io ready for connections`);
  });
});

export { io };
