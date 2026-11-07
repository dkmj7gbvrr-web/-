import { assert, setupHousehold, collectPageErrors } from './helpers.js';

// Covers: 共有①・共有② (two separate shared/joint cards). They're picked as
// two distinct 実際に立て替えた人 options, labeled and filterable separately,
// but settle as ONE combined pot -- same single "共有カード用口座への
// 振り込みを完了にする" toggle, same combined gross/net totals.
export async function run({ browser, baseUrl }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = collectPageErrors(page);
  try {
    await setupHousehold(page, baseUrl);

    // --- 実際に立て替えた人には、A/B に加えて共有①・共有②の4択がある ---
    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    const paidByOptions = await page.locator('#expense-paidby-segmented .segment').allTextContents();
    assert(paidByOptions.length === 4, '実際に立て替えた人の選択肢は4つ（A・B・共有①・共有②）: ' + JSON.stringify(paidByOptions));
    assert(paidByOptions.includes('共有①') && paidByOptions.includes('共有②'), '選択肢に「共有①」「共有②」が両方ある: ' + JSON.stringify(paidByOptions));

    // --- 共有①の支出を保存すると、一覧に「立替: 共有①」と表示される ---
    await page.fill('#expense-memo', '共有①で買った日用品');
    await page.fill('#expense-date', '2026-10-05');
    await page.fill('#expense-amount', '4000');
    await page.click('[data-action="select-split-type"][data-type="equal"]');
    await page.click('[data-action="select-paidby"][data-person="shared"]');
    await page.click('[data-action="save-expense"]');
    await page.waitForTimeout(300);
    const row1Text = await page.locator('#expenses-list .row', { hasText: '共有①で買った日用品' }).innerText();
    assert(row1Text.includes('共有①'), '共有①で保存した支出は一覧で「立替: 共有①」と表示される: ' + row1Text);

    // --- 共有②の支出を保存すると、一覧に「立替: 共有②」と表示される ---
    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    await page.fill('#expense-memo', '共有②で買った食料品');
    await page.fill('#expense-date', '2026-10-06');
    await page.fill('#expense-amount', '6000');
    await page.click('[data-action="select-split-type"][data-type="equal"]');
    await page.click('[data-action="select-paidby"][data-person="shared2"]');
    await page.click('[data-action="save-expense"]');
    await page.waitForTimeout(300);
    const row2Text = await page.locator('#expenses-list .row', { hasText: '共有②で買った食料品' }).innerText();
    assert(row2Text.includes('共有②'), '共有②で保存した支出は一覧で「立替: 共有②」と表示される: ' + row2Text);

    // --- 絞り込みフィルターにも共有①・共有②が別々の選択肢として出る ---
    await page.click('[data-action="toggle-expense-search"]');
    await page.waitForTimeout(150);
    const filterOptions = await page.locator('#expense-filter-paidby option').allTextContents();
    assert(filterOptions.some(function (t) { return t.includes('共有①'); }) && filterOptions.some(function (t) { return t.includes('共有②'); }), '絞り込みの「支払った人」にも共有①・共有②が別々に出る: ' + JSON.stringify(filterOptions));
    await page.selectOption('#expense-filter-paidby', 'shared2');
    await page.waitForTimeout(150);
    const filteredText = await page.locator('#expenses-list').innerText();
    assert(filteredText.includes('共有②で買った食料品') && !filteredText.includes('共有①で買った日用品'), '共有②で絞り込むと共有②の支出だけが残る: ' + filteredText);
    await page.click('[data-action="clear-expense-filter"]');
    await page.waitForTimeout(150);

    // --- 精算タブでは共有①・②が合算され、振り込み完了は1つのトグルでまとまる ---
    await page.click('[data-action="switch-tab"][data-tab="settle"]');
    await page.waitForTimeout(200);
    const settleText = await page.locator('#settle-body').innerText();
    assert(settleText.includes('10,000'), '共有①(4,000円)と共有②(6,000円)の合計1万円が、1つの共有カードの金額としてまとまって表示される: ' + settleText);
    assert((settleText.match(/共有カードの精算プラン/g) || []).length === 1, '「共有カードの精算プラン」の表示は共有①・②を合わせて1つだけ（別々のセクションにはならない）');
    await page.click('[data-action="toggle-settled-leg"][data-leg="shared"]');
    await page.waitForTimeout(200);
    const settledText = await page.locator('#settle-body').innerText();
    assert(settledText.includes('完了'), '「振り込みを完了にする」を押すと、共有①・②まとめて1回で完了になる: ' + settledText);

    assert(errors.length === 0, 'ページ上でconsole/pageエラーが発生していない: ' + errors.join(' | '));
  } finally {
    await page.close();
  }
}
