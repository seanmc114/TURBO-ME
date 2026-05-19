/**
 * TURBO ARCADE — CODE ENGINE
 * ─────────────────────────────────────────────────────────
 * Shared between every game and the arcade hub.
 * Drop this file into every repo as code-engine.js
 * Include with: <script src="code-engine.js"></script>
 *
 * How it works:
 *   generateCode(gameId, score)  → "K7X2QF"
 *   validateCode(code, gameId)   → { valid: true, score: 47 } or { valid: false }
 *
 * The code encodes: gameId + score + secret salt → 6-char hash
 * Score is embedded so the arcade can read the real value back.
 * Cannot be faked without knowing TURBO_SALT.
 * ─────────────────────────────────────────────────────────
 */

const TURBO_SALT = "SyngeSt2026ViriliterAge";  // 🔒 secret — same in all files

const GAME_IDS = {
  // Time-based games (score = best time in seconds, lower = better)
  'turbo-verbs':    'TV',
  'weather':        'WX',
  'waswere':        'WW',
  'interrogative':  'IQ',
  'subjunctive':    'SJ',
  'avery':          'AV',
  'turbo2':         'T2',
  // Star/points games (score = integer, higher = better)
  'review1':        'R1',
  'review2':        'R2',
  'review3':        'R3',
  // AI oral game (score = total stars)
  'turbome':        'TM',
};

// Reverse lookup: prefix → gameId
const PREFIX_TO_ID = Object.fromEntries(
  Object.entries(GAME_IDS).map(([k,v]) => [v,k])
);

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids confusion

/**
 * Simple non-cryptographic hash — deterministic, fast, good enough.
 * Returns a number 0–(2^32-1).
 */
function _hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Encode score as a 2-char base-32 string (0–1023 range covers all realistic scores)
 * Time scores: stored as Math.round(seconds * 10) to preserve one decimal
 * Star/point scores: stored as integer directly
 */
function _encodeScore(score, isTime) {
  const val = isTime ? Math.round(score * 10) : Math.round(score);
  const clamped = Math.max(0, Math.min(1023, val));
  return CHARS[Math.floor(clamped / 32)] + CHARS[clamped % 32];
}

function _decodeScore(two, isTime) {
  const a = CHARS.indexOf(two[0]);
  const b = CHARS.indexOf(two[1]);
  if (a < 0 || b < 0) return null;
  const val = a * 32 + b;
  return isTime ? val / 10 : val;
}

function _isTimeGame(gameId) {
  return !['review1','review2','review3','turbome'].includes(gameId);
}

/**
 * generateCode(gameId, score) → 6-char code string
 *
 * Format: [2-char prefix][2-char encoded score][2-char checksum]
 * Example: "TVK7QF"
 */
function generateCode(gameId, score) {
  const prefix = GAME_IDS[gameId];
  if (!prefix) { console.warn('Unknown gameId:', gameId); return null; }

  const isTime = _isTimeGame(gameId);
  const encoded = _encodeScore(score, isTime);
  const checkInput = prefix + encoded + TURBO_SALT;
  const h = _hash32(checkInput);

  // Turn hash into 2 chars
  const c1 = CHARS[h % 32];
  const c2 = CHARS[Math.floor(h / 32) % 32];

  return prefix + encoded + c1 + c2;
}

/**
 * validateCode(code) → { valid: true, gameId, score, isTime } | { valid: false }
 */
function validateCode(code) {
  if (!code || code.length !== 6) return { valid: false };
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 6) return { valid: false };

  const prefix  = clean.slice(0, 2);
  const encoded = clean.slice(2, 4);
  const check   = clean.slice(4, 6);

  const gameId = PREFIX_TO_ID[prefix];
  if (!gameId) return { valid: false };

  // Recompute checksum
  const checkInput = prefix + encoded + TURBO_SALT;
  const h = _hash32(checkInput);
  const c1 = CHARS[h % 32];
  const c2 = CHARS[Math.floor(h / 32) % 32];

  if (check !== c1 + c2) return { valid: false };

  const isTime = _isTimeGame(gameId);
  const score = _decodeScore(encoded, isTime);
  if (score === null) return { valid: false };

  return { valid: true, gameId, score, isTime };
}

// ── For use in game files ──────────────────────────────
// Call this after saving a new personal best:
//
//   const code = generateCode('turbo-verbs', bestTime);
//   showCodeToPlayer(code);
//
// ── For use in the arcade ──────────────────────────────
// Call this when player submits a code:
//
//   const result = validateCode(inputValue);
//   if (result.valid) { /* save result.score for result.gameId */ }
