import { assert, setupHousehold, collectPageErrors } from './helpers.js';

// Covers: 設定タブ の「バックアップから復元する」 -- restoring a previously
// exported JSON backup replaces the household's expenses/incomePeriods/
// settings entirely (confirmed via a native confirm() dialog first).
export async function run({ browser, baseUrl }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = collectPageErrors(page);
  page.on('dialog', function (dialog) { dialog.accept(); });
  try {
    await setupHousehold(page, baseUrl);

    // 復元前に、置き換えで消えるはずの支出を1件作っておく。
    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    await page.fill('#expense-memo', '復元前の支出（消えるはず）');
    await page.fill('#expense-date', '2026-01-01');
    await page.fill('#expense-amount', '1000');
    await page.click('[data-action="select-split-type"][data-type="equal"]');
    await page.click('[data-action="save-expense"]');
    await page.waitForTimeout(300);

    const backup = {
      settings: {
        personAName: 'じろう',
        personBName: 'さちこ',
        cardClosingDay: 10,
        customCategories: [],
        categoryBudgets: {},
        recurringTemplates: [],
        jointSavingsPlan: null
      },
      expenses: [
        { id: 'restored-1', date: '2026-09-01', amount: 5000, memo: '復元された支出1', splitType: 'equal', paidBy: 'shared', category: 'food', isSpecial: false },
        { id: 'restored-2', date: '2026-09-02', amount: 2000, memo: '復元された支出2', splitType: 'aOnly', paidBy: 'a', category: 'dining', isSpecial: false }
      ],
      incomePeriods: [],
      settledCycles: {},
      settledInitialCosts: false
    };

    await page.click('[data-action="switch-tab"][data-tab="settings"]');
    await page.waitForTimeout(150);
    assert(await page.locator('[data-action="import-backup-trigger"]').isVisible(), '「バックアップから復元する」ボタンが表示されている');

    await page.setInputFiles('#import-backup-input', {
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup))
    });
    await page.waitForTimeout(400);

    const toastText = await page.locator('#toast').textContent();
    assert(toastText.includes('バックアップから復元しました'), '復元完了のトーストが表示される: ' + toastText);

    // 設定（表示名・締め日）がバックアップの内容に置き換わっている。
    await page.waitForTimeout(200);
    assert(await page.inputValue('#setting-name-a') === 'じろう', '表示名Aがバックアップの内容に置き換わる');
    assert(await page.inputValue('#setting-name-b') === 'さちこ', '表示名Bがバックアップの内容に置き換わる');
    assert(await page.inputValue('#setting-closing-day') === '10', '締め日がバックアップの内容に置き換わる');

    // 支出もバックアップの2件に完全に置き換わり、復元前の支出は消えている。
    await page.click('[data-action="switch-tab"][data-tab="expenses"]');
    await page.waitForTimeout(150);
    const toggles = await page.locator('[data-action="toggle-expense-cycle"]').all();
    for (const t of toggles) {
      const expanded = await t.getAttribute('aria-expanded');
      if (expanded !== 'true') await t.click();
    }
    await page.waitForTimeout(150);
    const expensesText = await page.locator('#expenses-list').innerText();
    assert(!expensesText.includes('復元前の支出'), '復元前の支出は削除されている');
    assert(expensesText.includes('復元された支出1') && expensesText.includes('復元された支出2'), 'バックアップの2件の支出に置き換わっている');
    const rowCount = await page.locator('#expenses-list .row').count();
    assert(rowCount === 2, '支出一覧はバックアップの2件のみになっている: ' + rowCount);

    assert(errors.length === 0, 'ページ上でconsole/pageエラーが発生していない: ' + errors.join(' | '));
  } finally {
    await page.close();
  }
}
