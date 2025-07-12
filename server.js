// server.js
require('dotenv').config();

const express  = require('express');
const http     = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' }
});

// MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

app.use(express.static('public'));

// In-memory cache of the last offer per room (optional)
const roomOffers = {};

// Signaling & chat
io.on('connection', socket => {
  console.log('🔌', socket.id, 'connected');

  socket.on('join', room => {
    socket.join(room);
    console.log(`${socket.id} joined ${room}`);
    // Immediately relay existing offer if there is one
    if (roomOffers[room]) {
      socket.emit('offer', {
        from:    null,           // admin socket.id not needed here
        room,
        offer:   roomOffers[room]
      });
    }
    // Tell Admin a new student arrived
    socket.to(room).emit('user-joined', socket.id);
  });

  socket.on('offer', data => {
    // Cache the last offer for new joiners (optional)
    roomOffers[data.room] = data.offer;

    const payload = {
      from:  socket.id,
      room:  data.room,
      offer: data.offer
    };
    if (data.to) {
      socket.to(data.to).emit('offer', payload);
    } else {
      socket.to(data.room).emit('offer', payload);
    }
  });

  socket.on('answer', data => {
    const payload = {
      from:     socket.id,
      room:     data.room,
      answer:   data.answer
    };
    // route back to Admin
    socket.to(data.to).emit('answer', payload);
  });

  socket.on('ice-candidate', data => {
    const payload = {
      from:      socket.id,
      room:      data.room,
      candidate: data.candidate
    };
    // route to intended peer
    socket.to(data.to).emit('ice-candidate', payload);
  });

  socket.on('chat-message', data => {
    io.in(data.room).emit('chat-message', data);
  });

  socket.on('disconnect', () => {
    console.log('❌', socket.id, 'disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
