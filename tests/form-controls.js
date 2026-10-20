const {acceptConfirmation,launch,fresh,stored,fill,add,text,check,today,assert}=require('./helpers');
async function openChoice(page,id){await page.$eval('#'+id+'-control',e=>e.scrollIntoView({block:'center'}));await page.click('#'+id+'-control');assert.equal(await page.$eval('#form-picker',e=>e.open),true);}
async function chooseOption(page,id,value){await openChoice(page,id);const index=await page.$eval('#'+id,(e,v)=>[...e.options].findIndex(o=>o.value===v),value);assert.ok(index>=0);await page.click(`[data-picker-option="${index}"]`);assert.equal(await page.$eval('#'+id,e=>e.value),value);}
async function pickerFits(page){const r=await page.$eval('#form-picker',e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:e.scrollWidth>e.clientWidth};});assert.ok(r.left>=0&&r.right<=r.width&&r.top>=0&&r.bottom<=r.height,JSON.stringify(r));assert.equal(r.overflow,false);}
(async()=>{const browser=await launch();try{
 const {page,context,errors}=await fresh(browser);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await check('Every select and calendar is replaced by a labeled in-app control',async()=>{
  const controls=await page.evaluate(()=>[...document.querySelectorAll('select,input[type="date"],input[type="month"]')].map(e=>({id:e.id,hidden:e.hidden,button:!!document.getElementById(e.id+'-control')?.getAttribute('aria-labelledby')})));
  assert.equal(controls.length,12);assert.ok(controls.every(c=>c.hidden&&c.button));
  await page.click('#nav-settings');await chooseOption(page,'settings-category','food');assert.equal(await page.$eval('#category-name',e=>e.value),'Food & Dining');
  await chooseOption(page,'category-icon','work');await page.click('#category-settings-form button[type="submit"]');assert.equal((await stored(page)).categories.find(c=>c.id==='food').icon,'work');
  await chooseOption(page,'settings-subcategory','Cafes');assert.equal(await page.$eval('#subcategory-name',e=>e.value),'Cafes');
  await chooseOption(page,'subcategory-icon','food');await page.click('#subcategory-settings-form button[type="submit"]');assert.equal((await stored(page)).categories.find(c=>c.id==='food').subIcons.Cafes,'food');
  await chooseOption(page,'start-view','spending');await page.click('#behavior-form button[type="submit"]');assert.equal((await stored(page)).settings.startView,'spending');
 });
 await check('Select menus support keyboard search, cancellation, focus return and long inert labels',async()=>{
  await page.focus('#settings-category-control');await page.keyboard.press('ArrowDown');await page.keyboard.type('Trans');assert.match(await page.evaluate(()=>document.activeElement.textContent),/Transport/);await page.keyboard.press('Enter');assert.equal(await page.$eval('#settings-category',e=>e.value),'transport');
  await openChoice(page,'category-icon');await page.keyboard.press('End');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'category-icon-control');assert.equal(await page.$eval('#category-icon',e=>e.value),'bike');
  const name='<img src=x onerror="window.__pickerXss=1">';await page.click('#new-subcategory');await fill(page,'subcategory-name',name);await page.click('#subcategory-settings-form button[type="submit"]');
  await openChoice(page,'settings-subcategory');assert.ok((await text(page,'picker-options')).includes(name));assert.equal(await page.$$eval('#form-picker img',es=>es.length),0);assert.equal(await page.evaluate(()=>window.__pickerXss),undefined);await page.keyboard.press('Escape');
 });
 await check('The month picker changes actual spending, supports years, and prevents future months',async()=>{
  await page.click('#nav-spending');await openChoice(page,'month-picker');await pickerFits(page);
  await page.click('[data-picker-period]');await page.click('[data-picker-year="2024"]');await page.click('[data-picker-month="2024-02"]');assert.equal(await page.$eval('#month-picker',e=>e.value),'2024-02');assert.equal(await text(page,'spending-total'),'Rs. 0');assert.equal(await page.$eval('#month-picker-control',e=>e.getAttribute('aria-expanded')),'false');
  await openChoice(page,'month-picker');await page.click('[data-picker-today]');assert.equal(await page.$eval('#month-picker',e=>e.value),today().slice(0,7));
  await openChoice(page,'month-picker');const disabled=await page.$$eval('[data-picker-month]',es=>es.filter(e=>e.dataset.pickerMonth>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit'}).format(new Date())).every(e=>e.disabled));assert.ok(disabled);
  await page.screenshot({path:'/tmp/finflow-desktop-month-picker.png'});await page.keyboard.press('Escape');
 });
 await check('Income sources show suggestions, filter as typed, accept custom text and escape without closing income',async()=>{
  await page.click('#add-income-top');await page.click('#source-toggle');assert.equal(await page.$$eval('#income-source-options [role="option"]',es=>es.length),6);
  await page.focus('#income-source');await page.keyboard.press('ArrowUp');assert.equal(await page.$eval('#income-source-options [aria-selected="true"]',e=>e.textContent),'Other');await page.keyboard.press('Escape');
  await page.focus('#income-source');await page.keyboard.type('Sa');assert.equal(await page.$$eval('#income-source-options [role="option"]',es=>es.length),1);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.$eval('#income-source',e=>e.value),'Salary');assert.equal(await page.$eval('#income-source-options',e=>e.hidden),true);
  await page.focus('#income-source');await page.keyboard.press('End');await page.keyboard.type(' pilot');await page.keyboard.press('Escape');assert.equal(await page.$eval('#income-dialog',e=>e.open),true);assert.equal(await page.$eval('#income-source',e=>e.value),'Salary pilot');
  await page.click('#source-toggle');await page.screenshot({path:'/tmp/finflow-desktop-source-picker.png'});await page.keyboard.press('Escape');
 });
 await check('Nested calendars cancel independently, support leap dates and preserve unsaved income',async()=>{
  await fill(page,'income-amount','800.25');await openChoice(page,'income-date');assert.equal(await page.$eval('#form-picker [data-picker-next]',e=>e.disabled),true);
  await page.keyboard.press('ArrowLeft');await page.keyboard.press('Escape');assert.equal(await page.$eval('#income-dialog',e=>e.open),true);assert.equal(await page.$eval('#income-date',e=>e.value),today());assert.equal(await page.evaluate(()=>document.activeElement.id),'income-date-control');
  await openChoice(page,'income-date');await page.click('[data-picker-period]');await page.click('[data-picker-period]');await page.click('[data-picker-year="2024"]');await page.click('[data-picker-month="2024-02"]');await page.click('[data-picker-date="2024-02-29"]');
  assert.equal(await page.$eval('#income-date',e=>e.value),'2024-02-29');assert.equal((await stored(page)).incomes.length,0);await page.click('#save-income');assert.equal((await stored(page)).incomes[0].date,'2024-02-29');assert.equal((await stored(page)).incomes[0].cents,80025);
 });
 await check('Expense calendars respect one-off and recurring dates, and monthly selectors use app menus',async()=>{
  await page.click('#nav-track');await fill(page,'amount','120');await page.click('[data-category="food"]');await page.click('[data-subcategory="Other"]');await page.$eval('#entry-details',e=>e.open=true);
  await openChoice(page,'date');assert.equal(await page.$eval('[data-picker-next]',e=>e.disabled),true);await page.keyboard.press('Escape');
  await page.click('#repeat-monthly');await fill(page,'recurring-name','Calendar test');await openChoice(page,'date');assert.equal(await page.$eval('[data-picker-next]',e=>e.disabled),false);await page.screenshot({path:'/tmp/finflow-desktop-date-picker.png'});await page.click('[data-picker-today]');await page.click('#save-expense');
  await page.click('[data-monthly]');await chooseOption(page,'monthly-category','transport');await chooseOption(page,'monthly-subcategory','Parking');await page.click('#monthly-form button[type="submit"]');assert.equal((await stored(page)).recurringRules[0].subCategory,'Parking');
  await page.click('#nav-spending');await page.$eval('.cash-section',e=>e.open=true);await page.click('#add-movement');await chooseOption(page,'movement-type','loan_received');assert.equal(await page.$eval('#source-toggle',e=>e.hidden),true);await page.click('#close-income');
 });
 await check('Phone menus/calendars fit the viewport and category actions stay in one row',async()=>{
  for(const width of [320,360,390,430]){
   await page.setViewport({width,height:740});await page.click('#nav-settings');
   const rows=await page.$$eval('.category-actions',groups=>groups.map(group=>[...group.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {top:r.top,height:r.height,width:r.width};})));
   rows.forEach(row=>{assert.ok(row.every(r=>Math.abs(r.top-row[0].top)<1));assert.ok(row.every(r=>r.height>=44&&r.width>=44));});
   await openChoice(page,'settings-subcategory');await pickerFits(page);await page.screenshot({path:`/tmp/finflow-phone-options-${width}.png`});await page.keyboard.press('Escape');
   await page.click('#nav-spending');await page.click('#add-income-top');await openChoice(page,'income-date');await pickerFits(page);await page.screenshot({path:`/tmp/finflow-phone-calendar-${width}.png`});await page.keyboard.press('Escape');await page.click('#close-income');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.setViewport({width:390,height:844});await page.click('#nav-settings');await page.screenshot({path:'/tmp/finflow-phone-compact-actions.png',fullPage:true});
 });
 assert.deepEqual(errors,[]);await context.close();console.log('All in-app form control checks passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
