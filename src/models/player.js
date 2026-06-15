class Player {
  constructor(username, socketId) {
    this.id = socketId;          
    this.username = username;
    this.score = 0;
    this.role = 'player';         // 'player' or 'gamemaster'
    this.attemptsUsed = 0;        // Resets every round
    this.isConnected = true;
  }

  incrementScore(points = 10) {
    this.score += points;
  }

  resetAttempts() {
    this.attemptsUsed = 0;
  }

  useAttempt() {
    this.attemptsUsed++;
  }

  hasAttemptsLeft() {
    return this.attemptsUsed < 3;
  }
}

module.exports = Player;