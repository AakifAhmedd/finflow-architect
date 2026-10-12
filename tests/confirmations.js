const {launch,fresh,stored,fill,add,text,check,today,assert,acceptConfirmation,KEY,URL}=require('./helpers');
async function openSettings(page,id='personal',sub='Software & Cloud Services'){await page.click('#nav-settings');await fill(page,'settings-category',id);await fill(page,'settings-subcategory',sub);}
async function warning(page,label){assert.equal(await page.$eval('#confirm-dialog',e=>e.open),true);assert.equal(await page.$eval('#confirm-dialog',e=>e.getAttribute('role')),'alertdialog');assert.equal(await page.evaluate(()=>document.activeElement.id),'confirm-cancel');assert.equal(await text(page,'confirm-action'),label);assert.equal(await page.$eval('#confirm-dialog',e=>e.getAttribute('aria-describedby')),'confirm-copy');}
(async()=>{
 const browser=await launch();try{
 const {page,context,errors}=await fresh(browser);
 await add(page,'25','food');await fill(page,'amount','100');await page.click('[data-category="personal"]');await page.click('[data-subcategory="Software & Cloud Services"]');await page.$eval('#entry-details',e=>e.open=true);await page.click('#repeat-monthly');await fill(page,'recurring-name','Cloud plan');await page.click('#save-expense');
 await check('Expense deletion waits for a named warning; Cancel, Enter on Cancel, and Escape preserve data and parent focus',async()=>{
  await page.click('#recent-list [data-expense]');const before=await stored(page);await page.click('#delete-expense');await warning(page,'Delete expense');assert.deepEqual(await stored(page),before);assert.match(await text(page,'confirm-copy'),/Only this charge/);
  await page.keyboard.press('Enter');assert.equal(await page.$eval('#confirm-dialog',e=>e.open),false);assert.equal(await page.$eval('#expense-dialog',e=>e.open),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'delete-expense');assert.deepEqual(await stored(page),before);
  await page.click('#delete-expense');await page.keyboard.press('Escape');assert.deepEqual(await stored(page),before);assert.equal(await page.$eval('#expense-dialog',e=>e.open),true);
  await page.click('#delete-expense');await page.click('#confirm-cancel');assert.deepEqual(await stored(page),before);
  await page.click('#delete-expense');await acceptConfirmation(page);assert.equal((await stored(page)).expenses.length,1);assert.equal((await stored(page)).recurringRules[0].active,true);await page.click('#undo');assert.deepEqual(await stored(page),before);
 });
 await check('Stopping a monthly schedule is confirmed, Cancel keeps its editor open, and Undo restores confirmed stopping',async()=>{
  await page.click('[data-monthly]');const before=await stored(page);await page.click('#stop-monthly');await warning(page,'Stop monthly expense');assert.match(await text(page,'confirm-copy'),/Cloud plan/);await page.click('#confirm-cancel');assert.deepEqual(await stored(page),before);assert.equal(await page.$eval('#monthly-dialog',e=>e.open),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'stop-monthly');
  await page.click('#stop-monthly');await acceptConfirmation(page);assert.equal((await stored(page)).recurringRules[0].active,false);assert.deepEqual((await stored(page)).expenses,before.expenses);await page.click('#undo');assert.deepEqual(await stored(page),before);
 });
 await check('Category and subcategory removals share the warning, explain affected schedules, and are inert until confirmed',async()=>{
  await openSettings(page);for(const [button,label] of [['remove-category','Remove category'],['remove-subcategory','Remove subcategory']]){
   const before=await stored(page);await page.click('#'+button);await warning(page,label);assert.match(await text(page,'confirm-copy'),/stops 1 active monthly schedule/);assert.match(await text(page,'confirm-copy'),/Past expenses/);await page.click('#confirm-cancel');assert.deepEqual(await stored(page),before);assert.equal(await page.evaluate(()=>document.activeElement.id),button);
   await page.click('#'+button);await acceptConfirmation(page);assert.equal((await stored(page)).recurringRules[0].active,false);assert.deepEqual((await stored(page)).expenses,before.expenses);await page.click('#undo');assert.deepEqual(await stored(page),before);
  }
 });
 await check('Pausing automatic monthly logging waits for confirmation and applies other behavior changes only after acceptance',async()=>{
  const before=await stored(page);await page.$eval('#monthly-posting',e=>e.checked=false);await page.$eval('#remember-category',e=>e.checked=true);await page.click('#behavior-form button[type="submit"]');await warning(page,'Pause monthly logging');await page.click('#confirm-cancel');assert.deepEqual(await stored(page),before);
  await page.click('#behavior-form button[type="submit"]');await acceptConfirmation(page);let data=await stored(page);assert.equal(data.settings.monthlyPosting,false);assert.equal(data.settings.rememberCategory,true);assert.deepEqual(data.recurringRules,before.recurringRules);await page.click('#undo');assert.deepEqual(await stored(page),before);
 });
 await fill(page,'gist-id','abc123');await fill(page,'gist-token','synthetic-test-token');await page.click('#gist-config-form button[type="submit"]');
 const beforeGist=await stored(page),remote=structuredClone(beforeGist);remote.expenses=[];remote.settings.gistId='';
 await page.evaluate(remote=>{
  window.gistFixture={id:'abc123',public:false,truncated:false,files:{'finflow.json':{content:JSON.stringify({format:'finflow-backup',version:'0.3.1',data:remote})}}};window.requests=[];window.holdUpload=false;
  window.fetch=async(url,options)=>{window.requests.push(options.method);if(options.method==='PATCH'){Object.assign(window.gistFixture.files,JSON.parse(options.body).files);if(window.holdUpload)await new Promise(resolve=>window.releaseUpload=resolve);}return {ok:true,status:200,json:async()=>structuredClone(window.gistFixture)};};
 },remote);
 await check('Disconnect warns before clearing the connection, preview, or saved device token; cancellation keeps the connection usable',async()=>{
  await page.click('#gist-preview-button');await page.waitForFunction(()=>!document.getElementById('gist-actions').hidden);const before=await stored(page),requests=await page.evaluate(()=>requests.length),status=await text(page,'gist-status');
  await page.click('#gist-disconnect');await warning(page,'Disconnect Gist');assert.match(await text(page,'confirm-copy'),/local expenses and the Gist on GitHub are kept/);await page.click('#confirm-cancel');assert.deepEqual(await stored(page),before);assert.equal(await text(page,'gist-status'),status);assert.equal(await page.evaluate(()=>requests.length),requests);
  await page.click('#gist-preview-button');await page.waitForFunction(()=>!document.getElementById('gist-actions').hidden);assert.equal(await page.evaluate(()=>requests.length),requests+1);
  await page.click('#gist-disconnect');await acceptConfirmation(page);assert.equal((await stored(page)).settings.gistId,'');assert.deepEqual((await stored(page)).expenses,before.expenses);await page.click('#gist-preview-button');assert.match(await text(page,'gist-status'),/token first/);
  await fill(page,'gist-id','abc123');await fill(page,'gist-token','synthetic-test-token');await page.click('#gist-config-form button[type="submit"]');
 });
 await check('Changing an existing Gist uses the same confirmation and never reuses the old token for a different connection',async()=>{
  const before=await stored(page);await fill(page,'gist-id','def456');await page.click('#gist-config-form button[type="submit"]');await warning(page,'Change connection');await page.keyboard.press('Escape');assert.deepEqual(await stored(page),before);
  await page.click('#gist-config-form button[type="submit"]');await acceptConfirmation(page);assert.equal((await stored(page)).settings.gistId,'def456');await page.click('#gist-preview-button');assert.match(await text(page,'gist-status'),/token first/);
  await fill(page,'gist-id','abc123');await fill(page,'gist-token','synthetic-test-token');await page.click('#gist-config-form button[type="submit"]');await acceptConfirmation(page);
 });
 await check('Both Gist replacements use the shared warning and cancellation performs no replacement requests',async()=>{
  await page.click('#gist-preview-button');await page.waitForFunction(()=>!document.getElementById('gist-actions').hidden);
  for(const [button,label] of [['gist-pull','Replace browser data'],['gist-push','Replace Gist snapshot']]){const before=await stored(page),count=await page.evaluate(()=>requests.length);await page.click('#'+button);await warning(page,label);await page.click('#confirm-cancel');assert.deepEqual(await stored(page),before);assert.equal(await page.evaluate(()=>requests.length),count);}
 });
 await check('An accepted async replacement runs once and cannot appear canceled while the upload is in progress',async()=>{
  await page.evaluate(()=>window.holdUpload=true);await page.click('#gist-push');await page.click('#confirm-action');await page.waitForFunction(()=>typeof window.releaseUpload==='function');assert.equal(await page.$eval('#confirm-action',e=>e.disabled),true);assert.equal(await page.$eval('#confirm-cancel',e=>e.disabled),true);await page.keyboard.press('Escape');assert.equal(await page.$eval('#confirm-dialog',e=>e.open),true);
  await page.$eval('#confirm-action',e=>e.click());assert.equal(await page.evaluate(()=>requests.filter(r=>r==='PATCH').length),1);await page.evaluate(()=>window.releaseUpload());await page.waitForFunction(()=>!document.getElementById('confirm-dialog').open);assert.match(await text(page,'gist-status'),/uploaded/);assert.equal(await page.evaluate(()=>requests.filter(r=>r==='PATCH').length),1);
 });
 await check('Warnings safely render user names and fit phone/desktop with readable descriptions and touch-sized actions',async()=>{
  await fill(page,'category-name','<img src=x onerror="window.__xss=1">');await page.click('#category-settings-form button[type="submit"]');
  for(const width of [320,390,1440]){await page.setViewport({width,height:844});await page.click('#remove-category');await warning(page,'Remove category');assert.match(await text(page,'confirm-copy'),/<img/);assert.equal(await page.$$eval('img',es=>es.length),0);assert.equal(await page.evaluate(()=>window.__xss),undefined);assert.equal(await page.$eval('#confirm-dialog',e=>e.scrollWidth>e.clientWidth),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const actions=await page.$$eval('#confirm-dialog button',es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));assert.ok(actions.every(r=>r.width>=44&&r.height>=44));await page.keyboard.press('Escape');}
  await fill(page,'category-name','Tech & Subscriptions');await page.click('#category-settings-form button[type="submit"]');await page.setViewport({width:390,height:844});await page.click('#gist-disconnect');await page.screenshot({path:'/tmp/finflow-phone-confirmation.png'});await page.keyboard.press('Escape');await page.setViewport({width:1440,height:1000});await page.click('#remove-category');await page.screenshot({path:'/tmp/finflow-desktop-confirmation.png'});await page.keyboard.press('Escape');
 });
 await check('A storage failure keeps the warning open and the action unapplied, allowing a safe retry',async()=>{
  const before=await stored(page);await page.click('#remove-subcategory');await page.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('full');};});await page.click('#confirm-action');await page.waitForFunction(()=>!document.getElementById('confirm-feedback').hidden);assert.deepEqual(await stored(page),before);assert.equal(await page.$eval('#confirm-dialog',e=>e.open),true);assert.match(await text(page,'confirm-feedback'),/not saved/);await page.evaluate(()=>Storage.prototype.setItem=window.realSet);await acceptConfirmation(page);assert.equal((await stored(page)).recurringRules[0].active,false);await page.click('#undo');assert.deepEqual(await stored(page),before);
 });
 await check('A warning cannot apply against changed data from another tab',async()=>{
  await page.click('#gist-disconnect');const other=await context.newPage();await other.goto(URL,{waitUntil:'load'});await other.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key));d.expenses[0].note='Changed in another tab';localStorage.setItem(key,JSON.stringify(d));},KEY);await page.bringToFront();const changed=await stored(page);await page.click('#confirm-action');assert.equal(await page.$eval('#confirm-dialog',e=>e.open),true);assert.match(await text(page,'confirm-feedback'),/Saved data changed/);assert.deepEqual(await stored(page),changed);assert.equal(changed.settings.gistId,'abc123');await page.click('#confirm-cancel');await other.close();
 });
 assert.deepEqual(errors,[]);await context.close();console.log('All destructive-action confirmation checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
