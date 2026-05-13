# JC2503 Web Multiplayer Puzzle Game

A real-time multiplayer coursework project built with Node.js, Express, EJS, and Socket.IO.

## Runtime Environment
- Recommended Node.js version: `24.13.0 LTS`
- Default server port: `8080`

## Project Summary
This project implements the JC2503 assignment requirements with a turn-based 4x4 puzzle game:
- Players join with a display name and enter the turn queue
- Players place blocks on a shared 4x4 board in strict turn order
- Turn timeout (60s) removes inactive players automatically
- Game events and state are synchronized in real time across clients
- Scores and player order are updated continuously

## Routes
- `/` - Introduction page
- `/about` - About page
- `/game` - Multiplayer game page
- `/report.html` - Standalone HTML report page

## Tech Stack
- Backend: Node.js + Express
- Real-time communication: Socket.IO
- Templating: EJS
- Styling: CSS

## Quick Start
1. Install dependencies:
```bash
npm install
```

2. Start server:
```bash
npm start
```

3. Open in browser:
```text
http://localhost:8080
```

## Game Rules (Assignment Mapping)
- Shared board: 4x4 grid (16 cells)
- Block pool: 16 unique blocks (4 shapes x 4 colours)
- Turn flow: server assigns one random available block to current player
- Placement: player can place only on an empty cell during their own turn
- Scoring: contiguous line of 3+ matching shape or colour (horizontal, vertical, diagonal) is cleared and returned to pool; player gains 1 point per removed block
- Full board rule: if board becomes full after placement, board is cleared, all blocks return to pool, active player gains 16-point jackpot
- Timeout rule: player is removed after 60 seconds of inactivity on their turn
- Session model: game continues continuously while turn order cycles through active players

## Core Features
- Multiplayer online gameplay
- Turn-based game flow
- Automatic timeout removal (60 seconds)
- Real-time multiplayer state synchronization
- Live scoreboard and turn order
- Manual leave and disconnect handling
- Responsive UI

## Submission Notes
- Entry file is `server.js` (`npm start` runs `node server.js`).
- Keep `package.json` compatible with the course default environment.
- Do not include `node_modules` in submission archive.

## Project Structure
```text
game_project/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── img/
│   │   └── socket-sequence-preview.png
│   └── js/
│       └── game.js
├── views/
│   ├── index.ejs
│   ├── about.ejs
│   └── game.ejs
├── README.md
├── server.js
├── report.html
├── package-lock.json
└── package.json
```
