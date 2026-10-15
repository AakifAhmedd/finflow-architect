const {launch,fresh,stored,fill,text,check,assert,KEY,URL,acceptConfirmation}=require('./helpers');
async function clock(page,date){
 await page.evaluate(value=>localStorage.setItem('finflow_income_clock',value),date+'T12:00:00+05:30');await page.reload({waitUntil:'load'});
}
async function setup(page,label,amount,date){
 await page.click('#nav-spending');await page.click('#add-income-top');await fill(page,'income-source',label);await fill(page,'income-amount',amount);await page.click('#income-repeat');await fill(page,'income-date',date);await page.click('#save-income');
}
(async()=>{
 const browser=await launch();
 try{
  const {page,context,errors}=await fresh(browser);
  await page.evaluateOnNewDocument(()=>{const D=Date,value=localStorage.getItem('finflow_income_clock');if(value)window.Date=class extends D{constructor(...a){super(...(a.length?a:[value]));}static now(){return new D(value).getTime();}};});
  await clock(page,'2024-01-31');
  await check('Monthly income creates one schedule and one precise first entry, and survives reload',async()=>{
   await setup(page,'Base salary','100,000.50','2024-01-31');const before=await stored(page),r=before.recurringIncomeRules[0];
   assert.equal(before.incomes.length,1);assert.equal(before.expenses.length,0);assert.equal(r.cents,10000050);assert.equal(r.day,31);assert.equal(r.nextMonth,'2024-02');
   assert.equal(before.incomes[0].id,`monthly-income:${r.id}:2024-01`);assert.equal(before.incomes[0].recurringId,r.id);assert.match(await text(page,'income-list'),/Monthly/);
   await page.reload({waitUntil:'load'});assert.deepEqual(await stored(page),before);
  });
  await check('Leap February and missed months post once per month and exclude future income',async()=>{
   await clock(page,'2024-05-31');let data=await stored(page);assert.deepEqual(data.incomes.map(r=>r.date),['2024-01-31','2024-02-29','2024-03-31','2024-04-30','2024-05-31']);
   await setup(page,'Future allowance','2000','2025-01-01');data=await stored(page);assert.equal(data.incomes.length,5);assert.equal(data.recurringIncomeRules.length,2);assert.equal(data.recurringIncomeRules[1].nextMonth,'2025-01');assert.match(await text(page,'income-total'),/100,000.50/);
  });
  await check('Deleting a posted income honors its cursor; editing a posting leaves its schedule intact',async()=>{
   await page.click('#income-list [data-cash-id]');await page.click('#delete-income');await page.click('#confirm-cancel');assert.equal((await stored(page)).incomes.length,5);
   await page.click('#delete-income');await acceptConfirmation(page);await page.reload({waitUntil:'load'});assert.equal((await stored(page)).incomes.length,4);
   await page.click('#nav-spending');await fill(page,'month-picker','2024-04');await page.click('#income-list [data-cash-id]');await fill(page,'income-amount','99000.25');await page.click('#save-income');
   const data=await stored(page);assert.equal(data.incomes.find(r=>r.date==='2024-04-30').cents,9900025);assert.equal(data.recurringIncomeRules[0].cents,10000050);
  });
  await check('Schedule changes affect future posts; paused monthly logging catches up both income and expenses',async()=>{
   await page.click('[data-income-rule]');await fill(page,'income-rule-amount','120000');await page.click('#income-rule-form [type="submit"]');await clock(page,'2024-06-30');
   let data=await stored(page);assert.equal(data.incomes.at(-1).cents,12000000);assert.equal(data.incomes.at(-1).date,'2024-06-30');assert.equal(data.incomes[0].cents,10000050);
   await page.evaluate(()=>{const next=clone(state);next.settings.monthlyPosting=false;commit(next,'Paused');});await clock(page,'2024-08-31');assert.equal((await stored(page)).incomes.length,5);
   await page.evaluate(()=>{const next=clone(state);next.settings.monthlyPosting=true;addDueMonthly(next);commit(next,'Resumed');});data=await stored(page);assert.equal(data.incomes.length,7);assert.deepEqual(data.incomes.slice(-2).map(r=>r.date),['2024-07-31','2024-08-31']);
   await page.reload({waitUntil:'load'});assert.equal((await stored(page)).incomes.length,7);
  });
  await check('Stopping requires confirmation, retains past income, and supports Undo',async()=>{
   await page.click('#nav-spending');await page.click('[data-income-rule]');await page.click('#stop-income-rule');await page.click('#confirm-cancel');assert.equal((await stored(page)).recurringIncomeRules[0].active,true);
   await page.click('#stop-income-rule');await acceptConfirmation(page);assert.equal((await stored(page)).recurringIncomeRules[0].active,false);assert.equal((await stored(page)).incomes.length,7);
   await page.click('#undo');assert.equal((await stored(page)).recurringIncomeRules[0].active,true);
   await page.click('[data-income-rule]');await page.click('#stop-income-rule');await acceptConfirmation(page);await clock(page,'2024-11-30');assert.equal((await stored(page)).incomes.length,7);
  });
  await check('Storage failure cannot advance an income cursor or lose the previous model',async()=>{
   const before=await stored(page);const script=await page.evaluateOnNewDocument(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
   await clock(page,'2025-01-01');
   assert.deepEqual(await stored(page),before);assert.match(await text(page,'storage-warning'),/not saved/);
   await page.removeScriptToEvaluateOnNewDocument(script.identifier);await page.reload({waitUntil:'load'});const data=await stored(page);assert.equal(data.incomes.length,8);assert.equal(data.incomes.at(-1).label,'Future allowance');assert.equal(data.recurringIncomeRules[1].nextMonth,'2025-02');
  });
  await check('Backups and Gist round-trips preserve schedules, while older snapshots normalize idempotently',async()=>{
   const result=await page.evaluate(()=>{const backup=localBackup(),remote=parseRemote(JSON.stringify(backup)),older=freshState();delete older.recurringIncomeRules;const normalized=normalizeState(older);return {backup,remote,older:normalized,again:normalizeState(normalized)};});
   assert.deepEqual(result.remote.recurringIncomeRules,result.backup.data.recurringIncomeRules);assert.deepEqual(result.older.recurringIncomeRules,[]);assert.deepEqual(result.older,result.again);assert.equal(JSON.stringify(result.backup).includes('gistToken'),false);
  });
  await check('Changing a future pay day never creates income before its first date or backdates a new posting',async()=>{
   await setup(page,'Planned salary','5000','2025-02-28');await clock(page,'2025-02-15');const before=await stored(page),rule=before.recurringIncomeRules.at(-1);
   await page.evaluate(id=>{switchView('spending',false);showIncomeRule(id);},rule.id);await fill(page,'income-rule-day','1');await page.click('#income-rule-form [type="submit"]');const data=await stored(page);
   assert.equal(data.recurringIncomeRules.at(-1).nextMonth,'2025-03');assert.deepEqual(data.incomes,before.incomes);
  });
  await check('Non-leap month-end, inert labels, multiple tabs, and narrow management dialogs remain safe',async()=>{
   await setup(page,'<img src=x onerror="window.__incomeXss=1">','25','2025-01-31');await clock(page,'2025-02-28');let data=await stored(page);assert.equal(data.incomes.at(-1).date,'2025-02-28');assert.equal(await page.evaluate(()=>window.__incomeXss),undefined);
   const other=await context.newPage();await other.evaluateOnNewDocument(()=>{const D=Date,value=localStorage.getItem('finflow_income_clock');if(value)window.Date=class extends D{constructor(...a){super(...(a.length?a:[value]));}static now(){return new D(value).getTime();}};});await other.goto(URL,{waitUntil:'load'});assert.deepEqual(await stored(other),data);await other.close();
   for(const [width,height] of [[320,740],[390,844],[844,390],[1440,1000]]){await page.setViewport({width,height});await page.click('#nav-spending');await page.click('[data-income-rule]');assert.equal(await page.$eval('#income-rule-dialog',e=>e.scrollWidth>e.clientWidth),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(await page.$$eval('#income-rule-dialog input',es=>es.filter(e=>!e.labels.length).map(e=>e.id)),[]);if(width===390)await page.screenshot({path:'/tmp/finflow-phone-recurring-income.png'});await page.keyboard.press('Escape');}
  });
  await check('Malformed schedules or orphan income links preserve stored data and pause saving',async()=>{
   const data=await stored(page);for(const malformed of [{...data,recurringIncomeRules:null},{...data,recurringIncomeRules:[{...data.recurringIncomeRules[0],day:0}]},{...data,incomes:[{...data.incomes[0],recurringId:'missing'}]}]){const raw=JSON.stringify(malformed);await page.evaluate((key,raw)=>localStorage.setItem(key,raw),KEY,raw);await page.reload({waitUntil:'load'});assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),raw);assert.equal(await page.$eval('#storage-warning',e=>e.hidden),false);}
  });
  assert.deepEqual(errors,[]);await context.close();console.log('All recurring income checks passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
