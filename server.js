const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Serve static frontend files from public folder
app.use(express.static('public'));

// Fallback route - important for Render deployment
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// In-memory storage
const sessions = new Map();
const users = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createSession', (data) => {
    const { username } = data;
    const sessionId = generateRoomCode();
    const userId = uuidv4();

    const session = {
      id: sessionId,
      gameMaster: { id: userId, username, socketId: socket.id },
      players: [{ id: userId, username, score: 0, socketId: socket.id }],
      status: 'lobby',
      currentQuestion: null,
      timerEnd: null,
      roundNumber: 0,
      messages: []
    };

    sessions.set(sessionId, session);
    users.set(socket.id, { userId, username, sessionId });

    socket.join(`room:${sessionId}`);
    
    socket.emit('sessionCreated', { sessionId, session });
    io.to(`room:${sessionId}`).emit('playerJoined', { players: session.players });
  });

  socket.on('joinSession', (data) => {
    const { sessionId, username } = data;
    const session = sessions.get(sessionId);

    if (!session || session.status !== 'lobby') {
      socket.emit('error', { message: 'Session not found or already in progress' });
      return;
    }

    const userId = uuidv4();
    const player = { id: userId, username, score: 0, socketId: socket.id };

    session.players.push(player);
    users.set(socket.id, { userId, username, sessionId });

    socket.join(`room:${sessionId}`);

    io.to(`room:${sessionId}`).emit('playerJoined', { 
      players: session.players,
      message: `${username} joined the game!`
    });
  });

  socket.on('startGame', (data) => {
    const { sessionId } = data;
    const session = sessions.get(sessionId);

    if (!session || session.gameMaster.socketId !== socket.id) {
      socket.emit('error', { message: 'Not authorized' });
      return;
    }

    if (session.players.length < 3) {
      socket.emit('error', { message: 'Need at least 3 players' });
      return;
    }

    session.status = 'playing';
    session.roundNumber++;

    io.to(`room:${sessionId}`).emit('gameStarted', { 
      status: session.status,
      roundNumber: session.roundNumber 
    });
  });

  socket.on('createQuestion', (data) => {
    const { sessionId, question, answer } = data;
    const session = sessions.get(sessionId);

    if (!session || session.gameMaster.socketId !== socket.id || session.status !== 'playing') {
      socket.emit('error', { message: 'Not authorized or invalid state' });
      return;
    }

    session.currentQuestion = {
      question,
      answer: answer.toLowerCase().trim(),
      attempts: new Map()
    };

    io.to(`room:${sessionId}`).emit('questionCreated', { 
      question,
      timeLeft: 60
    });

    const timerEnd = Date.now() + 60000;
    session.timerEnd = timerEnd;

    const timerInterval = setInterval(() => {
      const now = Date.now();
      const timeLeft = Math.max(0, Math.ceil((timerEnd - now) / 1000));

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        endRound(sessionId, false);
      } else {
        io.to(`room:${sessionId}`).emit('timerUpdate', { timeLeft });
      }
    }, 1000);
  });

  socket.on('makeGuess', (data) => {
    const { sessionId, guess } = data;
    const session = sessions.get(sessionId);
    const user = users.get(socket.id);

    if (!session || session.status !== 'playing' || !session.currentQuestion) {
      socket.emit('error', { message: 'Invalid game state' });
      return;
    }

    const playerId = user.userId;
    const q = session.currentQuestion;
    
    if (!q.attempts.has(playerId)) q.attempts.set(playerId, 0);
    const attempts = q.attempts.get(playerId);
    
    if (attempts >= 3) {
      socket.emit('error', { message: 'No attempts left' });
      return;
    }

    q.attempts.set(playerId, attempts + 1);

    const normalizedGuess = guess.toLowerCase().trim();

    if (normalizedGuess === q.answer) {
      const winner = session.players.find(p => p.id === playerId);
      winner.score += 10;
      endRound(sessionId, true, winner);
    } else {
      socket.emit('guessResult', { 
        correct: false, 
        attemptsLeft: 3 - q.attempts.get(playerId) 
      });
    }
  });

  function endRound(sessionId, hasWinner, winner = null) {
    const session = sessions.get(sessionId);
    if (!session) return;

    session.status = 'finished';
    const answer = session.currentQuestion ? session.currentQuestion.answer : '';

    io.to(`room:${sessionId}`).emit('roundEnded', {
      hasWinner,
      winner: winner ? { username: winner.username, score: winner.score } : null,
      answer: hasWinner ? '' : answer,
      players: session.players
    });

    setTimeout(() => {
      if (session.players.length > 0) {
        const currentGmIndex = session.players.findIndex(p => p.id === session.gameMaster.id);
        const nextGmIndex = (currentGmIndex + 1) % session.players.length;
        const nextGm = session.players[nextGmIndex];
        
        session.gameMaster = { 
          id: nextGm.id, 
          username: nextGm.username, 
          socketId: nextGm.socketId 
        };
      }

      session.status = 'lobby';
      session.currentQuestion = null;
      session.timerEnd = null;

      io.to(`room:${sessionId}`).emit('nextRoundReady', {
        newGameMaster: session.gameMaster.username,
        players: session.players
      });
    }, 5000);
  }

  socket.on('leaveSession', (data) => {
    const { sessionId } = data;
    const user = users.get(socket.id);
    const session = sessions.get(sessionId);

    if (session && user) {
      session.players = session.players.filter(p => p.socketId !== socket.id);
      
      if (session.players.length === 0) {
        sessions.delete(sessionId);
      } else if (session.gameMaster.socketId === socket.id && session.players.length > 0) {
        session.gameMaster = { 
          id: session.players[0].id, 
          username: session.players[0].username, 
          socketId: session.players[0].socketId 
        };
      }

      io.to(`room:${sessionId}`).emit('playerLeft', { players: session.players });
    }

    users.delete(socket.id);
    socket.leave(`room:${sessionId}`);
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.emit('leaveSession', { sessionId: user.sessionId });
    }
  });

  socket.on('chatMessage', (data) => {
    const { sessionId, message } = data;
    const user = users.get(socket.id);
    if (user && sessions.has(sessionId)) {
      const chatMsg = {
        username: user.username,
        message,
        timestamp: Date.now()
      };
      sessions.get(sessionId).messages.push(chatMsg);
      io.to(`room:${sessionId}`).emit('chatMessage', chatMsg);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});