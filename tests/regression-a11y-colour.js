const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'file:///Users/aakifahmed/finflow-architect/index.html';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--allow-file-access-from-files', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 900 });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  // clean slate
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const addTx = async (type, cat, amount) => {
    await page.evaluate((t, c, a) => {
      document.getElementById(t === 'income' ? 'btn-tx-type-income' : 'btn-tx-type-expense').click();
      const sel = document.getElementById('select-tx-category');
      sel.value = c; sel.dispatchEvent(new Event('change', { bubbles: true }));
      const inp = document.getElementById('input-tx-amount');
      Object.getOwnPropertyDescriptor(inp.constructor.prototype, 'value').set.call(inp, a);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }, type, cat, amount);
    await new Promise(r => setTimeout(r, 350));
    await page.evaluate(() => document.getElementById('btn-tx-add').click());
    await new Promise(r => setTimeout(r, 800));
  };

  // ---- Issue 11: deficit colour ----
  await addTx('expense', 'Badminton Gear', '1250.50');
  const deficitColour = await page.evaluate(() => {
    const el = document.getElementById('tracker-total-net');
    return { text: el.innerText, rose: el.classList.contains('text-rose-400'), teal: el.classList.contains('text-teal-300') };
  });
  check('colour: tracker net deficit is rose, not teal',
    deficitColour.rose === true && deficitColour.teal === false, JSON.stringify(deficitColour));

  await addTx('income', 'Income', '5000');
  const surplusColour = await page.evaluate(() => {
    const el = document.getElementById('tracker-total-net');
    return { text: el.innerText, rose: el.classList.contains('text-rose-400'), teal: el.classList.contains('text-teal-300') };
  });
  check('colour: tracker net surplus is teal',
    surplusColour.teal === true && surplusColour.rose === false, JSON.stringify(surplusColour));

  const headerColour = await page.evaluate(() => {
    const el = document.getElementById('metric-savings');
    return { rose: el.classList.contains('text-rose-400'), teal: el.classList.contains('text-teal-300') };
  });
  check('colour: header net follows sign', headerColour.teal === true && headerColour.rose === false, JSON.stringify(headerColour));

  await page.evaluate(() => document.getElementById('tab-analytics').click());
  await new Promise(r => setTimeout(r, 1400));
  const analyticsColour = await page.evaluate(() => {
    const el = document.getElementById('analytics-surplus');
    return { text: el.innerText, rose: el.classList.contains('text-rose-400'), teal: el.classList.contains('text-teal-300') };
  });
  check('colour: analytics surplus follows sign', analyticsColour.teal === true && analyticsColour.rose === false, JSON.stringify(analyticsColour));

  // ---- Issue 9: month nav accessible names ----
  const navLabels = await page.evaluate(() => ({
    prev: document.getElementById('btn-chart-prev-month').getAttribute('aria-label'),
    next: document.getElementById('btn-chart-next-month').getAttribute('aria-label'),
  }));
  check('a11y: chart prev-month has aria-label', !!navLabels.prev, navLabels.prev);
  check('a11y: chart next-month has aria-label', !!navLabels.next, navLabels.next);

  const unnamed = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button').forEach(b => {
      if (b.offsetParent === null) return;
      const name = (b.textContent || '').trim() || b.getAttribute('aria-label') || b.getAttribute('title');
      if (!name) out.push(b.id || b.className.slice(0, 40));
    });
    return out;
  });
  check('a11y: no visible unnamed buttons', unnamed.length === 0, JSON.stringify(unnamed));

  // ---- Issue 10: sankey accessibility ----
  await page.evaluate(() => document.getElementById('tab-sankey').click());
  await new Promise(r => setTimeout(r, 2000));
  const planChart = await page.evaluate(() => {
    const svg = document.getElementById('sankey-svg');
    return { role: svg.getAttribute('role'), label: svg.getAttribute('aria-label') };
  });
  check('a11y: sankey has role=img', planChart.role === 'img', planChart.role);
  check('a11y: plan sankey has aria-label', /planned flow amounts/i.test(planChart.label || ''), planChart.label);

  await page.evaluate(() => document.getElementById('btn-chart-actual').click());
  await new Promise(r => setTimeout(r, 2000));
  const actualChart = await page.evaluate(() => {
    const svg = document.getElementById('sankey-svg');
    return { label: svg.getAttribute('aria-label'), nodes: svg.querySelectorAll('rect').length };
  });
  check('a11y: actual sankey label names the month', /logged transactions/i.test(actualChart.label || ''), actualChart.label);
  check('chart: actual sankey still renders nodes', actualChart.nodes > 0, `rects=${actualChart.nodes}`);

  // ---- regression: metrics agree across all three surfaces ----
  const surface = await page.evaluate(() => {
    document.getElementById('tab-tracker').click();
    return {
      trackerNet: document.getElementById('tracker-total-net').innerText,
      headerNet: document.getElementById('metric-savings').innerText,
    };
  });
  await new Promise(r => setTimeout(r, 900));
  const analyticsNet = await page.evaluate(() => {
    document.getElementById('tab-analytics').click();
    return null;
  });
  await new Promise(r => setTimeout(r, 1300));
  const an = await page.evaluate(() => document.getElementById('analytics-surplus').innerText);
  check('consistency: tracker, header and analytics agree on net',
    surface.trackerNet === surface.headerNet && surface.trackerNet === an,
    `tracker=${surface.trackerNet} header=${surface.headerNet} analytics=${an}`);

  // ---- regression: subscriptions + undo still work ----
  await page.evaluate(() => document.getElementById('tab-tracker').click());
  await new Promise(r => setTimeout(r, 700));
  const subAdded = await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); Object.getOwnPropertyDescriptor(e.constructor.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('input-sub-name', 'Netflix'); set('input-sub-amount', '2800'); set('input-sub-day', '15');
    const s = document.getElementById('select-sub-category'); s.value = 'Living & Tech'; s.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('btn-sub-add').click();
    return JSON.parse(localStorage.getItem('finflow_architect_model_v2')).subscriptions.length;
  });
  check('regression: subscription still saves', subAdded === 1, `count=${subAdded}`);

  const undoWorked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.btn-tx-delete')].find(x => x.offsetParent !== null);
    if (!b) return 'no rows';
    b.click();
    return 'clicked';
  });
  await new Promise(r => setTimeout(r, 700));
  const afterDelete = await page.evaluate(() => JSON.parse(localStorage.getItem('finflow_architect_model_v2')).transactions.length);
  await page.evaluate(() => { const u = [...document.querySelectorAll('button')].find(x => /undo/i.test(x.textContent) && x.offsetParent !== null); if (u) u.click(); });
  await new Promise(r => setTimeout(r, 700));
  const afterUndo = await page.evaluate(() => JSON.parse(localStorage.getItem('finflow_architect_model_v2')).transactions.length);
  check('regression: delete then undo restores', afterDelete === 1 && afterUndo === 2, `afterDelete=${afterDelete} afterUndo=${afterUndo} (${undoWorked})`);

  // ---- regression: duplicate node still rejected ----
  const dup = await page.evaluate(() => {
    window.__alerts = []; window.alert = m => window.__alerts.push(String(m));
    document.getElementById('tab-builder').click();
    return 1;
  });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => document.getElementById('btn-add-node-modal').click());
  await new Promise(r => setTimeout(r, 400));
  const dupResult = await page.evaluate(() => {
    const e = document.getElementById('input-node-name');
    Object.getOwnPropertyDescriptor(e.constructor.prototype, 'value').set.call(e, 'Cat Food');
    e.dispatchEvent(new Event('input', { bubbles: true }));
    const before = JSON.parse(localStorage.getItem('finflow_architect_model_v2')).currentFlows.length;
    document.getElementById('btn-submit-add-node').click();
    const after = JSON.parse(localStorage.getItem('finflow_architect_model_v2')).currentFlows.length;
    const toast = document.getElementById('toast');
    return { before, after, toastVisible: toast && !toast.classList.contains('hidden'), toastText: document.getElementById('toast-message').innerText };
  });
  check('regression: duplicate node rejected with visible feedback',
    dupResult.before === dupResult.after && dupResult.toastVisible && /already exists/i.test(dupResult.toastText),
    JSON.stringify(dupResult));

  console.log('\n--- page errors ---');
  console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });