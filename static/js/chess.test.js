/*
 * Lightweight engine tests — run with `node static/js/chess.test.js`.
 * Exercises move generation, check/checkmate detection, castling,
 * en passant and promotion against hand-built positions.
 */
const engine = require("./chess.js");
const { initialBoard, allLegalMoves, legalMovesFrom, applyMove, gameStatus,
        inCheck, chooseAIMove, WHITE, BLACK } = engine;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error("FAIL:", msg); }
}

function fresh() {
  return {
    board: initialBoard(), turn: WHITE,
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null, history: [], halfmoveClock: 0, gameOver: false,
  };
}
function empty() {
  return {
    board: Array.from({ length: 8 }, () => new Array(8).fill(null)),
    turn: WHITE, castling: { wK: false, wQ: false, bK: false, bQ: false },
    enPassant: null, history: [], halfmoveClock: 0, gameOver: false,
  };
}
const FILES = "abcdefgh";
function sq(name) { return { r: 8 - +name[1], c: FILES.indexOf(name[0]) }; }
function put(gs, name, color, type) { const s = sq(name); gs.board[s.r][s.c] = { color, type }; }
function move(gs, from, to, extra) {
  const f = sq(from), t = sq(to);
  const m = Object.assign({ from: f, to: t }, extra || {});
  applyMove(gs, m);
}

// 1. Initial position has exactly 20 legal moves for White.
{
  const gs = fresh();
  assert(allLegalMoves(gs, WHITE).length === 20, "20 opening moves for White");
}

// 2. Fool's mate is checkmate.
{
  const gs = fresh();
  move(gs, "f2", "f3");
  move(gs, "e7", "e5", { double: true });
  move(gs, "g2", "g4", { double: true });
  move(gs, "d8", "h4");
  assert(gameStatus(gs) === "checkmate", "fool's mate is checkmate");
  assert(inCheck(gs.board, WHITE), "White king is in check at mate");
}

// 3. Stalemate detection (classic K+Q vs K corner stalemate).
{
  const gs = empty();
  put(gs, "a8", BLACK, "k");
  put(gs, "c7", WHITE, "q");
  put(gs, "a1", WHITE, "k");
  gs.turn = BLACK;
  assert(gameStatus(gs) === "stalemate", "K+Q stalemate detected");
}

// 4. A pinned piece cannot move off the pin line.
{
  const gs = empty();
  put(gs, "e1", WHITE, "k");
  put(gs, "e2", WHITE, "b"); // bishop pinned to king
  put(gs, "e8", BLACK, "r"); // rook delivering the pin
  gs.turn = WHITE;
  const bishopMoves = legalMovesFrom(gs, sq("e2").r, sq("e2").c);
  assert(bishopMoves.length === 0, "pinned bishop has no legal moves");
}

// 5. King-side castling produces king on g1, rook on f1.
{
  const gs = empty();
  gs.castling = { wK: true, wQ: true, bK: false, bQ: false };
  put(gs, "e1", WHITE, "k");
  put(gs, "h1", WHITE, "r");
  gs.turn = WHITE;
  const kMoves = legalMovesFrom(gs, sq("e1").r, sq("e1").c);
  const castle = kMoves.find((m) => m.castle === "K");
  assert(!!castle, "king-side castling is available");
  applyMove(gs, castle);
  assert(gs.board[7][6] && gs.board[7][6].type === "k", "king lands on g1");
  assert(gs.board[7][5] && gs.board[7][5].type === "r", "rook lands on f1");
}

// 6. Cannot castle through an attacked square.
{
  const gs = empty();
  gs.castling = { wK: true, wQ: true, bK: false, bQ: false };
  put(gs, "e1", WHITE, "k");
  put(gs, "h1", WHITE, "r");
  put(gs, "f8", BLACK, "r"); // attacks f1, the king's transit square
  gs.turn = WHITE;
  const kMoves = legalMovesFrom(gs, sq("e1").r, sq("e1").c);
  assert(!kMoves.some((m) => m.castle === "K"), "no castling through check");
}

// 7. En passant capture removes the passed pawn.
{
  const gs = empty();
  put(gs, "e1", WHITE, "k");
  put(gs, "e8", BLACK, "k");
  put(gs, "e5", WHITE, "p");
  put(gs, "d7", BLACK, "p");
  gs.turn = BLACK;
  move(gs, "d7", "d5", { double: true });
  assert(gs.enPassant && gs.enPassant.r === sq("d6").r, "en passant target set");
  const wp = legalMovesFrom(gs, sq("e5").r, sq("e5").c);
  const ep = wp.find((m) => m.enPassant);
  assert(!!ep, "en passant capture is legal");
  applyMove(gs, ep);
  assert(gs.board[sq("d5").r][sq("d5").c] === null, "captured pawn removed");
  assert(gs.board[sq("d6").r][sq("d6").c].type === "p", "capturing pawn advanced");
}

// 8. Pawn promotion creates a queen.
{
  const gs = empty();
  put(gs, "e1", WHITE, "k");
  put(gs, "e8", BLACK, "k");
  put(gs, "a7", WHITE, "p");
  gs.turn = WHITE;
  const moves = legalMovesFrom(gs, sq("a7").r, sq("a7").c);
  const promo = moves.find((m) => m.promotion === "q");
  assert(!!promo, "promotion move generated");
  applyMove(gs, promo);
  assert(gs.board[0][0].type === "q", "pawn promoted to queen");
}

// 9. AI finds mate in one (back-rank).
{
  const gs = empty();
  put(gs, "g1", WHITE, "k");
  put(gs, "a1", WHITE, "r");
  put(gs, "h8", BLACK, "k");
  put(gs, "g7", BLACK, "p");
  put(gs, "h7", BLACK, "p");
  gs.turn = WHITE;
  const best = chooseAIMove(gs, 3);
  applyMove(gs, best);
  assert(gameStatus(gs) === "checkmate", "AI plays Ra8# back-rank mate");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
