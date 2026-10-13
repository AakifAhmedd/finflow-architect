const {launch,fresh,stored,fill,continueEntry,add,text,check,today,assert,KEY}=require('./helpers');
const choices=[
 ['transport','Transport',['Fuel','Vehicle Maintenance','Public Transport','Parking','Ride Sharing','Other']],
 ['food','Food & Dining',['Food Delivery','Restaurants','Cafes','Snacks & Drinks','Groceries','Other']],
 ['sports','Fitness & Health',['Gym','Supplements','Sports Activities','Sports Gear','Medical Visits','Medicines','Other']],
 ['personal','Personal',['Pets','Gifts','Personal Care','Clothing & Accessories','Software & Cloud Services','Other']],
 ['community','Professional & Community',['Work Expenses','Volunteering','Courses','Community Events','Other']],
 ['other','Other',['Other']]
];
(async()=>{
 const browser=await launch();
 try{
  const {page,context,errors}=await fresh(browser);
  await check('Main selector shows exactly the six agreed category names',async()=>{
   assert.deepEqual(await page.$$eval('[data-category] span',es=>es.map(e=>e.textContent)),choices.map(c=>c[1]));
   assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);
  });
  await page.setViewport({width:390,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.screenshot({path:'/tmp/finflow-phone-categories.png'});
  await fill(page,'amount','1250');await continueEntry(page);await page.screenshot({path:'/tmp/finflow-phone-categories.png'});await page.click('[data-category="transport"]');await page.click('[data-subcategory="Fuel"]');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.screenshot({path:'/tmp/finflow-phone-subcategories.png'});
  await page.click('#categories-back');await page.setViewport({width:1440,height:1000});
  await check('All categories expose exactly their agreed subcategories and save both selected labels',async()=>{
   for(const [id,name,subs] of choices){
    for(const sub of subs){
     await fill(page,'amount','10.25');await page.click(`[data-category="${id}"]`);
     if(id!=='other'){assert.deepEqual(await page.$$eval('[data-subcategory] span',es=>es.map(e=>e.textContent)),subs);
     assert.equal(await page.$eval('#categories-back',e=>e.hidden),false);
     assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);
     await page.click(`[data-subcategory="${sub}"]`);
     assert.equal(await page.$eval(`[data-subcategory="${sub}"]`,e=>e.getAttribute('aria-pressed')),'true');
     }else{assert.equal(await page.$$eval('[data-subcategory]',es=>es.length),0);assert.equal(await page.$eval('#categories-back',e=>e.hidden),true);}
     assert.equal(await page.$eval('#save-expense',e=>e.disabled),false);
     await page.click('#save-expense');const e=(await stored(page)).expenses.at(-1);
     assert.equal(e.mainCategory,name);assert.equal(e.subCategory,sub);assert.equal(e.cents,1025);
    }
   }
   const data=await stored(page);assert.equal(data.expenses.length,31);assert.equal(data.categories.length,6);
   await page.reload({waitUntil:'load'});assert.deepEqual((await stored(page)).expenses,data.expenses);
  });
  await check('Back clears classification and restores focus while keeping amount, note, and date',async()=>{
   await fill(page,'amount','42');await page.$eval('#entry-details',e=>e.open=true);await fill(page,'note','Retain this draft');
   await page.click('[data-category="personal"]');await page.click('[data-subcategory="Software & Cloud Services"]');await page.click('#categories-back');
   assert.equal(await page.$$eval('[data-category]',es=>es.length),6);
   assert.equal(await page.$eval('#save-expense',e=>e.disabled),true);
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.category),'personal');
   assert.equal(await page.$eval('#amount',e=>e.value),'42');assert.equal(await page.$eval('#note',e=>e.value),'Retain this draft');
   assert.equal(await page.$eval('#date',e=>e.value),today());
   await page.click('[data-category="personal"]');assert.equal(await page.$$eval('[data-subcategory][aria-pressed="true"]',es=>es.length),0);
   await page.click('#categories-back');await page.reload({waitUntil:'load'});
  });
  await check('Main-category analytics and subcategory totals reconcile, including the distinct Other in each group',async()=>{
   await page.click('#nav-spending');assert.equal(await text(page,'spending-total'),'Rs. 317.75');
   assert.equal(await page.$$eval('[data-filter]',es=>es.length),6);
   for(const [id,name,subs] of choices){
    await page.click(`[data-filter="${id}"]`);assert.equal(await text(page,'filtered-count'),`${subs.length} expense${subs.length===1?'':'s'}`);
    const rows=await page.$$eval('#subcategory-breakdown .subcategory-row',es=>es.map(e=>e.textContent));
    assert.equal(rows.length,subs.length);for(const sub of subs)assert.ok(rows.includes(sub+'Rs. 10.25'));
    assert.equal(await page.$$eval('#spending-list .expense-row',es=>es.length),subs.length);
    assert.ok((await text(page,'spending-list')).includes(name));await page.click('#clear-filter');
   }
  });
  await check('Editing restores the selected subcategory; changing groups updates summaries without duplicating the expense',async()=>{
   await page.click('[data-filter="community"]');await page.click('#spending-list [data-expense]');await page.click('#edit-expense');
   assert.equal(await text(page,'category-label'),'Professional & Community');
   assert.deepEqual(await page.$$eval('[data-subcategory][aria-pressed="true"]',es=>es.map(e=>e.textContent)),['Other']);
   await page.click('#categories-back');await page.click('[data-category="food"]');await page.click('[data-subcategory="Food Delivery"]');await page.click('#save-expense');
   const data=await stored(page);assert.equal(data.expenses.length,31);assert.equal(data.expenses[29].mainCategory,'Food & Dining');
   assert.equal(data.expenses[29].subCategory,'Food Delivery');
   await page.click('#nav-spending');await page.click('[data-filter="food"]');assert.equal(await text(page,'filtered-count'),'7 expenses');
   assert.ok((await text(page,'subcategory-breakdown')).includes('Food DeliveryRs. 20.50'));
  });
  assert.deepEqual(errors,[]);await context.close();
  const old=await fresh(browser),p=old.page;
  const flat={schema:1,categories:[
   {id:'transport',name:'Primary Transport',short:'Transport',icon:'bike',color:'#42634d',items:['RayZR Fuel','Uber']},
   {id:'living',name:'Living & Tech',short:'Living & Tech',icon:'home',color:'#aca5ba',items:['Google One']},
   {id:'custom',name:'Custom category',short:'Custom category',icon:'other',color:'#788c7b',items:['<img src=x onerror="window.__xss=1">']}
  ],expenses:[
   {id:'old-fuel',category:'transport',item:'RayZR Fuel',cents:100050,date:today(),note:'Fuel expense'},
   {id:'old-ride',category:'transport',item:'Uber',cents:25000,date:today(),note:''},
   {id:'old-cloud',category:'living',item:'Google One',cents:280000,date:today(),note:''},
   {id:'old-custom',category:'custom',item:'<img src=x onerror="window.__xss=1">',cents:45000,date:today(),note:'Custom note'}
  ]};
  await check('Existing flat expenses migrate additively to six groups without losing original data or executing old labels',async()=>{
   await p.evaluate((key,data)=>localStorage.setItem(key,JSON.stringify(data)),KEY,flat);await p.reload({waitUntil:'load'});
   const data=await stored(p);assert.equal(data.categories.length,6);assert.equal(data.expenses.length,4);assert.deepEqual(data.previousCategories,flat.categories);
   data.expenses.forEach((e,i)=>{for(const field of ['id','item','cents','date','note'])assert.equal(e[field],flat.expenses[i][field]);assert.equal(e.previousClassification.categoryId,flat.expenses[i].category);});
   assert.equal(data.expenses[0].subCategory,'Fuel');assert.equal(data.expenses[1].subCategory,'Ride Sharing');
   assert.equal(data.expenses[2].mainCategory,'Personal');assert.equal(data.expenses[3].mainCategory,'Personal');assert.equal(data.expenses[3].subCategory,'Other');
   assert.equal(await text(p,'track-total'),'4,500.50');assert.ok((await text(p,'recent-list')).includes(flat.expenses[3].item));
   assert.equal(await p.$$eval('img',es=>es.length),0);assert.equal(await p.evaluate(()=>window.__xss),undefined);
   const serialized=await p.evaluate(key=>localStorage.getItem(key),KEY);await p.reload({waitUntil:'load'});assert.equal(await p.evaluate(key=>localStorage.getItem(key),KEY),serialized);
   await p.click('#recent-list [data-expense]');await p.click('#edit-expense');await fill(p,'amount','500');await p.click('#save-expense');
   assert.equal((await stored(p)).expenses[3].previousClassification.subCategory,flat.expenses[3].item);
  });
  await check('Custom labels that match JavaScript property names migrate as inert labels',async()=>{
   const custom={schema:1,categories:[{id:'custom',name:'constructor',short:'constructor',icon:'other',color:'#788c7b',items:['__proto__']}],expenses:[{id:'custom-prototype',category:'custom',item:'__proto__',cents:100,date:today(),note:''}]};
   await p.evaluate((key,data)=>localStorage.setItem(key,JSON.stringify(data)),KEY,custom);await p.reload({waitUntil:'load'});
   const data=await stored(p);assert.equal(data.categories.length,6);assert.equal(data.expenses[0].subCategory,'Other');assert.equal(data.expenses[0].previousClassification.subCategory,'__proto__');
   assert.equal(await p.$eval('#storage-warning',e=>e.hidden),true);
  });
  await check('Invalid saved subcategory data is kept and saving is paused',async()=>{
   const before=await stored(p);before.expenses[0].subCategory='Not a valid subcategory';const raw=JSON.stringify(before);
   await p.evaluate((key,value)=>localStorage.setItem(key,value),KEY,raw);await p.reload({waitUntil:'load'});
   assert.equal(await p.$eval('#storage-warning',e=>e.hidden),false);await add(p,'1','food');
   assert.equal(await p.evaluate(key=>localStorage.getItem(key),KEY),raw);
  });
  assert.deepEqual(old.errors,[]);await old.context.close();
  console.log('All hierarchical category checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
