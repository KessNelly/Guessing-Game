# Guessing Game 

A live, multiplayer guessing game built with **Node.js**, **Express**, and **Socket.IO**. One player acts as the Game Master (GM) and sets a question/answer; other players race to guess it correctly within a time limit.

## Features

- Real-time chat-style game session interface
- Create or join a game session with a 6-character room code
- Live player list with scores and connection count
- Game Master sets a question and answer for the round
- Game requires more than 2 players to start
- Each player gets 3 attempts to guess correctly
- 60-second round timer
- First correct guess wins +10 points; answer revealed to everyone
- If time runs out, answer is revealed with no winner and no points awarded
- Game Master role rotates to the next player after each round
- Session is automatically deleted when all players leave

## Tech Stack

- **Backend:** Node.js, Express, Socket.IO
- **Frontend:** HTML, Tailwind CSS (CDN), vanilla JavaScript, Socket.IO client
- **Dev tools:** Nodemon

## Project Structure

```
Guessing Game/
├── server.js
├── public/
│   └── index.html
├── src/
│   ├── models/
│   │   ├── player.js
│   │   ├── gameSessions.js
│   │   └── sessionManager.js
│   └── sockets/
│       └── gameSocket.js
├── package.json
└── .env
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm

### Installation

```bash
git clone https://github.com/KessNelly/Guessing-Game.git
cd "Guessing Game"
npm install
```

### Environment Variables

Create a `.env` file in the project root (optional):

```env
PORT=3001
```

### Running the App

**Development (with auto-restart):**

```bash
npm run dev
```

**Production:**

```bash
npm start
```

The server will run at `http://localhost:3001` (or your configured `PORT`).

## How to Play

1. Open the app in your browser.
2. Enter a username and click **Create Game** to start a session as Game Master, or enter a **Room Code** and click **Join Game** to join an existing session.
3. Share the generated room code with friends so they can join.
4. The Game Master clicks **Create Question** to set a question and answer.
5. Once at least 2 other players have joined (3+ players total), the Game Master clicks **Start Round**.
6. Players have 60 seconds and up to 3 attempts to guess the answer.
7. The first correct guess wins the round (+10 points). If time runs out, no one wins and the answer is revealed.
8. After each round, the Game Master role passes to the next player.

## Socket Events Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `createSession` | `{ username }` | Create a new game session |
| `joinSession` | `{ sessionId, username }` | Join an existing session |
| `createQuestion` | `{ sessionId, question, answer }` | GM sets the round's question/answer |
| `startGame` | `{ sessionId }` | GM starts the round |
| `submitGuess` | `{ sessionId, guess }` | Player submits a guess |
| `leaveSession` | — | Leave the current session |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `sessionCreated` | `{ sessionId, role, players }` | Session created successfully |
| `sessionJoined` | `{ sessionId, role, players, status }` | Joined session successfully |
| `playerJoined` | `{ players, message }` | A new player joined |
| `playerLeft` | `{ players, message }` | A player left |
| `questionCreated` | `{ question }` | GM posted a question |
| `gameStarted` | `{ question }` | Round has started |
| `timerUpdate` | `{ timeLeft }` | Countdown timer tick |
| `guessResult` | `{ correct, attemptsUsed }` | Result of a player's guess |
| `roundEnded` | `{ players, answer, winner?, hasWinner }` | Round ended (win or timeout) |
| `nextRoundReady` | `{ newGameMaster, players }` | New GM assigned for next round |
| `error` | `{ message }` | Error message |

## License

This project is for educational purposes (AltSchool assignment).