(function () {
  const socket = io();

  const joinBtn = document.getElementById("joinBtn");
  const leaveBtn = document.getElementById("leaveBtn");
  const playerNameInput = document.getElementById("playerName");
  const joinStatus = document.getElementById("joinStatus");
  const turnInfo = document.getElementById("turnInfo");
  const boardEl = document.getElementById("board");
  const scoreboardEl = document.getElementById("scoreboard");
  const poolGridEl = document.getElementById("poolGrid");
  const poolInfo = document.getElementById("poolInfo");
  const currentBlockEl = document.getElementById("currentBlock");
  const deadlineInfo = document.getElementById("deadlineInfo");
  const messagesEl = document.getElementById("messages");

  const DEFAULT_BLOCKS = [
    { shape: "SQUARE", color: "YELLOW", colorHex: "#f1c40f" },
    { shape: "SQUARE", color: "RED", colorHex: "#ff5a5f" },
    { shape: "SQUARE", color: "GREEN", colorHex: "#1fb45b" },
    { shape: "SQUARE", color: "BLUE", colorHex: "#4b89c8" },
    { shape: "TRIANGLE", color: "YELLOW", colorHex: "#f1c40f" },
    { shape: "TRIANGLE", color: "RED", colorHex: "#ff5a5f" },
    { shape: "TRIANGLE", color: "GREEN", colorHex: "#1fb45b" },
    { shape: "TRIANGLE", color: "BLUE", colorHex: "#4b89c8" },
    { shape: "CIRCLE", color: "YELLOW", colorHex: "#f1c40f" },
    { shape: "CIRCLE", color: "RED", colorHex: "#ff5a5f" },
    { shape: "CIRCLE", color: "GREEN", colorHex: "#1fb45b" },
    { shape: "CIRCLE", color: "BLUE", colorHex: "#4b89c8" },
    { shape: "STAR", color: "YELLOW", colorHex: "#f1c40f" },
    { shape: "STAR", color: "RED", colorHex: "#ff5a5f" },
    { shape: "STAR", color: "GREEN", colorHex: "#1fb45b" },
    { shape: "STAR", color: "BLUE", colorHex: "#4b89c8" },
  ];

  let pendingPlacement = false;
  let latestState = null;
  let recentPlacedCell = null;
  let recentClearedCells = [];

  function setJoinControls(isJoined, playerNames) {
    joinBtn.disabled = false;
    playerNameInput.disabled = false;
    leaveBtn.disabled = !isJoined;
    joinStatus.textContent = isJoined
      ? `Local players: ${playerNames.join(", ")}. New players may still join while the current game continues.`
      : "Please enter a name to join the active player list.";
  }

  function escapeText(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function createShapeMarkup(block, size, faded) {
    const fill = faded ? "#e6e8ec" : block.colorHex;
    const stroke = faded ? "#c7ccd4" : "#1a1a1a";
    const common = `fill="${fill}" stroke="${stroke}" stroke-width="2.5"`;

    let shapeMarkup = "";
    if (block.shape === "SQUARE") {
      shapeMarkup = `<rect x="15" y="15" width="34" height="34" ${common} />`;
    } else if (block.shape === "TRIANGLE") {
      shapeMarkup = `<polygon points="32,12 52,48 12,48" ${common} />`;
    } else if (block.shape === "CIRCLE") {
      shapeMarkup = `<circle cx="32" cy="32" r="20" ${common} />`;
    } else if (block.shape === "STAR") {
      shapeMarkup =
        `<polygon points="32,9 38,24 55,24 41,35 46,52 32,41 18,52 23,35 9,24 26,24" ${common} />`;
    }

    return (
      `<svg class="shape-svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">` +
      `${shapeMarkup}</svg>`
    );
  }

  function clearBoardHighlights() {
    recentPlacedCell = null;
    recentClearedCells = [];
  }

  function scheduleHighlightReset() {
    window.setTimeout(() => {
      clearBoardHighlights();
      if (latestState) {
        renderBoard(latestState.board || Array(16).fill(null));
      }
    }, 700);
  }

  function pushMessage(text, type) {
    const li = document.createElement("li");
    li.textContent = text;
    li.className = type || "message-system";
    messagesEl.prepend(li);

    while (messagesEl.children.length > 40) {
      messagesEl.removeChild(messagesEl.lastChild);
    }
  }

  function getMe() {
    const controlledPlayers = getControlledPlayers();
    return controlledPlayers.length > 0 ? controlledPlayers[0] : null;
  }

  function getControlledPlayers() {
    if (!latestState || !latestState.players) {
      return [];
    }
    const controlledIds = latestState.controlledPlayerIds || [];
    return latestState.players.filter((player) => controlledIds.includes(player.id));
  }

  function getLeaveTargetPlayerId() {
    const controlled = getControlledPlayers();
    if (controlled.length === 0 || !latestState) {
      return null;
    }

    const activeControlled = controlled.find((player) => player.id === latestState.currentPlayerId);
    if (activeControlled) {
      return activeControlled.id;
    }

    return controlled[controlled.length - 1].id;
  }

  function isMyTurn() {
    return Boolean(latestState && latestState.yourBlock);
  }

  function renderScoreboard(players) {
    scoreboardEl.innerHTML = "";

    if (!players || players.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No active players. Join to start the game.";
      scoreboardEl.appendChild(li);
      return;
    }

    players.forEach((player, index) => {
      const li = document.createElement("li");
      li.textContent = `${index + 1}. ${player.name} - ${player.score} point(s)`;
      if (latestState.currentPlayerId === player.id) {
        li.classList.add("current-player");
      }
      scoreboardEl.appendChild(li);
    });
  }

  function renderCurrentBlock() {
    const block = latestState && latestState.yourBlock;
    if (!block) {
      currentBlockEl.classList.add("empty");
      currentBlockEl.innerHTML = "<span>Waiting for your turn. Your assigned block will appear here.</span>";
      return;
    }

    currentBlockEl.classList.remove("empty");
    currentBlockEl.innerHTML =
      createShapeMarkup(block, 92, false) +
      `<span class="hint">${escapeText(block.color)} ${escapeText(block.shape)}</span>`;
  }

  function renderTurnInfo() {
    if (!latestState || !latestState.currentPlayerName) {
      turnInfo.textContent = "Waiting for players...";
      deadlineInfo.textContent = "";
      return;
    }

    if (isMyTurn()) {
      turnInfo.textContent = `It is your turn, ${latestState.currentPlayerName}!`;
    } else {
      turnInfo.textContent = `It is ${latestState.currentPlayerName}'s turn.`;
    }

    if (latestState.turnDeadlineAt) {
      const remainingSec = Math.max(0, Math.ceil((latestState.turnDeadlineAt - Date.now()) / 1000));
      deadlineInfo.textContent = `Turn timeout: ${remainingSec} second(s) remaining before the player is removed.`;
    } else {
      deadlineInfo.textContent = "";
    }
  }

  function renderBoard(board) {
    boardEl.innerHTML = "";
    const canPlace = isMyTurn() && !pendingPlacement;

    for (let index = 0; index < board.length; index += 1) {
      const block = board[index];
      const cellBtn = document.createElement("button");
      cellBtn.type = "button";
      cellBtn.className = "cell";
      if (recentPlacedCell === index) {
        cellBtn.classList.add("placed-flash");
      }
      if (recentClearedCells.includes(index)) {
        cellBtn.classList.add("cleared-flash");
      }
      cellBtn.dataset.index = String(index);
      cellBtn.dataset.active = canPlace && !block ? "true" : "false";
      cellBtn.disabled = !canPlace || Boolean(block);
      cellBtn.setAttribute(
        "aria-label",
        block
          ? `Cell ${index + 1}, ${block.color} ${block.shape}`
          : `Empty cell ${index + 1}`
      );

      if (block) {
        cellBtn.innerHTML = createShapeMarkup(block, 48, false);
      }

      cellBtn.addEventListener("click", () => {
        if (!canPlace || pendingPlacement) {
          return;
        }
        pendingPlacement = true;
        recentPlacedCell = index;
        recentClearedCells = [];
        socket.emit("place-block", { cellIndex: index });
        renderBoard(board);
      });

      boardEl.appendChild(cellBtn);
    }
  }

  function renderPool(poolBlocks) {
    poolGridEl.innerHTML = "";
    if (!poolBlocks) {
      return;
    }

    poolBlocks.forEach((block) => {
      const slot = document.createElement("div");
      slot.className = `pool-slot${block.available ? "" : " unavailable"}`;
      slot.setAttribute(
        "aria-label",
        `${block.color} ${block.shape} ${block.available ? "available" : "not available"}`
      );
      slot.innerHTML = createShapeMarkup(block, 54, !block.available);
      poolGridEl.appendChild(slot);
    });
  }

  function renderState() {
    if (!latestState) {
      return;
    }

    renderBoard(latestState.board || Array(16).fill(null));
    renderPool(latestState.poolBlocks || []);
    renderScoreboard(latestState.players || []);
    renderCurrentBlock();
    renderTurnInfo();
    poolInfo.textContent = `Pool blocks currently available: ${latestState.poolCount}`;

    const controlledPlayers = getControlledPlayers();
    if (controlledPlayers.length > 0) {
      setJoinControls(true, controlledPlayers.map((player) => player.name));
    } else {
      setJoinControls(false, []);
    }
  }

  function resetLocalView() {
    setJoinControls(false, []);
    latestState = null;
    pendingPlacement = false;
    clearBoardHighlights();
    turnInfo.textContent = "Waiting for players...";
    deadlineInfo.textContent = "";
    currentBlockEl.classList.add("empty");
    currentBlockEl.innerHTML = "<span>No block assigned</span>";
    scoreboardEl.innerHTML = "<li>No active players. Join to start the game.</li>";
    poolInfo.textContent = "Pool blocks currently available: 16";
    renderPool(DEFAULT_BLOCKS.map((block) => ({ ...block, available: true })));
    renderBoard(Array(16).fill(null));
  }

  joinBtn.addEventListener("click", () => {
    const name = playerNameInput.value.trim();
    if (!name) {
      pushMessage("Please enter a display name before joining.", "message-alert");
      return;
    }
    socket.emit("player-join", { name });
    playerNameInput.value = "";
    playerNameInput.focus();
  });

  leaveBtn.addEventListener("click", () => {
    const playerId = getLeaveTargetPlayerId();
    socket.emit("leave-game", { playerId });
  });

  playerNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      joinBtn.click();
    }
  });

  socket.on("game-state", (state) => {
    latestState = state;
    pendingPlacement = false;
    renderState();
  });

  socket.on("connect", () => {
    pendingPlacement = false;
    if (!latestState || !getMe()) {
      resetLocalView();
    }
  });

  socket.on("disconnect", () => {
    resetLocalView();
    turnInfo.textContent = "Connection lost. Waiting to reconnect...";
  });

  socket.on("player-join", (payload) => {
    pushMessage(`${payload.player.name} joined the game and was added to the end of the turn order.`, "message-system");
  });

  socket.on("player-leave", (payload) => {
    let reason = "left the game.";
    if (payload.reason === "timeout") {
      reason = "was removed after the 60-second turn timeout.";
    } else if (payload.reason === "disconnect") {
      reason = "disconnected and was removed from the game.";
    }
    pushMessage(`${payload.player.name} ${reason}`, "message-alert");
  });

  socket.on("turn-start", (payload) => {
    if ((latestState && latestState.controlledPlayerIds || []).includes(payload.currentPlayer.id)) {
      pushMessage(`It is your turn, ${payload.currentPlayer.name}! Place your assigned block on an empty cell.`, "message-good");
    } else {
      pushMessage(`Next turn: ${payload.currentPlayer.name}.`, "message-system");
    }
  });

  socket.on("place-block", (payload) => {
    recentPlacedCell = payload.cellIndex;
    recentClearedCells = [];
    scheduleHighlightReset();
    pushMessage(
      `${payload.player.name} placed a ${payload.block.color.toLowerCase()} ${payload.block.shape.toLowerCase()} block on cell ${payload.cellIndex + 1}.`,
      "message-system"
    );
  });

  socket.on("clear-score", (payload) => {
    recentClearedCells = payload.clearedCells.slice();
    scheduleHighlightReset();
    pushMessage(
      `${payload.player.name} earned ${payload.pointsAwarded} point(s) by clearing ${payload.clearedCells.length} block(s).`,
      "message-good"
    );
  });

  socket.on("board-full", (payload) => {
    pushMessage(
      `${payload.player.name} filled the board and received the 16-point jackpot. The board has been cleared.`,
      "message-good"
    );
  });

  socket.on("error-message", (payload) => {
    pendingPlacement = false;
    pushMessage(payload.message, "message-alert");
  });

  setInterval(() => {
    if (latestState && latestState.turnDeadlineAt) {
      renderTurnInfo();
    }
  }, 1000);

  window.addEventListener("pagehide", () => {
    if (getMe()) {
      socket.emit("leave-game");
    }
  });

  resetLocalView();
})();
