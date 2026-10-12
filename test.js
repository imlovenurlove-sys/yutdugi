const Y = require('./engine.js');
const assert = require('assert');
let n = 0;
function t(name, fn) { try { fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.message); process.exitCode = 1; } }

t('첫 수는 도로 고정 (어느 가락을 뒤집어도 도)', () => {
  const g = Y.newGame();
  const fo = Y.flipOptions(g);
  assert.deepStrictEqual(fo.map(o => Y.RESULT[o.result]), ['도']);
});

t('둘째 수(후)는 개로 고정', () => {
  let g = Y.play(Y.newGame(), 0, 0);
  assert.strictEqual(g.turn, 1);
  assert.deepStrictEqual(Y.flipOptions(g).map(o => Y.RESULT[o.result]), ['개']);
  assert.strictEqual(Y.nodeOf(g.pieces[0][0]), 1);
});

t('셋째 수: 선은 도(배면을 엎음) 또는 걸(엎어진 것을 배면으로) 선택', () => {
  let g = Y.play(Y.newGame(), 0, 0);
  g = Y.play(g, 0, 0); // 후: 개 → 새 말 2번 칸
  assert.strictEqual(Y.nodeOf(g.pieces[1][0]), 2);
  const fo = Y.flipOptions(g);
  assert.deepStrictEqual(fo.map(o => Y.RESULT[o.result]).sort(), ['걸', '도']);
});

t('도로 상대의 개 자리 말을 잡는다 (규칙 원문 예시)', () => {
  let g = Y.play(Y.newGame(), 0, 0);
  g = Y.play(g, 0, 0);
  const doOpt = Y.flipOptions(g).find(o => Y.RESULT[o.result] === '도');
  g = Y.flip(g, doOpt.stick);
  const mv = Y.moveOptions(g).find(o => o.from === 1); // 1번 칸 말을 도로 → 2번
  assert.deepStrictEqual(mv.captures, [0]);
  g = Y.move(g, 1);
  assert.strictEqual(Y.nodeOf(g.pieces[0][0]), 2);
  assert.strictEqual(Y.nodeOf(g.pieces[1][0]), 0); // 잡혀서 집으로
  assert.strictEqual(g.turn, 1, '잡아도 한 번 더 없음');
});

t('윷·모가 나도 턴은 넘어간다', () => {
  let g = Y.newGame();
  g.sticks = [[true, false], [true, true]]; // 3 → 선이 뒤집으면 개 또는 윷
  const yut = Y.flipOptions(g).find(o => o.result === 4);
  g = Y.play(g, yut.stick, 0);
  assert.strictEqual(g.turn, 1);
  assert.strictEqual(Y.nodeOf(g.pieces[0][0]), 4);
});

t('모(0)에서는 도로만, 윷(4)에서는 걸로만 갈 수 있다 — 결과는 한 칸씩만 움직이는 사다리', () => {
  let g = Y.newGame(); g.sticks = [[false, false], [false, false]];
  assert.deepStrictEqual(Y.flipOptions(g).map(o => o.result), [1]);
  g.sticks = [[true, true], [true, true]];
  assert.deepStrictEqual(Y.flipOptions(g).map(o => o.result), [3]);
});

t('모(5칸)로 나가면 우상 모서리(5)에 서고 지름길로 접어든다', () => {
  let g = Y.newGame(); g.sticks = [[true, false], [false, false]]; // 1 → 선은 0(모) 또는 2
  const mo = Y.flipOptions(g).find(o => o.result === 0);
  g = Y.play(g, mo.stick, 0);
  const pc = g.pieces[0][0];
  assert.strictEqual(Y.nodeOf(pc), 5);
  assert.strictEqual(pc.route, 'FROM5');
  // 다음에 걸(3)이면 5→20→21→22 중앙에 정확히 섬 → FROM22
  g.turn = 0; g.sticks = [[false, false], [true, true]]; // 2 → 3 가능
  const geol = Y.flipOptions(g).find(o => o.result === 3);
  g = Y.play(g, geol.stick, 5);
  assert.strictEqual(Y.nodeOf(g.pieces[0][0]), 22);
  assert.strictEqual(g.pieces[0][0].route, 'FROM22');
  // 중앙에서 걸이면 22→27→28→출발점 = 완주
  g.turn = 0; g.sticks = [[false, false], [true, true]];
  g = Y.play(g, 0, 22);
  assert.strictEqual(g.pieces[0][0].done, true);
});

