// 설치된 Playwright·Chromium 전용 수동 검사. CI·앱 의존성에는 추가하지 않는다.
// PLAYWRIGHT_MODULE=/설치된/playwright/index.js node scripts/device-fit.cjs [서버 URL] [저장소 밖 결과 폴더]
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:5173';
const out = path.resolve(process.argv[3] || '/tmp/study-kt-device-fit');
const sizes = [[390,844],[844,390],[1333,800],[800,1333],[2560,1440],[2048,1152]];
const screens = ['home','math','sudoku5','sudoku6','blocks','pattern','bingo','obby','fishing','kid-talk','coach','corrections','device-check'];
// 테스트 데이터·API 응답은 모두 가짜다. 실제 가족 기록과 키는 읽거나 출력하지 않는다.
const fixture = `
import React from '/node_modules/.vite/deps/react.js?DEVICE_FIT_REACT_HASH';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js?DEVICE_FIT_DOM_HASH';
const {createElement:h}=React, {createRoot}=ReactDOM;
import '/src/styles.css';
import {StoreProvider} from 'DEVICE_FIT_STORE_MODULE';
import {defaultState} from '/src/store/defaults.ts';
import {toDateKey} from '/src/lib/date.ts';
import {emptyDay} from '/src/lib/progress.ts';
import {seededRng} from '/src/lib/random.ts';
import {GENERATORS} from '/src/content/puzzles/registry.ts';
import {buildLevelQueue} from '/src/content/math/session.ts';
import {buildFishPool} from '/src/content/games/fishing.ts';
import {Home} from '/src/pages/Home.tsx';
import {MathSession} from '/src/pages/MathSession.tsx';
import {BrainPuzzles} from '/src/pages/BrainPuzzles.tsx';
import {MathBingo} from '/src/pages/MathBingo.tsx';
import {ObbyGame} from '/src/pages/ObbyGame.tsx';
import {FishingGame} from '/src/pages/FishingGame.tsx';
import {TalkSession} from '/src/pages/TalkSession.tsx';
import {SpeakingSession} from '/src/pages/SpeakingSession.tsx';
import {TalkRetell} from '/src/components/TalkRetell.tsx';
import {TalkCorrections} from '/src/components/TalkCorrections.tsx';
import {TopBar} from '/src/components/common.tsx';
import {Parent} from '/src/pages/Parent.tsx';
const screen = new URL(location.href).searchParams.get('device-fit');
const state=defaultState(),today=toDateKey();
state.ai={endpoint:'https://device-fit.invalid',token:'fixture-token-'.repeat(3)};
for(const id of ['kid1','kid2']){
 state.settings[id].wordProblemRatio=0;
 state.settings[id].missions=state.settings[id].missions.map(m=>({...m,enabled:m.type==='math'}));
 state.data[id].math.level=1;
 state.data[id].days[today]={...emptyDay(today),progress:{math:20}};
 state.data[id].puzzles.levels={sudoku:{level:5,streak:0,fails:0,solved:0,hinted:0},pattern:{level:5,streak:0,fails:0,solved:0,hinted:0},blocks:{level:5,streak:0,fails:0,solved:0,hinted:0}};
}
if(screen==='home'){for(const m of state.settings.kid2.missions){m.enabled=true;state.data.kid2.days[today].progress[m.type]=m.target;}state.data.kid2.days[today].completed=true;state.data.kid2.days[today].completedAt='10:42';}
if(screen==='speaking'){state.settings.kid2.missions=state.settings.kid2.missions.map(m=>({...m,enabled:m.type==='speaking',target:m.type==='speaking'?1:m.target}));}
if(screen==='math')state.data.kid2.days[today].progress.math=0;
state.settings.parent.coach.subtitle='now';
const log={id:'fixture-talk',date:today,mode:'coach',seconds:180,englishRatio:1,lines:[{role:'kid',text:'I go yesterday.',at:1}],corrections:{items:[{said:'I go yesterday.',better:'I went yesterday.',focus:'went',hintKo:'언제 한 일인가요?',whyKo:'지난 일이에요.',pattern:'tense'}],praiseKo:'뜻을 잘 전했어요.',createdAt:today}};
state.data.parent.talks=[log];
if(screen==='sudoku6'){
 const answer=Array.from({length:6},(_,r)=>Array.from({length:6},(_,c)=>([0,3,1,4,2,5][r]+c)%6+1));
 // 이미 생성되지 않는 6×6은 기존 렌더러를 확인하는 테스트 전용 판이다.
 GENERATORS.sudoku={...GENERATORS.sudoku,generate:()=>({type:'sudoku',difficulty:5,seed:1,view:{size:6,boxRows:2,boxCols:3,rows:answer.map((row,r)=>row.map((n,c)=>c===r?0:n))},answer,hint:'가로줄·세로줄·상자를 살펴봐요.'})};
}
localStorage.setItem('study-kt:v1',JSON.stringify(state));
let component,props={profileId:'kid2',go:()=>{}};
if(screen==='home')component=Home;
else if(screen==='speaking')component=SpeakingSession;
else if(screen==='retell'){component=()=>h('div',{className:'page'},h(TopBar,{title:'다시 말하기',onBack:()=>{}}),h(TalkRetell,{log}));}
else if(['parent-settings','device-check'].includes(screen))component=Parent;
else if(screen==='math')component=MathSession;
else if(['sudoku5','sudoku6','blocks','pattern'].includes(screen))component=BrainPuzzles;
else if(screen==='bingo')component=MathBingo;
else if(screen==='obby')component=ObbyGame;
else if(screen==='fishing'){component=FishingGame;props.plan={index:0,date:today,seed:1,pool:buildFishPool([],buildLevelQueue('g3',1,[],64,seededRng(1)).map(x=>x.problem),8)};}
else if(screen==='kid-talk'||screen==='coach'){component=TalkSession;props.profileId=screen==='coach'?'parent':'kid2';}
else if(screen==='corrections'){component=()=>h('div',{className:'page'},h(TopBar,{title:'오늘의 교정',onBack:()=>{}}),h(TalkCorrections,{log}));}
const root=createRoot(document.getElementById('root'));
props.go=route=>{if(route.name==='home')root.render(h(StoreProvider,null,h(Home,{profileId:route.profileId,go:()=>{}})));};
root.render(h(StoreProvider,null,h(component,props)));
`;
const realtime = `export const stopLocalTalks=()=>{};export async function startTalk(cfg,req,cb){cb.onConnected(180);cb.onUserText('u','I go yesterday.');cb.onAssistantText('a','Oh, you went yesterday! What did you do?',true);cb.onFriendFinished();return{stop:async()=>{cb.onEndStatus('confirmed');cb.onState('ended');},setMicEnabled(){},sendSystemNote(){},beginPushToTalk(){},endPushToTalk(){}};}`;
async function prepare(page, screen, bingoMode = 'practice') {
  const source = await (await page.request.get(`${url}/src/main.tsx`)).text();
  const reactHash = source.match(/react\.js\?([^"]+)/)?.[1];
  const domHash = source.match(/react-dom_client\.js\?([^"]+)/)?.[1];
  // HMR 중에는 Context 주소에도 별도 쿼리가 붙는다. 앱과 같은 모듈을 사용한다.
  const storeModule = source.match(/from "([^"]*\/store\/StoreContext\.tsx[^"]*)"/)?.[1];
  if (!reactHash || !domHash || !storeModule) throw new Error('Vite의 모듈 주소를 확인할 수 없어요. 개발 서버로 검사해 주세요.');
  await page.route('**/src/main.tsx*', route => route.fulfill({contentType:'application/javascript',body:fixture.replaceAll('DEVICE_FIT_REACT_HASH', reactHash).replaceAll('DEVICE_FIT_DOM_HASH', domHash).replaceAll('DEVICE_FIT_STORE_MODULE', storeModule)}));
  await page.route('**/src/lib/realtime.ts*',route=>route.fulfill({contentType:'application/javascript',body:realtime}));
  await page.route('https://device-fit.invalid/**',route=>route.fulfill({json:{today:{kid1:{talkSeconds:0,generates:0},kid2:{talkSeconds:0,generates:0},parent:{talkSeconds:0,generates:0}},month:{talkSeconds:0,estimatedKrw:0}}}));
  await page.goto(`${url}/?device-fit=${screen}`); await page.locator('.page').waitFor();
  if(['sudoku5','sudoku6','blocks','pattern'].includes(screen))await page.locator('.puzzle-choice').filter({hasText:screen.startsWith('sudoku')?'스도쿠':screen==='blocks'?'블록 세기':'도형 규칙'}).click();
  if(screen==='bingo'){if(bingoMode==='practice')await page.getByRole('button',{name:'🐢 연습',exact:true}).click();await page.getByRole('button',{name:'시작하기',exact:true}).click();await page.locator('.bingo-board').waitFor();}
  if(screen==='device-check')await page.getByRole('button',{name:'백업·보안',exact:true}).click();
  if(screen==='parent-settings')await page.getByRole('button',{name:'미션 설정',exact:true}).click();
  if(screen==='obby')await page.getByRole('button',{name:'🏃 달리기 시작',exact:true}).click();
  if(screen==='coach')await page.getByRole('button',{name:/🌱 코치 모드/}).click();
  if(screen==='coach'||screen==='kid-talk')await page.getByRole('button',{name:'대화 시작',exact:true}).click();
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(80);
}
async function audit(page, screen, width, height, theme) {
  return page.evaluate(({screen,width,height,theme})=>{
    const touch = width>=600&&height>500?48:44;
    const controls=[...document.querySelectorAll('.page button:not(:disabled), .page input:not(:disabled), .page select, .page textarea')];
    const small=controls.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<touch-.5||r.height<touch-.5)}).map(el=>({text:(el.getAttribute('aria-label')||el.textContent||el.tagName).trim().slice(0,60),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
    const selector='.puzzle-grid,.blocks-picture,.pattern-grid,.bingo-board,.obby-course,.fish-pond';
    const boards=[...document.querySelectorAll(selector)].map(el=>{const r=el.getBoundingClientRect();return{type:el.className.baseVal??el.className,width:Math.round(r.width),height:Math.round(r.height),bottom:Math.round(r.bottom),fits:r.top>=0&&r.bottom<=height+.5&&r.left>=0&&r.right<=width+.5}});
    const confirm=document.querySelector('.number-confirm,.pattern-confirm');const r=confirm?.getBoundingClientRect();
    const card=document.querySelector('.completion-card')?.getBoundingClientRect();
    // 비활성 버튼도 포함해 취소·힌트·패스가 실제로 화면 안에 있는지 확인한다.
    const bingoControls=[...document.querySelectorAll('.bingo-page > .row-center button')].map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent.trim(),bottom:r.bottom,fits:r.top>=0&&r.bottom<=height+.5}});
    return{screen,width,height,theme,overflow:document.documentElement.scrollWidth>width,small,boards,bingoControls,confirmFits:!r||r.bottom<=height+.5,cardFits:!card||card.bottom<=height+.5,font:parseFloat(getComputedStyle(document.body).fontSize),missionColumns:document.querySelector('.mission-list')?getComputedStyle(document.querySelector('.mission-list')).gridTemplateColumns:null,qhdBoard:width!==2560||!['sudoku5','sudoku6','blocks','pattern','bingo'].includes(screen)||boards.every(board=>board.height>=height*.6-.5)};
  },{screen,width,height,theme});
}
async function main(){
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const rows=[],errors=[],safeArea=[],reviewChecks=[];
  try{
    for(const [width,height]of sizes)for(const theme of ['light','dark'])for(const screen of screens){
      const page=await browser.newPage({viewport:{width,height},hasTouch:width<1800,colorScheme:theme,timezoneId:'Asia/Seoul'});page.on('pageerror',e=>{errors.push(`${screen} ${width}: ${e.message}`);console.error(e.message);});
      await prepare(page,screen);const row=await audit(page,screen,width,height,theme);rows.push(row);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({rows,errors},null,2));await page.screenshot({path:path.join(out,`${screen}-${width}x${height}-${theme}.png`),fullPage:true});await page.close();
    }
    // Chromium에는 노치가 없으므로 같은 CSS 변수에 양수 여유를 넣어 배치를 검증한다.
    // iOS가 실제 env 값을 전달하는지는 Safari 실기기에서 별도로 확인한다.
    for(const [width,height,insets] of [[390,844,{top:47,right:0,bottom:34,left:0}],[844,390,{top:0,right:47,bottom:21,left:47}]])for(const screen of screens){
      const page=await browser.newPage({viewport:{width,height},hasTouch:true});
      await page.addInitScript(values=>{document.addEventListener('DOMContentLoaded',()=>{for(const [side,value]of Object.entries(values))document.documentElement.style.setProperty(`--safe-${side}`,`${value}px`);});},insets);
      await prepare(page,screen);
      const fits=await page.evaluate(({height,width,insets})=>[...document.querySelectorAll('.puzzle-grid,.blocks-picture,.pattern-grid,.bingo-board,.obby-course,.fish-pond,.number-confirm,.pattern-confirm,.bingo-page > .row-center button')].every(el=>{const r=el.getBoundingClientRect();return r.top>=insets.top&&r.bottom<=height-insets.bottom+.5&&r.left>=insets.left&&r.right<=width-insets.right+.5}),{height,width,insets});
      safeArea.push({width,height,screen,fits});await page.screenshot({path:path.join(out,`safe-${screen}-${width}x${height}.png`),fullPage:true});await page.close();
    }
    // 리뷰 회귀 검사: 타임어택에서 힌트까지 나타난 뒤에도 조작 버튼을 확인한다.
    for(const [width,height] of [[1333,800],[2560,1440],[2048,1152]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:width<1800});await page.clock.install();await prepare(page,'bingo','time');await page.clock.runFor(4000);await page.clock.fastForward(25000);await page.getByRole('button',{name:/💡 힌트/}).waitFor();
      const row=await audit(page,'bingo',width,height,'light');reviewChecks.push({kind:'bingo-time',width,height,controls:row.bingoControls,fits:!row.overflow&&row.boards.every(x=>x.fits)&&row.bingoControls.every(x=>x.fits)});
      await page.screenshot({path:path.join(out,`bingo-time-${width}x${height}.png`),fullPage:true});await page.close();
    }
    // 터치 설정에서는 큰 체크박스, 마우스 설정에서는 원래 크기를 보존한다.
    for(const width of [1333,2560])for(const hasTouch of [false,true]){
      const page=await browser.newPage({viewport:{width,height:800},hasTouch});await prepare(page,'parent-settings');
      const boxes=await page.locator('.page input[type="checkbox"]').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height};}));
      reviewChecks.push({kind:'parent-checkbox',width,hasTouch,boxes,fits:boxes.length>0&&boxes.every(r=>hasTouch?r.width>=48&&r.height>=48:r.width<48&&r.height<48)});
      await page.screenshot({path:path.join(out,`parent-settings-${width}-${hasTouch?'touch':'mouse'}.png`),fullPage:true});await page.close();
    }
    const iconPage=await browser.newPage();const icon=fs.readFileSync(path.join(__dirname,'../public/apple-touch-icon.png')).toString('base64');
    const opaque=await iconPage.evaluate(async source=>{const image=new Image();image.src=`data:image/png;base64,${source}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=180;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,180,180).data;for(let i=3;i<data.length;i+=4)if(data[i]!==255)return false;return image.width===180&&image.height===180;},icon);
    reviewChecks.push({kind:'apple-icon-opaque',fits:opaque});await iconPage.close();
    // 가상 키보드·물리 키 없이 실제 화면 키패드로 수학 20문제를 모두 푼다.
    const page=await browser.newPage({viewport:{width:1333,height:800},hasTouch:true,timezoneId:'Asia/Seoul'});await prepare(page,'math');
    for(let i=0;i<20;i++){
      const before=await page.locator('.question-text').innerText(),match=before.match(/(\d+)\s*([+−\-×÷])\s*(\d+)/);if(!match)throw new Error(`수학 터치 판 검사에서 지원하지 않은 식: ${before}`);
      const a=Number(match[1]),b=Number(match[3]),op=match[2],answer=op==='+'?a+b:op==='×'?a*b:op==='÷'?a/b:a-b;
      const pad=page.getByRole('group',{name:'숫자 키패드'});for(const digit of String(answer))await pad.getByRole('button',{name:digit,exact:true}).tap();await pad.getByRole('button',{name:'확인',exact:true}).tap();
      await page.waitForFunction(old=>!document.querySelector('.question-text')||document.querySelector('.question-text').textContent!==old,before);
    }
    const touchRound=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('study-kt:v1')),day=Object.values(s.data.kid2.days).at(-1);return{attempts:day.mathAttempts.length,correct:day.correct,completedAt:day.completedAt}});
    await page.getByRole('button',{name:'미션 목록으로',exact:true}).tap();await page.locator('.completion-card').waitFor();await page.screenshot({path:path.join(out,'touch-round-completion-1333x800.png')});
    if(touchRound.attempts!==20||touchRound.correct!==20||!touchRound.completedAt)throw new Error('수학 20문제 터치 완료 기록 불일치');await page.close();
    const failures=rows.filter(row=>row.overflow||row.small.length||row.boards.some(b=>!b.fits)||row.bingoControls.some(b=>!b.fits)||!row.confirmFits||!row.cardFits||!row.qhdBoard||row.width===2560&&row.font!==20);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,errors,safeArea,reviewChecks,touchRound,failures},null,2));
    const safeFailures=safeArea.filter(row=>!row.fits);
    const reviewFailures=reviewChecks.filter(row=>!row.fits);
    console.log(JSON.stringify({cases:rows.length,errors,failures:failures.map(({screen,width,height,theme,overflow,small,boards,bingoControls,confirmFits,qhdBoard})=>({screen,width,height,theme,overflow,small,boards,bingoControls,confirmFits,qhdBoard})),safeFailures,reviewFailures,touchRound},null,2));
    if(failures.length||errors.length||safeFailures.length||reviewFailures.length)process.exitCode=1;
  }finally{await browser.close();}
}
module.exports={prepare,audit};
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1});
