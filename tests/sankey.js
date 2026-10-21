const {launch,fresh,fill,add,text,check,today,assert}=require('./helpers');
async function income(page,label,amount){
 await page.click('#nav-spending');await page.click('#add-income-top');await fill(page,'income-source',label);await fill(page,'income-amount',amount);await page.click('#save-income');
}
async function flow(page){return page.evaluate(()=>{
 const g=monthlyFlow();return {income:g.income,spent:g.spent,amount:g.amount,nodes:g.columns.flat().map(n=>({label:n.label,cents:n.cents,kind:n.kind,column:n.column,incoming:g.links.filter(l=>l.to===n).reduce((s,l)=>s+l.cents,0),outgoing:g.links.filter(l=>l.from===n).reduce((s,l)=>s+l.cents,0)}))};
});}
(async()=>{
 const browser=await launch();
 try{
  const {page,context,errors}=await fresh(browser);
  await check('Desktop Sankey handles empty and income-only months without inventing expenses',async()=>{
   await page.click('#nav-spending');assert.match(await text(page,'sankey-chart'),/No money flow yet/);assert.equal(await page.$eval('#sankey-table',e=>e.hidden),true);
   await income(page,'Salary','1000.10');const g=await flow(page);assert.equal(g.income,100010);assert.equal(g.spent,0);assert.equal(g.nodes.find(n=>n.kind==='remainder').cents,100010);assert.match(await text(page,'sankey-balance'),/not an account balance/);
  });
  await check('Sankey conserves precise cents, excludes cash movements, and stays monthly during filters',async()=>{
   await add(page,'100.20','food',{subCategory:'Other'});await add(page,'200.30','transport',{subCategory:'Fuel'});await add(page,'0.01','food',{subCategory:'Other'});await page.click('#nav-spending');
   const g=await flow(page);assert.equal(g.spent,30051);assert.equal(g.nodes.find(n=>n.kind==='remainder').cents,69959);
   for(const n of g.nodes){if(n.column>0)assert.equal(n.incoming,n.cents,n.label);if(n.column<2||n.kind==='category')assert.equal(n.outgoing,n.cents,n.label);}
   const table=await text(page,'sankey-rows');await page.click('[data-filter="food"]');assert.equal(await text(page,'sankey-rows'),table);await page.click('#clear-filter');
   await page.$eval('.cash-section',e=>e.open=true);await page.click('#add-movement');await fill(page,'income-source','Transfer only');await fill(page,'income-amount','9999');await page.click('#save-income');assert.deepEqual(await flow(page),g);assert.ok(!(await text(page,'sankey-rows')).includes('Transfer only'));
   await page.click('#spending-prev');assert.match(await text(page,'sankey-chart'),/No money flow yet/);await page.click('#spending-next');assert.deepEqual(await flow(page),g);
  });
  await check('Income gaps, equal totals, and labels are rendered honestly and safely',async()=>{
   await add(page,'1000','other');await page.click('#nav-spending');let g=await flow(page);assert.equal(g.nodes.find(n=>n.kind==='gap').cents,30041);assert.match(await text(page,'sankey-balance'),/does not identify its funding source/);assert.ok(!g.nodes.some(n=>n.kind==='remainder'));
   const label='<img src=x onerror="window.sankeyInjected=true">';await income(page,label,'300.41');g=await flow(page);assert.ok(!g.nodes.some(n=>['gap','remainder'].includes(n.kind)));assert.match(await text(page,'sankey-balance'),/equals/);assert.ok((await text(page,'sankey-rows')).includes(label));assert.equal(await page.$eval('#sankey-card',e=>e.querySelectorAll('img').length),0);assert.equal(await page.evaluate(()=>window.sankeyInjected),undefined);
   assert.equal(await page.$$eval('.sankey-link',es=>es.some(e=>/NaN|Infinity/.test(e.getAttribute('d')))),false);
  });
  await check('Sankey stays out of phones and regenerates on desktop without page overflow',async()=>{
   const expected=await text(page,'sankey-rows');
   for(const width of [320,390,767,768,1024,1440]){
    await page.setViewport({width,height:1000});await page.waitForFunction(w=>w<768?!document.querySelector('#sankey-chart svg'):!!document.querySelector('#sankey-chart svg'),{},width);
    assert.equal(await page.$eval('#sankey-card',e=>getComputedStyle(e).display==='none'),width<768);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(width>=768)assert.equal(await text(page,'sankey-rows'),expected);
   }
   await page.$eval('#sankey-table',e=>e.open=true);await page.$eval('#sankey-card',e=>e.scrollIntoView());await page.screenshot({path:'/tmp/finflow-desktop-sankey.png',fullPage:true});
   await page.setViewport({width:390,height:844});await page.waitForFunction(()=>!document.querySelector('#sankey-chart svg'));await page.click('#nav-spending');await page.screenshot({path:'/tmp/finflow-phone-sankey-hidden.png',fullPage:true});
  });
  assert.deepEqual(errors,[]);await context.close();
  const empty=await fresh(browser);await add(empty.page,'25.01');await empty.page.click('#nav-spending');const g=await flow(empty.page);assert.equal(g.income,0);assert.equal(g.nodes.find(n=>n.kind==='gap').cents,2501);assert.equal(g.amount,g.spent);assert.deepEqual(empty.errors,[]);await empty.context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
