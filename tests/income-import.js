const {launch,fresh,stored,fill,add,text,check,today,assert,fs,KEY,acceptConfirmation}=require('./helpers');
const path=require('node:path'),os=require('node:os');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'finflow-import-tests-'));
function file(value,name='records.json'){const target=path.join(directory,name);fs.writeFileSync(target,JSON.stringify(value));return target;}
async function upload(page,value,name){await page.click('#nav-settings');await page.$eval('#import-file',e=>e.value='');await (await page.$('#import-file')).uploadFile(file(value,name));await page.waitForFunction(()=>!document.getElementById('apply-import').hidden||!document.getElementById('import-status').textContent.startsWith('Choose a file'));}
async function income(page,label,amount,date=today()){await page.click('#nav-spending');await page.click('#add-income-top');await fill(page,'income-source',label);await fill(page,'income-amount',amount);await fill(page,'income-date',date);await page.click('#income-form button[type="submit"]');}
function payload(records){return {format:'finflow-import',version:1,currency:'LKR',records,review:[{reason:'Missing amount'}]};}
const record=(id,kind='income',cents=10000)=>({id,kind,date:today(),cents,label:'Salary',note:'',...(kind==='expense'?{mainCategory:'Food & Dining',subCategory:'Cafes'}:kind==='movement'?{movementType:'refund',direction:'in'}:{})});
(async()=>{const browser=await launch();try{
 const t=await fresh(browser),p=t.page;
 await add(p,'25','food');
 await check('Income saves separately, validates amounts/dates, and compares the selected month without counting movements',async()=>{
  await income(p,'Salary','1000.10');assert.equal((await stored(p)).incomes[0].cents,100010);assert.equal((await stored(p)).expenses.length,1);assert.equal(await text(p,'income-total'),'Rs. 1,000.10');assert.equal(await text(p,'income-difference'),'Rs. 975.10');assert.equal(await text(p,'income-spent-share'),'2.5%');
  await p.click('#add-income');await fill(p,'income-source','Salary');for(const value of ['0','-5','1.234','abc']){await fill(p,'income-amount',value);await p.click('#income-form button[type="submit"]');assert.equal((await stored(p)).incomes.length,1);}
  await fill(p,'income-amount','10');await fill(p,'income-date','2099-01-01');await p.click('#income-form button[type="submit"]');assert.equal((await stored(p)).incomes.length,1);await p.click('#close-income');
  await income(p,'Freelance','0.20');assert.equal((await stored(p)).incomes[1].cents,20);await p.reload();await p.click('#nav-spending');assert.equal(await text(p,'income-total'),'Rs. 1,000.30');
 });
 await check('Income editing, confirmed deletion, cancellation and Undo preserve precise values and source labels remain inert',async()=>{
  await p.click('#income-list [data-cash-id]');await fill(p,'income-source','<img src=x onerror="window.__xss=1">');await fill(p,'income-amount','0.30');await p.click('#income-form button[type="submit"]');assert.equal((await stored(p)).incomes[1].cents,30);assert.equal(await p.evaluate(()=>window.__xss),undefined);assert.equal(await p.$$eval('#income-list img',es=>es.length),0);
  await p.click('#income-list [data-cash-id]');await p.click('#delete-income');await p.keyboard.press('Escape');assert.equal((await stored(p)).incomes.length,2);await p.click('#delete-income');await acceptConfirmation(p);assert.equal((await stored(p)).incomes.length,1);await p.click('#undo');assert.equal((await stored(p)).incomes.length,2);
 });
 const imported=payload([record('sheet-expense','expense',5000),record('sheet-income'),record('sheet-refund','movement',900000)]);
 await check('File preview is read-only; confirmed import adds all three kinds while refunds stay out of income and expense charts',async()=>{
  const before=await stored(p);await upload(p,imported);assert.deepEqual(await stored(p),before);assert.match(await text(p,'import-status'),/1 expenses, 1 income entries, and 1 other cash movements/);assert.match(await text(p,'import-status'),/1 incomplete/);
  await p.click('#apply-import');await p.keyboard.press('Escape');assert.deepEqual(await stored(p),before);await p.click('#apply-import');await acceptConfirmation(p);
  const data=await stored(p);assert.equal(data.expenses.length,2);assert.equal(data.incomes.length,3);assert.equal(data.movements.length,1);assert.equal(data.importLedger.length,3);
  await p.click('#nav-spending');assert.equal(await text(p,'spending-total'),'Rs. 75');assert.equal(await text(p,'income-total'),'Rs. 1,100.40');assert.equal(await text(p,'movement-count'),'1 records');
 });
 await check('Repeated imports skip originals, retain manual edits, and do not resurrect a deleted imported record',async()=>{
  await upload(p,imported);assert.match(await text(p,'import-status'),/3 already imported/);assert.equal(await p.$eval('#apply-import',e=>e.hidden),true);
  await p.click('#nav-spending');await p.click('#income-list [data-cash-id="sheet-income"]');await fill(p,'income-amount','120');await p.click('#income-form button[type="submit"]');
  await upload(p,imported);assert.equal((await stored(p)).incomes.find(r=>r.id==='sheet-income').cents,12000);assert.equal(await p.$eval('#apply-import',e=>e.hidden),true);
  await p.click('#nav-spending');await p.click('#income-list [data-cash-id="sheet-income"]');await p.click('#delete-income');await acceptConfirmation(p);await upload(p,imported);assert.equal((await stored(p)).incomes.some(r=>r.id==='sheet-income'),false);assert.match(await text(p,'import-status'),/3 already imported/);
  const changed=structuredClone(imported);changed.records[1].cents=20000;await upload(p,changed);assert.match(await text(p,'import-status'),/previously imported source record changed/);assert.equal(await p.$eval('#apply-import',e=>e.hidden),true);
 });
 await check('Invalid files, duplicates, currency, future dates, movement direction, and collisions never partially import',async()=>{
  const before=await stored(p);const cases=[{...payload([]),currency:'USD'},payload([record('new'),record('new')]),payload([{...record('new'),date:'2099-01-01'}]),payload([{...record('new','movement'),direction:'out'}]),payload([{...record('new'),cents:1.2}]),payload([{...record('new'),kind:'budget'}])];
  for(const value of cases){await upload(p,value);assert.equal(await p.$eval('#apply-import',e=>e.hidden),true);assert.deepEqual(await stored(p),before);}
 });
 await check('New loans/refunds/transfers can be recorded and edited without changing income or spending totals',async()=>{
  await p.click('#nav-spending');const before=await stored(p),earned=await text(p,'income-total'),spent=await text(p,'spending-total');await p.$eval('.cash-section',e=>e.open=true);await p.click('#add-movement');
  await fill(p,'income-source','Borrowed funds');await fill(p,'income-amount','50.10');await fill(p,'movement-type','loan_received');await p.click('#income-form button[type="submit"]');const r=(await stored(p)).movements.at(-1);assert.equal(r.direction,'in');assert.equal(r.cents,5010);assert.equal((await stored(p)).incomes.length,before.incomes.length);assert.equal(await text(p,'income-total'),earned);assert.equal(await text(p,'spending-total'),spent);
  await p.click(`[data-cash-id="${r.id}"]`);await fill(p,'movement-type','transfer');await p.click('#income-form button[type="submit"]');assert.equal((await stored(p)).movements.at(-1).direction,'internal');assert.equal(await text(p,'income-total'),earned);
 });
 await check('Income and import storage failures retain the previous model, and stale file previews cannot overwrite newer data',async()=>{
  await p.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='finflow_tracker_v1')throw Error('Full');return window.realSet.call(this,k,v);};});const before=await stored(p);
  await income(p,'Salary','10');assert.deepEqual(await stored(p),before);assert.equal(await p.$eval('#income-dialog',e=>e.open),true);await p.click('#close-income');
  await upload(p,payload([record('failure')]));await p.click('#apply-import');await p.click('#confirm-action');assert.equal(await p.$eval('#confirm-dialog',e=>e.open),true);assert.deepEqual(await stored(p),before);await p.keyboard.press('Escape');await p.evaluate(()=>Storage.prototype.setItem=window.realSet);
  await upload(p,payload([record('stale')]));await income(p,'Salary','10');await p.click('#nav-settings');await p.click('#apply-import');assert.match(await text(p,'import-status'),/changed after preview/);assert.equal((await stored(p)).incomes.some(r=>r.id==='stale'),false);
 });
 await check('Local backup and Gist round-trips include income/movements/history, exclude device credentials, and confirm restore',async()=>{
  await p.evaluate(()=>{state.settings.gistId='abc123';localStorage.setItem('finflow_tracker_v1',JSON.stringify(state));localStorage.setItem('finflow_gist_connection_v1',JSON.stringify({gistId:'abc123',token:'synthetic-device-secret'}));});await p.reload();
  const backup=await p.evaluate(()=>localBackup());assert.ok(!JSON.stringify(backup).includes('synthetic-device-secret'));assert.equal(backup.data.settings.gistId,'');assert.ok(backup.data.movements.length&&backup.data.importLedger.length);assert.deepEqual(await p.evaluate(raw=>parseRemote(raw),JSON.stringify(backup)),backup.data);
  await income(p,'Salary','10');const before=await stored(p);await upload(p,backup);await p.click('#apply-import');await p.keyboard.press('Escape');assert.deepEqual(await stored(p),before);
  await p.click('#apply-import');await acceptConfirmation(p);const restored=await stored(p);assert.equal(restored.incomes.length,backup.data.incomes.length);assert.equal(restored.settings.gistId,'abc123');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('finflow_gist_connection_v1')).token),'synthetic-device-secret');await p.click('#undo');assert.equal((await stored(p)).incomes.length,before.incomes.length);
 });
 await check('Older backups gain empty compatible arrays, repeat normalization is stable, and malformed income remains protected',async()=>{
  const old=await p.evaluate(()=>localBackup());delete old.data.incomes;delete old.data.movements;delete old.data.importLedger;const normalized=await p.evaluate(data=>normalizeState(data),old.data);assert.deepEqual(normalized.incomes,[]);assert.deepEqual(normalized.movements,[]);assert.deepEqual(normalized.importLedger,[]);assert.deepEqual(await p.evaluate(data=>normalizeState(data),normalized),normalized);
  const good=await stored(p),bad=structuredClone(good);bad.incomes='invalid';await p.evaluate((key,data)=>localStorage.setItem(key,JSON.stringify(data)),KEY,bad);await p.reload();assert.equal(await p.$eval('#storage-warning',e=>e.hidden),false);assert.equal((await stored(p)).incomes,'invalid');await p.evaluate((key,data)=>localStorage.setItem(key,JSON.stringify(data)),KEY,good);await p.reload();
 });
 await check('Income, movement review, import, and modal fields fit phone and desktop without overflow or missing names',async()=>{
  for(const width of [320,390,1440]){
   await p.setViewport({width,height:844});await p.click('#nav-spending');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.click('#add-income');assert.equal(await p.$eval('#income-dialog',e=>e.scrollWidth>e.clientWidth),false);const bad=await p.$$eval('#income-form input',es=>es.filter(e=>!e.labels.length));assert.deepEqual(bad,[]);await p.click('#close-income');await p.click('#nav-settings');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(width===390){await p.click('#nav-spending');await p.screenshot({path:'/tmp/finflow-phone-income.png',fullPage:true});await p.click('#add-income');await p.screenshot({path:'/tmp/finflow-phone-income-editor.png'});await p.click('#close-income');}
  }
  await p.click('#nav-spending');await p.screenshot({path:'/tmp/finflow-desktop-income.png',fullPage:true});
 });
 assert.deepEqual(t.errors,[]);await t.context.close();console.log('All income and file import checks passed.');
}finally{await browser.close();fs.rmSync(directory,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
