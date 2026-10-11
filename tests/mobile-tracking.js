const {launch,fresh,stored,fill,text,check,assert}=require('./helpers');
async function layout(page){return page.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
 const visible=e=>e.getClientRects().length>0;
 return {height:innerHeight,scrollHeight:document.documentElement.scrollHeight,scroll:scrollY,width:document.documentElement.scrollWidth,viewport:innerWidth,
  amount:rect(document.getElementById('amount')),actions:rect(document.querySelector('.entry-actions')),save:rect(document.getElementById('save-expense')),nav:rect(document.querySelector('.nav')),
  controls:[...document.querySelectorAll('[data-key],#categories button,#categories-back,#details-summary')].filter(visible).map(rect),
  review:[...document.querySelectorAll('#track-view .right-stack,.footer')].some(visible)};
 });}
(async()=>{const browser=await launch();try{
 const {page,context,errors}=await fresh(browser,390,844);
 await check('Mobile Tracks has only entry, fits both picker steps on common phones, and pins Save above navigation',async()=>{
  for(const [width,height] of [[390,740],[390,844],[393,852],[412,823],[414,896],[430,932],[360,800],[767,900]]){
   await page.setViewport({width,height});await page.click('#nav-track');
   for(const step of ['main','sub']){
    if(step==='sub')await page.click('[data-category="food"]');
    const l=await layout(page);assert.equal(l.review,false);assert.equal(l.width,l.viewport);assert.ok(l.scrollHeight<=height,`${width}x${height} ${step} scrolls: ${JSON.stringify(l)}`);
    assert.equal(l.scroll,0);assert.ok(l.amount.top>=0);assert.ok(l.controls.every(r=>r.height>=43.99&&r.bottom<=l.actions.top),`Entry clipped: ${JSON.stringify(l)}`);
    assert.ok(l.save.bottom<=l.nav.top);assert.ok(Math.abs(l.actions.bottom-l.nav.top)<1);assert.ok(l.nav.bottom<=height);
    if(step==='sub')await page.click('#categories-back');
   }
  }
  await page.setViewport({width:390,height:844});await page.screenshot({path:'/tmp/finflow-phone-dedicated-track.png'});
  await page.click('[data-category="food"]');await page.screenshot({path:'/tmp/finflow-phone-dedicated-subcategories.png'});await page.click('#categories-back');
 });
 await check('A changing bottom safe area moves Save and reserves space without covering entry or introducing phone scrolling',async()=>{
  await page.setViewport({width:390,height:740});await page.evaluate(()=>document.querySelector('.nav').style.paddingBottom='43px');
  await page.waitForFunction(()=>Math.abs(document.querySelector('.entry-actions').getBoundingClientRect().bottom-document.querySelector('.nav').getBoundingClientRect().top)<1);
  const l=await layout(page);assert.ok(l.scrollHeight<=l.height,JSON.stringify(l));assert.ok(l.controls.every(r=>r.bottom<=l.actions.top));assert.ok(l.save.bottom<=l.nav.top);
  await page.evaluate(()=>document.querySelector('.nav').style.paddingBottom='');
 });
 await check('The 768px boundary restores desktop analytics and moves the single monthly management card without losing state',async()=>{
  for(const width of [767,768,1440,390]){
   await page.setViewport({width,height:1000});await page.click('#nav-track');assert.equal((await layout(page)).review,width>=768);
   assert.equal(await page.$eval('#monthly-card',e=>e.parentElement.id),width<768?'mobile-monthly-slot':'');
   if(width<768){await page.click('#nav-spending');assert.equal(await page.$eval('#monthly-card',e=>e.getClientRects().length>0),true);assert.equal(await page.$eval('#spending-total',e=>e.getClientRects().length>0),true);}
   assert.equal(await page.$$eval('#monthly-card',es=>es.length),1);
  }
 });
 await check('A phone save persists classification and details, clears inputs, and immediately readies the keypad with a brief Undo confirmation',async()=>{
  await page.setViewport({width:390,height:844});await page.click('#nav-track');
  for(const key of ['1','2','3','.','4','5'])await page.click(`[data-key="${key}"]`);
  await page.click('[data-category="food"]');await page.click('[data-subcategory="Cafes & Dining"]');
  await page.click('#details-summary');await fill(page,'note','Quick coffee');await page.click('#save-expense');
  const data=await stored(page);assert.equal(data.expenses.length,1);assert.equal(data.expenses[0].cents,12345);assert.equal(data.expenses[0].mainCategory,'Food & Dining');assert.equal(data.expenses[0].subCategory,'Cafes & Dining');assert.equal(data.expenses[0].note,'Quick coffee');
  const clean=await page.evaluate(()=>({amount:document.getElementById('amount').value,note:document.getElementById('note').value,details:document.getElementById('entry-details').open,repeat:document.getElementById('repeat-monthly').checked,selected:[...document.querySelectorAll('#categories [aria-pressed="true"]')].length,disabled:document.getElementById('save-expense').disabled,focus:document.activeElement.dataset.key,scroll:scrollY}));
  assert.deepEqual(clean,{amount:'',note:'',details:false,repeat:false,selected:0,disabled:true,focus:'1',scroll:0});assert.equal(await text(page,'toast-message'),'Expense saved');assert.equal(await page.$eval('#undo',e=>e.hidden),false);
  await page.click('[data-key="8"]');assert.equal(await page.$eval('#amount',e=>e.value),'8');
  await page.waitForFunction(()=>document.getElementById('toast').hidden,{timeout:5000});
 });
 await check('Returning focus keeps a phone draft usable; another save and review/edit remain available in Spending',async()=>{
  await page.click('[data-category="transport"]');await page.click('[data-subcategory="Other"]');await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));});
  assert.equal(await page.$eval('#amount',e=>e.value),'8');assert.equal(await page.$eval('#save-expense',e=>e.disabled),false);assert.equal((await layout(page)).review,false);
  await page.click('#save-expense');assert.equal((await stored(page)).expenses.length,2);await page.click('#nav-spending');assert.equal(await text(page,'spending-total'),'Rs. 131.45');
  await page.click('#spending-list [data-expense]');await page.click('#edit-expense');assert.equal(await page.$eval('#track-view',e=>e.hidden),false);assert.equal(await text(page,'save-label'),'Save changes');
  await fill(page,'amount','9');await page.click('#save-expense');await page.waitForFunction(()=>document.getElementById('save-label').textContent==='Save expense');assert.equal((await stored(page)).expenses.length,2);assert.equal((await stored(page)).expenses.at(-1).cents,900);assert.equal((await layout(page)).scroll,0);
 });
 await check('Expanded details and very small phones can scroll while Save and navigation remain reachable',async()=>{
  await page.setViewport({width:320,height:568});await page.$eval('#details-summary',e=>e.scrollIntoView({block:'center'}));await page.click('#details-summary');await page.$eval('#repeat-monthly',e=>e.scrollIntoView({block:'center'}));await page.click('#repeat-monthly');
  await page.$eval('#date',e=>e.scrollIntoView({block:'center'}));const l=await layout(page);assert.ok(l.scrollHeight>l.height);assert.equal(l.width,l.viewport);assert.ok(l.save.top>=0&&l.save.bottom<=l.nav.top);
  const date=await page.$eval('#date',e=>({bottom:e.getBoundingClientRect().bottom,top:e.getBoundingClientRect().top}));assert.ok(date.top>=0&&date.bottom<=l.actions.top,JSON.stringify({date,l}));
  await page.click('#nav-settings');assert.equal(await page.$eval('.entry-actions',e=>e.getClientRects().length),0);assert.equal(await page.$eval('#settings-view',e=>e.hidden),false);
 });
 assert.deepEqual(errors,[]);await context.close();console.log('All dedicated mobile tracking checks passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
