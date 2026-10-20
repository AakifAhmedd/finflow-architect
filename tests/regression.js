const {acceptConfirmation,launch,fresh,stored,fill,add,text,check,today,assert,fs,ROOT,KEY,LEGACY}=require('./helpers');
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
   assert.equal(await page.$$eval('[data-category]',e=>e.length),6);
   assert.equal(await stored(page),null);assert.equal(await text(page,'track-total'),'0');
   assert.match(await text(page,'recent-list'),/first expense/i);
  });
  await check('Zero, malformed amounts, and missing category cannot save',async()=>{
   assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);
   await page.click('[data-category="food"]');await page.click('[data-subcategory="Other"]');
   for(const value of ['0','-10','1.234','1e4','abc','9999999999','1,23','1,,000','1,000.000']) {
    await fill(page,'amount',value);await page.click('#save-expense');assert.equal(await stored(page),null);
   }
   await page.click('#categories-back');await fill(page,'amount','20');await page.$eval('#expense-form',e=>e.requestSubmit());assert.match(await text(page,'form-feedback'),/Choose a main category/);
  });
  await check('Desktop keyboard entry supports decimal amounts, backspace, and two-digit cents without a keypad',async()=>{
   await fill(page,'amount','');
   assert.equal(await page.$eval('.keypad',e=>e.hidden),true);
   await page.focus('#amount');await page.keyboard.type('1250.50');await page.keyboard.press('Backspace');await page.keyboard.type('0');
   assert.equal(await page.$eval('#amount',e=>e.value),'1,250.50');
   await page.click('[data-category="sports"]');await page.click('[data-subcategory="Sports Gear"]');await page.click('#save-expense');
   const data=await stored(page);assert.equal(data.expenses.length,1);assert.equal(data.expenses[0].cents,125050);assert.equal(data.expenses[0].subCategory,'Sports Gear');
   assert.equal(await text(page,'track-total'),'1,250.50');
   assert.equal(await page.$eval('#amount',e=>e.value),'');
   await page.click('#save-expense');assert.equal((await stored(page)).expenses.length,1);
  });
  await check('Notes and dates are optional, local dates default correctly',async()=>{
   assert.equal((await stored(page)).expenses[0].date,today());
   await add(page,'200','transport',{subCategory:'Fuel',note:'Fuel stop'});
   const e=(await stored(page)).expenses[1];assert.equal(e.note,'Fuel stop');assert.equal(e.subCategory,'Fuel');
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
   await page.click('#nav-track');
   await page.click('#recent-list [data-expense]');await page.click('#delete-expense');await acceptConfirmation(page);
   assert.equal((await stored(page)).expenses.length,3);await page.click('#undo');
   assert.equal((await stored(page)).expenses.length,4);assert.equal(await text(page,'track-total'),'1,450.80');
  });
  await check('Persisted expense notes remain inert text across cards, dialog, and reload',async()=>{
   const payload='<img src=x onerror="window.__xss=1">';await add(page,'500','personal',{subCategory:'Pets',note:payload});
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
   await add(page,'77','personal');assert.equal((await stored(page)).expenses.length,6);
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
  const grouping=await fresh(browser,390,844),g=grouping.page;
  await check('Live grouping preserves keypad decimals and deletes a digit rather than a separator',async()=>{
   for(const key of ['1','0','0','0'])await g.click(`[data-key="${key}"]`);
   assert.equal(await g.$eval('#amount',e=>e.value),'1,000');await g.click('[data-key="backspace"]');assert.equal(await g.$eval('#amount',e=>e.value),'100');
   await fill(g,'amount','');for(const key of ['1','2','3','4','5','.','5','0'])await g.click(`[data-key="${key}"]`);
   assert.equal(await g.$eval('#amount',e=>e.value),'12,345.50');await g.click('[data-key="backspace"]');assert.equal(await g.$eval('#amount',e=>e.value),'12,345.5');
   await g.click('[data-key="0"]');assert.equal(await g.$eval('#amount',e=>e.value),'12,345.50');
  });
  await check('Keyboard edits retain the logical caret and support selection and deletion across commas',async()=>{
   await fill(g,'amount','');await g.focus('#amount');await g.keyboard.type('1234567.00');assert.equal(await g.$eval('#amount',e=>e.value),'1,234,567.00');
   await fill(g,'amount','1234');await g.$eval('#amount',e=>e.setSelectionRange(2,2));await g.keyboard.type('0');assert.equal(await g.$eval('#amount',e=>e.value),'10,234');assert.equal(await g.$eval('#amount',e=>e.selectionStart),2);
   await fill(g,'amount','1234');await g.$eval('#amount',e=>e.setSelectionRange(2,2));await g.keyboard.press('Backspace');assert.equal(await g.$eval('#amount',e=>e.value),'234');
   await fill(g,'amount','1234');await g.$eval('#amount',e=>e.setSelectionRange(1,1));await g.keyboard.press('Delete');assert.equal(await g.$eval('#amount',e=>e.value),'134');
   await fill(g,'amount','12345.50');await g.$eval('#amount',e=>e.setSelectionRange(0,6));await g.keyboard.type('99');assert.equal(await g.$eval('#amount',e=>e.value),'99.50');assert.equal(await g.$eval('#amount',e=>e.selectionStart),2);
  });
  await check('Malformed pasted grouping is rejected and grouped amounts save exact cents, reopen, and support the existing maximum',async()=>{
   await fill(g,'amount','1234');const accepted=await g.$eval('#amount',e=>{const data=new DataTransfer();data.setData('text/plain','1,23');return e.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
   assert.equal(accepted,false);assert.equal(await g.$eval('#amount',e=>e.value),'1,234');assert.match(await text(g,'form-feedback'),/correctly grouped/);
   await fill(g,'amount','12,345.50');await g.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await g.evaluate(()=>document.activeElement.blur());await g.screenshot({path:'/tmp/finflow-phone-grouped-amount.png'});
   await g.click('#continue-amount');assert.equal(await stored(g),null);assert.equal(await g.$eval('#amount',e=>e.value),'12,345.50');
   await g.click('[data-category="food"]');await g.click('[data-subcategory="Other"]');await g.click('#save-expense');assert.equal((await stored(g)).expenses[0].cents,1234550);
   await g.click('#nav-spending');await g.click('#spending-list [data-expense]');await g.click('#edit-expense');assert.equal(await g.$eval('#amount',e=>e.value),'12,345.5');
   await fill(g,'amount','1234567.00');await g.click('#continue-amount');await g.click('#save-expense');assert.equal((await stored(g)).expenses.length,1);assert.equal((await stored(g)).expenses[0].cents,123456700);
   await g.click('#nav-track');await fill(g,'amount','999999999.99');assert.equal(await g.$eval('#amount',e=>e.value),'999,999,999.99');await g.click('[data-key="1"]');assert.equal(await g.$eval('#amount',e=>e.value),'999,999,999.99');
   await g.click('#continue-amount');await g.click('[data-category="food"]');await g.click('[data-subcategory="Other"]');await g.click('#save-expense');assert.equal((await stored(g)).expenses.at(-1).cents,99999999999);
   await g.reload({waitUntil:'load'});assert.equal((await stored(g)).expenses.at(-1).cents,99999999999);
  });
  assert.deepEqual(grouping.errors,[]);await grouping.context.close();
  const migration=await fresh(browser),p=migration.page;
  const legacy={transactions:[{id:'one',type:'expense',node:'RayZR Fuel',amount:1200.5,date:today(),note:'Old expense'},{id:'two',type:'income',node:'Income',amount:50000,date:today()},{id:'deleted',type:'expense',node:'Meals',amount:150,date:today()},{id:'custom',type:'expense',node:'<img src=x onerror="window.__xss=1">',amount:400,date:today(),note:'Custom category'}],deletedTransactions:{deleted:1},currentFlows:[{source:'Total Cash Flow',target:'Custom Group',value:0},{source:'Custom Group',target:'<img src=x onerror="window.__xss=1">',value:0}]};
  await check('Legacy migration preserves real expenses and custom categories, honors deletions, and leaves original data intact',async()=>{
   await p.evaluate((key,value)=>localStorage.setItem(key,value),LEGACY,JSON.stringify(legacy));await p.reload({waitUntil:'load'});
   const data=await stored(p);assert.equal(data.expenses.length,2);assert.equal(data.expenses[0].cents,120050);assert.equal(data.categories.length,6);assert.equal(data.previousCategories.length,7);
   assert.equal(data.expenses[0].mainCategory,'Transport');assert.equal(data.expenses[0].subCategory,'Fuel');
   assert.equal(data.expenses[1].mainCategory,'Personal');assert.equal(data.expenses[1].subCategory,'Other');assert.equal(data.expenses[1].previousClassification.subCategory,legacy.transactions[3].node);
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
