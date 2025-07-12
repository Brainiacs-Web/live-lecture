// server.js
require('dotenv').config();

const path     = require('path');
const express  = require('express');
const http     = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' }
});

// ——————————————————————————————————————————
// 1) MongoDB Atlas Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// ——————————————————————————————————————————
// 2) Static & File Routes

// Serve everything in /public as static
app.use(express.static(path.join(__dirname, 'public')));

// Root redirect to student page
app.get('/', (req, res) => {
  res.redirect('/student.html');
});

// Explicit routes (optional, but ensures Render can find them)
app.get('/student.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ——————————————————————————————————————————
// 3) WebRTC Signaling & Chat
// (unchanged from before; adjust as needed)
const roomOffers = {};

io.on('connection', socket => {
  console.log('🔌', socket.id, 'connected');

  socket.on('join', room => {
    socket.join(room);
    console.log(`${socket.id} joined ${room}`);

    // Send existing offer to late joiners
    if (roomOffers[room]) {
      socket.emit('offer', {
        from:  null,
        room,
        offer: roomOffers[room]
      });
    }
    socket.to(room).emit('user-joined', socket.id);
  });

  socket.on('offer', data => {
    roomOffers[data.room] = data.offer;
    const payload = { from: socket.id, room: data.room, offer: data.offer };
    if (data.to) socket.to(data.to).emit('offer', payload);
    else         socket.to(data.room).emit('offer', payload);
  });

  socket.on('answer', data => {
    socket.to(data.to).emit('answer', {
      from:   socket.id,
      room:   data.room,
      answer: data.answer
    });
  });

  socket.on('ice-candidate', data => {
    socket.to(data.to).emit('ice-candidate', {
      from:      socket.id,
      room:      data.room,
      candidate: data.candidate
    });
  });

  socket.on('chat-message', data => {
    io.in(data.room).emit('chat-message', data);
  });

  socket.on('disconnect', () => {
    console.log('❌', socket.id, 'disconnected');
  });
});

// ——————————————————————————————————————————
// 4) Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
