/*
 * 2D Chess game — vanilla JavaScript engine + UI.
 *
 * Board representation:
 *   The board is an 8x8 array `board[r][c]` where r=0 is rank 8 (Black's back
 *   rank) and r=7 is rank 1 (White's back rank). Each square holds either null
 *   or a piece object { type, color } where type is one of
 *   'p','n','b','r','q','k' and color is 'w' or 'b'.
 */

(function () {
  "use strict";

  // ----- Constants -------------------------------------------------------

  const WHITE = "w";
  const BLACK = "b";

  // Unicode glyphs for each piece, keyed by color + type.
  const GLYPHS = {
    wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
    bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
  };

  const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

  // ----- Game state ------------------------------------------------------

  function initialBoard() {
    const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    const board = Array.from({ length: 8 }, () => new Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: back[c], color: BLACK };
      board[1][c] = { type: "p", color: BLACK };
      board[6][c] = { type: "p", color: WHITE };
      board[7][c] = { type: back[c], color: WHITE };
    }
    return board;
  }

  // The full mutable game state.
  const state = {
    board: initialBoard(),
    turn: WHITE,
    // Castling rights.
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    // En-passant target square as {r, c} or null.
    enPassant: null,
    selected: null, // {r, c} currently picked-up square
    legalForSelected: [], // cached legal moves for the selected piece
    history: [], // list of SAN-ish move strings for the move list
    gameOver: false,
    vsAI: true,
    aiColor: BLACK,
    halfmoveClock: 0,
  };

  // ----- Geometry helpers ------------------------------------------------

  function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function cloneBoard(board) {
    return board.map((row) => row.map((sq) => (sq ? { type: sq.type, color: sq.color } : null)));
  }

  function findKing(board, color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === "k" && p.color === color) return { r, c };
      }
    }
    return null;
  }

  function opponent(color) {
    return color === WHITE ? BLACK : WHITE;
  }

  // ----- Attack detection ------------------------------------------------

  // Is the given square attacked by any piece of `byColor`?
  function isSquareAttacked(board, r, c, byColor) {
    const dir = byColor === WHITE ? -1 : 1; // direction white pawns move (up)
    // Pawn attacks: a white pawn on (r+1, c±1) attacks (r, c).
    for (const dc of [-1, 1]) {
      const pr = r - dir;
      const pc = c + dc;
      if (inBounds(pr, pc)) {
        const p = board[pr][pc];
        if (p && p.color === byColor && p.type === "p") return true;
      }
    }
    // Knight attacks.
    const knightHops = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
    ];
    for (const [dr, dc] of knightHops) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p && p.color === byColor && p.type === "n") return true;
      }
    }
    // King attacks (adjacent squares).
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) {
          const p = board[nr][nc];
          if (p && p.color === byColor && p.type === "k") return true;
        }
      }
    }
    // Sliding pieces: rook/queen orthogonally, bishop/queen diagonally.
    const ortho = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const diag = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of ortho) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === "r" || p.type === "q")) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    for (const [dr, dc] of diag) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === "b" || p.type === "q")) return true;
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    return false;
  }

  function inCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return false;
    return isSquareAttacked(board, king.r, king.c, opponent(color));
  }

  // ----- Move generation -------------------------------------------------

  // Generate pseudo-legal moves (ignoring whether the king is left in check)
  // for the piece at (r, c). Returns an array of move objects.
  function pseudoMoves(gs, r, c) {
    const board = gs.board;
    const piece = board[r][c];
    if (!piece) return [];
    const moves = [];
    const color = piece.color;
    const push = (tr, tc, extra) => {
      moves.push(Object.assign({ from: { r, c }, to: { r: tr, c: tc } }, extra || {}));
    };

    const slide = (dirs) => {
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          const t = board[nr][nc];
          if (!t) {
            push(nr, nc);
          } else {
            if (t.color !== color) push(nr, nc, { capture: true });
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    };

    switch (piece.type) {
      case "p": {
        const dir = color === WHITE ? -1 : 1;
        const startRow = color === WHITE ? 6 : 1;
        const promoRow = color === WHITE ? 0 : 7;
        // Single push.
        if (inBounds(r + dir, c) && !board[r + dir][c]) {
          if (r + dir === promoRow) {
            for (const promo of ["q", "r", "b", "n"]) push(r + dir, c, { promotion: promo });
          } else {
            push(r + dir, c);
          }
          // Double push.
          if (r === startRow && !board[r + 2 * dir][c]) {
            push(r + 2 * dir, c, { double: true });
          }
        }
        // Captures (including en passant).
        for (const dc of [-1, 1]) {
          const nr = r + dir;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const t = board[nr][nc];
          if (t && t.color !== color) {
            if (nr === promoRow) {
              for (const promo of ["q", "r", "b", "n"]) push(nr, nc, { capture: true, promotion: promo });
            } else {
              push(nr, nc, { capture: true });
            }
          } else if (gs.enPassant && gs.enPassant.r === nr && gs.enPassant.c === nc) {
            push(nr, nc, { capture: true, enPassant: true });
          }
        }
        break;
      }
      case "n": {
        const hops = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
        ];
        for (const [dr, dc] of hops) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const t = board[nr][nc];
          if (!t) push(nr, nc);
          else if (t.color !== color) push(nr, nc, { capture: true });
        }
        break;
      }
      case "b":
        slide([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
        break;
      case "r":
        slide([[-1, 0], [1, 0], [0, -1], [0, 1]]);
        break;
      case "q":
        slide([[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
        break;
      case "k": {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const t = board[nr][nc];
            if (!t) push(nr, nc);
            else if (t.color !== color) push(nr, nc, { capture: true });
          }
        }
        // Castling.
        addCastlingMoves(gs, r, c, color, push);
        break;
      }
    }
    return moves;
  }

  function addCastlingMoves(gs, r, c, color, push) {
    const board = gs.board;
    const homeRow = color === WHITE ? 7 : 0;
    if (r !== homeRow || c !== 4) return; // king not on its home square
    if (inCheck(board, color)) return; // cannot castle out of check
    const rights = gs.castling;
    const opp = opponent(color);

    // King-side: squares f and g must be empty and not attacked.
    const kSide = color === WHITE ? rights.wK : rights.bK;
    if (kSide && !board[homeRow][5] && !board[homeRow][6] &&
        board[homeRow][7] && board[homeRow][7].type === "r") {
      if (!isSquareAttacked(board, homeRow, 5, opp) &&
          !isSquareAttacked(board, homeRow, 6, opp)) {
        push(homeRow, 6, { castle: "K" });
      }
    }
    // Queen-side: squares b, c, d must be empty (b need not be safe), c and d safe.
    const qSide = color === WHITE ? rights.wQ : rights.bQ;
    if (qSide && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
        board[homeRow][0] && board[homeRow][0].type === "r") {
      if (!isSquareAttacked(board, homeRow, 3, opp) &&
          !isSquareAttacked(board, homeRow, 2, opp)) {
        push(homeRow, 2, { castle: "Q" });
      }
    }
  }

  // Apply a move to a *copy* of the state's board and return the new board
  // plus side-effect metadata. Does not mutate the input.
  function simulate(gs, move) {
    const board = cloneBoard(gs.board);
    const piece = board[move.from.r][move.from.c];
    board[move.to.r][move.to.c] = piece;
    board[move.from.r][move.from.c] = null;

    if (move.enPassant) {
      // Captured pawn sits behind the destination square.
      const dir = piece.color === WHITE ? 1 : -1;
      board[move.to.r + dir][move.to.c] = null;
    }
    if (move.promotion) {
      board[move.to.r][move.to.c] = { type: move.promotion, color: piece.color };
    }
    if (move.castle === "K") {
      board[move.to.r][5] = board[move.to.r][7];
      board[move.to.r][7] = null;
    } else if (move.castle === "Q") {
      board[move.to.r][3] = board[move.to.r][0];
      board[move.to.r][0] = null;
    }
    return board;
  }

  // Filter pseudo-legal moves to those that don't leave own king in check.
  function legalMovesFrom(gs, r, c) {
    const piece = gs.board[r][c];
    if (!piece) return [];
    return pseudoMoves(gs, r, c).filter((m) => {
      const board = simulate(gs, m);
      return !inCheck(board, piece.color);
    });
  }

  function allLegalMoves(gs, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = gs.board[r][c];
        if (p && p.color === color) {
          for (const m of legalMovesFrom(gs, r, c)) moves.push(m);
        }
      }
    }
    return moves;
  }

  // ----- Applying a move to the live state -------------------------------

  const FILES = "abcdefgh";
  function squareName(r, c) {
    return FILES[c] + (8 - r);
  }

  function applyMove(gs, move) {
    const piece = gs.board[move.from.r][move.from.c];
    const captured = gs.board[move.to.r][move.to.c] || (move.enPassant ? { type: "p" } : null);

    // Update board via simulate, then commit.
    gs.board = simulate(gs, move);

    // Update castling rights.
    if (piece.type === "k") {
      if (piece.color === WHITE) { gs.castling.wK = false; gs.castling.wQ = false; }
      else { gs.castling.bK = false; gs.castling.bQ = false; }
    }
    const touchRook = (r, c) => {
      if (r === 7 && c === 0) gs.castling.wQ = false;
      if (r === 7 && c === 7) gs.castling.wK = false;
      if (r === 0 && c === 0) gs.castling.bQ = false;
      if (r === 0 && c === 7) gs.castling.bK = false;
    };
    touchRook(move.from.r, move.from.c);
    touchRook(move.to.r, move.to.c); // a rook being captured also loses rights

    // Update en-passant target.
    if (move.double) {
      const dir = piece.color === WHITE ? -1 : 1;
      gs.enPassant = { r: move.from.r + dir, c: move.from.c };
    } else {
      gs.enPassant = null;
    }

    // Halfmove clock for the 50-move rule.
    if (piece.type === "p" || captured) gs.halfmoveClock = 0;
    else gs.halfmoveClock++;

    // Build a readable move string.
    gs.history.push(describeMove(piece, captured, move));

    gs.turn = opponent(gs.turn);
  }

  function describeMove(piece, captured, move) {
    if (move.castle === "K") return "O-O";
    if (move.castle === "Q") return "O-O-O";
    const letter = piece.type === "p" ? "" : piece.type.toUpperCase();
    const from = piece.type === "p" && captured ? FILES[move.from.c] : "";
    const sep = captured ? "x" : "";
    const dest = squareName(move.to.r, move.to.c);
    const promo = move.promotion ? "=" + move.promotion.toUpperCase() : "";
    return letter + from + sep + dest + promo;
  }

  // ----- Game status -----------------------------------------------------

  function gameStatus(gs) {
    const moves = allLegalMoves(gs, gs.turn);
    const checked = inCheck(gs.board, gs.turn);
    if (moves.length === 0) {
      return checked ? "checkmate" : "stalemate";
    }
    if (gs.halfmoveClock >= 100) return "draw50";
    if (insufficientMaterial(gs.board)) return "insufficient";
    return checked ? "check" : "ongoing";
  }

  function insufficientMaterial(board) {
    const pieces = [];
    for (const row of board) for (const sq of row) if (sq) pieces.push(sq.type);
    const nonKings = pieces.filter((t) => t !== "k");
    if (nonKings.length === 0) return true; // K vs K
    if (nonKings.length === 1 && (nonKings[0] === "b" || nonKings[0] === "n")) return true; // K+minor vs K
    return false;
  }

  // ----- Simple AI -------------------------------------------------------

  function evaluate(board, color) {
    // Material balance from `color`'s perspective.
    let score = 0;
    for (const row of board) {
      for (const sq of row) {
        if (!sq) continue;
        const v = PIECE_VALUE[sq.type];
        score += sq.color === color ? v : -v;
      }
    }
    return score;
  }

  const MATE = 100000;

  // Negamax with alpha-beta pruning. Always returns a score from the
  // perspective of the side to move (gs.turn); the caller negates.
  function search(gs, depth, alpha, beta) {
    const moves = allLegalMoves(gs, gs.turn);
    if (moves.length === 0) {
      // Mated: very bad for the side to move. The `+ depth` term makes the
      // engine prefer faster mates (more remaining depth = found sooner).
      // Stalemate is neutral.
      return inCheck(gs.board, gs.turn) ? -(MATE + depth) : 0;
    }
    if (depth === 0) return evaluate(gs.board, gs.turn);
    // Move ordering: try captures first to improve pruning.
    moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));
    let best = -Infinity;
    for (const m of moves) {
      const child = snapshot(gs);
      applyMove(child, m);
      const val = -search(child, depth - 1, -beta, -alpha);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Lightweight snapshot of the parts of state the search mutates.
  function snapshot(gs) {
    return {
      board: cloneBoard(gs.board),
      turn: gs.turn,
      castling: Object.assign({}, gs.castling),
      enPassant: gs.enPassant ? { r: gs.enPassant.r, c: gs.enPassant.c } : null,
      history: [],
      halfmoveClock: gs.halfmoveClock,
    };
  }

  function chooseAIMove(gs, depth) {
    const moves = allLegalMoves(gs, gs.turn);
    if (moves.length === 0) return null;
    moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));
    let best = -Infinity;
    let bestMoves = [];
    let alpha = -Infinity;
    const beta = Infinity;
    for (const m of moves) {
      const child = snapshot(gs);
      applyMove(child, m);
      const val = -search(child, depth - 1, -beta, -alpha);
      if (val > best) {
        best = val;
        bestMoves = [m];
      } else if (val === best) {
        bestMoves.push(m);
      }
      if (best > alpha) alpha = best;
    }
    // Random tie-break for variety.
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ----- Node test export (no-op in the browser) -------------------------

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      initialBoard, allLegalMoves, legalMovesFrom, applyMove, gameStatus,
      inCheck, isSquareAttacked, findKing, chooseAIMove, snapshot,
      WHITE, BLACK,
    };
  }

  // ----- UI --------------------------------------------------------------
  // Only wire up the DOM when running in a browser; under Node (tests) the
  // engine above is all that's exercised.
  if (typeof document === "undefined") return;

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const movesEl = document.getElementById("moves");
  const promoOverlay = document.getElementById("promo-overlay");
  let flipped = false;
  let pendingPromotion = null; // {move, resolve}

  function buildBoard() {
    boardEl.innerHTML = "";
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const r = flipped ? 7 - i : i;
        const c = flipped ? 7 - j : j;
        const sq = document.createElement("div");
        sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");
        sq.dataset.r = r;
        sq.dataset.c = c;
        // Rank/file coordinate labels along the edges.
        if (j === 0) {
          const rank = document.createElement("span");
          rank.className = "coord rank";
          rank.textContent = 8 - r;
          sq.appendChild(rank);
        }
        if (i === 7) {
          const file = document.createElement("span");
          file.className = "coord file";
          file.textContent = FILES[c];
          sq.appendChild(file);
        }
        sq.addEventListener("click", () => onSquareClick(r, c));
        boardEl.appendChild(sq);
      }
    }
    render();
  }

  function render() {
    // Clear piece layers and markers but keep coordinate labels.
    for (const sq of boardEl.children) {
      const r = +sq.dataset.r;
      const c = +sq.dataset.c;
      sq.classList.remove("selected", "move-target", "capture-target", "in-check", "last-move");
      const old = sq.querySelector(".piece");
      if (old) old.remove();
      const dot = sq.querySelector(".dot");
      if (dot) dot.remove();

      const piece = state.board[r][c];
      if (piece) {
        const span = document.createElement("span");
        span.className = "piece " + (piece.color === WHITE ? "white-piece" : "black-piece");
        span.textContent = GLYPHS[piece.color + piece.type];
        sq.appendChild(span);
      }
    }

    // Highlight last move.
    const lastMove = state._lastMove;
    if (lastMove) {
      markSquare(lastMove.from.r, lastMove.from.c, "last-move");
      markSquare(lastMove.to.r, lastMove.to.c, "last-move");
    }

    // Highlight selection and its legal targets.
    if (state.selected) {
      markSquare(state.selected.r, state.selected.c, "selected");
      for (const m of state.legalForSelected) {
        const target = squareEl(m.to.r, m.to.c);
        if (!target) continue;
        const dot = document.createElement("span");
        dot.className = "dot";
        if (m.capture) target.classList.add("capture-target");
        else target.classList.add("move-target");
        target.appendChild(dot);
      }
    }

    // Highlight king in check.
    if (inCheck(state.board, state.turn)) {
      const king = findKing(state.board, state.turn);
      if (king) markSquare(king.r, king.c, "in-check");
    }

    renderStatus();
    renderMoves();
  }

  function squareEl(r, c) {
    return boardEl.querySelector(`.square[data-r="${r}"][data-c="${c}"]`);
  }
  function markSquare(r, c, cls) {
    const el = squareEl(r, c);
    if (el) el.classList.add(cls);
  }

  function renderStatus() {
    const status = gameStatus(state);
    const sideToMove = state.turn === WHITE ? "White" : "Black";
    let text;
    switch (status) {
      case "checkmate":
        text = `Checkmate — ${state.turn === WHITE ? "Black" : "White"} wins!`;
        state.gameOver = true;
        break;
      case "stalemate":
        text = "Stalemate — draw.";
        state.gameOver = true;
        break;
      case "draw50":
        text = "Draw — 50-move rule.";
        state.gameOver = true;
        break;
      case "insufficient":
        text = "Draw — insufficient material.";
        state.gameOver = true;
        break;
      case "check":
        text = `${sideToMove} to move — check!`;
        break;
      default:
        text = `${sideToMove} to move.`;
    }
    statusEl.textContent = text;
    statusEl.classList.toggle("over", state.gameOver);
  }

  function renderMoves() {
    movesEl.innerHTML = "";
    for (let i = 0; i < state.history.length; i += 2) {
      const li = document.createElement("li");
      const num = i / 2 + 1;
      const white = state.history[i] || "";
      const black = state.history[i + 1] || "";
      li.innerHTML = `<span class="movenum">${num}.</span> <span class="ply">${white}</span> <span class="ply">${black}</span>`;
      movesEl.appendChild(li);
    }
    movesEl.scrollTop = movesEl.scrollHeight;
  }

  function onSquareClick(r, c) {
    if (state.gameOver) return;
    if (pendingPromotion) return; // wait for promotion choice
    if (state.vsAI && state.turn === state.aiColor) return; // not player's turn

    const piece = state.board[r][c];

    // If a piece is already selected and this is a legal target, move there.
    if (state.selected) {
      const move = state.legalForSelected.find((m) => m.to.r === r && m.to.c === c);
      if (move) {
        playMove(move);
        return;
      }
    }

    // Otherwise (re)select if it's our own piece.
    if (piece && piece.color === state.turn) {
      state.selected = { r, c };
      state.legalForSelected = legalMovesFrom(state, r, c);
    } else {
      state.selected = null;
      state.legalForSelected = [];
    }
    render();
  }

  function playMove(move) {
    // Pawn promotion needs a piece choice; group the four promo variants.
    if (move.promotion) {
      askPromotion(state.turn, (choice) => {
        const chosen = state.legalForSelected.find(
          (m) => m.to.r === move.to.r && m.to.c === move.to.c && m.promotion === choice
        );
        finishMove(chosen);
      });
      return;
    }
    finishMove(move);
  }

  function finishMove(move) {
    applyMove(state, move);
    state._lastMove = move;
    state.selected = null;
    state.legalForSelected = [];
    render();

    if (!state.gameOver && state.vsAI && state.turn === state.aiColor) {
      statusEl.textContent = "Thinking…";
      // Defer so the UI repaints before the (synchronous) search runs.
      setTimeout(() => {
        const aiMove = chooseAIMove(state, 3);
        if (aiMove) {
          applyMove(state, aiMove);
          state._lastMove = aiMove;
        }
        render();
      }, 50);
    }
  }

  // ----- Promotion overlay ----------------------------------------------

  function askPromotion(color, callback) {
    pendingPromotion = callback;
    promoOverlay.innerHTML = "";
    const card = document.createElement("div");
    card.className = "promo-card";
    const label = document.createElement("div");
    label.className = "promo-label";
    label.textContent = "Promote to:";
    card.appendChild(label);
    const row = document.createElement("div");
    row.className = "promo-row";
    for (const t of ["q", "r", "b", "n"]) {
      const btn = document.createElement("button");
      btn.className = "promo-btn " + (color === WHITE ? "white-piece" : "black-piece");
      btn.textContent = GLYPHS[color + t];
      btn.addEventListener("click", () => {
        const cb = pendingPromotion;
        pendingPromotion = null;
        promoOverlay.classList.remove("show");
        cb(t);
      });
      row.appendChild(btn);
    }
    card.appendChild(row);
    promoOverlay.appendChild(card);
    promoOverlay.classList.add("show");
  }

  // ----- New game / controls --------------------------------------------

  function newGame() {
    state.board = initialBoard();
    state.turn = WHITE;
    state.castling = { wK: true, wQ: true, bK: true, bQ: true };
    state.enPassant = null;
    state.selected = null;
    state.legalForSelected = [];
    state.history = [];
    state.gameOver = false;
    state.halfmoveClock = 0;
    state._lastMove = null;
    pendingPromotion = null;
    promoOverlay.classList.remove("show");
    render();
    // If the AI plays White, let it open the game.
    if (state.vsAI && state.aiColor === WHITE) {
      statusEl.textContent = "Thinking…";
      setTimeout(() => {
        const aiMove = chooseAIMove(state, 3);
        if (aiMove) { applyMove(state, aiMove); state._lastMove = aiMove; }
        render();
      }, 50);
    }
  }

  document.getElementById("new-game").addEventListener("click", newGame);
  document.getElementById("flip-board").addEventListener("click", () => {
    flipped = !flipped;
    buildBoard();
  });
  const modeSelect = document.getElementById("mode");
  modeSelect.addEventListener("change", () => {
    state.vsAI = modeSelect.value !== "human";
    state.aiColor = modeSelect.value === "ai-white" ? WHITE : BLACK;
    newGame();
  });

  // ----- Boot ------------------------------------------------------------

  buildBoard();
})();
