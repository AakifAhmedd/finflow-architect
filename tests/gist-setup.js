const {launch,fresh,stored,fill,add,text,check,assert,KEY,acceptConfirmation}=require('./helpers');
const TOKEN='synthetic-gist-token';
async function cloud(page,options={}){
 await page.evaluate(options=>{
  const rack={id:'aa777',description:'RACK wardrobe backup',public:false,truncated:false,files:{'rack-data.json':{content:'rack-only-data'}}};
  window.cloudMock={requests:[],gists:{aa777:rack},postCount:0,...options};
  window.fetch=async(url,request)=>{
   const m=window.cloudMock,method=request.method,body=request.body?JSON.parse(request.body):null;
   m.requests.push({url,method,body,authenticated:request.headers.Authorization==='Bearer synthetic-gist-token'});
   if(m.failAll)throw Error('network');
   if(method==='GET'&&url.includes('?')){
    if(m.beforeList)m.beforeList();
    const page=Number(new URL(url).searchParams.get('page'));let values=m.pages?m.pages[page-1]||[]:Object.values(m.gists).filter(g=>!m.hideNew||g.id==='aa777');
    return {ok:true,status:200,json:async()=>structuredClone(values)};
   }
   if(method==='POST'){
    m.postCount++;
    if(m.createStatus)return {ok:false,status:m.createStatus,json:async()=>({message:'refused'})};
    const created={id:'ff001',description:body.description,public:body.public,truncated:false,files:structuredClone(body.files)};m.gists[created.id]=created;
    if(m.holdCreate)await new Promise(resolve=>window.releaseCreation=resolve);
    if(m.failAfterCreate)throw Error('response lost');
    if(m.quotaAfterCreate){window.nativeSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};}
    return {ok:true,status:201,json:async()=>structuredClone(m.badCreateResponse||created)};
   }
   const id=url.split('/').at(-1),gist=m.gists[id];
   if(!gist)return {ok:false,status:404,json:async()=>({})};
   if(method==='PATCH')Object.assign(gist.files,body.files);
   return {ok:true,status:200,json:async()=>structuredClone(gist)};
  };
 },options);
}
async function setup(page){await page.click('#nav-settings');await fill(page,'gist-token',TOKEN);await fill(page,'gist-id','');await page.click('#gist-config-form button[type="submit"]');}
async function settled(page){await page.waitForFunction(()=>!document.getElementById('gist-config-form').querySelector('button[type="submit"]').disabled);}
async function run(browser,name,fn){await check(name,async()=>{const t=await fresh(browser);try{await fn(t.page);assert.deepEqual(t.errors,[]);}finally{await t.context.close();}});}
(async()=>{const browser=await launch();try{
 await run(browser,'Blank setup needs a token, and an invalid entered ID never initiates discovery or creation',async page=>{
  await cloud(page);await page.click('#nav-settings');await page.click('#gist-config-form button[type="submit"]');assert.match(await text(page,'gist-status'),/personal access token/);
  await fill(page,'gist-token',TOKEN);await fill(page,'gist-id','https://example.com/not-a-gist');await page.click('#gist-config-form button[type="submit"]');assert.match(await text(page,'gist-status'),/existing Gist ID/);assert.equal(await page.evaluate(()=>cloudMock.requests.length),0);
 });
 await run(browser,'First token-only setup creates a separate secret finflow-data backup, persists its ID, and never writes RACK data or credentials',async page=>{
  await add(page,'20','transport',{subCategory:'Fuel',note:'Keep this purchase'});await page.evaluate(()=>localStorage.setItem('rack-fixture','rack-only-local-data'));
  const before=await stored(page);await cloud(page);await setup(page);await settled(page);
  const m=await page.evaluate(()=>cloudMock),post=m.requests.find(r=>r.method==='POST');assert.equal(m.postCount,1);assert.equal(post.url,'https://api.github.com/gists');assert.equal(post.body.public,false);assert.equal(post.body.description,'finflow-data');assert.deepEqual(Object.keys(post.body.files),['finflow.json']);
  const backup=JSON.parse(post.body.files['finflow.json'].content);assert.equal(backup.format,'finflow-backup');assert.deepEqual(backup.data.expenses,before.expenses);assert.equal(backup.data.settings.gistId,'');assert.ok(!JSON.stringify(post.body).includes(TOKEN));assert.ok(!JSON.stringify(post.body).includes('rack-only'));
  assert.equal((await stored(page)).settings.gistId,'ff001');assert.equal(await page.$eval('#gist-id',e=>e.value),'ff001');assert.equal(await page.$eval('#gist-token',e=>e.value),TOKEN);assert.ok(!JSON.stringify(await stored(page)).includes(TOKEN));assert.equal(m.gists.aa777.files['rack-data.json'].content,'rack-only-data');assert.ok(m.requests.every(r=>r.authenticated));assert.deepEqual(m.requests.map(r=>r.method),['GET','POST']);assert.equal(await page.$eval('#gist-actions',e=>e.hidden),false);
  await page.reload();await cloud(page,{gists:m.gists});await page.click('#nav-settings');assert.equal(await page.$eval('#gist-token',e=>e.value),TOKEN);await page.click('#gist-preview-button');await settled(page);assert.match(await text(page,'gist-status'),/Gist:/);
 });
 await run(browser,'In-progress setup runs once, locks its credentials, and keeps expenses entered while the first upload is pending',async page=>{
  await add(page,'20','food');await cloud(page,{holdCreate:true});await setup(page);await page.waitForFunction(()=>typeof window.releaseCreation==='function');
  assert.equal(await page.$eval('#gist-token',e=>e.disabled),true);assert.equal(await page.$eval('#gist-id',e=>e.disabled),true);await page.$eval('#gist-config-form',e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(await page.evaluate(()=>cloudMock.postCount),1);
  await page.click('#nav-track');await add(page,'30','transport');await page.evaluate(()=>releaseCreation());await settled(page);assert.equal((await stored(page)).expenses.length,2);assert.equal((await stored(page)).settings.gistId,'ff001');assert.match(await text(page,'gist-status'),/This browser: 2 expenses/);assert.equal(await page.evaluate(()=>JSON.parse(cloudMock.gists.ff001.files['finflow.json'].content).data.expenses.length),1);
 });
 await run(browser,'Discovery reconnects an existing finflow-data Gist across pages without creating, uploading, or replacing local expenses',async page=>{
  await add(page,'7','food');const current=await stored(page),remote=structuredClone(current);remote.expenses=[];remote.settings.gistId='';
  const gist={id:'bb888',description:'finflow-data',public:false,truncated:false,files:{'finflow.json':{content:JSON.stringify({format:'finflow-backup',version:'0.4.1',data:remote})}}};
  const first=Array.from({length:100},(_,i)=>({id:(i+100000).toString(16),description:'RACK or other app',public:false,files:{'rack-data.json':{}}}));
  await cloud(page,{gists:{bb888:gist},pages:[first,[{...gist,files:{'finflow.json':{}}}]]});await setup(page);await settled(page);const m=await page.evaluate(()=>cloudMock);
  assert.deepEqual(m.requests.map(r=>r.method),['GET','GET','GET']);assert.equal(m.requests.at(-1).url,'https://api.github.com/gists/bb888');assert.equal((await stored(page)).settings.gistId,'bb888');assert.deepEqual((await stored(page)).expenses,current.expenses);assert.match(await text(page,'gist-status'),/existing finflow-data/);assert.equal(m.postCount,0);
 });
 await run(browser,'Duplicate matches, incomplete pagination, and an invalid named backup block setup without any remote writes',async page=>{
  await add(page,'3','food');const before=await stored(page);
  await cloud(page,{gists:{aa111:{id:'aa111',description:'finflow-data',public:false,files:{}},aa222:{id:'aa222',description:'finflow-data',public:false,files:{}}}});await setup(page);await settled(page);assert.match(await text(page,'gist-status'),/multiple/);assert.deepEqual(await stored(page),before);assert.equal(await page.evaluate(()=>cloudMock.postCount),0);
  const hundred=Array.from({length:100},(_,i)=>({id:(i+100000).toString(16),description:'RACK',public:false,files:{}}));await cloud(page,{pages:Array.from({length:10},()=>hundred)});await setup(page);await settled(page);assert.match(await text(page,'gist-status'),/Could not check all/);assert.equal(await page.evaluate(()=>cloudMock.postCount),0);
  await cloud(page,{gists:{bb888:{id:'bb888',description:'finflow-data',public:false,truncated:false,files:{'rack-data.json':{content:'rack-only'}}}}});await setup(page);await settled(page);assert.match(await text(page,'gist-status'),/no FinFlow backup/);assert.equal(await page.evaluate(()=>cloudMock.postCount),0);assert.deepEqual(await stored(page),before);
 });
 await run(browser,'An explicitly entered RACK Gist cannot enable FinFlow push or pull and its files remain intact',async page=>{
  await cloud(page);await page.click('#nav-settings');await fill(page,'gist-token',TOKEN);await fill(page,'gist-id','aa777');await page.click('#gist-config-form button[type="submit"]');await page.click('#gist-preview-button');await settled(page);
  assert.match(await text(page,'gist-status'),/another app/);assert.equal(await page.$eval('#gist-actions',e=>e.hidden),true);await page.$eval('#gist-push',e=>e.click());await page.$eval('#gist-pull',e=>e.click());const m=await page.evaluate(()=>cloudMock);assert.deepEqual(m.requests.map(r=>r.method),['GET']);assert.equal(m.gists.aa777.files['rack-data.json'].content,'rack-only-data');
 });
 await run(browser,'Existing FinFlow Gists keep unrelated files and descriptions when a confirmed push updates only finflow.json',async page=>{
  await add(page,'4','food');const data=await stored(page),gist={id:'bb888',description:'Older FinFlow backup',public:false,truncated:false,files:{'finflow.json':{content:JSON.stringify({format:'finflow-backup',version:'0.4.1',data})},'rack-data.json':{content:'rack-only-data'}}};await cloud(page,{gists:{bb888:gist}});
  await page.click('#nav-settings');await fill(page,'gist-token',TOKEN);await fill(page,'gist-id','bb888');await page.click('#gist-config-form button[type="submit"]');await page.click('#gist-preview-button');await settled(page);await page.click('#gist-push');await acceptConfirmation(page);
  const m=await page.evaluate(()=>cloudMock),patch=m.requests.find(r=>r.method==='PATCH');assert.deepEqual(Object.keys(patch.body),['files']);assert.deepEqual(Object.keys(patch.body.files),['finflow.json']);assert.equal(m.gists.bb888.files['rack-data.json'].content,'rack-only-data');assert.equal(m.gists.bb888.description,'Older FinFlow backup');
 });
 await run(browser,'Changing a saved connection to token-only setup warns before any request and preserves the previous Gist',async page=>{
  await add(page,'4','food');const data=await stored(page),old={id:'bb888',description:'Previous FinFlow backup',public:false,truncated:false,files:{'finflow.json':{content:JSON.stringify({format:'finflow-backup',version:'0.4.1',data})}}};await cloud(page,{gists:{bb888:old}});
  await page.click('#nav-settings');await fill(page,'gist-id','bb888');await fill(page,'gist-token',TOKEN);await page.click('#gist-config-form button[type="submit"]');const before=await stored(page);
  await fill(page,'gist-id','');await page.click('#gist-config-form button[type="submit"]');assert.equal(await page.$eval('#confirm-dialog',e=>e.open),true);assert.equal(await page.evaluate(()=>cloudMock.requests.length),0);await page.keyboard.press('Escape');assert.deepEqual(await stored(page),before);
  await page.click('#gist-config-form button[type="submit"]');await acceptConfirmation(page);await settled(page);assert.equal((await stored(page)).settings.gistId,'ff001');assert.deepEqual(await page.evaluate(()=>cloudMock.gists.bb888),old);assert.equal(await page.evaluate(()=>cloudMock.requests.some(r=>r.method==='PATCH')),false);
 });
 await run(browser,'Malformed discovery and untrusted creation responses never become usable connections or trigger an automatic second creation',async page=>{
  await cloud(page,{pages:[{unexpected:'not a list'}]});await setup(page);await settled(page);assert.match(await text(page,'gist-status'),/incomplete Gist list/);assert.equal(await page.evaluate(()=>cloudMock.postCount),0);
  for(const response of [{id:'https://gist.github.com/ff001',public:false,description:'finflow-data',files:{}},{id:'ff001',public:true,description:'finflow-data',files:{}},{id:'ff001',public:false,description:'finflow-data',files:{'finflow.json':{content:'{}'}}}]){
   await page.reload();await cloud(page,{badCreateResponse:response,hideNew:true});await setup(page);await settled(page);assert.equal((await stored(page))?.settings.gistId||'','');assert.equal(await page.$eval('#gist-actions',e=>e.hidden),true);assert.equal(await page.evaluate(()=>cloudMock.postCount),1);await page.click('#gist-config-form button[type="submit"]');await settled(page);assert.equal(await page.evaluate(()=>cloudMock.postCount),1);
  }
 });
 await run(browser,'Refused creation preserves local data and allows a corrected permission attempt without retaining a token',async page=>{
  await add(page,'5','food');const before=await stored(page);await cloud(page,{createStatus:403});await setup(page);await settled(page);assert.match(await text(page,'gist-status'),/GitHub returned 403/);assert.deepEqual(await stored(page),before);
  await page.evaluate(()=>cloudMock.createStatus=null);await page.click('#gist-config-form button[type="submit"]');await settled(page);assert.equal((await stored(page)).settings.gistId,'ff001');assert.equal(await page.evaluate(()=>cloudMock.postCount),2);assert.equal(await page.$eval('#gist-token',e=>e.value),TOKEN);
 });
 await run(browser,'An uncertain creation response is never blindly repeated and can be recovered by later discovery',async page=>{
  await cloud(page,{failAfterCreate:true,hideNew:true});await setup(page);await settled(page);assert.match(await text(page,'gist-status'),/may have succeeded/);assert.equal(await page.evaluate(()=>cloudMock.postCount),1);
  await page.click('#gist-config-form button[type="submit"]');await settled(page);assert.equal(await page.evaluate(()=>cloudMock.postCount),1);assert.match(await text(page,'gist-status'),/previous creation/);
  await page.evaluate(()=>cloudMock.hideNew=false);await page.click('#gist-config-form button[type="submit"]');await settled(page);assert.equal((await stored(page)).settings.gistId,'ff001');assert.equal(await page.evaluate(()=>cloudMock.postCount),1);
 });
 await run(browser,'A failed local connection save exposes the created ID and retries only persistence, without creating another Gist',async page=>{
  await add(page,'6','food');const before=await stored(page);await cloud(page,{quotaAfterCreate:true});await setup(page);await settled(page);assert.deepEqual(await stored(page),before);assert.equal(await page.$eval('#gist-id',e=>e.value),'ff001');assert.equal(await page.$eval('#gist-token',e=>e.value),TOKEN);assert.match(await text(page,'gist-status'),/No second Gist/);
  const count=await page.evaluate(()=>cloudMock.requests.length);await page.evaluate(()=>Storage.prototype.setItem=nativeSet);await page.click('#gist-config-form button[type="submit"]');assert.equal((await stored(page)).settings.gistId,'ff001');assert.deepEqual((await stored(page)).expenses,before.expenses);assert.equal(await page.evaluate(()=>cloudMock.requests.length),count);assert.ok(!JSON.stringify(await stored(page)).includes(TOKEN));
 });
 await run(browser,'A stale local snapshot blocks creation before POST, and oversized Unicode snapshots are never uploaded',async page=>{
  await add(page,'8','food');await cloud(page);await page.evaluate(()=>cloudMock.beforeList=()=>{const data=JSON.parse(localStorage.getItem('finflow_tracker_v1'));data.expenses[0].note='Other tab edit';localStorage.setItem('finflow_tracker_v1',JSON.stringify(data));});await setup(page);await settled(page);assert.equal(await page.evaluate(()=>cloudMock.postCount),0);assert.equal((await stored(page)).expenses[0].note,'Other tab edit');assert.equal(await page.$eval('#storage-warning',e=>e.hidden),false);
  await page.reload();await cloud(page);await page.evaluate(()=>{state.previousCategories=[{retained:'界'.repeat(350000)}];localStorage.setItem('finflow_tracker_v1',JSON.stringify(state));storageSnapshot=localStorage.getItem('finflow_tracker_v1');});await setup(page);await settled(page);assert.equal(await page.evaluate(()=>cloudMock.postCount),0);assert.match(await text(page,'gist-status'),/too large/);
 });
 await run(browser,'Created connections remain readable and accessible on phone and desktop, with labeled controls and no overflow',async page=>{
  await cloud(page);await setup(page);await settled(page);
  for(const width of [320,390,1440]){await page.setViewport({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.match(await page.$eval('label[for="gist-id"]',e=>e.textContent),/leave blank to create one/);const unnamed=await page.$$eval('#gist-config-form input',es=>es.filter(e=>!e.labels.length));assert.deepEqual(unnamed,[]);if(width===390)await page.screenshot({path:'/tmp/finflow-phone-gist-setup.png',fullPage:true});}
  await page.screenshot({path:'/tmp/finflow-desktop-gist-setup.png',fullPage:true});
 });
 console.log('All first-time Gist setup checks passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
