import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ChatMessage from '../models/ChatMessage.js';
import GameSession from '../models/GameSession.js';

const onlineUsers = new Map();
const roomTimers = new Map();

export const setupSocket = (io) => {
  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('username avatar level');
      if (!user) return next(new Error('User not found'));

      socket.userId = decoded.id;
      socket.username = user.username;
      socket.avatar = user.avatar;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Connected: ${socket.username} (${socket.id})`);
    onlineUsers.set(socket.userId, { socketId: socket.id, username: socket.username });

    // Join room
    socket.on('joinRoom', async ({ roomId }) => {
      socket.join(roomId);
      socket.currentRoom = roomId;

      io.to(roomId).emit('playerJoined', {
        userId: socket.userId,
        username: socket.username,
        avatar: socket.avatar,
        playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
      });

      // System message
      const sysMsg = await ChatMessage.create({
        roomId, userId: socket.userId, username: 'System',
        message: `${socket.username} joined the room`, type: 'system'
      });
      io.to(roomId).emit('chatMessage', sysMsg);
    });

    // Leave room
    socket.on('leaveRoom', async ({ roomId }) => {
      socket.leave(roomId);
      io.to(roomId).emit('playerLeft', {
        userId: socket.userId, username: socket.username,
        playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
      });

      const sysMsg = await ChatMessage.create({
        roomId, userId: socket.userId, username: 'System',
        message: `${socket.username} left the room`, type: 'system'
      });
      io.to(roomId).emit('chatMessage', sysMsg);
    });

    // Ready check
    socket.on('playerReady', ({ roomId, ready }) => {
      io.to(roomId).emit('playerReady', {
        userId: socket.userId, username: socket.username, ready
      });
    });

    // Chat message
    socket.on('chatMessage', async ({ roomId, message }) => {
      if (!message || message.length > 500) return;
      const chatMsg = await ChatMessage.create({
        roomId, userId: socket.userId, username: socket.username,
        message, type: 'text'
      });
      const populated = await ChatMessage.findById(chatMsg._id)
        .populate('userId', 'username avatar');
      io.to(roomId).emit('chatMessage', populated);
    });

    // Item collected
    socket.on('itemCollected', ({ roomId, item }) => {
      io.to(roomId).emit('itemCollected', {
        userId: socket.userId, username: socket.username, item
      });
    });

    // Hint used
    socket.on('hintUsed', ({ roomId, puzzleId, hintLevel, hint }) => {
      io.to(roomId).emit('hintUsed', {
        userId: socket.userId, username: socket.username,
        puzzleId, hintLevel, hint
      });
    });

    // Puzzle solved
    socket.on('puzzleSolved', ({ roomId, puzzleId, puzzleName, points }) => {
      io.to(roomId).emit('puzzleSolved', {
        userId: socket.userId, username: socket.username,
        puzzleId, puzzleName, points
      });
    });

    // Door unlocked
    socket.on('doorUnlocked', ({ roomId, doorName }) => {
      io.to(roomId).emit('doorUnlocked', {
        userId: socket.userId, username: socket.username, doorName
      });
    });

    // Timer sync
    socket.on('timerSync', ({ roomId, timer }) => {
      io.to(roomId).emit('timerUpdated', { timer });
    });

    // Start timer for room
    socket.on('startTimer', ({ roomId, duration, sessionId }) => {
      if (roomTimers.has(roomId)) clearInterval(roomTimers.get(roomId));

      let timeLeft = duration;
      const interval = setInterval(async () => {
        timeLeft -= 1;
        io.to(roomId).emit('timerUpdated', { timer: timeLeft });

        if (timeLeft <= 0) {
          clearInterval(interval);
          roomTimers.delete(roomId);
          io.to(roomId).emit('gameLost', { message: 'Time is up!' });

          if (sessionId) {
            try {
              const session = await GameSession.findById(sessionId);
              if (session && session.status === 'active') {
                session.status = 'failed';
                session.endTime = new Date();
                session.timerActive = false;
                await session.save();
              }
            } catch (e) { console.error('Timer end error:', e); }
          }
        }
      }, 1000);

      roomTimers.set(roomId, interval);
    });

    // Stop timer
    socket.on('stopTimer', ({ roomId }) => {
      if (roomTimers.has(roomId)) {
        clearInterval(roomTimers.get(roomId));
        roomTimers.delete(roomId);
      }
    });

    // Game won
    socket.on('gameWon', ({ roomId, sessionId, scores }) => {
      if (roomTimers.has(roomId)) {
        clearInterval(roomTimers.get(roomId));
        roomTimers.delete(roomId);
      }
      io.to(roomId).emit('gameWon', { sessionId, scores });
    });

    // Cursor move
    socket.on('cursorMove', ({ roomId, x, y }) => {
      socket.to(roomId).emit('cursorMove', {
        userId: socket.userId, username: socket.username, x, y
      });
    });

    // Typing indicator
    socket.on('typingStart', ({ roomId }) => {
      socket.to(roomId).emit('typingIndicator', {
        userId: socket.userId, username: socket.username, typing: true
      });
    });

    socket.on('typingStop', ({ roomId }) => {
      socket.to(roomId).emit('typingIndicator', {
        userId: socket.userId, username: socket.username, typing: false
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.username}`);
      onlineUsers.delete(socket.userId);

      if (socket.currentRoom) {
        io.to(socket.currentRoom).emit('playerLeft', {
          userId: socket.userId, username: socket.username,
          playerCount: io.sockets.adapter.rooms.get(socket.currentRoom)?.size || 0
        });
      }

      io.emit('onlineUsers', Array.from(onlineUsers.values()));
    });
  });
};
