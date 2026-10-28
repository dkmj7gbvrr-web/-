export function assert(cond, label) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + label);
  console.log('  ok:', label);
}

// Every test starts from the same blank slate: a fresh household (the mock
// Firestore store is per-page, so this is always truly empty) with both
// display names set, landed on the 支出 tab.
export async function setupHousehold(page, baseUrl, names) {
  names = names || { a: 'たろう', b: 'はなこ' };
  await page.goto(baseUrl + '/shared-test.html');
  await page.waitForTimeout(200);
  await page.click('[data-action="create-household"]');
  await page.waitForTimeout(200);
  await page.click('[data-action="enter-app"]');
  await page.waitForTimeout(200);
  await page.click('[data-action="switch-tab"][data-tab="settings"]');
  await page.fill('#setting-name-a', names.a);
  await page.locator('#setting-name-a').dispatchEvent('change');
  await page.fill('#setting-name-b', names.b);
  await page.locator('#setting-name-b').dispatchEvent('change');
  await page.waitForTimeout(150);
  await page.click('[data-action="switch-tab"][data-tab="expenses"]');
  await page.waitForTimeout(150);
  return names;
}

// Call once right after page creation. Returns the live error array --
// check it (or just that it's empty) at the end of a test.
export function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', function (err) { errors.push('pageerror: ' + err.message); });
  page.on('console', function (msg) {
    if (msg.type() === 'error' && !msg.text().includes('404')) errors.push('console.error: ' + msg.text());
  });
  return errors;
}
