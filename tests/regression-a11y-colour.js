const {launch,fresh,stored,fill,continueEntry,add,text,check,today,assert,ROOT,fs}=require('./helpers');
(async()=>{
 const browser=await launch();
 try{
  const {page,context,errors}=await fresh(browser);
  const external=[];page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  await page.setOfflineMode(true);await page.reload({waitUntil:'load'});
  await check('The app works offline and requests no CDN scripts, images, fonts, or other external resources',async()=>{
   await add(page,'1800','food',{subCategory:'Cafes'});assert.equal((await stored(page)).expenses.length,1);assert.deepEqual(external,[]);
  });
  await add(page,'2500','transport',{subCategory:'Fuel'});await add(page,'1200','personal',{subCategory:'Pets'});await add(page,'10000','sports',{subCategory:'Gym'});
  await add(page,'2800','personal',{subCategory:'Software & Cloud Services'});await add(page,'650','food',{subCategory:'Other'});await add(page,'6500','other',{subCategory:'Other'});
  const seeded=await page.evaluate(()=>{
   const key='finflow_tracker_v1',data=JSON.parse(localStorage.getItem(key)),base=data.expenses[0].date.slice(0,7);
   // Exercise daily plots with multiple dates without shipping demonstration data.
   data.expenses.forEach((e,i)=>e.date=base+'-'+String(Math.max(1,Number(e.date.slice(8))-i)).padStart(2,'0'));
   localStorage.setItem(key,JSON.stringify(data));return data;
  });await page.reload({waitUntil:'load'});
  await check('Layouts have no horizontal overflow; the keypad is phone-only with touch-sized targets',async()=>{
   for(const width of [320,360,390,760,768,1024,1440]){
    await page.setViewport({width,height:900});await page.click('#nav-track');
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,keys:[...document.querySelectorAll('[data-key]')].filter(e=>e.getClientRects().length).map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))}));
    assert.equal(layout.overflow,false,`Tracker overflow at ${width}`);assert.ok(layout.keys.every(k=>k.width>=44&&k.height>=44));
    assert.equal(layout.keys.length,width<768?12:0,`Keypad visibility at ${width}`);
    if(width>=768){
     await page.focus('#amount');await page.keyboard.press('Tab');
     assert.ok(await page.evaluate(()=>document.activeElement.hasAttribute('data-category')),`Desktop tab order at ${width}`);
    }
    await page.click('#nav-spending');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Spending overflow at ${width}`);
   }
  });
  await check('Phone subcategory selection keeps Save visible and enables it only after selection',async()=>{
   await page.setViewport({width:390,height:844});await page.click('#nav-track');
   assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);
   await fill(page,'amount','100');await continueEntry(page);await page.click('[data-category="food"]');
   assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);
   await page.click('[data-subcategory="Other"]');
   assert.equal(await page.$eval('#save-expense',e=>e.disabled),false);
   const position=await page.evaluate(()=>({save:document.getElementById('save-expense').getBoundingClientRect().bottom,nav:document.querySelector('.nav').getBoundingClientRect().top}));
   assert.ok(position.save<=position.nav,`Save covered by navigation: ${JSON.stringify(position)}`);
   await page.click('#categories-back');
  });
  await check('Every visible control has an accessible name and all form fields have labels',async()=>{
   for(const view of ['track','spending']){
    await page.click('#nav-'+view);
    const unnamed=await page.evaluate(()=>[...document.querySelectorAll('button,input,select')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).filter(e=>!((e.getAttribute('aria-label')||e.textContent||'').trim()||(e.labels&&e.labels.length))).map(e=>e.id));
    assert.deepEqual(unnamed,[]);
   }
  });
  await check('Charts have meaningful month-specific text alternatives and exact category amounts',async()=>{
   assert.equal(await page.$eval('.donut',e=>e.getAttribute('role')),'img');assert.match(await page.$eval('.donut',e=>e.getAttribute('aria-label')),/Exact amounts/);
   assert.equal(await page.$eval('.daily-chart',e=>e.getAttribute('role')),'img');assert.match(await page.$eval('.daily-chart',e=>e.getAttribute('aria-label')),/Highest day/);
   assert.equal(await page.$$eval('[data-filter]',e=>e.length),5);assert.match(await text(page,'breakdown-list'),/Rs\. 10,000/);
  });
  await check('Navigation state, dialogs, focus return, and Escape support keyboard use',async()=>{
   assert.equal(await page.$eval('#nav-spending',e=>e.getAttribute('aria-current')),'page');
   await page.click('#spending-list [data-expense]');assert.equal(await page.$eval('#expense-dialog',e=>e.open),true);
   await page.keyboard.press('Escape');assert.equal(await page.$eval('#expense-dialog',e=>e.open),false);
   assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-expense')),true);
   await page.click('#nav-track');assert.equal(await page.evaluate(()=>document.activeElement.id),'categories-back');
  });
  await check('Reduced-motion mode removes entrance and button animations',async()=>{
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
   assert.equal(await page.$eval('#track-view',e=>getComputedStyle(e).animationName),'none');
   assert.equal(await page.$eval('#save-expense',e=>getComputedStyle(e).transitionDuration),'0s');
   await page.click('[data-category="food"]');assert.equal(await page.$eval('#categories',e=>getComputedStyle(e).animationName),'none');await page.click('#categories-back');
  });
  await check('Adding by keyboard and undoing outside inputs is supported',async()=>{
   await page.click('#edit-amount');await fill(page,'amount','');await page.focus('#amount');await page.keyboard.type('123.45');await page.keyboard.press('Enter');await page.click('[data-category="food"]');await page.click('[data-subcategory="Other"]');await page.click('#save-expense');
   assert.equal((await stored(page)).expenses.length,seeded.expenses.length+1);
   await page.focus('#nav-track');await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');
   assert.equal((await stored(page)).expenses.length,seeded.expenses.length);
  });
  await check('Zero and fractional values always use LKR and never display negative zero',async()=>{
   await page.click('#nav-spending');await page.click('#spending-prev');
   assert.equal(await text(page,'spending-total'),'Rs. 0');assert.equal(await text(page,'daily-average'),'Rs. 0');
   await page.click('#spending-next');
   assert.ok(!(await text(page,'spending-total')).includes('-0'));
  });
  // Review artifacts live outside the repository and do not change the app's stored defaults.
  await page.evaluate(()=>document.getElementById('toast').hidden=true);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.setViewport({width:1440,height:1050});await page.click('#nav-track');await page.screenshot({path:'/tmp/finflow-desktop-track.png',fullPage:true});
  await page.click('#nav-spending');await page.screenshot({path:'/tmp/finflow-desktop-spending.png',fullPage:true});
  await page.setViewport({width:390,height:844});await page.click('#nav-track');await page.screenshot({path:'/tmp/finflow-phone-track.png',fullPage:true});
  await page.click('#nav-spending');await page.screenshot({path:'/tmp/finflow-phone-spending.png',fullPage:true});
  assert.deepEqual(errors,[]);await context.close();
  console.log('All layout and accessibility checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
