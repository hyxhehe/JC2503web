const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 8080;
const BOARD_SIZE = 4;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const TURN_TIMEOUT_MS = 60_000;

const SHAPES = ["SQUARE", "TRIANGLE", "CIRCLE", "STAR"];
const COLORS = [
  { name: "YELLOW", hex: "#f1c40f" },
  { name: "RED", hex: "#ff5a5f" },
  { name: "GREEN", hex: "#1fb45b" },
  { name: "BLUE", hex: "#4b89c8" },
];

const blocks = [];
for (const color of COLORS) {
  for (const shape of SHAPES) {
    blocks.push({
      id: `${color.name}_${shape}`,
      color: color.name,
      colorHex: color.hex,
      shape,
    });
  }
}

const blockById = Object.fromEntries(blocks.map((block) => [block.id, block]));

let board = Array(CELL_COUNT).fill(null);
let pool = blocks.map((block) => block.id);
const players = [];
let turnIndex = -1;
let currentTurn = null;
let turnTimer = null;
let playerSequence = 0;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => res.render("index"));
app.get("/about", (_req, res) => res.render("about"));
app.get("/game", (_req, res) => res.render("game"));
app.get("/report", (_req, res) => res.sendFile(path.join(__dirname, "report.html")));
app.get("/report.html", (_req, res) => res.sendFile(path.join(__dirname, "report.html")));

function resetGameState() {
  board = Array(CELL_COUNT).fill(null);
  pool = blocks.map((block) => block.id);
  turnIndex = -1;
  currentTurn = null;
  clearTurnTimer();
}

function sanitizeName(name) {
  if (typeof name !== "string") {
    return "";
  }
  return name.trim().replace(/\s+/g, " ").slice(0, 24);
}

function getPlayersPublic() {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score,
  }));
}

function getBoardPublic() {
  return board.map((id) => (id ? blockById[id] : null));
}

function getPoolPublic() {
  return blocks.map((block) => ({
    ...block,
    available: pool.includes(block.id),
  }));
}

function emitGameState() {
  const boardPublic = getBoardPublic();
  const playersPublic = getPlayersPublic();
  const poolPublic = getPoolPublic();
  const currentPlayer = currentTurn
    ? players.find((player) => player.id === currentTurn.playerId) || null
    : null;

  for (const [socketId, socket] of io.of("/").sockets) {
    const yourBlock =
      currentPlayer && currentPlayer.socketId === socketId ? blockById[currentTurn.blockId] : null;
    const controlledPlayers = players
      .filter((player) => player.socketId === socketId)
      .map((player) => player.id);

    socket.emit("game-state", {
      board: boardPublic,
      players: playersPublic,
      poolBlocks: poolPublic,
      poolCount: pool.length,
      controlledPlayerIds: controlledPlayers,
      currentPlayerId: currentPlayer ? currentPlayer.id : null,
      currentPlayerName: currentPlayer ? currentPlayer.name : null,
      turnDeadlineAt: currentTurn ? currentTurn.deadlineAt : null,
      yourBlock,
    });
  }
}

function clearTurnTimer() {
  if (turnTimer) {
    clearTimeout(turnTimer);
    turnTimer = null;
  }
}

