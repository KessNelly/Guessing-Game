const Player = require('./Player');

class GameSession {
  constructor(id, gameMasterId, gameMasterUsername) {
    this.id = id;                           // Unique session code
    this.gameMasterId = gameMasterId;       // Socket ID of current GM
    this.players = new Map();               // socketId -> Player object
    this.status = 'lobby';                  // 'lobby' | 'playing' | 'ended'
    this.currentQuestion = null;
    this.correctAnswer = null;              
    this.roundStartTime = null;
    this.timerDuration = 60;                // seconds
    this.timerInterval = null;

    // Add game master as first player
    this.addPlayer(gameMasterId, gameMasterUsername);
    this.players.get(gameMasterId).role = 'gamemaster';
  }

  addPlayer(socketId, username) {
    if (this.players.has(socketId)) return false;
    const player = new Player(username, socketId);
    this.players.set(socketId, player);
    return true;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  getPlayerCount() {
    return this.players.size;
  }

  getPlayersList() {
    return Array.from(this.players.values());
  }

  isGameMaster(socketId) {
    return this.gameMasterId === socketId;
  }

  changeGameMaster(newGameMasterId) {
    const oldGM = this.players.get(this.gameMasterId);
    if (oldGM) oldGM.role = 'player';

    const newGM = this.players.get(newGameMasterId);
    if (newGM) {
      newGM.role = 'gamemaster';
      this.gameMasterId = newGameMasterId;
    }
  }

  startRound(question, answer) {
    this.status = 'playing';
    this.currentQuestion = question;
    this.correctAnswer = answer.toLowerCase().trim();
    this.roundStartTime = Date.now();
    this.resetAllAttempts();
  }

  resetAllAttempts() {
    this.players.forEach(player => player.resetAttempts());
  }

  endRound() {
    this.status = 'ended';
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  isActive() {
    return this.players.size > 0;
  }
}

module.exports = GameSession;