const sessionManager = require('../models/sessionManager');

function initializeGameSockets(io) {

  io.on('connection', (socket) => {

    console.log(`User connected: ${socket.id}`);

    socket.on('createSession', ({ username }) => {
      if (!username || username.trim().length < 2 || username.length > 20) {
        return socket.emit('error', { message: 'Username must be 2-20 characters' });
      }

      const session = sessionManager.createSession(socket.id, username.trim());
      socket.join(session.id);

      socket.emit('sessionCreated', {
        sessionId: session.id,
        role: 'gamemaster',
        players: session.getPlayersList()
      });
    });

    socket.on('joinSession', ({ sessionId, username }) => {
      if (!username || username.trim().length < 2 || username.length > 20) {
        return socket.emit('error', { message: 'Username must be 2-20 characters' });
      }
      if (!sessionId || sessionId.length !== 6) {
        return socket.emit('error', { message: 'Invalid room code' });
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) return socket.emit('error', { message: 'Session not found' });
      if (session.status !== 'lobby') {
        return socket.emit('error', { message: 'Game already in progress' });
      }
      if (session.players.has(socket.id)) {
        return socket.emit('error', { message: 'Already connected' });
      }

      const success = session.addPlayer(socket.id, username.trim());
      if (!success) return socket.emit('error', { message: 'Failed to join' });

      socket.join(session.id);

      io.to(session.id).emit('playerJoined', {
        players: session.getPlayersList(),
        message: `${username} joined the game`
      });

      socket.emit('sessionJoined', {
        sessionId: session.id,
        role: session.isGameMaster(socket.id) ? 'gamemaster' : 'player',
        players: session.getPlayersList(),
        status: session.status
      });
    });

    socket.on('leaveSession', () => handlePlayerLeave(socket));

    // GAME FLOW
    socket.on('createQuestion', ({ sessionId, question, answer }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session || !session.isGameMaster(socket.id)) {
        return socket.emit('error', { message: 'Not authorized' });
      }
      if (!question || question.trim().length < 5 || !answer || answer.trim().length < 1) {
        return socket.emit('error', { message: 'Question must be at least 5 characters' });
      }

      session.currentQuestion = question.trim();
      session.correctAnswer = answer.toLowerCase().trim();

      io.to(session.id).emit('questionCreated', { question: session.currentQuestion });
    });

    socket.on('startGame', ({ sessionId }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session || !session.isGameMaster(socket.id)) return socket.emit('error', { message: 'Not authorized' });
      if (session.getPlayerCount() < 3) return socket.emit('error', { message: 'At least 2 players needed' });
      if (!session.currentQuestion) return socket.emit('error', { message: 'Create a question first' });

      session.startRound(session.currentQuestion, session.correctAnswer);
      startTimer(session, sessionId);

      io.to(session.id).emit('gameStarted', { question: session.currentQuestion });
    });

    socket.on('submitGuess', ({ sessionId, guess }) => {
      const session = sessionManager.getSession(sessionId);
      if (!session || session.status !== 'playing') return socket.emit('error', { message: 'No active round' });

      const player = session.players.get(socket.id);
      if (!player) return;
      if (!player.hasAttemptsLeft()) return socket.emit('error', { message: 'No attempts left' });

      player.useAttempt();
      const isCorrect = guess.toLowerCase().trim() === session.correctAnswer;

      socket.emit('guessResult', { correct: isCorrect, attemptsUsed: player.attemptsUsed });

      if (isCorrect) {
        player.incrementScore(10);
        endRound(session, sessionId, player);
      }
    });

    socket.on('disconnect', () => handlePlayerLeave(socket));

    // Helper Functions
    function handlePlayerLeave(socket) {
      for (const [sessionId, session] of sessionManager.sessions.entries()) {
        if (!session.players.has(socket.id)) continue;

        const player = session.players.get(socket.id);
        const wasGM = session.isGameMaster(socket.id);

        session.removePlayer(socket.id);
        socket.leave(sessionId);

        if (session.getPlayerCount() === 0) {
          sessionManager.deleteSession(sessionId);
          return;
        }

        if (wasGM && session.getPlayerCount() > 0) {
          const nextId = session.players.keys().next().value;
          session.changeGameMaster(nextId);
          io.to(sessionId).emit('nextRoundReady', {
            newGameMaster: session.players.get(nextId).username,
            players: session.getPlayersList()
          });
        }

        io.to(sessionId).emit('playerLeft', {
          players: session.getPlayersList(),
          message: `${player.username} left the session`
        });
        break;
      }
    }

    function startTimer(session, sessionId) {
      if (session.timerInterval) clearInterval(session.timerInterval);
      let timeLeft = session.timerDuration;

      session.timerInterval = setInterval(() => {
        timeLeft--;
        io.to(sessionId).emit('timerUpdate', { timeLeft });
        if (timeLeft <= 0) {
          clearInterval(session.timerInterval);
          endRound(session, sessionId, null);
        }
      }, 1000);
    }

    function endRound(session, sessionId, winnerPlayer) {
      if (session.timerInterval) clearInterval(session.timerInterval);
      session.endRound();

      const result = {
        players: session.getPlayersList(),
        answer: session.correctAnswer || "N/A"
      };

      if (winnerPlayer) {
        result.winner = winnerPlayer;
        io.to(sessionId).emit('roundEnded', { ...result, hasWinner: true });
      } else {
        io.to(sessionId).emit('roundEnded', { ...result, hasWinner: false });
      }

      // Better GM rotation
      if (session.getPlayerCount() > 1) {
        const playerIds = Array.from(session.players.keys());
        const currentIndex = playerIds.indexOf(session.gameMasterId);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        session.changeGameMaster(playerIds[nextIndex]);

        io.to(sessionId).emit('nextRoundReady', {
        newGameMaster: session.players.get(playerIds[nextIndex]).username,
        players: session.getPlayersList()
        });
            }

      setTimeout(() => {
        session.currentQuestion = null;
        session.correctAnswer = null;
        session.status = 'lobby';
      }, 6500);
    }
  });
}

module.exports = { initializeGameSockets };