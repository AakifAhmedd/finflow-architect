const {launch,fresh,stored,fill,add,text,check,today,assert,fs,ROOT,KEY,LEGACY}=require('./helpers');
(async()=>{
 const browser=await launch();
 try {
  const {page,context,errors}=await fresh(browser);
  await check('Current version is consistent across all release references',async()=>{
   const version=fs.readFileSync(ROOT+'/VERSION','utf8').trim(),html=fs.readFileSync(ROOT+'/index.html','utf8');
   assert.match(version,/^\d+\.\d+\.\d+$/);assert.ok(html.includes(`const APP_VERSION = '${version}'`));
   assert.equal(await text(page,'app-version'),version);
   assert.equal(await page.$eval('meta[name="application-version"]',e=>e.content),version);
   assert.equal(JSON.parse(fs.readFileSync(ROOT+'/package.json')).version,version);
  });
  await check('Tracker opens first with the full personal category set and no invented expenses',async()=>{
   assert.equal(await page.$eval('#track-view',e=>e.hidden),false);
   assert.equal(await page.$$eval('[data-category]',e=>e.length),8);
   assert.equal(await stored(page),null);assert.equal(await text(page,'track-total'),'0');
   assert.match(await text(page,'recent-list'),/first expense/i);
  });
  await check('Zero, malformed amounts, and missing category cannot save',async()=>{
   assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);
   await page.click('[data-category="food"]');await page.click('[data-subcategory="Other"]');
   for(const value of ['0','-10','1.234','1e4','abc','9999999999']) {
    await fill(page,'amount',value);await page.click('#save-expense');assert.equal(await stored(page),null);
   }
   await page.click('#categories-back');await fill(page,'amount','20');await page.$eval('#expense-form',e=>e.requestSubmit());assert.match(await text(page,'form-feedback'),/Choose a main category/);
  });
  await check('Keypad supports decimal entry, backspace, and two-digit cents',async()=>{
   await fill(page,'amount','');
   for(const key of ['1','2','5','0','.','5','0','7','backspace','0']) await page.click(`[data-key="${key}"]`);
   assert.equal(await page.$eval('#amount',e=>e.value),'1250.50');
   await page.click('[data-category="sports"]');await page.click('[data-subcategory="Sports & Gear (Badminton/Swimming)"]');await page.click('#save-expense');
   const data=await stored(page);assert.equal(data.expenses.length,1);assert.equal(data.expenses[0].cents,125050);assert.equal(data.expenses[0].subCategory,'Sports & Gear (Badminton/Swimming)');
   assert.equal(await text(page,'track-total'),'1,250.50');
   assert.equal(await page.$eval('#amount',e=>e.value),'');
   await page.click('#save-expense');assert.equal((await stored(page)).expenses.length,1);
  });
  await check('Notes and dates are optional, local dates default correctly',async()=>{
   assert.equal((await stored(page)).expenses[0].date,today());
   await add(page,'200','transport',{subCategory:'Fuel & Scooter Maintenance (RayZR)',note:'Fuel stop'});
   const e=(await stored(page)).expenses[1];assert.equal(e.note,'Fuel stop');assert.equal(e.subCategory,'Fuel & Scooter Maintenance (RayZR)');
  });
  await check('Integer cents keep totals exact and graphs agree with tracker',async()=>{
   await add(page,'0.10');await add(page,'0.20');await page.click('#nav-spending');
   assert.equal(await text(page,'spending-total'),'Rs. 1,450.80');assert.equal(await text(page,'spending-count'),'4');
   assert.equal(await page.$$eval('.donut circle',e=>e.length),3);assert.equal(await page.$$eval('.daily-chart rect',e=>e.length),new Date(Number(today().slice(0,4)),Number(today().slice(5,7)),0).getDate());
   assert.ok((await page.$eval('.daily-chart',e=>e.textContent)).includes('Rs. 1,450.80'));
   assert.equal(await text(page,'daily-average'),'Rs. '+(1450.80/Number(today().slice(8))).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}));
  });
  await check('Category selection filters the actual expense list and clears correctly',async()=>{
   await page.click('[data-filter="food"]');assert.equal(await text(page,'filtered-count'),'2 expenses');
   assert.equal(await page.$$eval('#spending-list .expense-row',e=>e.length),2);
   await page.click('#clear-filter');assert.equal(await page.$$eval('#spending-list .expense-row',e=>e.length),4);
  });
  await check('Edits update the same expense and undo restores its prior value',async()=>{
   await page.click('#spending-list [data-expense]');await page.click('#edit-expense');
   assert.equal(await text(page,'entry-title'),'Edit expense');
   await fill(page,'amount','10');await page.click('#save-expense');
   assert.equal((await stored(page)).expenses.length,4);assert.equal(await text(page,'track-total'),'1,460.60');
   await page.click('#undo');assert.equal(await text(page,'track-total'),'1,450.80');
  });
  await check('Delete and undo restore the expense and corresponding totals',async()=>{
   await page.click('#recent-list [data-expense]');await page.click('#delete-expense');
   assert.equal((await stored(page)).expenses.length,3);await page.click('#undo');
   assert.equal((await stored(page)).expenses.length,4);assert.equal(await text(page,'track-total'),'1,450.80');
  });
  await check('Persisted expense notes remain inert text across cards, dialog, and reload',async()=>{
   const payload='<img src=x onerror="window.__xss=1">';await add(page,'500','pet',{subCategory:'Cat Food & Litter',note:payload});
   await page.reload({waitUntil:'load'});assert.equal((await stored(page)).expenses.length,5);
   assert.equal(await page.evaluate(()=>window.__xss),undefined);assert.equal(await page.$$eval('img',e=>e.length),0);
   assert.ok((await text(page,'recent-list')).includes(payload));await page.click('#recent-list [data-expense]');
   assert.ok((await text(page,'dialog-note')).includes(payload));await page.click('#close-dialog');
  });
  await check('Previous months show actual empty totals and the current month stays bounded',async()=>{
   await page.click('#nav-spending');assert.equal(await page.$eval('#spending-next',e=>e.disabled),true);
   await page.click('#spending-prev');assert.equal(await text(page,'spending-total'),'Rs. 0');
   assert.match(await text(page,'daily-chart'),/No spending/);assert.match(await text(page,'category-chart'),/Add an expense/);
   await page.click('#spending-next');assert.equal(await text(page,'spending-total'),'Rs. 1,950.80');
  });
  await check('Historical entries move the summary to their month without changing the next default date',async()=>{
   await page.click('#nav-track');await add(page,'50','food',{date:'2024-02-29'});
   assert.equal(await text(page,'track-month'),'February 2024');assert.equal(await text(page,'track-total'),'50');
   assert.equal(await page.$eval('#date',e=>e.value),today());
   await add(page,'1','food',{date:'2024-02-30'});assert.equal((await stored(page)).expenses.length,6);
   await fill(page,'date','2099-01-01');await page.click('#save-expense');assert.equal((await stored(page)).expenses.length,6);
  });
  await check('Failed storage writes retain the form and never show a false save or mutate totals',async()=>{
   await page.reload({waitUntil:'load'});
   await page.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
   await add(page,'77','tech');assert.equal((await stored(page)).expenses.length,6);
   assert.equal(await page.$eval('#amount',e=>e.value),'77');assert.match(await text(page,'storage-warning'),/not saved/);
   await page.evaluate(()=>Storage.prototype.setItem=window.realSet);await page.click('#save-expense');
   assert.equal((await stored(page)).expenses.length,7);
  });
  await check('Another tab cannot silently overwrite newly saved expenses',async()=>{
   const other=await context.newPage();await other.bringToFront();await other.goto(page.url(),{waitUntil:'load'});
   await add(other,'25','transport');await page.bringToFront();await add(page,'10','food');
   assert.match(await text(page,'storage-warning'),/another tab/);assert.equal((await stored(page)).expenses.length,8);
   await page.click('#retry-storage');await page.click('#save-expense');assert.equal((await stored(page)).expenses.length,9);
   await other.close();
  });
  assert.deepEqual(errors,[]);await context.close();
  const migration=await fresh(browser),p=migration.page;
  const legacy={transactions:[{id:'one',type:'expense',node:'RayZR Fuel',amount:1200.5,date:today(),note:'Old expense'},{id:'two',type:'income',node:'Income',amount:50000,date:today()},{id:'deleted',type:'expense',node:'Meals',amount:150,date:today()},{id:'custom',type:'expense',node:'<img src=x onerror="window.__xss=1">',amount:400,date:today(),note:'Custom category'}],deletedTransactions:{deleted:1},currentFlows:[{source:'Total Cash Flow',target:'Custom Group',value:0},{source:'Custom Group',target:'<img src=x onerror="window.__xss=1">',value:0}]};
  await check('Legacy migration preserves real expenses and custom categories, honors deletions, and leaves original data intact',async()=>{
   await p.evaluate((key,value)=>localStorage.setItem(key,value),LEGACY,JSON.stringify(legacy));await p.reload({waitUntil:'load'});
   const data=await stored(p);assert.equal(data.expenses.length,2);assert.equal(data.expenses[0].cents,120050);assert.equal(data.categories.length,8);assert.equal(data.previousCategories.length,7);
   assert.equal(data.expenses[0].mainCategory,'Transport & Vehicles');assert.equal(data.expenses[0].subCategory,'Fuel & Scooter Maintenance (RayZR)');
   assert.equal(data.expenses[1].mainCategory,'Lifestyle & Social');assert.equal(data.expenses[1].subCategory,'Other');assert.equal(data.expenses[1].previousClassification.subCategory,legacy.transactions[3].node);
   assert.ok((await text(p,'recent-list')).includes(legacy.transactions[3].node));
   assert.equal(await p.evaluate(key=>localStorage.getItem(key),LEGACY),JSON.stringify(legacy));
   assert.equal(await p.$$eval('img',e=>e.length),0);assert.equal(await p.evaluate(()=>window.__xss),undefined);
   await p.reload({waitUntil:'load'});assert.equal((await stored(p)).expenses.length,2);
  });
  await check('Unreadable new data is preserved and prevents writes rather than reverting to legacy',async()=>{
   await p.evaluate(key=>localStorage.setItem(key,'{broken'),KEY);await p.reload({waitUntil:'load'});
   await add(p,'5');assert.equal(await p.evaluate(key=>localStorage.getItem(key),KEY),'{broken');
   assert.equal(await p.$eval('#storage-warning',e=>e.hidden),false);
  });
  await check('Invalid legacy expenses are never silently dropped during migration',async()=>{
   await p.evaluate((key,legacy)=>{localStorage.removeItem(key);localStorage.setItem(legacy,JSON.stringify({transactions:[{type:'expense',amount:5,node:'Meals',date:'bad-date'}]}));},KEY,LEGACY);
   await p.reload({waitUntil:'load'});assert.equal(await stored(p),null);assert.equal(await p.$eval('#storage-warning',e=>e.hidden),false);
  });
  assert.deepEqual(migration.errors,[]);await migration.context.close();
  console.log('All behavioral checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
