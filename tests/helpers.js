const puppeteer = require('puppeteer-core');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..');
const URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const KEY = 'finflow_tracker_v1';
const LEGACY = 'finflow_architect_model_v2';
async function launch() {
  return puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--allow-file-access-from-files', '--no-sandbox'] });
}
async function fresh(browser, width=1440, height=1000) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({width,height});
  await page.emulateTimezone('Asia/Colombo');
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(URL, {waitUntil:'load'});
  return {context,page,errors};
}
async function stored(page) { return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY); }
async function fill(page, id, value) {
  await page.$eval('#'+id,(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);
}
async function add(page, amount, category='food', options={}) {
  await fill(page,'amount',amount);
  await page.click(`[data-category="${category}"]`);
  if(options.item) { await page.$eval('#entry-details',el=>el.open=true); await page.click(`[data-item="${options.item}"]`); }
  if(options.note || options.date) {
    await page.$eval('#entry-details',el=>el.open=true);
    if(options.note) await fill(page,'note',options.note);
    if(options.date) await fill(page,'date',options.date);
  }
  await page.click('#save-expense');
}
async function text(page,id) {return page.$eval('#'+id,el=>el.textContent.trim());}
function check(name,fn) {return Promise.resolve().then(fn).then(()=>console.log('PASS  '+name));}
function today() {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
module.exports={launch,fresh,stored,fill,add,text,check,today,assert,fs,ROOT,URL,KEY,LEGACY};