function selectRandomPoolBlock() {
  if (pool.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

function startNextTurn() {
  clearTurnTimer();

  if (players.length === 0) {
    currentTurn = null;
    turnIndex = -1;
    emitGameState();
    return;
  }

  turnIndex = turnIndex < 0 ? 0 : (turnIndex + 1) % players.length;
  const activePlayer = players[turnIndex];
  const blockId = selectRandomPoolBlock();

  if (!activePlayer || !blockId) {
    currentTurn = null;
    emitGameState();
    return;
  }

  const deadlineAt = Date.now() + TURN_TIMEOUT_MS;
  currentTurn = {
    playerId: activePlayer.id,
    blockId,
    deadlineAt,
  };

  io.emit("turn-start", {
    currentPlayer: {
      id: activePlayer.id,
      name: activePlayer.name,
    },
    deadlineAt,
  });

  emitGameState();

  turnTimer = setTimeout(() => {
    removePlayer(activePlayer.id, "timeout");
  }, TURN_TIMEOUT_MS);
}

function toRowCol(index) {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function collectLineMatches(originIndex, stepRow, stepCol, propertyName) {
  const originId = board[originIndex];
  if (!originId) {
    return [];
  }

  const originBlock = blockById[originId];
  const { row: originRow, col: originCol } = toRowCol(originIndex);
  const line = [originIndex];

  for (const direction of [-1, 1]) {
    let row = originRow + stepRow * direction;
    let col = originCol + stepCol * direction;

    while (inBounds(row, col)) {
      const index = row * BOARD_SIZE + col;
      const id = board[index];
      if (!id) {
        break;
      }
      const block = blockById[id];
      if (block[propertyName] !== originBlock[propertyName]) {
        break;
      }
      line.push(index);
      row += stepRow * direction;
      col += stepCol * direction;
    }
  }

  return line.length >= 3 ? line : [];
}

function findClearedIndices(originIndex) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  const cleared = new Set();
  for (const propertyName of ["shape", "color"]) {
    for (const [stepRow, stepCol] of directions) {
      const matched = collectLineMatches(originIndex, stepRow, stepCol, propertyName);
      for (const index of matched) {
        cleared.add(index);
      }
    }
  }
  return Array.from(cleared);
}

function removePlayer(playerId, reason) {
  const playerIndex = players.findIndex((player) => player.id === playerId);
  if (playerIndex === -1) {
    return;
  }

  const removedPlayer = players[playerIndex];
  const wasCurrentTurn = currentTurn && currentTurn.playerId === playerId;
  players.splice(playerIndex, 1);

  if (players.length === 0) {
    resetGameState();
  } else if (wasCurrentTurn) {
    turnIndex = (playerIndex - 1 + players.length) % players.length;
    clearTurnTimer();
    currentTurn = null;
  } else if (playerIndex <= turnIndex) {
    turnIndex = (turnIndex - 1 + players.length) % players.length;
  }

  io.emit("player-leave", {
    player: {
      id: removedPlayer.id,
      name: removedPlayer.name,
    },
    reason,
    players: getPlayersPublic(),
  });

  if (players.length === 0) {
    emitGameState();
    return;
  }

  if (wasCurrentTurn) {
    startNextTurn();
  } else {
    emitGameState();
  }
}

function removePlayersForSocket(socketId, reason) {
  const playerIds = players
    .filter((player) => player.socketId === socketId)
    .map((player) => player.id);

  for (const playerId of playerIds) {
    removePlayer(playerId, reason);
  }
}

io.on("connection", (socket) => {
  emitGameState();

  socket.on("player-join", (payload) => {
    const name = sanitizeName(payload && payload.name);
    if (!name) {
      socket.emit("error-message", { message: "Please enter a valid player name." });
      return;
    }

    const player = {
      id: `player-${Date.now()}-${playerSequence += 1}`,
      socketId: socket.id,
      name,
      score: 0,
      joinedAt: Date.now(),
    };
    players.push(player);

    io.emit("player-join", {
      player: {
        id: player.id,
        name: player.name,
        score: player.score,
      },
      players: getPlayersPublic(),
    });

    emitGameState();

    if (!currentTurn) {
      turnIndex = -1;
      startNextTurn();
    }
  });

  socket.on("leave-game", (payload) => {
    const controlledIds = players
      .filter((player) => player.socketId === socket.id)
      .map((player) => player.id);

    if (controlledIds.length === 0) {
      return;
    }

    const requestedId = payload && payload.playerId;
    const targetId = controlledIds.includes(requestedId)
      ? requestedId
      : controlledIds[controlledIds.length - 1];

    removePlayer(targetId, "left");
  });

  socket.on("place-block", (payload) => {
    if (!currentTurn) {
      socket.emit("error-message", { message: "No active turn is currently available." });
      return;
    }
    const activeTurnPlayer = players.find((item) => item.id === currentTurn.playerId);
    if (!activeTurnPlayer || activeTurnPlayer.socketId !== socket.id) {
      socket.emit("error-message", { message: "It is not your turn." });
      return;
    }

    const cellIndex = Number(payload && payload.cellIndex);
    if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= CELL_COUNT) {
      socket.emit("error-message", { message: "Invalid board position." });
      return;
    }
    if (board[cellIndex] !== null) {
      socket.emit("error-message", { message: "This cell is already occupied." });
      return;
    }

    const player = activeTurnPlayer;
    const blockId = currentTurn.blockId;
    const poolIndex = pool.indexOf(blockId);
    if (poolIndex === -1) {
      socket.emit("error-message", { message: "Assigned block is not available in the pool." });
      return;
    }

    clearTurnTimer();
    currentTurn = null;

    board[cellIndex] = blockId;
    pool.splice(poolIndex, 1);
    const wasFullImmediatelyAfterPlacement = board.every((cell) => cell !== null);

    io.emit("place-block", {
      player: { id: player.id, name: player.name },
      cellIndex,
      block: blockById[blockId],
      board: getBoardPublic(),
    });

    const clearedIndices = findClearedIndices(cellIndex);
    if (clearedIndices.length > 0) {
      const returnedBlocks = [];
      for (const index of clearedIndices) {
        if (board[index]) {
          returnedBlocks.push(board[index]);
          board[index] = null;
        }
      }
      pool.push(...returnedBlocks);
      player.score += returnedBlocks.length;

      io.emit("clear-score", {
        player: { id: player.id, name: player.name },
        clearedCells: clearedIndices,
        pointsAwarded: returnedBlocks.length,
        scores: getPlayersPublic(),
        board: getBoardPublic(),
        poolCount: pool.length,
      });
    }

    if (wasFullImmediatelyAfterPlacement) {
      const returnedBlocks = [];
      for (let i = 0; i < board.length; i += 1) {
        if (board[i]) {
          returnedBlocks.push(board[i]);
          board[i] = null;
        }
      }
      pool.push(...returnedBlocks);
      player.score += 16;

      io.emit("board-full", {
        player: { id: player.id, name: player.name },
        jackpot: 16,
        scores: getPlayersPublic(),
        board: getBoardPublic(),
        poolCount: pool.length,
      });
    }

    emitGameState();
    startNextTurn();
  });

  socket.on("disconnect", () => {
    removePlayersForSocket(socket.id, "disconnect");
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
