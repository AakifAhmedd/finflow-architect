const {launch,fresh,stored,fill,continueEntry,text,check,assert,today}=require('./helpers');
async function layout(page){return page.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width};};
 const visible=e=>e.getClientRects().length>0;
 return {height:innerHeight,scrollHeight:document.documentElement.scrollHeight,scroll:scrollY,width:document.documentElement.scrollWidth,viewport:innerWidth,
  amount:rect(document.getElementById('amount')),actions:rect(document.querySelector('.entry-actions')),nav:rect(document.querySelector('.nav')),
  controls:[...document.querySelectorAll('[data-key],#categories button,#categories-back,#edit-amount,#details-summary,#continue-amount,#save-expense')].filter(visible).map(rect),
  review:[...document.querySelectorAll('#track-view .right-stack,.footer')].some(visible)};
 });}
function assertFits(l,label){
 assert.equal(l.review,false);assert.equal(l.width,l.viewport);assert.ok(l.scrollHeight<=l.height,`${label} scrolls: ${JSON.stringify(l)}`);assert.equal(l.scroll,0);
 assert.ok(l.amount.top>=0);assert.ok(l.controls.every(r=>r.height>=43.99&&r.width>=43.99&&r.bottom<=l.nav.top),`${label} clipped: ${JSON.stringify(l)}`);
 assert.ok(Math.abs(l.actions.bottom-l.nav.top)<1);assert.ok(l.nav.bottom<=l.height);
}
async function amountStage(page){if(await page.$eval('#edit-amount',e=>!e.hidden))await page.click('#edit-amount');}
(async()=>{const browser=await launch();try{
 const {page,context,errors}=await fresh(browser,390,844);
 await check('Phones open on the amount alone; invalid amounts cannot advance or save and Enter only advances',async()=>{
  assert.equal(await page.$eval('#category-picker',e=>e.hidden),true);assert.equal(await page.$eval('#entry-details',e=>e.hidden),true);assert.equal(await page.$eval('#save-expense',e=>e.hidden),true);
  for(const amount of ['','0','-1','1.234','1e4','9999999999']){
   await fill(page,'amount',amount);assert.equal(await page.$eval('#continue-amount',e=>e.disabled),true);await page.$eval('#expense-form',e=>e.requestSubmit());assert.equal(await stored(page),null);assert.equal(await page.$eval('#category-picker',e=>e.hidden),true);
  }
  await fill(page,'amount','100');await page.focus('#amount');await page.keyboard.press('Enter');assert.equal(await stored(page),null);
  assert.equal(await page.$eval('.keypad',e=>e.hidden),true);assert.equal(await page.$eval('#amount',e=>e.readOnly),true);assert.equal(await page.evaluate(()=>document.activeElement.dataset.category),'transport');
  await page.click('#categories-back');assert.equal(await page.$eval('#amount',e=>e.value),'100');assert.equal(await page.$eval('#amount',e=>e.readOnly),false);
 });
 await check('Amount, main categories, and every default subcategory grid fit common phones without scrolling',async()=>{
  for(const [width,height] of [[390,740],[390,844],[393,852],[412,823],[414,896],[430,932],[360,800],[767,900]]){
   await page.setViewport({width,height});await page.click('#nav-track');await amountStage(page);assertFits(await layout(page),`${width}x${height} amount`);
   await fill(page,'amount','100');await continueEntry(page);assertFits(await layout(page),`${width}x${height} categories`);
   for(const id of ['transport','food','sports','personal','community']){
    await page.click(`[data-category="${id}"]`);assertFits(await layout(page),`${width}x${height} ${id}`);
    assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);await page.click('[data-subcategory="Other"]');assertFits(await layout(page),`${width}x${height} selected ${id}`);
    await page.click('#categories-back');
   }
   await page.click('#categories-back');
  }
  await page.setViewport({width:390,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.screenshot({path:'/tmp/finflow-phone-staged-amount.png'});
  await continueEntry(page);await page.screenshot({path:'/tmp/finflow-phone-staged-categories.png'});
  await page.click('[data-category="food"]');await page.click('[data-subcategory="Cafes"]');await page.screenshot({path:'/tmp/finflow-phone-staged-subcategories.png'});
  await page.click('#categories-back');await page.click('#categories-back');
 });
 await check('A changing bottom safe area reserves room at every stage',async()=>{
  await page.setViewport({width:390,height:740});await page.evaluate(()=>document.querySelector('.nav').style.paddingBottom='43px');
  await page.waitForFunction(()=>Math.abs(document.querySelector('.entry-actions').getBoundingClientRect().bottom-document.querySelector('.nav').getBoundingClientRect().top)<1);
  assertFits(await layout(page),'safe area amount');await continueEntry(page);assertFits(await layout(page),'safe area categories');
  await page.click('[data-category="sports"]');await page.click('[data-subcategory="Medicines"]');assertFits(await layout(page),'safe area subcategory');await page.click('#categories-back');await page.click('#categories-back');
  await page.evaluate(()=>document.querySelector('.nav').style.paddingBottom='');
 });
 await check('The 768px boundary restores simultaneous desktop entry and analytics while preserving the phone draft',async()=>{
  await continueEntry(page);await page.click('[data-category="food"]');await page.click('[data-subcategory="Cafes"]');
  for(const width of [767,768,1440,390]){
   await page.setViewport({width,height:1000});await page.click('#nav-track');assert.equal((await layout(page)).review,width>=768);
   assert.equal(await page.$eval('.keypad',e=>e.hidden),width<768);assert.equal(await page.$eval('#amount',e=>e.readOnly),width<768);
   assert.equal(await page.$eval('#amount',e=>e.value),'100');assert.equal(await page.$eval('[data-subcategory="Cafes"]',e=>e.getAttribute('aria-pressed')),'true');
   assert.equal(await page.$eval('#monthly-card',e=>e.parentElement.id),width<768?'mobile-monthly-slot':'');
   if(width<768){await page.click('#nav-spending');assert.equal(await page.$eval('#monthly-card',e=>e.getClientRects().length>0),true);}
   assert.equal(await page.$$eval('#monthly-card',es=>es.length),1);
  }
  await page.click('#nav-track');await page.click('#categories-back');await page.click('#categories-back');
 });
 await check('Edit amount preserves classification, note and date; advancing never commits a complete draft',async()=>{
  await fill(page,'amount','100');await continueEntry(page);await page.click('[data-category="food"]');await page.click('[data-subcategory="Cafes"]');
  await page.click('#details-summary');await fill(page,'note','Quick coffee');await fill(page,'date',today());
  await page.click('#edit-amount');assert.equal(await page.$eval('#amount',e=>e.value),'100');assert.equal(await page.$eval('#entry-details',e=>e.hidden),true);
  await fill(page,'amount','123.45');await page.focus('#amount');await page.keyboard.press('Enter');assert.equal(await stored(page),null);
  assert.equal(await page.$eval('[data-subcategory="Cafes"]',e=>e.getAttribute('aria-pressed')),'true');assert.equal(await page.$eval('#note',e=>e.value),'Quick coffee');assert.equal(await page.$eval('#date',e=>e.value),today());
  await page.click('#save-expense');const data=await stored(page);assert.equal(data.expenses.length,1);assert.equal(data.expenses[0].cents,12345);assert.equal(data.expenses[0].subCategory,'Cafes');assert.equal(data.expenses[0].note,'Quick coffee');
  const clean=await page.evaluate(()=>({amount:document.getElementById('amount').value,note:document.getElementById('note').value,details:document.getElementById('entry-details').open,step:document.getElementById('expense-form').dataset.entryStep,repeat:document.getElementById('repeat-monthly').checked,focus:document.activeElement.dataset.key,scroll:scrollY}));
  assert.deepEqual(clean,{amount:'',note:'',details:false,step:'amount',repeat:false,focus:'1',scroll:0});assert.equal(await text(page,'toast-message'),'Expense saved');assert.equal(await page.$eval('#undo',e=>e.hidden),false);
  await page.click('[data-key="8"]');assert.equal(await page.$eval('#amount',e=>e.value),'8');await page.waitForFunction(()=>document.getElementById('toast').hidden,{timeout:5000});
 });
 await check('Navigation and returning focus retain a draft; phone edits also advance before saving and keep existing details',async()=>{
  await continueEntry(page);await page.click('[data-category="transport"]');await page.click('[data-subcategory="Other"]');
  await page.click('#nav-spending');await page.click('#nav-track');await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));});
  assert.equal(await page.$eval('#amount',e=>e.value),'8');assert.equal(await page.$eval('#save-expense',e=>e.disabled),false);await page.click('#save-expense');assert.equal((await stored(page)).expenses.length,2);
  await page.click('#nav-spending');assert.equal(await text(page,'spending-total'),'Rs. 131.45');await page.click('#spending-list [data-expense]');await page.click('#edit-expense');
  assert.equal(await text(page,'save-label'),'Save changes');assert.equal(await page.$eval('#save-expense',e=>e.hidden),true);await fill(page,'amount','9');await page.focus('#amount');await page.keyboard.press('Enter');assert.equal((await stored(page)).expenses.at(-1).cents,800);
  await page.click('#save-expense');assert.equal((await stored(page)).expenses.length,2);assert.equal((await stored(page)).expenses.at(-1).cents,900);assert.equal((await layout(page)).scroll,0);
 });
 await check('Remembered main categories apply after amount entry; canceling an edit restores the amount screen',async()=>{
  await page.click('#nav-settings');await page.click('#remember-category');await page.click('#behavior-form button[type="submit"]');await page.click('#nav-track');
  await fill(page,'amount','4');await continueEntry(page);await page.click('[data-category="food"]');await page.click('[data-subcategory="Cafes"]');await page.click('#save-expense');
  assert.equal(await page.$eval('#category-picker',e=>e.hidden),true);await fill(page,'amount','5');await continueEntry(page);assert.equal(await text(page,'category-label'),'Food & Dining');assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);
  await page.click('#nav-spending');await page.click('#spending-list [data-expense]');await page.click('#edit-expense');await page.click('#cancel-edit');assert.equal(await page.$eval('#amount',e=>e.value),'');assert.equal(await page.$eval('#category-picker',e=>e.hidden),true);
 });
 await check('Expanded details and very short phones may scroll while actions stay reachable',async()=>{
  await page.setViewport({width:320,height:568});await fill(page,'amount','30');await continueEntry(page);await page.click('[data-subcategory="Other"]');
  await page.$eval('#details-summary',e=>e.scrollIntoView({block:'center'}));await page.click('#details-summary');await page.$eval('#repeat-monthly',e=>e.scrollIntoView({block:'center'}));await page.click('#repeat-monthly');
  await page.$eval('#date',e=>e.scrollIntoView({block:'center'}));const l=await layout(page);assert.ok(l.scrollHeight>l.height);assert.equal(l.width,l.viewport);
  const save=await page.$eval('#save-expense',e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}));assert.ok(save.top>=0&&save.bottom<=l.nav.top);
  const date=await page.$eval('#date',e=>({bottom:e.getBoundingClientRect().bottom,top:e.getBoundingClientRect().top}));assert.ok(date.top>=0&&date.bottom<=l.actions.top,JSON.stringify({date,l}));
  await page.click('#nav-settings');assert.equal(await page.$eval('.entry-actions',e=>e.getClientRects().length),0);
 });
 assert.deepEqual(errors,[]);await context.close();console.log('All staged phone tracking checks passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
