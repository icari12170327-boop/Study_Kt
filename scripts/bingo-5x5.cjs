// 설치된 Playwright·Chromium으로 빙고만 검사한다. 새 앱 의존성은 추가하지 않는다.
// PLAYWRIGHT_MODULE=/설치된/playwright/index.js node scripts/bingo-5x5.cjs [서버 URL] [저장소 밖 결과 폴더]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:5173';
const out = path.resolve(process.argv[3] || '/tmp/study-kt-bingo-5x5');
const sizes = [[390, 844], [1333, 800], [2560, 1440], [375, 844], [820, 1180]];

// 가족 데이터 대신 합성 기록만 사용한다. 예전 99개 기록은 새 최고 화면에 나오면 안 된다.
const fixture = `
import React from '/node_modules/.vite/deps/react.js?REACT_HASH';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?DOM_HASH';
import '/src/styles.css';
import {StoreProvider} from 'STORE_MODULE';
import {defaultState} from '/src/store/defaults.ts';
import {seededRng} from '/src/lib/random.ts';
import {MathBingo} from '/src/pages/MathBingo.tsx';
const pid = new URL(location.href).searchParams.get('profile');
const state = defaultState(), level = pid === 'kid1' ? 'g5' : 'g3';
const limitSec = state.settings[pid].bingo.limitSec;
const rec = {date:'2026-10-11',level,limitSec,found:99,bingos:19,hints:0};
state.data[pid].bingo = {recent:[rec],best:{[String(limitSec)]:rec}};
Math.random = seededRng(26);
localStorage.setItem('study-kt:v1', JSON.stringify(state));
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(StoreProvider,null,React.createElement(MathBingo,{profileId:pid,go:()=>{}})));
`;

async function prepare(page, profile, mode) {
  const source = await (await page.request.get(`${url}/src/main.tsx`)).text();
  const reactHash = source.match(/react\.js\?([^\"]+)/)?.[1];
  const domHash = source.match(/react-dom_client\.js\?([^\"]+)/)?.[1];
  const storeModule = source.match(/from \"([^\"]*\/store\/StoreContext\.tsx[^\"]*)\"/)?.[1];
  assert(reactHash && domHash && storeModule, '개발 서버의 모듈 주소를 확인해 주세요.');
  await page.route('**/src/main.tsx*', route => route.fulfill({contentType: 'application/javascript', body: fixture.replaceAll('REACT_HASH', reactHash).replaceAll('DOM_HASH', domHash).replaceAll('STORE_MODULE', storeModule)}));
  await page.clock.install();
  await page.goto(`${url}/?profile=${profile}`);
  await page.getByText(/최고 기록: 아직 없어요/).waitFor();
  assert(!await page.getByText(/99개/).count());
  if (mode === 'practice') await page.getByRole('button', {name: '🐢 연습', exact: true}).click();
  await page.getByRole('button', {name: '시작하기', exact: true}).click();
  await page.locator('.bingo-board').waitFor();
  await page.clock.fastForward(mode === 'time' ? 24000 : 41000);
  await page.getByRole('button', {name: /💡 힌트/}).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function audit(page, info) {
  return page.evaluate(info => {
    const rect = el => {
      const r = el.getBoundingClientRect();
      return {width: r.width, height: r.height, bottom: r.bottom, fits: r.top >= 0 && r.left >= 0 && r.right <= info.width + .5 && r.bottom <= info.height + .5};
    };
    const board = rect(document.querySelector('.bingo-board'));
    const goal = rect(document.querySelector('.bingo-goal'));
    const buttons = [...document.querySelectorAll('.bingo-page > .row-center button')].map(el => ({text: el.textContent.trim(), ...rect(el)}));
    const cellRects = [...document.querySelectorAll('.bingo-cell')].map(rect);
    const touchMin = info.width >= 600 ? 48 : 44;
    return {...info, board, goal, buttons, cells: cellRects.length,
      touchFits: [...cellRects, ...buttons].every(r => r.width >= touchMin - .5 && r.height >= touchMin - .5),
      overflow: document.documentElement.scrollWidth > info.width};
  }, info);
}

async function main() {
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  const rows = [], errors = [];
  let examples;
  try {
    for (const [width, height] of sizes) for (const theme of ['light', 'dark']) for (const profile of ['kid1', 'kid2']) for (const mode of ['time', 'practice']) {
      const page = await browser.newPage({viewport: {width, height}, hasTouch: width < 1800, colorScheme: theme, timezoneId: 'Asia/Seoul'});
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      await prepare(page, profile, mode);
      if (!examples) examples = await page.evaluate(async () => {
        const {generateBingoBoard, findLines} = await import('/src/content/math/bingo.ts');
        const {seededRng} = await import('/src/lib/random.ts');
        return {g3: generateBingoBoard('g3', seededRng(16)), boards: [generateBingoBoard('g5', seededRng(16)), generateBingoBoard('g5', () => 0, {productMix: 'many'})].map(board => ({...board, solutions: board.goals.map(goal => findLines(board, goal).length)}))};
      });
      const row = await audit(page, {width, height, theme, profile, mode});
      rows.push(row);
      fs.writeFileSync(path.join(out, 'progress.json'), JSON.stringify({rows, errors, examples}, null, 2));
      await page.screenshot({path: path.join(out, `${profile}-${mode}-${width}x${height}-${theme}.png`), fullPage: true});
      assert.equal(row.cells, 25);
      assert(!row.overflow && row.board.fits && row.goal.fits && row.buttons.every(r => r.fits) && row.touchFits, JSON.stringify(row));
      // 정답 하나를 터치·마우스로 풀고, 타임어택이 끝나면 새 기록의 키도 확인한다.
      const line = await page.evaluate(async () => {
        const {findLines} = await import('/src/content/math/bingo.ts');
        const values = [...document.querySelectorAll('.bingo-cell')].map(el => Number(el.textContent));
        const board = {size: 5, grid: Array.from({length: 5}, (_, r) => values.slice(r * 5, r * 5 + 5)), goals: []};
        const goal = {op: document.querySelector('.bingo-goal h2').textContent.startsWith('곱') ? 'product' : 'sum', target: Number(document.querySelector('.bingo-goal h2 strong').textContent)};
        return findLines(board, goal)[0];
      });
      assert(line, '화면에 표시된 목표의 정답 줄이 있어야 해요.');
      for (const {r, c} of line) {
        const cell = page.locator(`[data-r="${r}"][data-c="${c}"]`);
        if (width < 1800) await cell.tap(); else await cell.click();
      }
      await page.getByText('이번 판 2 / 5문제', {exact: true}).waitFor();
      if (mode === 'time') {
        await page.clock.fastForward(400000);
        await page.getByText('시간 끝!', {exact: true}).waitFor();
        await page.getByText('🎉 새 기록!', {exact: true}).waitFor();
      }
      const stored = await page.evaluate(profile => JSON.parse(localStorage.getItem('study-kt:v1')).data[profile].bingo, profile);
      const limit = profile === 'kid1' ? 120 : 180;
      assert.equal(stored.best[String(limit)].found, 99);
      if (mode === 'time') assert.equal(stored.best[`5x5-${limit}`].found, 1);
      else assert.equal(stored.best[`5x5-${limit}`], undefined);
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({rows, errors, examples}, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({cases: rows.length, errors, boards: rows.filter(r => r.profile === 'kid1' && r.theme === 'light' && r.mode === 'time'), examples}, null, 2));
}
main().catch(error => {console.error(error); process.exitCode = 1;});
