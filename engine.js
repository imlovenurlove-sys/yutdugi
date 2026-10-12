/* 윷두기 규칙 엔진 — 브라우저/Node 공용, 부수효과 없음(순수 함수) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YUT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 말판 ----------
  // 바깥 20칸: 0=출발(집), 1..19, 완주 = F. 모서리 5(우상), 10(좌상), 15(좌하).
  // 지름길: 5→20→21→22(중앙)→23→24→15,  10→25→26→22(중앙)→27→28→F
  const F = 99;      // 완주(말판 밖)
  const START = 30;  // 출발점 칸(정확히 서는 경우) — exactFinish 규칙에서만 쓰임
  const ROUTES = {
    OUTER: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, START, F],
    FROM5: [5, 20, 21, 22, 23, 24, 15, 16, 17, 18, 19, START, F],
    FROM10: [10, 25, 26, 22, 27, 28, START, F],
    FROM22: [22, 27, 28, START, F],
  };
  const BRANCH = { 5: 'FROM5', 10: 'FROM10', 22: 'FROM22' };

  const RESULT = ['모', '도', '개', '걸', '윷']; // index = 배(평평한 면)가 위로 온 가락 수
  const STEPS = [5, 1, 2, 3, 4];

  // ---------- 상태 ----------
  // sticks[p] = [bool, bool]  (true = 배면이 위 = 셈에 들어감)
  // pieces[p] = [{route, idx, done}]
  function newGame(opts) {
    opts = opts || {};
    const np = (opts.pieces === 3) ? 3 : 4; // 말 수: 3동 또는 4동(기본)
    const g0 = {
      sticks: [[false, false], [false, false]], // 처음엔 네 가락 모두 엎어진 상태(모) → 첫 수는 도로 고정
      pieces: [0, 1].map(() => Array.from({ length: np }, () => ({ route: 'OUTER', idx: 0, done: false }))),
      npieces: np,
      turn: 0,           // 0 = 선(先), 1 = 후(後)
      ply: 0,            // 진행된 수
      result: null,      // 이번 턴 판정 인덱스(0~4), 뒤집기 전엔 null
      pending: null,     // 뒤집기 후 아직 말을 안 옮긴 상태의 정보
      winner: null,      // 0 | 1 | -1(무승부: 같은 국면 3회 반복)
      seen: {},          // 국면 반복 횟수
      history: [],       // {p, stick, result, move}
      exactFinish: !!opts.exactFinish, // true면 출발점에 정확히 서야 완주 아님(전통 규칙), 기본 false
      komi: opts.komi || 'none',       // 'none' | 'pass'(후가 한 번 안 뒤집을 수 있음) | 'head'(후 말 하나가 1칸에서 출발) | 'three'(후는 3동만 완주)
      passes: [0, opts.komi === 'pass' ? 1 : 0],
      names: opts.names || ['선', '후'],
    };
    if (opts.komi === 'head') g0.pieces[1][0] = { route: 'OUTER', idx: 1, done: false };
    if (opts.komi === 'three') g0.pieces[1][np - 1] = { route: 'OUTER', idx: 0, done: true };
    return g0;
  }

  function clone(g) { return JSON.parse(JSON.stringify(g)); }

  function countUp(sticks) {
    return sticks[0].filter(Boolean).length + sticks[1].filter(Boolean).length;
  }

  function nodeOf(pc) { return pc.done ? F : ROUTES[pc.route][pc.idx]; }

  // 이 플레이어가 뒤집어서 만들 수 있는 결과들: [{stick, result}]
  function flipOptions(g, p) {
    p = p == null ? g.turn : p;
    const base = countUp(g.sticks);
    const out = [];
    for (let s = 0; s < 2; s++) {
      const r = base + (g.sticks[p][s] ? -1 : 1);
      if (!out.some(o => o.result === r)) out.push({ stick: s, result: r });
    }
    if (g.passes && g.passes[p] > 0) out.push({ stick: -1, result: base, pass: true }); // 덤: 안 뒤집고 그대로
    return out;
  }

  // 말 이동 옵션: 같은 칸의 내 말은 뭉쳐(둑) 함께 움직인다.
  // 반환 [{from: node, ids:[...], to: node|F, captures:[ids], stacks:[ids]}]
  function moveOptions(g, p, result) {
    p = p == null ? g.turn : p;
    result = result == null ? g.result : result;
    if (result == null) return [];
    const steps = STEPS[result];
    const mine = g.pieces[p];
    const groups = new Map(); // node -> ids
    mine.forEach((pc, i) => {
      if (pc.done) return;
      const n = nodeOf(pc);
      if (!groups.has(n)) groups.set(n, []);
      else if (n === 0) return; // 집에 있는 말은 한 번에 한 동만 나간다
      groups.get(n).push(i);
    });
    const opts = [];
    groups.forEach((ids, from) => {
      const lead = mine[ids[0]];
      const route = ROUTES[lead.route];
      const ni = lead.idx + steps;
      let to, newRoute = lead.route, newIdx = ni;
      if (ni >= route.length - 1) { to = F; }
      else {
        to = route[ni];
        if (to === START && !g.exactFinish) to = F; // 기본 규칙: 출발점에 닿으면 완주
        else if (BRANCH[to]) { newRoute = BRANCH[to]; newIdx = 0; }
      }
      const captures = [], stacks = [];
      if (to !== F) {
        g.pieces[1 - p].forEach((pc, i) => { if (!pc.done && nodeOf(pc) === to) captures.push(i); });
        mine.forEach((pc, i) => { if (!pc.done && nodeOf(pc) === to && !ids.includes(i)) stacks.push(i); });
      }
      opts.push({ from, ids, to, route: newRoute, idx: newIdx, captures, stacks });
    });
    return opts;
  }

  // 1단계: 가락 뒤집기
  function flip(g, stick) {
    if (g.winner != null) throw new Error('game over');
    if (g.pending) throw new Error('이미 뒤집었습니다. 말을 옮기세요.');
    const p = g.turn;
    const n = clone(g);
    if (stick === -1) { // 덤(패스): 뒤집지 않고 지금 결과로 둔다
      if (!(n.passes && n.passes[p] > 0)) throw new Error('덤이 없습니다');
      n.passes[p] -= 1;
    } else n.sticks[p][stick] = !n.sticks[p][stick];
    n.result = countUp(n.sticks);
    n.pending = { stick };
    return n;
  }

  // 2단계 내부: 반복 금지 검사 없이 말을 옮긴 결과
  function applyMove(g, opt) {
    const p = g.turn;
    const n = clone(g);
    const mine = n.pieces[p];
    const movers = opt.ids.concat(opt.stacks);
    movers.forEach(i => {
      if (opt.to === F) { mine[i].done = true; mine[i].route = 'OUTER'; mine[i].idx = 0; }
      else { mine[i].done = false; mine[i].route = opt.route; mine[i].idx = opt.idx; }
    });
    opt.captures.forEach(i => { n.pieces[1 - p][i] = { route: 'OUTER', idx: 0, done: false }; });
    n.history.push({ p, stick: g.pending.stick, result: g.result, from: opt.from, to: opt.to, captured: opt.captures.length, stacked: opt.stacks.length });
    if (mine.every(pc => pc.done)) n.winner = p;
    n.turn = 1 - p;
    if (n.winner == null) {
      const key = posKey(n);
      n.seen[key] = (n.seen[key] || 0) + 1;
      if (n.seen[key] >= 3) n.winner = -1; // 같은 판이 세 번째 — 반복 금지 규칙에선 '다른 수가 없을 때'만 일어난다
    }
    n.ply += 1;
    n.result = null;
    n.pending = null;
    return n;
  }

  // 반복 금지(바둑의 패처럼): 같은 판(차례·가락·말 자리)을 세 번째로 만드는 수는 둘 수 없다.
  // 단, 이번 차례에 둘 수 있는 수가 모두 그런 수뿐이면 막지 않는다 → 그 수를 두면 무승부.
  // turnMoves(g): 뒤집기 전 상태에서 이번 차례의 모든 (가락, 말) 조합 — {stick, result, from, to, ..., next, banned, ok}
  function turnMoves(g) {
    if (g.winner != null || g.pending) return [];
    const p = g.turn, out = [], keys = {};
    const sticks = [0, 1].concat(g.passes && g.passes[p] > 0 ? [-1] : []);
    sticks.forEach(st => {
      const gf = flip(g, st);
      moveOptions(gf).forEach(o => {
        const next = applyMove(gf, o);
        const k = posKey(next) + '#' + o.from; // 같은 결과를 내는 두 가락은 하나로
        if (keys[k]) return; keys[k] = 1;
        out.push(Object.assign({ stick: st, result: gf.result }, o, { next, banned: next.winner === -1 }));
      });
    });
    const anyOk = out.some(m => !m.banned);
    out.forEach(m => { m.ok = anyOk ? !m.banned : true; });
    return out;
  }

  // 뒤집은 뒤(pending) 상태에서 고를 수 있는 말 이동: moveOptions + {banned, ok}
  function moveChoices(g) {
    if (!g.pending) return [];
    const unflipped = Object.assign({}, g, { sticks: g.sticks.map(a => a.slice()), pending: null, result: null });
    if (g.pending.stick >= 0) unflipped.sticks[g.turn][g.pending.stick] = !unflipped.sticks[g.turn][g.pending.stick];
    else unflipped.passes = g.passes.map((v, i) => i === g.turn ? v + 1 : v);
    const turnOk = turnMoves(unflipped).some(m => !m.banned);
    return moveOptions(g).map(o => {
      const next = applyMove(g, o);
      const banned = next.winner === -1;
      return Object.assign({}, o, { next, banned, ok: turnOk ? !banned : true });
    });
  }

  // 가락별로 뒤집을 수 있는지: [{stick, result, ok}] — ok=false면 그 가락을 뒤집으면 둘 수 있는 수가 없다(반복 금지)
  function stickChoices(g, p) {
    p = p == null ? g.turn : p;
    const base = countUp(g.sticks);
    const tm = p === g.turn ? turnMoves(g) : [];
    return [0, 1].map(s => {
      const result = base + (g.sticks[p][s] ? -1 : 1);
      const ok = p === g.turn ? tm.some(m => m.ok && (m.stick === s || (m.result === result && m.stick !== -1))) : false;
      return { stick: s, result, ok };
    });
  }

  // 2단계: 말 옮기기 (from 노드 또는 moveOptions 원소)
  function move(g, from) {
    if (!g.pending) throw new Error('먼저 가락을 뒤집으세요.');
    const f = typeof from === 'object' ? from.from : from;
    const opt = moveChoices(g).find(o => o.from === f);
    if (!opt) throw new Error('잘못된 이동');
    if (!opt.ok) throw new Error('같은 판을 세 번째로 만드는 수는 둘 수 없습니다.');
    return opt.next;
  }

  function posKey(g) {
    return g.turn + '|' + (g.passes ? g.passes.join('') : '') + '|' + g.sticks.map(s => s.filter(Boolean).length).join('/') + '|' +
      g.pieces.map(ps => ps.map(pc => pc.done ? 'F' : pc.route[0] + pc.route[4] + pc.idx).sort().join(',')).join('/');
  }

  // 한 수 전체 (뒤집기+이동)
  function play(g, stick, from) { return move(flip(g, stick), from); }

  // 이 턴에 둘 수 있는 전체 수(반복 금지 반영): [{stick, result, from, to, captures, stacks, next}]
  function legalMoves(g) { return turnMoves(g).filter(m => m.ok); }

  // ---------- 평가/AI ----------
  // 진척도: 말이 완주에 얼마나 가까운지(남은 칸 수 기준)
  function remaining(pc) {
    if (pc.done) return 0;
    return ROUTES[pc.route].length - 1 - pc.idx;
  }
  function evaluate(g, p) {
    if (g.winner != null) return g.winner === -1 ? 0 : (g.winner === p ? 10000 : -10000);
    let s = 0;
    for (let q = 0; q < 2; q++) {
      const sign = q === p ? 1 : -1;
      g.pieces[q].forEach(pc => {
        if (pc.done) s += sign * 40;
        else if (pc.idx > 0 || pc.route !== 'OUTER') s += sign * (25 - remaining(pc)); // 나온 말: 남은 칸이 적을수록 좋음
      });
    }
    return s;
  }

  function search(g, depth, alpha, beta, me) {
    if (depth === 0 || g.winner != null) return evaluate(g, me);
    const moves = legalMoves(g);
    const maximizing = g.turn === me;
    let best = maximizing ? -Infinity : Infinity;
    for (const m of moves) {
      const v = search(m.next, depth - 1, alpha, beta, me);
      if (maximizing) { if (v > best) best = v; if (best > alpha) alpha = best; }
      else { if (v < best) best = v; if (best < beta) beta = best; }
      if (beta <= alpha) break;
    }
    return best;
  }

  // 국면 가치(탐색 포함): side 입장에서의 점수
  function valueOf(g, depth, side) {
    g = Object.assign({}, g, { history: [] });
    return search(g, depth || 4, -Infinity, Infinity, side);
  }

  function bestMove(g, depth) {
    depth = depth || 4;
    g = Object.assign({}, g, { history: [] });
    const me = g.turn;
    const moves = legalMoves(g);
    let best = null, bestV = -Infinity;
    // 잡기·완주 등 확실히 좋은 수를 먼저 보면 가지치기가 잘 됨
    moves.sort((a, b) => (b.captures.length * 10 + (b.to === F ? 5 : 0)) - (a.captures.length * 10 + (a.to === F ? 5 : 0)));
    for (const m of moves) {
      const v = search(m.next, depth - 1, -Infinity, Infinity, me);
      if (v > bestV) { bestV = v; best = m; }
    }
    if (best) delete best.next;
    return best;
  }

  return { F, START, posKey, ROUTES, BRANCH, RESULT, STEPS, newGame, clone, countUp, nodeOf, flipOptions, moveOptions, moveChoices, stickChoices, turnMoves, flip, move, play, legalMoves, evaluate, bestMove, valueOf, remaining };
});
