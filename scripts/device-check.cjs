// T24b 전용 수동 검사. 설치된 Chromium만 사용하며 결과는 저장소 밖에 둔다.
// PLAYWRIGHT_MODULE=/설치된/playwright/index.js node scripts/device-check.cjs [서버 URL] [결과 폴더]
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { prepare } = require('./device-fit.cjs');
const out = path.resolve(process.argv[3] || '/tmp/study-kt-device-check');
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const rows = [], errors = [];
  try {
    for (const [width,height] of [[390,844],[1333,800],[2560,1440]]) for (const theme of ['light','dark']) for (const screen of ['speaking','corrections','retell']) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1800, colorScheme: theme });
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
      await prepare(page, screen);
      if (screen === 'retell') await page.getByRole('button',{name:'2분 다시 말하기 시작',exact:true}).click();
      const mic = page.getByRole('button',{name:screen==='retell'?'🎤 문장 말하기':'🎤 말하기',exact:true});
      if (!await mic.isDisabled()) throw new Error(`${screen}: 미지원 마이크가 활성화됨`);
      await page.getByRole('button',{name:'⌨️ 입력',exact:true}).click();
      if (screen === 'speaking') {
        const sentence = await page.locator('.sentence-en').innerText(); await page.getByLabel('따라 쓴 문장').fill(sentence);
        await page.getByRole('button',{name:'쓴 문장 확인',exact:true}).click(); await page.getByRole('button',{name:'다음 문장',exact:true}).click(); await page.getByRole('button',{name:'미션 목록으로',exact:true}).waitFor();
      } else if (screen === 'corrections') {
        await page.getByLabel('내가 고친 문장').fill('I went yesterday.'); await page.getByRole('button',{name:'고친 문장 확인',exact:true}).click();
        await page.getByRole('button',{name:'듣고 따라 말하기',exact:true}).click(); if (!await page.getByRole('button',{name:'🎤 따라 말하기',exact:true}).isDisabled()) throw new Error('따라 말하기 미지원 처리 실패');
        await page.getByRole('button',{name:'⌨️ 입력',exact:true}).click(); await page.getByLabel('따라 쓴 문장').fill('I went yesterday.'); await page.getByRole('button',{name:'따라 쓴 문장 확인',exact:true}).click();
        await page.getByRole('button',{name:'저장으로',exact:true}).click(); await page.getByRole('button',{name:'저장하고 다음',exact:true}).click();
        await page.getByText('오늘의 교정을 모두 확인했어요.',{exact:false}).waitFor();
      } else {
        await page.getByLabel('내 이야기',{exact:true}).fill('I went yesterday.'); await page.getByRole('button',{name:'다시 말하기 끝내기',exact:true}).click(); await page.getByText(/영어 단어 3개/).waitFor();
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      rows.push({screen,width,height,theme,keyboardCompleted:true,overflow});
      await page.screenshot({path:path.join(out,`${screen}-${width}x${height}-${theme}.png`),fullPage:true}); await page.close();
    }
    // 실제 브라우저 오디오 경로에는 가짜 장치만 주입한다. 가족의 마이크·녹취는 쓰지 않는다.
    const page = await browser.newPage({ viewport: {width:390,height:844} });
    await page.addInitScript(() => {
      window.testStreams = [];
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); window.testStreams.push(stream); return stream; };
    });
    await prepare(page,'device-check'); await page.getByRole('button',{name:'🎤 마이크 시험',exact:true}).click();
    await page.getByText('마이크 시험을 끝냈어요.',{exact:false}).waitFor();
    const tracksEnded = await page.evaluate(() => window.testStreams.length === 1 && window.testStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
    rows.push({screen:'microphone',width:390,height:844,tracksEnded}); if(!tracksEnded)throw new Error('마이크 스트림이 닫히지 않음');
    await page.close();
    for (const screen of ['obby','fishing']) for (const [width,height] of [[390,844],[1333,800],[2560,1440]]) {
      const game = await browser.newPage({viewport:{width,height},hasTouch:width<1800,colorScheme:'dark'});
      await game.clock.install(); await prepare(game,screen); await game.clock.runFor(5000);
      const before = await game.getByRole('timer').innerText();
      await game.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange')); });
      await game.getByRole('dialog',{name:'게임 일시정지'}).waitFor(); await game.clock.fastForward(300000);
      await game.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange')); });
      if(await game.getByRole('timer').innerText()!==before)throw new Error(`${screen}: 숨김 시간이 차감됨`);
      await game.keyboard.press('Tab');
      if(await game.evaluate(()=>document.activeElement.textContent)!=='계속하기')throw new Error('일시정지 키보드 포커스가 벗어남');
      await game.screenshot({path:path.join(out,`paused-${screen}-${width}x${height}-dark.png`),fullPage:true});
      await game.keyboard.press('Enter'); await game.getByRole('dialog',{name:'게임 일시정지'}).waitFor({state:'detached'}); await game.clock.runFor(1000);
      const after = await game.getByRole('timer').innerText();
      if(!before.includes('85초')||!after.includes('84초'))throw new Error(`${screen}: 계속하기 뒤 시간 오류 ${before} / ${after}`);
      rows.push({screen:`pause-${screen}`,width,height,pausedFiveMinutes:true,keyboardResume:true}); await game.close();
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,errors},null,2));
    console.log(JSON.stringify({cases:rows.length,overflow:rows.filter(row=>row.overflow),errors},null,2));
    if(rows.some(row=>row.overflow)||errors.length)process.exitCode=1;
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
