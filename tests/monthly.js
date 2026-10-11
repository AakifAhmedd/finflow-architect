const {acceptConfirmation,launch,fresh,stored,fill,add,text,check,assert,KEY,LEGACY,URL}=require('./helpers');
async function installClock(page){
 await page.evaluateOnNewDocument(()=>{
  const OriginalDate=Date,instant=localStorage.getItem('finflow_test_clock');
  if(instant){window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return new OriginalDate(instant).getTime();}};}
 });
}
async function at(page,date){
 await page.evaluate(value=>localStorage.setItem('finflow_test_clock',value),date+'T12:00:00+05:30');
 await page.reload({waitUntil:'load'});
}
async function setup(page,name,amount,date,sub='Software & Cloud Services'){
 await fill(page,'amount',amount);if(await page.$eval('#categories-back',e=>!e.hidden))await page.click('#categories-back');
 await page.click('[data-category="personal"]');await page.click(`[data-subcategory="${sub}"]`);
 await page.$eval('#entry-details',e=>e.open=true);await page.click('#repeat-monthly');await fill(page,'recurring-name',name);await fill(page,'date',date);await page.click('#save-expense');
}
(async()=>{
 const browser=await launch();
 try{
  const {page,context,errors}=await fresh(browser);await installClock(page);await at(page,'2024-01-31');
  await check('Monthly setup requires a name and stores one schedule with its first due charge',async()=>{
   await setup(page,'','1000.50','2024-01-31');assert.match(await text(page,'form-feedback'),/Name this monthly/);assert.equal(await stored(page),null);
   await fill(page,'recurring-name','Google One');await page.click('#save-expense');
   const data=await stored(page);assert.equal(data.recurringRules.length,1);assert.equal(data.expenses.length,1);
   const r=data.recurringRules[0],e=data.expenses[0];assert.equal(r.day,31);assert.equal(r.nextMonth,'2024-02');assert.equal(r.cents,100050);
   assert.equal(e.recurringId,r.id);assert.equal(e.recurringName,'Google One');assert.equal(e.date,'2024-01-31');assert.equal(e.subCategory,'Software & Cloud Services');
   assert.match(await text(page,'monthly-list'),/29 Feb/);assert.match(await text(page,'recent-list'),/Google One/);assert.match(await text(page,'recent-list'),/Monthly/);
  });
  await check('Reloading does not duplicate charges or alter the monthly cursor',async()=>{
   const before=await stored(page);await page.reload({waitUntil:'load'});assert.deepEqual(await stored(page),before);
  });
  await check('Day 31 uses February 29 in leap years and catches up all missed months once',async()=>{
   await at(page,'2024-02-28');assert.equal((await stored(page)).expenses.length,1);
   await at(page,'2024-02-29');assert.equal((await stored(page)).expenses.length,2);assert.equal((await stored(page)).expenses.at(-1).date,'2024-02-29');
   await at(page,'2024-06-30');const data=await stored(page);assert.deepEqual(data.expenses.map(e=>e.date),['2024-01-31','2024-02-29','2024-03-31','2024-04-30','2024-05-31','2024-06-30']);
   assert.equal(data.recurringRules[0].nextMonth,'2024-07');assert.equal(new Set(data.expenses.map(e=>e.id)).size,6);
   assert.equal(await text(page,'track-total'),'1,000.50');await page.click('#nav-spending');assert.equal(await text(page,'spending-total'),'Rs. 1,000.50');await page.click('#nav-track');
  });
  await check('Deleting a monthly charge honors deletion on reload and still allows future months',async()=>{
   await page.click('#recent-list [data-expense]');await page.click('#delete-expense');await acceptConfirmation(page);assert.equal((await stored(page)).expenses.length,5);
   await page.click('#undo');assert.equal((await stored(page)).expenses.length,6);
   await page.click('#recent-list [data-expense]');await page.click('#delete-expense');await acceptConfirmation(page);await page.reload({waitUntil:'load'});
   assert.equal((await stored(page)).expenses.length,5);assert.equal((await stored(page)).recurringRules[0].nextMonth,'2024-07');
   await at(page,'2024-07-31');assert.equal((await stored(page)).expenses.length,6);assert.equal((await stored(page)).expenses.at(-1).date,'2024-07-31');
  });
  await check('Schedule edits affect future charges while preserving historical amounts and classifications',async()=>{
   const before=(await stored(page)).expenses;
   await page.click('[data-monthly]');await fill(page,'monthly-name','Google One Plus');await fill(page,'monthly-amount','2000');await fill(page,'monthly-day','15');await fill(page,'monthly-subcategory','Other');await fill(page,'monthly-note','Updated plan');await page.click('#monthly-form button[type="submit"]');
   assert.deepEqual((await stored(page)).expenses,before);
   await at(page,'2024-08-14');assert.equal((await stored(page)).expenses.length,6);
   await at(page,'2024-08-15');const e=(await stored(page)).expenses.at(-1);assert.equal(e.cents,200000);assert.equal(e.recurringName,'Google One Plus');assert.equal(e.subCategory,'Other');assert.equal(e.note,'Updated plan');
  });
  await check('Editing a single charge preserves the schedule, and changing the day cannot add two charges in the same month',async()=>{
   await page.click('#recent-list [data-expense]');await page.click('#edit-expense');assert.equal(await page.$eval('#recurrence-field',e=>e.hidden),true);
   await fill(page,'amount','99');await page.click('#save-expense');assert.equal((await stored(page)).expenses.at(-1).cents,9900);assert.equal((await stored(page)).recurringRules[0].cents,200000);
   await page.click('[data-monthly]');await fill(page,'monthly-day','20');await page.click('#monthly-form button[type="submit"]');
   await at(page,'2024-08-20');assert.equal((await stored(page)).expenses.length,7);
   await at(page,'2024-09-19');assert.equal((await stored(page)).expenses.length,7);
   await at(page,'2024-09-20');assert.equal((await stored(page)).expenses.length,8);assert.equal((await stored(page)).expenses.at(-1).cents,200000);
  });
  await check('Stopping keeps previous charges, Undo restores the schedule, and stopped expenses do not catch up later',async()=>{
   await page.click('[data-monthly]');await page.click('#stop-monthly');await acceptConfirmation(page);assert.equal((await stored(page)).recurringRules[0].active,false);assert.equal((await stored(page)).expenses.length,8);
   await page.click('#undo');assert.equal((await stored(page)).recurringRules[0].active,true);
   await page.click('[data-monthly]');await page.click('#stop-monthly');await acceptConfirmation(page);await at(page,'2024-11-20');assert.equal((await stored(page)).expenses.length,8);assert.match(await text(page,'monthly-list'),/No monthly expenses/);
  });
  await check('Future monthly setup stays out of actual spending until its first charge date',async()=>{
   await setup(page,'YouTube','1200','2024-12-01','Other');const data=await stored(page);assert.equal(data.recurringRules.length,2);assert.equal(data.expenses.length,8);assert.equal(await text(page,'track-total'),'0');assert.match(await text(page,'monthly-list'),/YouTube/);
  });
  await check('Automatic posting writes the charge and cursor atomically and recovers from storage failure',async()=>{
   const original=await stored(page);
   const failure=await page.evaluateOnNewDocument(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
   await at(page,'2024-12-01');assert.deepEqual(await stored(page),original);assert.match(await text(page,'storage-warning'),/not saved/);
   await page.removeScriptToEvaluateOnNewDocument(failure.identifier);await page.reload({waitUntil:'load'});
   const data=await stored(page);assert.equal(data.expenses.length,9);assert.equal(data.expenses.at(-1).recurringName,'YouTube');assert.equal(data.recurringRules[1].nextMonth,'2025-01');
  });
  await check('Multiple tabs and repeated opens log only one charge per schedule/month',async()=>{
   const other=await context.newPage();await installClock(other);await other.goto(URL,{waitUntil:'load'});
   await page.bringToFront();await at(page,'2025-01-01');await other.bringToFront();await other.reload({waitUntil:'load'});
   assert.equal((await stored(other)).expenses.length,10);await page.bringToFront();await page.reload({waitUntil:'load'});assert.equal((await stored(page)).expenses.length,10);await other.close();
  });
  await check('A non-leap February clamps day 31 to February 28',async()=>{
   await setup(page,'Month-end subscription','50','2025-01-31','Software & Cloud Services');assert.equal((await stored(page)).expenses.length,10);
   await at(page,'2025-01-31');assert.equal((await stored(page)).expenses.length,11);
   await at(page,'2025-02-28');const data=await stored(page),r=data.recurringRules[2],charges=data.expenses.filter(e=>e.recurringId===r.id);
   assert.deepEqual(charges.map(e=>e.date),['2025-01-31','2025-02-28']);assert.equal(r.nextMonth,'2025-03');
  });
  await check('Monthly names render as inert text in lists and dialogs',async()=>{
   await setup(page,'<img src=x onerror="window.__xss=1">','10','2025-02-28','Other');
   assert.equal(await page.$$eval('img',es=>es.length),0);assert.equal(await page.evaluate(()=>window.__xss),undefined);
   await page.click('#recent-list [data-expense]');assert.match(await text(page,'dialog-title'),/<img/);await page.click('#manage-monthly-charge');assert.equal(await page.$eval('#monthly-dialog',e=>e.open),true);await page.keyboard.press('Escape');
  });
  await check('Monthly setup and management fit phone and desktop layouts, including labeled controls',async()=>{
   for(const width of [320,390,1440]){
    await page.setViewport({width,height:844});await page.click(width<768?'#nav-spending':'#nav-track');await page.click('[data-monthly]');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const overflow=await page.$eval('#monthly-dialog',e=>e.scrollWidth>e.clientWidth);assert.equal(overflow,false);
    const unnamed=await page.$$eval('#monthly-dialog input,#monthly-dialog select',es=>es.filter(e=>!e.labels.length).map(e=>e.id));assert.deepEqual(unnamed,[]);
    if(width===390)await page.screenshot({path:'/tmp/finflow-phone-monthly-settings.png'});
    await page.keyboard.press('Escape');
   }
   await page.setViewport({width:1440,height:1050});await page.evaluate(()=>document.getElementById('toast').hidden=true);await page.screenshot({path:'/tmp/finflow-desktop-monthly.png',fullPage:true});
  });
  await check('Invalid stored schedules are preserved and block posting rather than being silently dropped',async()=>{
   const before=await stored(page);before.recurringRules[1].day=0;const raw=JSON.stringify(before);
   await page.evaluate((key,value)=>localStorage.setItem(key,value),KEY,raw);await page.reload({waitUntil:'load'});
   assert.equal(await page.$eval('#storage-warning',e=>e.hidden),false);assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),raw);
  });
  assert.deepEqual(errors,[]);await context.close();
  const old=await fresh(browser),p=old.page;
  await check('Older tracker data gains an empty rule list without reactivating legacy subscriptions',async()=>{
   await add(p,'25');const original=await stored(p);delete original.recurringRules;
   await p.evaluate((key,legacy,data)=>{localStorage.setItem(key,JSON.stringify(data));localStorage.setItem(legacy,JSON.stringify({transactions:[],subscriptions:[{id:'old',name:'Google One',amount:1000,day:1,startDate:'2020-01-01',node:'Google One'}]}));},KEY,LEGACY,original);
   await p.reload({waitUntil:'load'});const data=await stored(p);assert.deepEqual(data.recurringRules,[]);assert.deepEqual(data.expenses,original.expenses);
  });
  assert.deepEqual(old.errors,[]);await old.context.close();console.log('All monthly expense checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
