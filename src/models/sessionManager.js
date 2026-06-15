const GameSession = require('./gameSessions');

class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> GameSession
  }

  createSession(socketId, username) {
    const sessionId = this.generateSessionCode();
    const session = new GameSession(sessionId, socketId, username);
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  generateSessionCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    if (this.sessions.has(code)) return this.generateSessionCode();
    return code;
  }

  cleanupEmptySessions() {
    for (const [id, session] of this.sessions) {
      if (!session.isActive()) {
        this.deleteSession(id);
      }
    }
  }
}

module.exports = new SessionManager(); // Singleton