t('5번 모서리를 지나치면 바깥길로 계속 간다', () => {
  let g = Y.newGame();
  g.pieces[0][0] = { route: 'OUTER', idx: 4, done: false };
  g.sticks = [[false, false], [true, false]]; // 1 → 0(모=5칸) 또는 2
  const gae = Y.flipOptions(g).find(o => o.result === 2);
  g = Y.play(g, gae.stick, 4);
  assert.strictEqual(Y.nodeOf(g.pieces[0][0]), 6);
  assert.strictEqual(g.pieces[0][0].route, 'OUTER');
});

t('중앙을 지나치면(5쪽 지름길) 좌하(15) 방향으로 계속', () => {
  let g = Y.newGame();
  g.pieces[0][0] = { route: 'FROM5', idx: 2, done: false }; // 21번 칸
  g.sticks = [[false, false], [true, false]]; // → 개(2) 가능: 21→22→23
  g = Y.play(g, 0, 21);
  assert.strictEqual(Y.nodeOf(g.pieces[0][0]), 23);
});

t('둑(업기): 같은 칸에 도착하면 함께 움직인다', () => {
  let g = Y.newGame();
  g.pieces[0][0] = { route: 'OUTER', idx: 3, done: false };
  g.pieces[0][1] = { route: 'OUTER', idx: 1, done: false };
  g.sticks = [[false, false], [true, false]]; // → 개
  g = Y.flip(g, 0);
  const mv = Y.moveOptions(g).find(o => o.from === 1);
  assert.deepStrictEqual(mv.stacks, [0]);
  g = Y.move(g, 1);
  assert.strictEqual(Y.nodeOf(g.pieces[0][0]), 3);
  assert.strictEqual(Y.nodeOf(g.pieces[0][1]), 3);
  // 다음 선 턴에 둑이 함께 이동
  g.turn = 0; g.sticks = [[false, false], [true, false]];
  g = Y.flip(g, 0);
  const opts = Y.moveOptions(g);
  assert.strictEqual(opts.filter(o => o.from === 3).length, 1);
  assert.deepStrictEqual(opts.find(o => o.from === 3).ids, [0, 1]);
  g = Y.move(g, 3);
  assert.strictEqual(Y.nodeOf(g.pieces[0][0]), 5);
  assert.strictEqual(Y.nodeOf(g.pieces[0][1]), 5);
});

t('둑을 잡으면 전부 집으로', () => {
  let g = Y.newGame();
  g.pieces[1][0] = { route: 'OUTER', idx: 2, done: false };
  g.pieces[1][1] = { route: 'OUTER', idx: 2, done: false };
  g.sticks = [[false, false], [true, false]]; // → 개: 집에서 2번 칸
  g = Y.play(g, 0, 0);
  assert.strictEqual(Y.nodeOf(g.pieces[1][0]), 0);
  assert.strictEqual(Y.nodeOf(g.pieces[1][1]), 0);
});

t('4동 모두 완주하면 승리', () => {
  let g = Y.newGame();
  g.pieces[0] = [0, 1, 2].map(() => ({ route: 'OUTER', idx: 0, done: true })).concat([{ route: 'OUTER', idx: 19, done: false }]);
  g.sticks = [[false, false], [false, false]]; // → 도
  g = Y.play(g, 0, 19);
  assert.strictEqual(g.winner, 0);
});

t('exactFinish 규칙: 출발점에 정확히 서면 아직 완주 아님', () => {
  let g = Y.newGame({ exactFinish: true });
  g.pieces[0][0] = { route: 'OUTER', idx: 19, done: false };
  g.sticks = [[false, false], [false, false]]; // → 도
  g = Y.play(g, 0, 19);
  assert.strictEqual(g.pieces[0][0].done, false);
  assert.strictEqual(Y.nodeOf(g.pieces[0][0]), Y.START);
});

t('항상 최소 한 수는 둘 수 있다 (무작위 200국)', () => {
  let maxPly = 0;
  for (let k = 0; k < 200; k++) {
    let g = Y.newGame();
    while (g.winner == null && g.ply < 400) {
      const ms = Y.legalMoves(g);
      assert.ok(ms.length > 0, '둘 수 없음 ply=' + g.ply);
      const m = ms[Math.floor(Math.random() * ms.length)];
      g = Y.play(g, m.stick, m.from);
    }
    maxPly = Math.max(maxPly, g.ply);
  }
  console.log('   (무작위 최장 대국', maxPly, '수)');
});

