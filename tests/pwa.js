const http=require('node:http');
const zlib=require('node:zlib');
const os=require('node:os');
const path=require('node:path');
const puppeteer=require('puppeteer-core');
const {fs,ROOT,KEY,LEGACY,fill,add,text,check,assert}=require('./helpers');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),worker=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const release=fs.readFileSync(path.join(ROOT,'VERSION'),'utf8').trim();
const nextRelease=release.replace(/\d+$/,n=>String(Number(n)+1));
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));
let servedRelease=release,htmlRelease=release,enableWorker=false,failedFile='',disconnected=false,browser;
const files=new Set(['index.html','sw.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png']);
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=url.pathname.replace(/^\/finflow-architect\//,'')||'index.html';
 if(disconnected||file===failedFile||file==='sw.js'&&!enableWorker){res.writeHead(503);res.end('Unavailable');return;}
 if(!url.pathname.startsWith('/finflow-architect/')||!files.has(file)){res.writeHead(404);res.end('Not cached');return;}
 const type=file.endsWith('.js')?'text/javascript':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html';
 const body=file==='index.html'?html.replaceAll(release,htmlRelease):file==='sw.js'?worker.replaceAll(release,servedRelease):fs.readFileSync(path.join(ROOT,file));
 const compressed=file==='index.html'||file==='manifest.webmanifest';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store',...(compressed?{'Content-Encoding':'gzip'}:{})});
 res.end(compressed?zlib.gzipSync(body):body);
});
async function startBrowser(profile){return puppeteer.launch({executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,userDataDir:profile,args:['--no-sandbox']});}
async function waitReady(page){try{await page.waitForFunction(()=>navigator.serviceWorker.controller&&pwaReady,{timeout:20000});}catch(error){console.log('PWA diagnostic',await page.evaluate(async()=>({status:document.getElementById('pwa-status').textContent,controlled:!!navigator.serviceWorker.controller,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.state,installing:r.installing?.state,waiting:r.waiting?.state}))})));throw error;}}
async function update(page){await page.evaluate(()=>checkPwaUpdate());}
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'finflow-pwa-'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/finflow-architect/';
 const errors=[];
 try{
  browser=await startBrowser(profile);let page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.emulateTimezone('Asia/Colombo');await page.goto(url,{waitUntil:'load'});
  let baseline;
  await check('Existing same-origin financial data and credentials survive the first PWA upgrade',async()=>{
   baseline=await page.evaluate((key,legacy)=>{
    const old=freshState();old.settings.gistId='abcde';delete old.recurringIncomeRules;old.expenses.push({id:'old-expense',date:localDate(),cents:125050,category:'food',item:'Other',mainCategory:'Food & Dining',subCategory:'Other',note:'Existing expense'});old.incomes.push({id:'old-income',date:localDate(),cents:50000000,label:'Salary',note:''});
    localStorage.setItem(key,JSON.stringify(old));localStorage.setItem(legacy,'{"preserve":"original legacy data"}');localStorage.setItem('finflow_gist_connection_v1',JSON.stringify({gistId:'abcde',token:'SYNTHETIC-PWA-TOKEN'}));return old;
   },KEY,LEGACY);
   enableWorker=true;await page.reload({waitUntil:'load'});await waitReady(page);
   const data=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);assert.deepEqual(data.expenses,baseline.expenses);assert.deepEqual(data.incomes,baseline.incomes);assert.deepEqual(data.recurringIncomeRules,[]);baseline=data;
   assert.match(await page.evaluate(()=>localStorage.getItem('finflow_gist_connection_v1')),/SYNTHETIC-PWA-TOKEN/);assert.equal(await page.$eval('#gist-token',e=>e.type==='password'&&e.value==='SYNTHETIC-PWA-TOKEN'),true);assert.match(await page.evaluate(key=>localStorage.getItem(key),LEGACY),/original legacy data/);
  });
  await check('Manifest, scope, icons and Chromium installability are valid',async()=>{
   assert.ok(worker.includes(`const RELEASE = '${release}';`));
   const client=await page.createCDPSession();const result=await client.send('Page.getAppManifest');assert.deepEqual(result.errors,[]);assert.equal(JSON.parse(result.data).display,'standalone');
   const installability=await client.send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors,[]);
   assert.equal(manifest.id,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
   for(const [file,size] of [['icon-192.png',192],['icon-512.png',512],['maskable-512.png',512],['apple-touch-icon.png',180]]){const b=fs.readFileSync(path.join(ROOT,'icons',file));assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);}
   assert.equal(await page.evaluate(()=>pwaRegistration.scope),url);await client.detach();
  });
  await check('Installation prompting is user-triggered and the installed display state hides installation help',async()=>{
   await page.click('#nav-settings');await page.evaluate(()=>{const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.__installPromptCalled=true;};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event);window.__installWasDeferred=event.defaultPrevented;});
   assert.equal(await page.evaluate(()=>window.__installWasDeferred),true);assert.equal(await page.evaluate(()=>window.__installPromptCalled),undefined);assert.equal(await page.$eval('#install-app',e=>e.hidden),false);await page.click('#install-app');assert.equal(await page.evaluate(()=>window.__installPromptCalled),true);
   const installed=await page.evaluate(()=>{const original=window.matchMedia;window.matchMedia=query=>query==='(display-mode: standalone)'?{matches:true}:original(query);renderPwa();const result={help:$('install-help').hidden,button:$('install-app').hidden,status:$('pwa-status').textContent};window.matchMedia=original;renderPwa();return result;});assert.equal(installed.help,true);assert.equal(installed.button,true);assert.match(installed.status,/Installed/);await page.click('#nav-track');
  });
  await check('Offline navigation, expense save/edit/delete/Undo, income and backups work without network',async()=>{
   await page.setOfflineMode(true);await page.reload({waitUntil:'load'});assert.equal(await text(page,'app-version'),release);
   await add(page,'70.25');assert.equal(await page.evaluate(()=>state.expenses.length),2);
   await page.click('#recent-list [data-expense]');await page.click('#edit-expense');await fill(page,'amount','80.50');await page.click('#save-expense');assert.equal(await page.evaluate(()=>state.expenses.find(r=>r.id!=='old-expense').cents),8050);
   await page.click('#recent-list [data-expense]');await page.click('#delete-expense');await page.click('#confirm-action');await page.waitForFunction(()=>!document.getElementById('confirm-dialog').open);assert.equal(await page.evaluate(()=>state.expenses.length),1);await page.click('#undo');assert.equal(await page.evaluate(()=>state.expenses.length),2);
   await page.click('#nav-spending');await page.click('#add-income-top');await fill(page,'income-source','Offline allowance');await fill(page,'income-amount','2500.25');await page.click('#save-income');assert.equal(await page.evaluate(()=>state.incomes.length),2);
   const backup=await page.evaluate(()=>localBackup());assert.equal(backup.data.expenses.length,2);assert.equal(JSON.stringify(backup).includes('SYNTHETIC-PWA-TOKEN'),false);
   baseline=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);await page.click('#nav-settings');assert.match(await text(page,'pwa-status'),/Offline/);await update(page);assert.match(await text(page,'pwa-status'),/offline/i);
   await page.setOfflineMode(false);await page.reload({waitUntil:'load'});await waitReady(page);
  });
  await check('App-shell caches exclude credentials, financial records and requests outside the app',async()=>{
   const result=await page.evaluate(async()=>{await fetch('/unrelated-data.json').catch(()=>{});await (await caches.open('rack-shell-v1')).put('/rack-marker',new Response('keep'));const out=[];for(const key of await caches.keys()){if(key.startsWith('finflow-shell:'))out.push(...(await (await caches.open(key)).keys()).map(r=>r.url));}return out;});
   assert.equal(result.length,7);assert.ok(result.every(u=>u.startsWith(url)));assert.ok(!result.some(u=>/gist|finflow\.json|unrelated/.test(u)));
  });
  await check('Failed assets and mismatched deployment versions leave the working release available offline',async()=>{
   servedRelease=nextRelease;htmlRelease=nextRelease;failedFile='icons/icon-512.png';await update(page);await page.waitForFunction(()=>pwaNotice.includes('could not finish'),{timeout:20000});
   assert.equal(await page.evaluate(()=>pwaRegistration.waiting===null),true);assert.equal(await text(page,'app-version'),release);
   failedFile='';htmlRelease=release;await update(page);await page.waitForFunction(()=>pwaNotice.includes('could not finish'),{timeout:20000});assert.equal(await page.evaluate(()=>pwaRegistration.waiting===null),true);
   await page.setOfflineMode(true);await page.reload({waitUntil:'load'});assert.equal(await text(page,'app-version'),release);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY),baseline);await page.setOfflineMode(false);
  });
  await check('A new version waits for confirmation and preserves drafts when canceled',async()=>{
   htmlRelease=nextRelease;await fill(page,'amount','12345');await update(page);await page.waitForFunction(()=>!!pwaRegistration.waiting,{timeout:20000});
   assert.equal(await text(page,'app-version'),release);assert.equal(await page.$eval('#amount',e=>e.value),'12,345');assert.equal(await page.$eval('#pwa-update-dot',e=>e.hidden),false);
   await page.click('#nav-settings');await page.click('#apply-update');await page.click('#confirm-cancel');assert.equal(await page.$eval('#amount',e=>e.value),'12,345');assert.equal(await text(page,'app-version'),release);
  });
  await check('Confirmed updates preserve data and credentials, isolate other apps, and never reload other drafts',async()=>{
   const other=await browser.newPage();await other.goto(url,{waitUntil:'load'});await fill(other,'amount','789');assert.equal(await text(other,'app-version'),release);
   await page.bringToFront();await page.click('#apply-update');await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.click('#confirm-action')]);await waitReady(page);assert.equal(await text(page,'app-version'),nextRelease);
   assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY),baseline);assert.match(await page.evaluate(()=>localStorage.getItem('finflow_gist_connection_v1')),/SYNTHETIC-PWA-TOKEN/);
   await other.waitForFunction(()=>pwaNewController,{polling:100});assert.equal(await text(other,'app-version'),release);assert.equal(await other.$eval('#amount',e=>e.value),'789');await other.close();
   const keys=await page.evaluate(()=>caches.keys());assert.ok(keys.includes('rack-shell-v1'));assert.deepEqual(keys.filter(k=>k.startsWith('finflow-shell:')),['finflow-shell:/finflow-architect/:'+nextRelease]);
  });
  await check('Offline reopening survives browser restart, and standalone/phone/landscape views fit',async()=>{
   await browser.close();browser=null;disconnected=true;browser=await startBrowser(profile);page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.emulateTimezone('Asia/Colombo');await page.setOfflineMode(true);await page.goto(url+'index.html?from=home',{waitUntil:'load'});assert.equal(await text(page,'app-version'),nextRelease);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY),baseline);
   for(const [width,height] of [[390,844],[412,823],[844,390],[1440,1000]]){await page.setViewport({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.click('#nav-settings');assert.equal(await page.$eval('#pwa-card',e=>e.scrollWidth>e.clientWidth),false);if(width===390)await (await page.$('#pwa-card')).screenshot({path:'/tmp/finflow-phone-pwa-settings.png'});await page.click('#nav-track');}
   await page.setViewport({width:390,height:844});await page.evaluate(()=>{document.querySelectorAll('style').forEach(style=>style.textContent=style.textContent.replaceAll('env(safe-area-inset-top)','44px').replaceAll('env(safe-area-inset-bottom)','34px'));});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const safe=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight,height:innerHeight,amount:$('amount').getBoundingClientRect().top,nav:document.querySelector('.nav').getBoundingClientRect().top,keyBottom:Math.max(...[...document.querySelectorAll('[data-key]')].map(e=>e.getBoundingClientRect().bottom))}));assert.ok(safe.scroll<=safe.height);assert.ok(safe.amount>=44);assert.ok(safe.keyBottom<=safe.nav);
  });
  assert.deepEqual(errors,[]);console.log('All PWA checks passed.');
 }catch(error){console.error('PWA test failed before cleanup:',error);throw error;}finally{if(browser){const timer=setTimeout(()=>browser?.process()?.kill('SIGKILL'),5000);try{await browser.close();}finally{clearTimeout(timer);}}server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
