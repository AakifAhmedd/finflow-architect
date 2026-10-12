const {launch,fresh,stored,fill,add,text,check,assert,KEY,URL,acceptConfirmation}=require('./helpers');
const CREDENTIALS='finflow_gist_connection_v1',TOKEN='device-token-fixture',NEXT_TOKEN='replacement-token-fixture';
async function connect(page,token=TOKEN,id='abc123'){
 await page.click('#nav-settings');await fill(page,'gist-id',id);await fill(page,'gist-token',token);await page.click('#gist-config-form button[type="submit"]');await acceptConfirmation(page);
}
async function credential(page){return page.evaluate(key=>{const value=localStorage.getItem(key);return value===null?null:JSON.parse(value);},CREDENTIALS);}
async function mock(page,data,token=TOKEN){await page.evaluate((data,token)=>{
 window.connectionMock={token,data:structuredClone(data),requests:[]};
 window.fetch=async(url,options)=>{
  const m=connectionMock;m.requests.push({url,method:options.method,body:options.body});
  const ok=options.headers.Authorization==='Bearer '+m.token;
  if(ok&&options.method==='PATCH')Object.assign(m.data.files,JSON.parse(options.body).files);
  return {ok,status:ok?200:401,json:async()=>structuredClone(m.data)};
 };
},data,token);}
async function gist(page){const data=await stored(page);data.settings.gistId='';return {id:'abc123',public:false,truncated:false,files:{'finflow.json':{content:JSON.stringify({format:'finflow-backup',version:'0.5.0',data})}}};}
async function preview(page){await page.click('#gist-preview-button');await page.waitForFunction(()=>!document.getElementById('gist-preview-button').disabled);}
async function run(browser,name,fn){await check(name,async()=>{const t=await fresh(browser);try{await add(t.page,'20','food');await fn(t);assert.deepEqual(t.errors,[]);}finally{await t.context.close();}});}
(async()=>{const browser=await launch();try{
 await run(browser,'Saving a connection remembers the masked key and ID across reload and new tabs, and authenticated sync works without retyping',async({page,context})=>{
  await connect(page);assert.deepEqual(await credential(page),{gistId:'abc123',token:TOKEN});assert.equal(await page.$eval('#gist-token',e=>e.type),'password');
  const remote=await gist(page);await page.reload();await page.click('#nav-settings');assert.equal(await page.$eval('#gist-token',e=>e.value),TOKEN);assert.equal(await page.$eval('#gist-id',e=>e.value),'abc123');await mock(page,remote);await preview(page);assert.match(await text(page,'gist-status'),/Gist: 1 expenses/);
  await page.click('#gist-push');await acceptConfirmation(page);assert.match(await text(page,'gist-status'),/uploaded/);
  const requests=await page.evaluate(()=>connectionMock.requests);assert.ok(requests.some(r=>r.method==='PATCH'));assert.ok(!JSON.stringify(requests).includes(TOKEN));assert.ok(!JSON.stringify(await stored(page)).includes(TOKEN));
  const other=await context.newPage();await other.goto(URL,{waitUntil:'load'});assert.equal(await other.$eval('#gist-token',e=>e.value),TOKEN);assert.equal(await other.$eval('#gist-id',e=>e.value),'abc123');await other.close();await page.bringToFront();
 });
 await run(browser,'Confirmed Disconnect removes the device record and masked input, while Cancel preserves it and RACK keys stay untouched',async({page})=>{
  await connect(page);await page.evaluate(()=>localStorage.setItem('rack-credential-fixture','rack-token-fixture'));
  const before=await credential(page);await page.click('#gist-disconnect');await page.keyboard.press('Escape');assert.deepEqual(await credential(page),before);assert.equal(await page.$eval('#gist-token',e=>e.value),TOKEN);
  await page.click('#gist-disconnect');await acceptConfirmation(page);assert.equal(await credential(page),null);assert.equal((await stored(page)).settings.gistId,'');assert.equal(await page.$eval('#gist-token',e=>e.value),'');assert.equal(await page.evaluate(()=>localStorage.getItem('rack-credential-fixture')),'rack-token-fixture');
  await page.reload();assert.equal(await page.$eval('#gist-token',e=>e.value),'');assert.equal((await stored(page)).expenses.length,1);
 });
 await run(browser,'Changing Gist IDs never carries an untouched remembered key to another connection; explicitly entering a key saves the new binding',async({page})=>{
  await connect(page);await fill(page,'gist-id','def456');await page.click('#gist-config-form button[type="submit"]');await page.keyboard.press('Escape');assert.deepEqual(await credential(page),{gistId:'abc123',token:TOKEN});
  await page.click('#gist-config-form button[type="submit"]');await acceptConfirmation(page);assert.equal(await credential(page),null);assert.equal(await page.$eval('#gist-token',e=>e.value),'');
  await fill(page,'gist-token',NEXT_TOKEN);await page.click('#gist-config-form button[type="submit"]');assert.deepEqual(await credential(page),{gistId:'def456',token:NEXT_TOKEN});await page.reload();assert.equal(await page.$eval('#gist-token',e=>e.value),NEXT_TOKEN);
 });
 await run(browser,'Financial backups, restore, and Undo exclude credentials and preserve the current device connection',async({page})=>{
  await connect(page);const remote=await gist(page);const data=JSON.parse(remote.files['finflow.json'].content);data.data.expenses=[];data.data.token='foreign-token-fixture';remote.files['finflow.json'].content=JSON.stringify(data);
  await mock(page,remote);await preview(page);await page.click('#gist-pull');await acceptConfirmation(page);assert.equal((await stored(page)).expenses.length,0);assert.equal((await stored(page)).token,undefined);assert.deepEqual(await credential(page),{gistId:'abc123',token:TOKEN});
  await page.click('#undo');assert.equal((await stored(page)).expenses.length,1);assert.deepEqual(await credential(page),{gistId:'abc123',token:TOKEN});const backup=await page.evaluate(()=>gistBackupContent());assert.ok(!backup.includes(TOKEN));assert.ok(!backup.includes(CREDENTIALS));assert.ok(!backup.includes('foreign-token-fixture'));
 });
 await run(browser,'A credential write failure retains the old connection and entered replacement, with a successful retry after storage recovers',async({page})=>{
  await connect(page);const before=await stored(page);await fill(page,'gist-token',NEXT_TOKEN);
  await page.evaluate(key=>{window.nativeSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Full','QuotaExceededError');return nativeSet.call(this,k,v);};},CREDENTIALS);
  await page.click('#gist-config-form button[type="submit"]');assert.deepEqual(await stored(page),before);assert.deepEqual(await credential(page),{gistId:'abc123',token:TOKEN});assert.equal(await page.$eval('#gist-token',e=>e.value),NEXT_TOKEN);assert.match(await text(page,'storage-warning-text'),/cloud connection was not saved/);
  await page.evaluate(()=>Storage.prototype.setItem=nativeSet);await page.click('#gist-config-form button[type="submit"]');assert.deepEqual(await credential(page),{gistId:'abc123',token:NEXT_TOKEN});
 });
 await run(browser,'A failed financial-settings write rolls the credential record back without losing expenses or falsely applying a replacement token',async({page})=>{
  await connect(page);const before=await stored(page);await fill(page,'gist-token',NEXT_TOKEN);
  await page.evaluate(key=>{window.nativeSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Full','QuotaExceededError');return nativeSet.call(this,k,v);};},KEY);
  await page.click('#gist-config-form button[type="submit"]');assert.deepEqual(await stored(page),before);assert.deepEqual(await credential(page),{gistId:'abc123',token:TOKEN});await page.evaluate(()=>Storage.prototype.setItem=nativeSet);await page.click('#gist-config-form button[type="submit"]');assert.deepEqual(await credential(page),{gistId:'abc123',token:NEXT_TOKEN});
 });
 await run(browser,'Failed token removal keeps Disconnect unapplied and its warning open until a safe retry',async({page})=>{
  await connect(page);await page.evaluate(key=>{window.nativeRemove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(k){if(k===key)throw new DOMException('Unavailable','SecurityError');return nativeRemove.call(this,k);};},CREDENTIALS);
  await page.click('#gist-disconnect');await page.click('#confirm-action');await page.waitForFunction(()=>!document.getElementById('confirm-action').disabled);assert.equal(await page.$eval('#confirm-dialog',e=>e.open),true);assert.equal((await stored(page)).settings.gistId,'abc123');assert.deepEqual(await credential(page),{gistId:'abc123',token:TOKEN});
  await page.evaluate(()=>Storage.prototype.removeItem=nativeRemove);await page.click('#confirm-action');await page.waitForFunction(()=>!document.getElementById('confirm-dialog').open);assert.equal(await credential(page),null);
 });
 await run(browser,'Cross-tab token rotation invalidates an already confirmed snapshot before any remote replacement',async({page,context})=>{
  await connect(page);await mock(page,await gist(page));await preview(page);await page.click('#gist-push');
  const other=await context.newPage();await other.goto(URL,{waitUntil:'load'});await connect(other,NEXT_TOKEN);await page.bringToFront();await page.waitForFunction(()=>document.getElementById('gist-token').value==='replacement-token-fixture');
  await page.click('#confirm-action');await page.waitForFunction(()=>!document.getElementById('confirm-dialog').open);assert.match(await text(page,'gist-status'),/connection changed in another tab/);assert.equal(await page.evaluate(()=>connectionMock.requests.some(r=>r.method==='PATCH')),false);
  await page.evaluate(()=>connectionMock.token='replacement-token-fixture');await preview(page);assert.match(await text(page,'gist-status'),/Gist:/);await other.close();
 });
 await run(browser,'Credential changes while first-time setup confirmation is open block stale-token discovery and creation',async({page,context})=>{
  await connect(page);await mock(page,await gist(page));await fill(page,'gist-id','');await page.click('#gist-config-form button[type="submit"]');assert.equal(await page.$eval('#confirm-dialog',e=>e.open),true);
  const other=await context.newPage();await other.goto(URL,{waitUntil:'load'});await connect(other,NEXT_TOKEN);await page.bringToFront();await page.waitForFunction(()=>document.getElementById('gist-token').value==='replacement-token-fixture');
  await page.click('#confirm-action');await page.waitForFunction(()=>!document.getElementById('confirm-dialog').open);assert.match(await text(page,'gist-status'),/connection changed in another tab/);assert.equal(await page.evaluate(()=>connectionMock.requests.length),0);assert.deepEqual(await credential(page),{gistId:'abc123',token:NEXT_TOKEN});await other.close();
 });
 await run(browser,'Malformed or mismatched saved credentials never authorize requests and can be repaired without changing financial data',async({page})=>{
  await connect(page);const before=await stored(page);
  for(const raw of ['invalid-json',JSON.stringify({gistId:'def456',token:NEXT_TOKEN}),JSON.stringify({gistId:'abc123',token:42})]){
   await page.evaluate((key,raw)=>localStorage.setItem(key,raw),CREDENTIALS,raw);await page.reload();await page.click('#nav-settings');assert.equal(await page.$eval('#gist-token',e=>e.value),'');assert.deepEqual(await stored(page),before);await mock(page,await gist(page));await preview(page);assert.equal(await page.evaluate(()=>connectionMock.requests.length),0);assert.equal(await page.evaluate(key=>localStorage.getItem(key),CREDENTIALS),raw);
  }
  await fill(page,'gist-token',NEXT_TOKEN);await page.click('#gist-config-form button[type="submit"]');assert.deepEqual(await credential(page),{gistId:'abc123',token:NEXT_TOKEN});
 });
 await run(browser,'Remembered keys stay local to one browser profile and remain masked in phone and desktop Settings',async({page})=>{
  await connect(page);const isolated=await fresh(browser);assert.equal(await credential(isolated.page),null);assert.equal(await isolated.page.$eval('#gist-token',e=>e.value),'');await isolated.context.close();await page.bringToFront();
  for(const width of [320,390,1440]){await page.setViewport({width,height:844});assert.equal(await page.$eval('#gist-token',e=>e.type),'password');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(width===390)await page.screenshot({path:'/tmp/finflow-phone-remembered-token.png',fullPage:true});}
  await page.screenshot({path:'/tmp/finflow-desktop-remembered-token.png',fullPage:true});
 });
 console.log('All remembered Gist credential checks passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