t('AI가 안전한 잡기 수를 찾는다', () => {
  let g = Y.newGame();
  g.pieces[0][0] = { route: 'OUTER', idx: 17, done: false };
  g.pieces[1][0] = { route: 'OUTER', idx: 18, done: false }; // 상대 말이 완주 직전
  g.sticks = [[false, false], [false, false]]; // → 도
  const m = Y.bestMove(g, 3);
  assert.strictEqual(m.captures.length, 1);
});

t('3수째 "도로 잡기"는 즉시 되잡히므로 AI는 걸을 택한다 (전략적 함정 확인)', () => {
  let g = Y.play(Y.newGame(), 0, 0);
  g = Y.play(g, 0, 0);
  const m = Y.bestMove(g, 2);
  assert.strictEqual(Y.RESULT[m.result], '걸');
});

t('3동 옵션: 말이 3개씩이고 3개 완주하면 승리', () => {
  let g = Y.newGame({ pieces: 3 });
  assert.strictEqual(g.pieces[0].length, 3);
  assert.strictEqual(g.pieces[1].length, 3);
  assert.strictEqual(g.npieces, 3);
  g.pieces[0] = [{ route: 'OUTER', idx: 0, done: true }, { route: 'OUTER', idx: 0, done: true }, { route: 'OUTER', idx: 19, done: false }];
  g.sticks = [[false, false], [false, false]]; // → 도
  const ms = Y.legalMoves(g).filter(m => m.to === Y.F);
  assert.ok(ms.length > 0);
  g = Y.play(g, ms[0].stick, ms[0].from);
  assert.strictEqual(g.winner, 0);
  let g4 = Y.newGame();
  assert.strictEqual(g4.pieces[0].length, 4);
});

t('반복 금지: 같은 판을 세 번째로 만드는 수는 막히고, 막을 수 없을 때만 무승부', () => {
  let rng = 7; const rnd = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
  let bannedSeen = 0, forcedDraws = 0, threw = 0;
  for (let k = 0; k < 400; k++) {
    let g = Y.newGame({ exactFinish: true, pieces: k % 2 ? 3 : 4 });
    while (g.winner == null && g.ply < 400) {
      const tm = Y.turnMoves(g);
      const ok = tm.filter(m => m.ok);
      assert.ok(ok.length > 0, '둘 수 있는 수가 없음');
      const banned = tm.filter(m => !m.ok);
      if (banned.length) {
        bannedSeen++;
        const b = banned[0];
        const gf = Y.flip(g, b.stick);
        if (Y.moveChoices(gf).some(o => o.from === b.from && !o.ok)) { assert.throws(() => Y.move(gf, b.from)); threw++; }
      }
      // 반복을 일부러 노리는 쪽: 가능하면 막힌 수와 같은 결과를 내는 수를 고른다
      const m = ok[Math.floor(rnd() * ok.length)];
      const before = tm.every(x => x.banned);
      g = Y.play(g, m.stick, m.from);
      if (g.winner === -1) { assert.ok(before, '다른 수가 있었는데 무승부가 났다'); forcedDraws++; }
    }
    Object.values(g.seen).forEach(c => assert.ok(c <= 3));
  }
  console.log(`   (막힌 수가 생긴 차례 ${bannedSeen}번, move() 거부 확인 ${threw}번, 강제 무승부 ${forcedDraws}판)`);
  assert.ok(bannedSeen > 0 && threw > 0);
});

t('반복 판정에서 내 두 가락은 서로 바꿔도 같은 판', () => {
  const a = Y.newGame(), b = Y.newGame();
  a.sticks = [[true, false], [false, false]]; b.sticks = [[false, true], [false, false]];
  assert.strictEqual(Y.posKey(a), Y.posKey(b));
});

t('3동에서 후 덤(three) 옵션도 오류 없이 만들어진다', () => {
  const g = Y.newGame({ pieces: 3, komi: 'three' });
  assert.strictEqual(g.pieces[1].length, 3);
  assert.strictEqual(g.pieces[1][2].done, true);
});

console.log(`\n${n} tests passed`);
