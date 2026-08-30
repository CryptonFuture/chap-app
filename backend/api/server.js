const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const User = require('./models/User');
const Message = require('./models/Message');
const Group = require('./models/Group');

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: 1e7 // 10MB for large payloads if needed
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Chat App API is running - Groups & File Uploads enabled' });
});

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Online users: userId -> socketId
const onlineUsers = new Map();

// Socket auth
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new Error('User not found'));
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  const userId = socket.user._id.toString();
  console.log(`User connected: ${socket.user.username} (${userId})`);

  onlineUsers.set(userId, socket.id);
  await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

  io.emit('userOnline', { userId, username: socket.user.username });
  socket.emit('onlineUsers', Array.from(onlineUsers.keys()));
  socket.join(userId);

  // Join all group rooms user is member of
  try {
    const groups = await Group.find({ members: userId }).select('_id');
    groups.forEach(g => socket.join(`group_${g._id}`));
  } catch (e) {
    console.error('Error joining groups:', e);
  }

  // ---- Public message ----
  socket.on('sendPublicMessage', async (data) => {
    try {
      const { content, messageType, fileUrl, fileName, fileSize } = data;
      if (!content && !fileUrl) return;

      const message = await Message.create({
        sender: userId,
        receiver: null,
        group: null,
        content: content || '',
        messageType: messageType || 'text',
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null
      });

      const populated = await Message.findById(message._id)
        .populate('sender', 'username avatar');

      io.emit('newPublicMessage', populated);
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // ---- Private message ----
  socket.on('sendPrivateMessage', async (data) => {
    try {
      const { receiverId, content, messageType, fileUrl, fileName, fileSize } = data;
      if (!receiverId || (!content && !fileUrl)) return;

      const message = await Message.create({
        sender: userId,
        receiver: receiverId,
        group: null,
        content: content || '',
        messageType: messageType || 'text',
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null
      });

      const populated = await Message.findById(message._id)
        .populate('sender', 'username avatar')
        .populate('receiver', 'username avatar');

      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newPrivateMessage', populated);
      }
      socket.emit('newPrivateMessage', populated);
    } catch (error) {
      socket.emit('error', { message: 'Failed to send private message' });
    }
  });

  // ---- Group message ----
  socket.on('sendGroupMessage', async (data) => {
    try {
      const { groupId, content, messageType, fileUrl, fileName, fileSize } = data;
      if (!groupId || (!content && !fileUrl)) return;

      const group = await Group.findById(groupId);
      if (!group) return;

      const isMember = group.members.some(m => m.toString() === userId);
      if (!isMember) {
        socket.emit('error', { message: 'Not a member of this group' });
        return;
      }

      const message = await Message.create({
        sender: userId,
        receiver: null,
        group: groupId,
        content: content || '',
        messageType: messageType || 'text',
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null
      });

      const populated = await Message.findById(message._id)
        .populate('sender', 'username avatar');

      io.to(`group_${groupId}`).emit('newGroupMessage', populated);
    } catch (error) {
      socket.emit('error', { message: 'Failed to send group message' });
    }
  });

  // Join a new group room (after creating/joining)
  socket.on('joinGroup', (groupId) => {
    if (groupId) socket.join(`group_${groupId}`);
  });

  // Typing
  socket.on('typing', (data) => {
    if (data.groupId) {
      socket.to(`group_${data.groupId}`).emit('userTyping', {
        userId,
        username: socket.user.username,
        groupId: data.groupId
      });
    } else if (data.receiverId) {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userTyping', {
          userId,
          username: socket.user.username
        });
      }
    } else {
      socket.broadcast.emit('userTyping', {
        userId,
        username: socket.user.username,
        isPublic: true
      });
    }
  });

  socket.on('stopTyping', (data) => {
    if (data.groupId) {
      socket.to(`group_${data.groupId}`).emit('userStopTyping', { userId, groupId: data.groupId });
    } else if (data.receiverId) {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userStopTyping', { userId });
      }
    } else {
      socket.broadcast.emit('userStopTyping', { userId, isPublic: true });
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.user.username}`);
    onlineUsers.delete(userId);
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
    io.emit('userOffline', { userId });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
