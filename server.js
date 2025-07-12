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
  cors: { origin: '*' }
});

// 1) MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// 2) Static file serving
app.use(express.static(path.join(__dirname, 'public')));
app.get('/',      (req, res) => res.redirect('/student.html'));
app.get('/admin.html',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/student.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'student.html')));

// 3) Build ICE server list with STUN + public TURN
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls:       'turn:numb.viagenie.ca:3478',
    username:   'webrtc@live.com',
    credential: 'muazkh'
  }
];
console.log('🔹 Using ICE servers:', iceServers);

// 4) Signaling & chat
const roomOffers = {};

io.on('connection', socket => {
  console.log('🔌', socket.id, 'connected');

  socket.on('join', room => {
    socket.join(room);
    console.log(`${socket.id} → joined ${room}`);
    // If an offer is already live, send it immediately
    if (roomOffers[room]) {
      socket.emit('offer', { from: null, room, offer: roomOffers[room] });
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

// 5) Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 running at http://localhost:${PORT}`);
});
