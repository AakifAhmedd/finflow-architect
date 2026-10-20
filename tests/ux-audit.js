const {launch,fresh,stored,fill,continueEntry,add,text,check,today,assert}=require('./helpers');

async function choose(page,id,value){
 await page.click('#'+id+'-control');
 await page.click(`#form-picker [data-picker-value="${value}"]`);
}
async function cash(page,kind,label,amount){
 await page.click('#nav-spending');
 if(kind==='movement'){await page.$eval('.cash-section',e=>e.open=true);await page.click('#add-movement');}
 else await page.click('#add-income-top');
 await fill(page,'income-source',label);await fill(page,'income-amount',amount);await page.click('#save-income');
}
(async()=>{
 const browser=await launch();try{
 const {page,context,errors}=await fresh(browser,390,844);
 const date=today(),day=date.slice(8),first=date.slice(0,7)+'-01';
 await add(page,'12.50','food',{subCategory:'Cafes',date:first});
 await add(page,'20','transport',{subCategory:'Fuel'});
 await add(page,'7','food',{subCategory:'Groceries'});
 await page.click('#nav-spending');

 await check('Spending leads with totals and transactions, with compact income and direct section shortcuts',async()=>{
  const order=await page.evaluate(()=>{const top=id=>document.getElementById(id).getBoundingClientRect().top;return {stats:top('spending-total'),transactions:top('spending-transactions'),insights:top('spending-insights'),income:top('income-overview'),comparisons:[...document.querySelectorAll('.income-comparison')].some(e=>e.getClientRects().length)};});
  assert.ok(order.stats<order.transactions&&order.transactions<order.insights&&order.insights<order.income);assert.equal(order.comparisons,false);
  await page.click('[data-spending-section="income"]');assert.equal(await page.evaluate(()=>document.activeElement.id),'income-title');
  await page.click('[data-spending-section="monthly"]');assert.equal(await page.evaluate(()=>document.activeElement.id),'monthly-title');assert.equal(await page.$eval('body',e=>e.dataset.view),'spending');
  await page.setViewport({width:1440,height:1000});await page.click('[data-spending-section="monthly"]');assert.equal(await page.$eval('body',e=>e.dataset.view),'track');assert.equal(await page.evaluate(()=>document.activeElement.id),'monthly-title');
  await page.setViewport({width:390,height:844});await page.click('#nav-spending');
 });
 await check('Whole expense rows open by tapping the name or pressing Enter, and edit/save/cancel return to review',async()=>{
  const id=await page.$eval('#spending-list [data-expense]',e=>e.dataset.expense);
  const size=await page.$eval('#spending-list [data-expense]',e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,nested:e.querySelectorAll('button').length}));assert.ok(size.width>=44&&size.height>=44);assert.equal(size.nested,0);
  await page.click('#spending-list .expense-name');assert.equal(await page.$eval('#expense-dialog',e=>e.open),true);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.expense),id);await page.keyboard.press('Enter');assert.equal(await page.$eval('#expense-dialog',e=>e.open),true);await page.click('#edit-expense');
  assert.equal(await page.$eval('#edit-context',e=>e.hidden),false);assert.match(await text(page,'edit-context'),/Editing Groceries/);assert.ok((await text(page,'edit-context')).includes(date.slice(0,4)));
  await fill(page,'amount','8');await continueEntry(page);await page.click('#save-expense');assert.equal(await page.$eval('body',e=>e.dataset.view),'spending');assert.equal(await page.evaluate(()=>document.activeElement.dataset.expense),id);assert.equal((await stored(page)).expenses.length,3);assert.equal((await stored(page)).expenses.at(-1).cents,800);
  await page.keyboard.press('Enter');await page.click('#edit-expense');const before=await stored(page);await fill(page,'amount','99');await page.click('#cancel-edit');assert.deepEqual(await stored(page),before);assert.equal(await page.$eval('body',e=>e.dataset.view),'spending');assert.equal(await page.$eval('#edit-context',e=>e.hidden),true);
 });
 await check('Category selection scopes the daily chart, while day selection filters transactions with explicit feedback',async()=>{
  await page.click('[data-filter="food"]');assert.equal(await text(page,'filtered-count'),'2 expenses');assert.match(await text(page,'daily-month'),/Food & Dining/);assert.match(await text(page,'category-filter-label'),/Monthly totals above include all categories/);assert.equal(await text(page,'spending-total'),'Rs. 40.50');
  await page.$eval('#daily-chart [data-day="01"]',e=>e.focus());await page.keyboard.press('Enter');assert.equal(await text(page,'filtered-count'),day==='01'?'2 expenses':'1 expense');assert.match(await text(page,'daily-selection'),/Food & Dining/);assert.match(await text(page,'spending-list-title'),/1 /);
  await page.keyboard.press('End');const end=await page.evaluate(()=>document.activeElement.dataset.day);await page.keyboard.press('Enter');assert.equal(await page.$eval('#daily-day',e=>e.value),end);assert.equal(await page.$eval('#view-day-expenses',e=>e.hidden),false);
  await choose(page,'daily-day',day);assert.equal(await text(page,'filtered-count'),day==='01'?'2 expenses':'1 expense');assert.equal(await page.$eval('#daily-day',e=>e.value),day);
  await page.click('#view-day-expenses');assert.equal(await page.evaluate(()=>document.activeElement.id),'spending-list-title');
  await page.click('#clear-filter');assert.equal(await text(page,'filtered-count'),'3 expenses');assert.equal(await page.$eval('#daily-day',e=>e.value),'');assert.match(await text(page,'daily-month'),/All categories/);
  await choose(page,'daily-day',day);await page.click('#spending-prev');assert.equal(await page.$eval('#daily-day',e=>e.value),'');assert.equal(await page.$eval('#category-filter-status',e=>e.hidden),true);await page.click('#spending-next');
 });
 await check('New income and cash movements use the selected month, while explicit and edited dates are preserved',async()=>{
  await fill(page,'month-picker','2024-02');await page.click('#add-income-top');const expected='2024-02-'+String(Math.min(Number(day),29)).padStart(2,'0');assert.equal(await page.$eval('#income-date',e=>e.value),expected);assert.match(await text(page,'income-date-context'),/February 2024/);
  await fill(page,'income-source','Historic pay');await fill(page,'income-amount','50');await page.click('#save-income');assert.equal((await stored(page)).incomes[0].date,expected);assert.equal(await text(page,'income-total'),'Rs. 50');
  await page.click('#income-list .expense-name');await fill(page,'income-date','2024-02-01');assert.match(await text(page,'income-date-context'),/February 2024/);await page.click('#save-income');await page.click('#income-list .expense-name');assert.equal(await page.$eval('#income-date',e=>e.value),'2024-02-01');await page.click('#close-income');
  await page.$eval('.cash-section',e=>e.open=true);await page.click('#add-movement');assert.equal(await page.$eval('#income-date',e=>e.value),expected);await fill(page,'income-source','Refund');await fill(page,'income-amount','5');await page.click('#save-income');assert.equal(await text(page,'movement-count'),'1 record');
  await page.click('#movement-list .expense-name');assert.equal(await page.$eval('#income-dialog',e=>e.open),true);await page.click('#close-income');
  await fill(page,'month-picker',date.slice(0,7));await cash(page,'income','Salary','100');assert.equal(await page.$eval('#income-overview',e=>e.dataset.hasIncome),'true');
 });
 await check('Category creation is explicit, cancel is non-destructive, and subscription labels fit narrow phones',async()=>{
  await page.click('#nav-settings');const before=await stored(page),original=await page.$eval('#settings-category',e=>e.value);
  await page.click('#new-category');assert.equal(await page.$eval('#settings-category',e=>e.value),'');assert.equal(await page.$eval('#save-category',e=>e.getAttribute('aria-label')),'Create category');assert.equal(await page.$eval('#subcategory-editor',e=>e.hidden),true);await fill(page,'category-name','Discard me');await page.click('#cancel-new-category');assert.deepEqual(await stored(page),before);assert.equal(await page.$eval('#settings-category',e=>e.value),original);
  await page.click('#new-category');await fill(page,'category-name','Travel & family expenses');await page.click('#save-category');const id=(await stored(page)).categories.at(-1).id;
  await page.click('#new-subcategory');assert.equal(await page.$eval('#save-subcategory',e=>e.getAttribute('aria-label')),'Create subcategory');await fill(page,'subcategory-name','Discard this too');await page.click('#cancel-new-subcategory');assert.deepEqual((await stored(page)).categories.at(-1).subcategories,['Other']);
  await page.click('#new-subcategory');await fill(page,'subcategory-name','UX TEST monthly pass');await page.click('#subcategory-subscription');await page.click('#save-subcategory');
  await page.click('#nav-track');await fill(page,'amount','100');await continueEntry(page);await page.click(`[data-category="${id}"]`);await page.click('[data-subcategory="UX TEST monthly pass"]');
  for(const width of [320,390]){await page.setViewport({width,height:844});const badge=await page.$eval('[data-subcategory="UX TEST monthly pass"] small',e=>{const r=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return {height:r.height,inside:r.left>=b.left&&r.right<=b.right,whiteSpace:getComputedStyle(e).whiteSpace,overflow:document.documentElement.scrollWidth>innerWidth};});assert.equal(badge.whiteSpace,'nowrap');assert.ok(badge.height<20&&badge.inside);assert.equal(badge.overflow,false);}
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.screenshot({path:'/tmp/finflow-phone-subscription-1.1.png'});
 });
 await check('Oversized amounts explain the supported limit without saving or destroying the draft',async()=>{
  await page.click('#edit-amount');await fill(page,'amount','1234567890');assert.match(await text(page,'form-feedback'),/999,999,999\.99/);assert.equal(await page.$eval('#continue-amount',e=>e.disabled),true);
  await fill(page,'amount','10');const before=await stored(page);await page.$eval('#amount',e=>{const data=new DataTransfer();data.setData('text','123456789012345');e.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});assert.match(await text(page,'form-feedback'),/999,999,999\.99/);assert.equal(await page.$eval('#amount',e=>e.value),'10');assert.deepEqual(await stored(page),before);
  await fill(page,'amount','999999999.99');assert.equal(await page.$eval('#continue-amount',e=>e.disabled),false);
 });
 await check('Review layouts and interactive controls remain usable at phone, tablet and desktop widths',async()=>{
  for(const width of [320,390,768,1440]){await page.setViewport({width,height:900});await page.click('#nav-spending');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const controls=await page.$$eval('#spending-list [data-expense],#daily-day-control',es=>es.map(e=>e.getBoundingClientRect().height));assert.ok(controls.every(h=>h>=44));}
  await page.setViewport({width:390,height:844});await page.click('#nav-spending');await page.screenshot({path:'/tmp/finflow-phone-spending-1.1.png',fullPage:true});await page.setViewport({width:1440,height:1000});await page.click('#nav-spending');await page.screenshot({path:'/tmp/finflow-desktop-spending-1.1.png',fullPage:true});
 });
 assert.deepEqual(errors,[]);await context.close();
 const edge=await fresh(browser),p=edge.page;
 await p.evaluateOnNewDocument(()=>{
  const OriginalDate=Date;
  window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:['2026-10-31T12:00:00+05:30']));}static now(){return new OriginalDate('2026-10-31T12:00:00+05:30').getTime();}};
 });
 await p.reload();await p.click('#nav-spending');
 await check('Selected-month entry clamps the 31st to leap February, non-leap February, and a thirty-day month',async()=>{
  for(const [month,expected] of [['2024-02','2024-02-29'],['2025-02','2025-02-28'],['2026-09','2026-09-30'],['2026-10','2026-10-31']]){
   await fill(p,'month-picker',month);await p.click('#add-income-top');assert.equal(await p.$eval('#income-date',e=>e.value),expected);await p.click('#income-repeat');assert.equal(await p.$eval('#income-date',e=>e.value),expected);await p.click('#close-income');
   await p.$eval('.cash-section',e=>e.open=true);await p.click('#add-movement');assert.equal(await p.$eval('#income-date',e=>e.value),expected);await p.click('#close-income');
  }
  assert.equal(await stored(p),null);
 });
 await check('Saving income into another month clears a stale selected day, including a day absent from the new month',async()=>{
  await choose(p,'daily-day','31');await p.click('#add-income-top');await fill(p,'income-source','Prior February');await fill(p,'income-amount','1');await fill(p,'income-date','2024-02-29');await p.click('#save-income');
  assert.equal(await p.$eval('#month-picker',e=>e.value),'2024-02');assert.equal(await p.$eval('#daily-day',e=>e.value),'');assert.equal(await p.$eval('#category-filter-status',e=>e.hidden),true);assert.equal(await text(p,'income-total'),'Rs. 1');assert.ok(!(await text(p,'daily-selection')).includes('NaN'));
 });
 assert.deepEqual(edge.errors,[]);await edge.context.close();console.log('All UX audit regression checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
