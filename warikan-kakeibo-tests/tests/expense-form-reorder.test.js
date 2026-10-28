import { assert, setupHousehold, collectPageErrors } from './helpers.js';

// Covers: ジャンル moved above 負担の分け方 and compressed into a dropdown,
// and the per-device "この端末の利用者" setting that defaults 実際に立て替えた人
// for brand-new expenses only (never overriding an existing expense's saved
// paidBy).
export async function run({ browser, baseUrl }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = collectPageErrors(page);
  try {
    await setupHousehold(page, baseUrl);

    // --- ジャンルが負担の分け方より上にある ---
    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    const fieldOrder = await page.evaluate(function () {
      const body = document.querySelector('#expense-sheet-backdrop .sheet-body');
      const categoryPicker = body.querySelector('#expense-category-picker');
      const splitOptions = body.querySelector('#expense-split-options');
      const all = Array.from(body.querySelectorAll('*'));
      return { categoryIdx: all.indexOf(categoryPicker), splitIdx: all.indexOf(splitOptions) };
    });
    assert(fieldOrder.categoryIdx < fieldOrder.splitIdx, 'ジャンルの選択肢は負担の分け方より前に表示される: ' + JSON.stringify(fieldOrder));

    // --- ジャンルはプルダウン(select)で、1行の高さに収まっている ---
    const pickerTag = await page.evaluate(function () { return document.getElementById('expense-category-picker').tagName; });
    assert(pickerTag === 'SELECT', 'ジャンルはプルダウン(select要素)になっている: ' + pickerTag);
    const optionCount = await page.locator('#expense-category-picker option').count();
    assert(optionCount > 1, 'ジャンルのプルダウンに選択肢が複数ある: ' + optionCount);
    const pickerBox = await page.locator('#expense-category-picker').boundingBox();
    assert(pickerBox.height < 60, 'ジャンルのプルダウンは1行分の高さに収まっている: ' + pickerBox.height);

    // --- ジャンルを選ぶと、負担の分け方の初期値がそのジャンルに連動して変わる ---
    await page.selectOption('#expense-category-picker', 'dining');
    await page.waitForTimeout(150);
    const diningSelected = await page.locator('[data-action="select-split-type"].selected').getAttribute('data-type');
    await page.selectOption('#expense-category-picker', 'food');
    await page.waitForTimeout(150);
    const foodSelected = await page.locator('[data-action="select-split-type"].selected').getAttribute('data-type');
    assert(diningSelected !== null && foodSelected !== null, 'ジャンルに応じて負担の分け方の初期値が選択される');

    // --- 「＋ 新しいジャンル」ボタンはプルダウンの外に独立して存在する ---
    const addLinkVisible = await page.locator('[data-action="add-category-from-expense"]').isVisible();
    assert(addLinkVisible, '「＋ 新しいジャンル」ボタンはプルダウンの横に表示されている');

    // --- 端末の利用者が未設定なら、新規支出の初期値は「共有」のまま ---
    await page.click('[data-action="close-sheet"][data-sheet="expense"]');
    await page.waitForTimeout(200);
    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    let paidBySelected = await page.locator('[data-action="select-paidby"].selected').getAttribute('data-person');
    assert(paidBySelected === 'shared', '端末の利用者が未設定なら、立て替えた人の初期値は「共有」のまま: ' + paidBySelected);

    // --- 設定タブで「この端末の利用者」を「たろう」に設定すると、新規支出の初期値が「たろう」になる ---
    await page.click('[data-action="close-sheet"][data-sheet="expense"]');
    await page.waitForTimeout(200);
    await page.click('[data-action="switch-tab"][data-tab="settings"]');
    await page.waitForTimeout(150);
    const deviceOptions = await page.locator('#device-person-segmented .segment').allTextContents();
    assert(deviceOptions.length === 3, '端末の利用者の選択肢は「未設定」「たろう」「はなこ」の3つ: ' + deviceOptions.length);
    await page.click('#device-person-segmented [data-action="select-device-person"][data-person="a"]');
    await page.waitForTimeout(150);
    const selectedDeviceOption = await page.locator('#device-person-segmented .segment.selected').textContent();
    assert(selectedDeviceOption === 'たろう', '「たろう」を選ぶとその選択肢が選択状態になる: ' + selectedDeviceOption);

    await page.click('[data-action="switch-tab"][data-tab="expenses"]');
    await page.waitForTimeout(150);
    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    paidBySelected = await page.locator('[data-action="select-paidby"].selected').getAttribute('data-person');
    assert(paidBySelected === 'a', '端末の利用者を「たろう」に設定すると、新規支出の立て替えた人の初期値は「たろう」になる: ' + paidBySelected);

    // --- 既存の支出を編集するときは、保存済みのpaidByがそのまま使われる(端末設定で上書きされない) ---
    await page.fill('#expense-memo', 'たろうの買い物');
    await page.fill('#expense-date', '2026-08-05');
    await page.fill('#expense-amount', '2000');
    await page.click('[data-action="select-split-type"][data-type="bOnly"]');
    await page.click('[data-action="select-paidby"][data-person="b"]');
    await page.click('[data-action="save-expense"]');
    await page.waitForTimeout(300);
    await page.click('#expenses-list .row', { hasText: 'たろうの買い物' });
    await page.waitForTimeout(300);
    const reopenedPaidBy = await page.locator('[data-action="select-paidby"].selected').getAttribute('data-person');
    assert(reopenedPaidBy === 'b', '既存の支出を開き直すと保存済みの立て替えた人(b)がそのまま使われる（端末設定で上書きされない）: ' + reopenedPaidBy);

    // --- 「未設定」に戻すと、新規支出の初期値は「共有」に戻る ---
    await page.click('[data-action="close-sheet"][data-sheet="expense"]');
    await page.waitForTimeout(200);
    await page.click('[data-action="switch-tab"][data-tab="settings"]');
    await page.waitForTimeout(150);
    await page.click('#device-person-segmented [data-action="select-device-person"][data-person=""]');
    await page.waitForTimeout(150);
    await page.click('[data-action="switch-tab"][data-tab="expenses"]');
    await page.waitForTimeout(150);
    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    paidBySelected = await page.locator('[data-action="select-paidby"].selected').getAttribute('data-person');
    assert(paidBySelected === 'shared', '端末の利用者を「未設定」に戻すと、新規支出の初期値も「共有」に戻る: ' + paidBySelected);

    assert(errors.length === 0, 'ページ上でconsole/pageエラーが発生していない: ' + errors.join(' | '));
  } finally {
    await page.close();
  }
}
