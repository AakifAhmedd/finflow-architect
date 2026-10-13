const {acceptConfirmation,launch,fresh,stored,fill,continueEntry,add,text,check,today,assert,KEY}=require('./helpers');
async function settings(page,id='personal',sub){await page.click('#nav-settings');await fill(page,'settings-category',id);if(sub)await fill(page,'settings-subcategory',sub);}
async function saveSub(page,name,subscription=false,icon=''){await fill(page,'subcategory-name',name);await fill(page,'subcategory-icon',icon);await page.$eval('#subcategory-subscription',(e,v)=>e.checked=v,subscription);await page.click('#subcategory-settings-form button[type="submit"]');}
async function mockGist(page,data){await page.evaluate(data=>{window.gistMock={data,requests:[],fail:false,beforeRead:null};window.fetch=async(url,options)=>{const m=window.gistMock;m.requests.push({url,method:options.method,body:options.body});if(m.fail)throw Error('network');if(options.method==='PATCH')Object.assign(m.data.files,JSON.parse(options.body).files);return {ok:true,status:200,json:async()=>structuredClone(m.data)};};},data);}
(async()=>{
 const browser=await launch();try{
 const {page,context,errors}=await fresh(browser);
 await check('Both category steps and all default entry controls fit common large phones without scrolling',async()=>{
  for(const [width,height] of [[390,740],[390,844],[393,852],[412,823],[414,896],[430,932],[360,800]]){
   await page.setViewport({width,height});await page.click('#nav-track');await page.evaluate(()=>window.scrollTo(0,0));
   if(await page.$eval('#edit-amount',e=>!e.hidden))await page.click('#edit-amount');
   const fit=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect();return {save:rect('save-expense').bottom,nav:document.querySelector('.nav').getBoundingClientRect().top,top:rect('amount').top,keys:[...document.querySelectorAll('[data-key]')].map(e=>e.getBoundingClientRect().height),overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.ok(fit.save<=fit.nav,`Main step clipped at ${width}x${height}: ${JSON.stringify(fit)}`);assert.ok(fit.top>=0);assert.ok(fit.keys.every(h=>h>=44));assert.equal(fit.overflow,false);
   await fill(page,'amount','10');await continueEntry(page);
   for(const id of ['transport','food','sports','personal','community']){await page.click(`[data-category="${id}"]`);await page.click('[data-subcategory="Other"]');const subfit=await page.evaluate(()=>({save:document.getElementById('save-expense').getBoundingClientRect().bottom,nav:document.querySelector('.nav').getBoundingClientRect().top,scroll:scrollY}));assert.ok(subfit.save<=subfit.nav);assert.equal(subfit.scroll,0);await page.click('#categories-back');}
  }
  await page.setViewport({width:390,height:740});await page.click('#nav-track');await page.evaluate(()=>{document.querySelector('.nav').style.paddingBottom='43px';window.scrollTo(0,0);});
  await page.waitForFunction(()=>Math.abs(document.querySelector('.entry-actions').getBoundingClientRect().bottom-document.querySelector('.nav').getBoundingClientRect().top)<1);
  const safe=await page.evaluate(()=>({save:document.getElementById('save-expense').getBoundingClientRect().bottom,nav:document.querySelector('.nav').getBoundingClientRect().top}));assert.ok(safe.save<=safe.nav,`Simulated safe area covers entry: ${JSON.stringify(safe)}`);await page.evaluate(()=>document.querySelector('.nav').style.paddingBottom='');
  await page.setViewport({width:390,height:844});await page.screenshot({path:'/tmp/finflow-phone-entry-0.3.png'});await page.setViewport({width:1440,height:1000});
 });
 await add(page,'25','personal',{subCategory:'Software & Cloud Services'});await add(page,'15','food',{subCategory:'Cafes'});
 await check('Settings is a third labeled navigation destination and category rename updates stored and displayed classifications',async()=>{
  await settings(page);assert.equal(await page.$eval('#nav-settings',e=>e.getAttribute('aria-current')),'page');assert.equal(await page.$eval('#settings-view',e=>e.hidden),false);
  await fill(page,'category-name','Technology');await fill(page,'category-icon','other');await page.click('#category-settings-form button[type="submit"]');
  const data=await stored(page);assert.equal(data.categories.find(c=>c.id==='personal').icon,'other');assert.equal(data.expenses[0].mainCategory,'Technology');assert.equal(data.expenses[0].cents,2500);await page.click('#nav-spending');assert.match(await text(page,'breakdown-list'),/Technology/);
 });
 await check('Subcategory rename, icon, and subscription default persist and set up one named monthly rule only after saving',async()=>{
  await settings(page,'personal','Software & Cloud Services');await saveSub(page,'Software subscriptions',true,'tech');
  let data=await stored(page);assert.equal(data.expenses[0].subCategory,'Software subscriptions');assert.equal(data.recurringRules.length,0);
  await page.click('#nav-track');await fill(page,'amount','99');await page.click('[data-category="personal"]');await page.click('[data-subcategory="Software subscriptions"]');
  assert.equal(await page.$eval('#repeat-monthly',e=>e.checked),true);assert.equal(await page.$eval('#recurring-name',e=>e.value),'Software subscriptions');await page.click('#save-expense');
  data=await stored(page);assert.equal(data.recurringRules.length,1);assert.equal(data.recurringRules[0].cents,9900);assert.equal(data.expenses.length,3);await page.reload();
  assert.equal((await stored(page)).categories.find(c=>c.id==='personal').subscriptions[0],'Software subscriptions');
 });
 await check('Removing a subcategory retains history and totals, pauses its schedule, and Undo restores it',async()=>{
  await settings(page,'personal','Software subscriptions');await page.click('#remove-subcategory');await acceptConfirmation(page);let data=await stored(page);
  assert.equal(data.expenses.length,3);assert.equal(data.recurringRules[0].active,false);await page.click('#nav-track');await page.click('[data-category="personal"]');assert.equal(await page.$$eval('[data-subcategory="Software subscriptions"]',es=>es.length),0);await page.click('#categories-back');
  await page.click('#undo');data=await stored(page);assert.equal(data.recurringRules[0].active,true);await page.click('[data-category="personal"]');assert.equal(await page.$$eval('[data-subcategory="Software subscriptions"]',es=>es.length),1);await page.click('#categories-back');
  await settings(page,'personal','Software subscriptions');await page.click('#remove-subcategory');await acceptConfirmation(page);await page.click('#restore-subcategory');assert.equal((await stored(page)).recurringRules[0].active,false);
 });
 await check('Removing and restoring a main category keeps spending accessible and monthly charges stopped',async()=>{
  await page.click('#remove-category');await acceptConfirmation(page);let data=await stored(page);assert.equal(data.expenses.length,3);await page.click('#nav-track');assert.equal(await page.$$eval('[data-category="personal"]',es=>es.length),0);
  await page.click('#nav-spending');assert.equal(await text(page,'spending-total'),'Rs. 139');await page.click('[data-filter="personal"]');assert.equal(await text(page,'filtered-count'),'2 expenses');await page.click('#clear-filter');
  await settings(page);await page.click('#restore-category');data=await stored(page);assert.equal(data.categories.find(c=>c.id==='personal').removed,false);assert.equal(data.recurringRules[0].active,false);
 });
 await check('Custom categories and subcategories support inert names, icons, reload, and exact analytics',async()=>{
  await settings(page);await page.click('#new-category');await fill(page,'category-name','Personal projects');await fill(page,'category-icon','work');await page.click('#category-settings-form button[type="submit"]');
  const id=(await stored(page)).categories.at(-1).id;await page.click('#new-subcategory');const name='<img src=x onerror="window.__xss=1">';await saveSub(page,name,false,'home');
  await page.click('#nav-track');await add(page,'10',id,{subCategory:name});await page.reload();const e=(await stored(page)).expenses.at(-1);assert.equal(e.subCategory,name);assert.equal(e.cents,1000);assert.equal(await page.evaluate(()=>window.__xss),undefined);assert.equal(await page.$$eval('img',es=>es.length),0);
  await settings(page,id,'Other');await saveSub(page,'__proto__',false,'pet');assert.equal((await stored(page)).categories.at(-1).subIcons.__proto__,'pet');
  await page.click('#nav-track');await add(page,'1',id,{subCategory:'__proto__'});assert.equal((await stored(page)).expenses.at(-1).subCategory,'__proto__');
 });
 await check('Duplicate names and removing the final available choice are rejected without corrupting data',async()=>{
  const c=(await stored(page)).categories.at(-1);await settings(page,c.id,'__proto__');await fill(page,'category-name','Food & Dining');await page.click('#category-settings-form button[type="submit"]');assert.match(await text(page,'category-settings-feedback'),/unique/);assert.equal((await stored(page)).categories.at(-1).name,'Personal projects');
  await page.click('#remove-subcategory');await acceptConfirmation(page);await fill(page,'settings-subcategory',c.subcategories.at(-1));await page.click('#remove-subcategory');await acceptConfirmation(page);assert.match(await text(page,'category-settings-feedback'),/at least one/);
  await fill(page,'settings-category','food');await page.click('#new-subcategory');await saveSub(page,'constructor',false,'food');assert.ok((await stored(page)).categories.find(c=>c.id==='food').subcategories.includes('constructor'));
 });
 await check('Behavior preferences persist, control startup and reduced motion, and remember only the main category',async()=>{
  await fill(page,'start-view','spending');await page.$eval('#remember-category',e=>e.checked=true);await page.$eval('#reduce-motion',e=>e.checked=true);await page.$eval('#monthly-posting',e=>e.checked=false);await page.click('#behavior-form button[type="submit"]');await acceptConfirmation(page);await page.reload();
  assert.equal(await page.$eval('#spending-view',e=>e.hidden),false);assert.equal(await page.$eval('body',e=>e.classList.contains('reduce-motion')),true);
  await page.click('#nav-track');await add(page,'2','food');assert.equal(await text(page,'category-label'),'Food & Dining');assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);await page.click('#categories-back');
  await page.click('#nav-settings');await fill(page,'start-view','track');await page.click('#behavior-form button[type="submit"]');await acceptConfirmation(page);
 });
 await check('Settings remains usable and named on phone/desktop with keyboard navigation and no overflow',async()=>{
  for(const width of [320,390,768,1440]){await page.setViewport({width,height:844});await page.click('#nav-settings');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const bad=await page.evaluate(()=>[...document.querySelectorAll('#settings-view button,#settings-view input,#settings-view select')].filter(e=>e.getClientRects().length&&!((e.getAttribute('aria-label')||e.textContent||'').trim()||e.labels?.length)).map(e=>e.id));assert.deepEqual(bad,[]);}
  await page.setViewport({width:390,height:844});await page.click('#nav-settings');await page.screenshot({path:'/tmp/finflow-phone-settings.png',fullPage:true});await page.setViewport({width:1440,height:1100});await page.click('#nav-settings');await page.screenshot({path:'/tmp/finflow-desktop-settings.png',fullPage:true});
 });
 await check('Gist connection validates origin/ID, remembers its masked token, and keeps credentials outside financial data',async()=>{
  await fill(page,'gist-id','https://example.com/bad');await page.click('#gist-config-form button[type="submit"]');assert.match(await text(page,'gist-status'),/existing Gist/);
  await fill(page,'gist-id','https://gist.github.com/personal/abc123');await fill(page,'gist-token','fixture-token');await page.click('#gist-config-form button[type="submit"]');assert.equal((await stored(page)).settings.gistId,'abc123');assert.equal(await page.$eval('#gist-token',e=>e.value),'fixture-token');assert.ok(!JSON.stringify(await stored(page)).includes('fixture-token'));
  await page.reload();await page.click('#nav-settings');assert.equal(await page.$eval('#gist-token',e=>e.value),'fixture-token');assert.equal(await page.$eval('#gist-id',e=>e.value),'abc123');
  await fill(page,'gist-token','fixture-token');await page.click('#gist-config-form button[type="submit"]');
 });
 const data=await stored(page),remote={format:'finflow-backup',version:'0.3.0',data:structuredClone(data)};remote.data.expenses=remote.data.expenses.slice(0,1);remote.data.recurringRules=[];
 const raw=JSON.stringify(remote),gist={id:'abc123',public:false,files:{'finflow.json':{content:raw,truncated:false},'notes.txt':{content:'keep this'}},truncated:false};
 await mockGist(page,gist);
 await check('Gist preview is read-only, replacements require confirmation, and cancellation writes nothing',async()=>{
  const before=await stored(page);await page.click('#gist-preview-button');assert.match(await text(page,'gist-status'),/Gist: 1 expenses/);assert.deepEqual(await stored(page),before);
  await page.click('#gist-pull');assert.equal(await page.$eval('#confirm-dialog',e=>e.open),true);await page.keyboard.press('Escape');assert.deepEqual(await stored(page),before);
 });
 await check('Changed remote and local snapshots block replacement after preview',async()=>{
  await page.evaluate(()=>window.gistMock.data.files['finflow.json'].content+=' ');await page.click('#gist-pull');await page.click('#confirm-action');await page.waitForFunction(()=>document.getElementById('gist-status').textContent.includes('changed after preview'));assert.equal((await stored(page)).expenses.length,data.expenses.length);
  await page.click('#gist-preview-button');await page.waitForFunction(()=>!document.getElementById('gist-actions').hidden);await page.$eval('#remember-category',e=>e.checked=!e.checked);await page.click('#behavior-form button[type="submit"]');await acceptConfirmation(page);await page.click('#gist-pull');await page.click('#confirm-action');await page.waitForFunction(()=>document.getElementById('gist-status').textContent.includes('browser changed after preview'));
 });
 await check('Validated Gist restore is atomic, retains local connection, and supports Undo',async()=>{
  await page.click('#gist-preview-button');await page.waitForFunction(()=>!document.getElementById('gist-actions').hidden);await page.click('#gist-pull');await page.click('#confirm-action');await page.waitForFunction(()=>document.getElementById('gist-status').textContent.includes('Gist restored'));
  assert.equal((await stored(page)).expenses.length,1);assert.equal((await stored(page)).settings.gistId,'abc123');await page.click('#undo');assert.equal((await stored(page)).expenses.length,data.expenses.length);
 });
 await check('Upload uses only finflow.json, omits credentials/connection, preserves unrelated files, and detects malformed/public/truncated Gists',async()=>{
  await page.click('#gist-preview-button');await page.waitForFunction(()=>!document.getElementById('gist-actions').hidden);await page.click('#gist-push');await page.click('#confirm-action');await page.waitForFunction(()=>document.getElementById('gist-status').textContent.includes('uploaded'));
  const result=await page.evaluate(()=>window.gistMock);const uploaded=JSON.parse(result.data.files['finflow.json'].content);assert.equal(uploaded.data.settings.gistId,'');assert.equal(result.data.files['notes.txt'].content,'keep this');assert.ok(!JSON.stringify(result.requests).includes('fixture-token'));assert.ok(result.requests.every(r=>r.url==='https://api.github.com/gists/abc123'));
  for(const change of [{public:true},{public:false,files:{'finflow.json':{content:'bad'}}},{files:{'finflow.json':{content:raw,truncated:true}}}]){await page.evaluate(change=>Object.assign(window.gistMock.data,change),change);const before=await stored(page);await page.click('#gist-preview-button');await page.waitForFunction(()=>document.getElementById('gist-preview-button').disabled===false);assert.equal(await page.$eval('#gist-actions',e=>e.hidden),true);assert.deepEqual(await stored(page),before);}
 });
 await check('Gist network errors preserve local data and disconnect prevents further requests',async()=>{
  await page.evaluate(()=>window.gistMock.fail=true);const before=await stored(page);await page.click('#gist-preview-button');await page.waitForFunction(()=>document.getElementById('gist-status').textContent.includes('Could not reach'));assert.deepEqual(await stored(page),before);await page.click('#gist-disconnect');await acceptConfirmation(page);assert.equal((await stored(page)).settings.gistId,'');const requests=await page.evaluate(()=>window.gistMock.requests.length);await page.click('#gist-preview-button');assert.equal(await page.evaluate(()=>window.gistMock.requests.length),requests);
 });
 assert.deepEqual(errors,[]);await context.close();
 const old=await fresh(browser),p=old.page;
 await check('Previous branded hierarchy and monthly rules migrate generically without losing values or repeated writes',async()=>{
  const fixture=await p.evaluate(()=>({schema:1,categorizationVersion:1,categories:structuredClone(PRIOR_CATEGORIES),expenses:[{id:'old-cloud',date:localDate(),cents:12345,category:'tech',item:'Cloud Storage & Software (Google One)',mainCategory:'Tech & Subscriptions',subCategory:'Cloud Storage & Software (Google One)',note:'keep note'}],recurringRules:[{id:'old-monthly',name:'Google One',cents:12345,category:'tech',mainCategory:'Tech & Subscriptions',subCategory:'Cloud Storage & Software (Google One)',note:'keep rule',day:1,startDate:'2026-01-01',nextMonth:shiftMonth(localDate().slice(0,7),1),active:true}]}));
  await p.evaluate((key,data)=>localStorage.setItem(key,JSON.stringify(data)),KEY,fixture);await p.reload();const next=await stored(p);assert.equal(next.categorySettingsVersion,1);assert.equal(next.expenses[0].subCategory,'Software & Cloud Services');assert.equal(next.expenses[0].item,fixture.expenses[0].item);assert.equal(next.recurringRules[0].subCategory,'Software & Cloud Services');assert.equal(next.recurringRules[0].name,'Google One');assert.equal(next.expenses[0].cents,12345);const serialized=JSON.stringify(next);await p.reload();assert.equal(JSON.stringify(await stored(p)),serialized);
 });
 await check('Pausing monthly posting preserves due schedules and resuming catches up once',async()=>{
  const fixture=await stored(p);fixture.settings.monthlyPosting=false;fixture.recurringRules[0].nextMonth=today().slice(0,7);await p.evaluate((key,data)=>localStorage.setItem(key,JSON.stringify(data)),KEY,fixture);await p.reload();assert.equal((await stored(p)).expenses.length,1);await p.click('#nav-settings');await p.$eval('#monthly-posting',e=>e.checked=true);await p.click('#behavior-form button[type="submit"]');assert.equal((await stored(p)).expenses.length,2);await p.reload();assert.equal((await stored(p)).expenses.length,2);
 });
 await check('Settings storage failures keep the prior snapshot and do not falsely apply edits',async()=>{
  await settings(p);const before=await stored(p);await p.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('full');};});await fill(p,'category-name','Unsaved name');await p.click('#category-settings-form button[type="submit"]');assert.deepEqual(await stored(p),before);assert.equal(await p.$eval('#storage-warning',e=>e.hidden),false);await p.evaluate(()=>Storage.prototype.setItem=window.realSet);await p.reload();
 });
 await check('Invalid category settings never overwrite saved data',async()=>{
  const data=await stored(p);data.categories[0].removedSubs=['unknown'];const raw=JSON.stringify(data);await p.evaluate((key,raw)=>localStorage.setItem(key,raw),KEY,raw);await p.reload();assert.equal(await p.$eval('#storage-warning',e=>e.hidden),false);await p.click('#nav-settings');await p.click('#behavior-form button[type="submit"]');assert.equal(await p.evaluate(key=>localStorage.getItem(key),KEY),raw);
 });
 assert.deepEqual(old.errors,[]);await old.context.close();console.log('All Settings checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
