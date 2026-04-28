# JC2503 Web Multiplayer Puzzle Game

A real-time multiplayer coursework project built with Node.js, Express, EJS, and Socket.IO.

## Project Summary
This project implements the JC2503 assignment requirements with a turn-based 4x4 puzzle game:
- Players join with a display name and enter the turn queue
- Players place blocks on a shared 4x4 board in strict turn order
- Turn timeout (60s) removes inactive players automatically
- Game events and state are synchronized in real time across clients
- Scores and player order are updated continuously

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

## Core Features
- Multiplayer online gameplay
- Turn-based game flow
- Automatic timeout removal (60 seconds)
- Real-time event messages
- Live scoreboard and turn order
- Manual leave and disconnect handling
- Responsive UI

## Project Structure
```text
game_project/
├── public/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── game.js
├── views/
│   ├── index.ejs
│   ├── about.ejs
│   └── game.ejs
├── server.js
├── report.html
└── package.json
```
