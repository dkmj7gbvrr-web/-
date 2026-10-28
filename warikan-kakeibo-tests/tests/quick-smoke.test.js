import { assert, setupHousehold, collectPageErrors } from './helpers.js';

export async function run({ browser, baseUrl }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = collectPageErrors(page);
  try {
    await setupHousehold(page, baseUrl);

    // 通常の支出保存フローは引き続き動作する。
    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    await page.fill('#expense-memo', 'テスト支出');
    await page.fill('#expense-date', '2026-08-10');
    await page.fill('#expense-amount', '10000');
    await page.click('[data-action="select-split-type"][data-type="equal"]');
    await page.click('[data-action="save-expense"]');
    await page.waitForTimeout(300);
    const rowCount = await page.locator('#expenses-list .row').count();
    assert(rowCount === 1, '通常の支出保存フローは引き続き動作する: ' + rowCount);

    // 精算タブの合計計算も正常。
    await page.click('[data-action="switch-tab"][data-tab="settle"]');
    await page.waitForTimeout(200);
    const settleText = await page.locator('#settle-body').innerText();
    assert(/合計[\s\S]*?10,000/.test(settleText), '精算タブの合計計算も正常');

    // 収入タブのselect要素(1%刻みの収入割合など)も無事。
    await page.click('[data-action="switch-tab"][data-tab="income"]');
    await page.waitForTimeout(150);
    await page.click('[data-action="add-income"]');
    await page.waitForTimeout(300);
    const incomeSelectOptions = await page.locator('#income-ratio-select option').count();
    assert(incomeSelectOptions === 101, '収入タブの収入割合セレクトも影響を受けていない: ' + incomeSelectOptions);

    assert(errors.length === 0, 'ページ上でconsole/pageエラーが発生していない: ' + errors.join(' | '));
  } finally {
    await page.close();
  }
}
