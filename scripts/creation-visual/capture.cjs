// Run through the installed playwright-skill executor with the preview server on port 4175.
/* eslint-disable @typescript-eslint/no-require-imports -- The Playwright skill executor loads CommonJS scripts. */
const { chromium } = require('playwright');
const fs = require('node:fs'); const path = require('node:path'); const { execFileSync } = require('node:child_process');
const directory = path.resolve('plans/before-after'); const target = 'http://127.0.0.1:4175';
const screens = [
 [2,'Recommendations',1585,992,4.1],[3,'Starting point',1585,992,4.2],[4,'Material input',1585,992,4.3],
 [5,'Understanding',1585,992,4.4],[6,'Chunking',1586,992,4.5],[7,'Analyzing',1586,992,4.6],
 [8,'Ready',1584,993,4.7],[9,'Review',1536,1024,4.8],[10,'Publication success',1584,993,4.9]
];
(async()=>{
 fs.mkdirSync(directory,{recursive:true}); const browser=await chromium.launch({headless:false});
 const manifestPath=path.join(directory,'manifest.json');
 const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{baseline:'33660b2',screens:[]};
 const selected=process.env.SCREENS?.split(',').map(Number);
 const completed=Number(process.env.COMPLETED_CHECKPOINT??Math.max(4.4,...manifest.screens.filter(screen=>screen.status.startsWith('Implemented')).map(screen=>screen.checkpoint)));
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('undone_theme','light'));
  await page.route('**/api/cohort-creation/drafts/*/understanding',async route=>route.fulfill({json:await page.evaluate(()=>window.__creationVisualFixtures.conceptPreview)}));
  await page.route('**/api/cohort-creation/drafts/*/chunks',async route=>route.fulfill({json:await page.evaluate(()=>window.__creationVisualFixtures.chunkPreview)}));
  await page.route('**/api/cohort-creation/drafts/*/review',async route=>route.fulfill({json:await page.evaluate(()=>window.__creationVisualFixtures.reviewResponse)}));
  for (const [number,name,width,height,checkpoint] of screens) {
   if(selected&&!selected.includes(number))continue;
   for(const version of ['before','after']) {
    const filename=`${version}-${number}.png`;
    if(version==='before'&&fs.existsSync(path.join(directory,filename)))continue;
    await page.setViewportSize({width,height});await page.goto(`${target}/?screen=${number}&version=${version}`);
    await page.locator('main').waitFor();await page.evaluate(()=>document.fonts.ready);
    if(number===9)await page.getByRole('heading',{name:'Foundations',exact:true}).waitFor();
    if(number===5&&version==='after')await page.getByText('Distributed systems',{exact:true}).waitFor();
    if(number===6&&version==='after'&&completed>=4.5)await page.getByText('What makes a distributed system?',{exact:true}).waitFor();
    // Wait for every rendered image, including Next image wrapper substitutes.
    await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode().catch(()=>{}))));
    await page.screenshot({path:path.join(directory,filename)});
    await page.screenshot({path:path.join(directory,`${version}-${number}-full.png`),fullPage:true});
    if(version==='after'){
     await page.setViewportSize({width:390,height:844});
     if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`Mobile overflow on screen ${number}`);
     await page.screenshot({path:path.join(directory,`mobile-${number}.png`),fullPage:true});
    }
   }
   const previous=manifest.screens.find(screen=>screen.number===number);
   const entry={number,name,width,height,checkpoint,status:checkpoint<=completed?'Implemented; final fidelity review pending':'Pending visual checkpoint',
    currentCommit:execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim(),capturedAt:new Date().toISOString()};
   entry.uncommittedCode=Boolean(execFileSync('git',['status','--porcelain','--','src','scripts/creation-visual'],{encoding:'utf8'}).trim());
   if(previous)Object.assign(previous,entry);else manifest.screens.push(entry);
   console.log(`Captured screen ${number}: ${name}`);
  }
  if(errors.length)throw Error(errors.join('\n'));
  manifest.screens.sort((a,b)=>a.number-b.number);fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 }finally{await browser.close();}
})();
