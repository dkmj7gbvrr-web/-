import { assert, setupHousehold, collectPageErrors } from './helpers.js';

// Covers: テキストから明細を読み込む (paste-text import) -- parsing the
// 日付|金額|メモ format, reusing the PDF-import review/dedup pipeline, and
// the "このプロンプトでClaudeを開く" convenience button.
export async function run({ browser, baseUrl }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = collectPageErrors(page);
  try {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await setupHousehold(page, baseUrl);

    // --- トリガーでシートが開き、プロンプトが表示される ---
    await page.click('[data-action="paste-import-trigger"]');
    await page.waitForTimeout(250);
    const promptText = await page.locator('#paste-import-prompt-box').textContent();
    assert(promptText.includes('日付|金額|お店・メモ'), 'プロンプトの中に取り込み形式の説明が含まれる');
    assert(promptText.includes('2026-10-05|12800|イオン南砂店'), 'プロンプトの中に出力例が含まれる');

    // --- プロンプトのコピーだけするリンクでクリップボードにコピーされる ---
    await page.click('[data-action="copy-paste-import-prompt"]');
    await page.waitForTimeout(150);
    const clipboardText = await page.evaluate(function () { return navigator.clipboard.readText(); });
    assert(clipboardText === promptText, 'プロンプトをコピーすると、表示されているテキストと同じ内容がクリップボードに入る');

    // --- 「このプロンプトでClaudeを開く」はプロンプト入りのclaude.aiリンクを
    // 新しいタブで開こうとし、フォールバックとしてクリップボードにもコピーする
    // (window.open を差し替えて実際のタブ遷移は発生させない) ---
    await page.evaluate(function () {
      window.__openedUrls = [];
      window.open = function (url) { window.__openedUrls.push(url); return null; };
    });
    await page.evaluate(function () { return navigator.clipboard.writeText(''); });
    await page.click('[data-action="open-prompt-in-claude"]');
    await page.waitForTimeout(150);
    const openedUrls = await page.evaluate(function () { return window.__openedUrls; });
    assert(openedUrls.length === 1 && openedUrls[0].startsWith('https://claude.ai/new?q='), '「このプロンプトでClaudeを開く」はclaude.ai/new?q=のURLを新しいタブで開こうとする: ' + JSON.stringify(openedUrls));
    const openedUrlDecoded = decodeURIComponent(openedUrls[0].replace('https://claude.ai/new?q=', ''));
    assert(openedUrlDecoded === promptText, '開こうとするURLのq=パラメータは、表示されているプロンプトと一致する');
    const clipboardAfterOpen = await page.evaluate(function () { return navigator.clipboard.readText(); });
    assert(clipboardAfterOpen === promptText, '「このプロンプトでClaudeを開く」はフォールバックとしてクリップボードにもコピーする');

    // --- 正しい形式のテキストを貼り付けて読み込むと、確認リストに反映される ---
    const pasteText = [
      '2026-10-05|12800|イオン南砂店',
      '2026-10-07|3200|Amazon.co.jp',
      '日付|金額|メモ', // ヘッダーらしき行は無視される想定
      '2026/10/09|¥4,500|スターバックス 渋谷店',
      'invalid line with no pipes'
    ].join('\n');
    await page.fill('#paste-import-textarea', pasteText);
    await page.click('[data-action="parse-paste-import"]');
    await page.waitForTimeout(300);

    const importRowCount = await page.locator('#import-review-list .row').count();
    assert(importRowCount === 3, '形式に合う3件だけが確認リストに表示される（ヘッダー行と不正な行は無視）: ' + importRowCount);
    const importListText = await page.locator('#import-review-list').innerText();
    assert(importListText.includes('イオン南砂店'), 'パイプ区切りのメモが取り込まれている');
    assert(importListText.includes('スターバックス'), 'カンマや円記号・スラッシュ区切りの日付が入っていても金額と日付を正しく解釈する');

    // --- 確認リストから一括で追加すると、支出一覧に反映される ---
    await page.click('[data-action="commit-import"]');
    await page.waitForTimeout(300);
    const toastText = await page.locator('#toast').textContent();
    assert(toastText.includes('3件の支出を追加しました'), 'テキストインポートで取り込んだ3件が一括で追加される: ' + toastText);
    const toggles = await page.locator('[data-action="toggle-expense-cycle"]').all();
    for (const t of toggles) {
      const expanded = await t.getAttribute('aria-expanded');
      if (expanded !== 'true') await t.click();
    }
    await page.waitForTimeout(150);
    const expenseRowCount = await page.locator('#expenses-list .row').count();
    assert(expenseRowCount === 3, 'すべての締め月グループを展開すると3件とも支出一覧に表示される: ' + expenseRowCount);

    // --- 同じ内容をもう一度貼り付けると、重複候補として検出される ---
    await page.click('[data-action="paste-import-trigger"]');
    await page.waitForTimeout(250);
    await page.fill('#paste-import-textarea', '2026-10-05|12800|イオン南砂店');
    await page.click('[data-action="parse-paste-import"]');
    await page.waitForTimeout(300);
    const dupChecked = await page.locator('#import-review-list .import-checkbox').first().isChecked();
    const dupListText = await page.locator('#import-review-list').innerText();
    assert(dupChecked === false, '既に登録済みの日付・金額と一致する行はデフォルトでチェックが外れている(重複防止): ' + dupChecked);
    assert(dupListText.includes('登録済みかも'), '重複候補には「登録済みかも」の表示が出る');

    assert(errors.length === 0, 'ページ上でconsole/pageエラーが発生していない: ' + errors.join(' | '));
  } finally {
    await page.close();
  }
}
