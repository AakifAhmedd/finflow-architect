const {launch,fresh,stored,fill,continueEntry,text,check,today,assert,KEY}=require('./helpers');
(async()=>{const browser=await launch();try{
 const {page,context,errors}=await fresh(browser,390,844);
 await check('Main Other is a direct highlighted choice that saves an optional note and resets without another selection step',async()=>{
  await fill(page,'amount','7000');await continueEntry(page);await page.click('[data-category="other"]');assert.equal(await page.$$eval('[data-subcategory]',es=>es.length),0);assert.equal(await page.$eval('[data-category="other"]',e=>e.getAttribute('aria-pressed')),'true');assert.equal(await page.$eval('#save-expense',e=>e.disabled),false);
  await page.click('#details-summary');await fill(page,'note','Flight ticket');await page.click('#save-expense');const e=(await stored(page)).expenses[0];assert.equal(e.mainCategory,'Other');assert.equal(e.subCategory,'Other');assert.equal(e.note,'Flight ticket');assert.equal(await page.$$eval('#categories [aria-pressed="true"]',es=>es.length),0);assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);
  await page.click('#nav-spending');await page.click('#spending-list [data-expense]');await page.click('#edit-expense');assert.equal(await page.$eval('[data-category="other"]',e=>e.getAttribute('aria-pressed')),'true');await fill(page,'amount','7100');await continueEntry(page);await page.click('#save-expense');assert.equal((await stored(page)).expenses.length,1);assert.equal((await stored(page)).expenses[0].cents,710000);
 });
 await check('Direct Other can be replaced by a normal category and category memory does not preselect another Other purchase',async()=>{
  await page.click('#nav-track');
  await fill(page,'amount','12');await continueEntry(page);await page.click('[data-category="other"]');await page.click('[data-category="transport"]');assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);await page.click('[data-subcategory="Parking"]');await page.click('#categories-back');
  await page.click('#nav-settings');await page.$eval('#remember-category',e=>e.checked=true);await page.click('#behavior-form button[type="submit"]');await page.click('#nav-track');await fill(page,'amount','12');await continueEntry(page);await page.click('[data-category="other"]');await page.click('#save-expense');assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);assert.equal(await page.$$eval('[data-category]',es=>es.length),6);
 });
 await check('Customizing Other with multiple subcategories restores explicit two-step selection and supports recurring defaults',async()=>{
  await page.click('#nav-settings');await fill(page,'settings-category','other');await page.click('#new-subcategory');await fill(page,'subcategory-name','Travel Fees');await page.$eval('#subcategory-subscription',e=>e.checked=true);await page.click('#subcategory-settings-form button[type="submit"]');await page.click('#nav-track');await fill(page,'amount','22');await continueEntry(page);await page.click('[data-category="other"]');assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);assert.equal(await page.$$eval('[data-subcategory]',es=>es.length),2);await page.click('[data-subcategory="Travel Fees"]');assert.equal(await page.$eval('#repeat-monthly',e=>e.checked),true);await page.click('#repeat-monthly');await page.click('#save-expense');assert.equal((await stored(page)).expenses.at(-1).subCategory,'Travel Fees');
 });
 await context.close();assert.deepEqual(errors,[]);
 const old=await fresh(browser),p=old.page;
 const fixture=await p.evaluate(()=>{
  const categories=structuredClone(EIGHT_CATEGORIES);let i=0;
  const expenses=categories.flatMap(c=>c.subcategories.map(sub=>({id:'old-'+i,date:localDate(),cents:++i*101,category:c.id,item:sub,mainCategory:c.name,subCategory:sub,note:'Keep '+i})));
  expenses[0].previousClassification={categoryId:'legacy',mainCategory:'Primary Transport',subCategory:'RayZR Fuel'};
  categories.find(c=>c.id==='food').removedSubs=['Food Delivery'];
  categories.find(c=>c.id==='tech').subscriptions=['Cloud Storage & Software'];
  categories.find(c=>c.id==='community').subscriptions=['Work-Related'];
  categories.find(c=>c.id==='transport').subIcons['Ride-Sharing']='car';
  const recurringRules=[['tech','Cloud Storage & Software'],['pet','Cat Food & Litter'],['transport','Fuel & Scooter Maintenance']].map(([id,sub],i)=>({id:'rule-'+i,name:'Plan '+i,cents:500+i,category:id,mainCategory:categories.find(c=>c.id===id).name,subCategory:sub,note:'Keep schedule',day:31,startDate:localDate(),nextMonth:shiftMonth(localDate().slice(0,7),1),active:true}));
  recurringRules.push({...recurringRules[0],id:'stopped',category:'food',mainCategory:'Food & Dining',subCategory:'Food Delivery',active:false});
  return {schema:1,categorizationVersion:1,categorySettingsVersion:1,categories,expenses,recurringRules,settings:{...DEFAULT_SETTINGS,reducedMotion:true},previousCategories:[{label:'Retained earlier metadata'}]};
 });
 await check('All old default labels migrate without guessed splits, lost values, rewritten notes, or changed monthly cursors',async()=>{
  await p.evaluate((key,data)=>localStorage.setItem(key,JSON.stringify(data)),KEY,fixture);await p.reload();const next=await stored(p);assert.equal(next.taxonomyVersion,1);assert.equal(next.categories.length,6);assert.deepEqual(next.previousCategoryRegistry,fixture.categories);assert.deepEqual(next.previousCategories,fixture.previousCategories);
  next.expenses.forEach((e,i)=>{for(const field of ['id','date','cents','item','note'])assert.equal(e[field],fixture.expenses[i][field]);});
  assert.equal(next.expenses[0].subCategory,'Fuel');assert.equal(next.expenses[2].subCategory,'Other');assert.equal(next.expenses[5].subCategory,'Other');assert.equal(next.expenses[12].mainCategory,'Personal');assert.equal(next.expenses[12].subCategory,'Pets');assert.equal(next.expenses[16].mainCategory,'Other');assert.equal(next.expenses[20].subCategory,'Software & Cloud Services');assert.equal(next.expenses[25].subCategory,'Other');
  next.recurringRules.forEach((r,i)=>{for(const field of ['id','name','cents','note','day','startDate','nextMonth','active'])assert.equal(r[field],fixture.recurringRules[i][field]);});assert.equal(next.recurringRules[0].mainCategory,'Personal');assert.equal(next.recurringRules[1].subCategory,'Pets');assert.equal(next.recurringRules[2].subCategory,'Other');assert.equal(next.recurringRules[3].active,false);assert.equal(await text(p,'track-total'),'533.28');
  assert.equal(next.categories.find(c=>c.id==='food').removedSubs.includes('Food Delivery'),true);assert.equal(next.categories.find(c=>c.id==='community').subscriptions.includes('Work Expenses'),true);assert.equal(next.categories.find(c=>c.id==='personal').subscriptions.includes('Software & Cloud Services'),false);assert.equal(next.categories.find(c=>c.id==='transport').subIcons['Ride Sharing'],'car');
 });
 await check('Migrated metadata is idempotent across reloads and retained in validated Gist snapshots and older backup imports',async()=>{
  const raw=await p.evaluate(key=>localStorage.getItem(key),KEY);await p.reload();assert.equal(await p.evaluate(key=>localStorage.getItem(key),KEY),raw);
  const roundtrip=await p.evaluate(old=>{const current=financialSnapshot(state),parsed=parseRemote(JSON.stringify({format:'finflow-backup',version:APP_VERSION,data:current}));return {current,parsed,older:normalizeState(structuredClone(old))};},fixture);
  assert.deepEqual(roundtrip.parsed,roundtrip.current);assert.equal(roundtrip.older.taxonomyVersion,1);assert.equal(roundtrip.parsed.taxonomyVersion,1);assert.deepEqual(roundtrip.parsed.previousCategoryRegistry,fixture.categories);assert.equal(roundtrip.parsed.expenses[0].classificationHistory[0].subCategory,'Fuel & Scooter Maintenance');
 });
 await check('Renamed/custom registries survive migration and default IDs/names cannot collide with them',async()=>{
  const custom=structuredClone(fixture);custom.categories[0].name='My scooter';custom.expenses.filter(e=>e.category==='transport').forEach(e=>e.mainCategory='My scooter');custom.recurringRules.filter(r=>r.category==='transport').forEach(r=>r.mainCategory='My scooter');
  custom.categories.find(c=>c.id==='tech').subcategories.push('My custom service');custom.categories.find(c=>c.id==='tech').items.push('My custom service');
  custom.categories.push({id:'personal',name:'Personal',short:'Personal',icon:'pet',color:'#788c7b',items:['Only mine'],subcategories:['Only mine'],removed:false,removedSubs:[],subscriptions:[],subIcons:{}});
  await p.evaluate((key,data)=>localStorage.setItem(key,JSON.stringify(data)),KEY,custom);await p.reload();const next=await stored(p);assert.deepEqual(next.categories.find(c=>c.id==='transport'),custom.categories[0]);assert.deepEqual(next.categories.find(c=>c.id==='tech'),custom.categories.find(c=>c.id==='tech'));assert.deepEqual(next.categories.find(c=>c.id==='personal'),custom.categories.at(-1));assert.equal(new Set(next.categories.map(c=>c.id)).size,next.categories.length);assert.equal(new Set(next.categories.map(c=>c.name)).size,next.categories.length);assert.equal(next.recurringRules[2].mainCategory,'My scooter');assert.equal(next.expenses.length,32);
 });
 await check('Invalid old classifications, unknown future taxonomies, and failed migration writes preserve original storage',async()=>{
  for(const data of [{...fixture,expenses:[{...fixture.expenses[0],subCategory:'Missing'}]},{...fixture,taxonomyVersion:99},{...fixture,expenses:[{...fixture.expenses[0],classificationHistory:'Malformed'}]}]){const raw=JSON.stringify(data);await p.evaluate((key,raw)=>localStorage.setItem(key,raw),KEY,raw);await p.reload();assert.equal(await p.$eval('#storage-warning',e=>e.hidden),false);assert.equal(await p.evaluate(key=>localStorage.getItem(key),KEY),raw);}
  await p.evaluate((key,data)=>localStorage.setItem(key,JSON.stringify(data)),KEY,fixture);await p.evaluateOnNewDocument(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});await p.reload();assert.equal(await p.$eval('#storage-warning',e=>e.hidden),false);assert.deepEqual(await stored(p),fixture);
 });
 assert.deepEqual(old.errors,[]);await old.context.close();console.log('All six-category migration and direct-entry checks passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
