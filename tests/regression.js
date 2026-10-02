const puppeteer = require('puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'file:///Users/aakifahmed/finflow-architect/index.html';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--allow-file-access-from-files', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 900 });

  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // --- Issue 4: rounding ---
  const fmt = await page.evaluate(() => ({
    pos: formatCurrency(1250.5),
    neg: formatCurrency(-1250.5),
    tiny: formatCurrency(-0.4),
    zero: formatCurrency(0),
    negZero: formatCurrency(-0),
  }));
  check('rounding: +1250.5 rounds away from zero', fmt.pos === 'Rs. 1,251', fmt.pos);
  check('rounding: -1250.5 mirrors +1250.5', fmt.neg === 'Rs. -1,251', fmt.neg);
  check('rounding: no "Rs. -0"', !/-0\b/.test(fmt.tiny) && !/-0$/.test(fmt.negZero), `tiny=${fmt.tiny} negZero=${fmt.negZero}`);
  check('rounding: zero stays zero', fmt.zero === 'Rs. 0', fmt.zero);

  // --- Issue 1: stored XSS ---
  await page.evaluate(() => {
    window.__xss = 0;
    window.__alerts = [];
    window.alert = m => window.__alerts.push(String(m));
    document.getElementById('tab-builder').click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => document.getElementById('btn-add-node-modal').click());
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const e = document.getElementById('input-node-name');
    const setter = Object.getOwnPropertyDescriptor(e.constructor.prototype, 'value').set;
    setter.call(e, '<img src=x onerror=window.__xss=1>');
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => document.getElementById('btn-submit-add-node').click());
  await new Promise(r => setTimeout(r, 1200));

  const afterCreate = await page.evaluate(() => ({
    xss: window.__xss,
    stored: localStorage.getItem('finflow_architect_model_v2').includes('onerror'),
    builderRawImg: document.getElementById('view-builder').innerHTML.includes('<img src=x'),
  }));
  check('XSS: payload persisted to storage', afterCreate.stored, `stored=${afterCreate.stored}`);

  await page.evaluate(() => { window.__xss = 0; document.getElementById('tab-analytics').click(); });
  await new Promise(r => setTimeout(r, 1500));
  const afterAnalytics = await page.evaluate(() => ({
    xss: window.__xss,
    rawImg: document.getElementById('view-analytics').innerHTML.includes('<img src=x'),
    shownAsText: document.getElementById('view-analytics').innerText.includes('<img src=x'),
  }));
  check('XSS: does not execute in Analysis', afterAnalytics.xss === 0, `__xss=${afterAnalytics.xss}`);
  check('XSS: no injected <img> element in Analysis DOM', afterAnalytics.rawImg === false, `rawImg=${afterAnalytics.rawImg}`);
  check('XSS: payload renders as inert text', afterAnalytics.shownAsText === true, `asText=${afterAnalytics.shownAsText}`);

  await page.evaluate(() => document.getElementById('tab-builder').click());
  await new Promise(r => setTimeout(r, 900));
  const builder = await page.evaluate(() => ({
    xss: window.__xss,
    rawImg: document.getElementById('view-builder').innerHTML.includes('<img src=x'),
  }));
  check('XSS: does not execute in Flow Builder', builder.xss === 0, `__xss=${builder.xss}`);
  check('XSS: no injected <img> in Builder DOM', builder.rawImg === false, `rawImg=${builder.rawImg}`);

  // connections table also escaped
  const table = await page.evaluate(() =>
    document.getElementById('connections-table-body').innerHTML.includes('<img src=x'));
  check('XSS: connections matrix escaped', table === false, `raw=${table}`);

  // reload persistence: payload must not fire on fresh load
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));
  const afterReload = await page.evaluate(() => {
    const has = localStorage.getItem('finflow_architect_model_v2').includes('onerror');
    document.getElementById('tab-analytics').click();
    return { has, images: document.images.length };
  });
  await new Promise(r => setTimeout(r, 1500));
  const reloadImgs = await page.evaluate(() => document.images.length);
  check('XSS: no injected images after reload + Analysis', reloadImgs === 0, `images=${reloadImgs} payloadInStorage=${afterReload.has}`);

  // --- Issue 5: plan empty state ---
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('finflow_architect_model_v2'));
    m.currentFlows.forEach(f => (f.value = 0));
    localStorage.setItem('finflow_architect_model_v2', JSON.stringify(m));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => document.getElementById('tab-sankey').click());
  await new Promise(r => setTimeout(r, 2000));
  const planEmpty = await page.evaluate(() => {
    const svg = document.getElementById('sankey-svg');
    return {
      rects: svg.querySelectorAll('rect').length,
      text: svg.textContent.trim(),
    };
  });
  check('empty state: Plan shows a message', planEmpty.text.length > 0, `text="${planEmpty.text}"`);
  check('empty state: message is plan-specific', /plan amounts/i.test(planEmpty.text), planEmpty.text);

  await page.evaluate(() => document.getElementById('btn-chart-actual').click());
  await new Promise(r => setTimeout(r, 1800));
  const actualEmpty = await page.evaluate(() =>
    document.getElementById('sankey-svg').textContent.trim());
  check('empty state: Actual keeps its own message', /No transactions logged/i.test(actualEmpty), actualEmpty);

  // --- Issues 2/3/8: metrics follow actuals ---
  await page.evaluate(() => document.getElementById('tab-tracker').click());
  await new Promise(r => setTimeout(r, 700));
  const addTx = async (type, cat, amount) => {
    await page.evaluate((t, c, a) => {
      document.getElementById(t === 'income' ? 'btn-tx-type-income' : 'btn-tx-type-expense').click();
      const sel = document.getElementById('select-tx-category');
      sel.value = c;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const inp = document.getElementById('input-tx-amount');
      const setter = Object.getOwnPropertyDescriptor(inp.constructor.prototype, 'value').set;
      setter.call(inp, a);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }, type, cat, amount);
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => document.getElementById('btn-tx-add').click());
    await new Promise(r => setTimeout(r, 900));
  };

  await addTx('expense', 'Badminton Gear', '1250.50');
  await addTx('income', 'Income', '100.50');

  const tracker = await page.evaluate(() => ({
    inc: document.getElementById('tracker-total-income').innerText,
    exp: document.getElementById('tracker-total-expense').innerText,
    net: document.getElementById('tracker-total-net').innerText,
  }));
  check('metrics: tracker spend rounds to 1,251', tracker.exp === 'Rs. 1,251', tracker.exp);
  check('metrics: tracker net mirrors spend (-1,251)', tracker.net === 'Rs. -1,151' || tracker.net === 'Rs. -1,150', tracker.net);

  const header = await page.evaluate(() => ({
    inc: document.getElementById('metric-income').innerText,
    exp: document.getElementById('metric-expenses').innerText,
    net: document.getElementById('metric-savings').innerText,
    rate: document.getElementById('metric-savings-rate').innerText,
  }));
  check('header: income matches logged income', header.inc === tracker.inc, `${header.inc} vs ${tracker.inc}`);
  check('header: spend matches logged spend', header.exp === tracker.exp, `${header.exp} vs ${tracker.exp}`);
  check('header: net matches tracker net', header.net === tracker.net, `${header.net} vs ${tracker.net}`);

  await page.evaluate(() => document.getElementById('tab-analytics').click());
  await new Promise(r => setTimeout(r, 1500));
  const analytics = await page.evaluate(() => ({
    rate: document.getElementById('analytics-savings-rate').innerText,
    streams: document.getElementById('analytics-income-count').innerText,
    surplus: document.getElementById('analytics-surplus').innerText,
    msg: document.getElementById('analytics-savings-msg').innerText,
  }));
  check('analysis: surplus now equals tracker net', analytics.surplus === tracker.net, `${analytics.surplus} vs ${tracker.net}`);
  check('analysis: singular "Stream" grammar', /1 Stream$/.test(analytics.streams), analytics.streams);
  check('analysis: deficit message replaces generic advice', /Spending exceeds income/i.test(analytics.msg), analytics.msg);

  // empty month advice
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('finflow_architect_model_v2'));
    m.transactions = [];
    localStorage.setItem('finflow_architect_model_v2', JSON.stringify(m));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => document.getElementById('tab-analytics').click());
  await new Promise(r => setTimeout(r, 1200));
  const emptyMsg = await page.evaluate(() => document.getElementById('analytics-savings-msg').innerText);
  check('analysis: empty month says so, not "low savings rate"', /No transactions logged/i.test(emptyMsg), emptyMsg);
  const emptyStreams = await page.evaluate(() => document.getElementById('analytics-income-count').innerText);
  check('analysis: zero active streams on empty month', /^0 Streams$/.test(emptyStreams), emptyStreams);

  console.log('\n--- page errors ---');
  console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');

  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });