import { assert, setupHousehold, collectPageErrors } from './helpers.js';

// Covers: テキストから明細を読み込む (paste-text import) -- parsing the
// 日付|金額|メモ|ジャンル format (ジャンル optional), reusing the PDF-import
// review/dedup pipeline, the "このプロンプトでClaudeを開く" convenience
// button, and the category-priority order (merchant memory > Claude's
// ジャンル field > local keyword guess).
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
    assert(promptText.includes('日付|金額|お店・メモ|ジャンル'), 'プロンプトの中に取り込み形式の説明が含まれる(ジャンルを含む4項目)');
    assert(promptText.includes('2026-10-05|12800|イオン南砂店|食料品'), 'プロンプトの中に出力例が含まれる');
    assert(promptText.includes('食料品') && promptText.includes('その他'), 'プロンプトにこの世帯の実際のジャンル一覧が列挙されている');

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
      '2026-10-11|9000|マルイ渋谷店|美容・衣服', // ジャンルが4項目目で指定されている
      '2026-10-12|500|謎の店|そんなジャンルはない', // 最後の項目が未知のジャンル名 -> メモの一部として扱われる
      'invalid line with no pipes'
    ].join('\n');
    await page.fill('#paste-import-textarea', pasteText);
    await page.click('[data-action="parse-paste-import"]');
    await page.waitForTimeout(300);

    const importRowCount = await page.locator('#import-review-list .row').count();
    assert(importRowCount === 5, '形式に合う5件だけが確認リストに表示される（ヘッダー行と不正な行は無視）: ' + importRowCount);
    const importListText = await page.locator('#import-review-list').innerText();
    assert(importListText.includes('イオン南砂店'), 'パイプ区切りのメモが取り込まれている');
    assert(importListText.includes('スターバックス'), 'カンマや円記号・スラッシュ区切りの日付が入っていても金額と日付を正しく解釈する');

    const maruiRowText = await page.locator('#import-review-list .import-row', { hasText: 'マルイ渋谷店' }).innerText();
    assert(maruiRowText.includes('美容・衣服'), 'Claudeが4項目目で指定したジャンルがそのまま使われる: ' + maruiRowText);

    const nazoRowText = await page.locator('#import-review-list .import-row', { hasText: '謎の店' }).innerText();
    assert(nazoRowText.includes('謎の店｜そんなジャンルはない') || nazoRowText.includes('謎の店|そんなジャンルはない'), '最後の項目が未知のジャンル名の場合、メモとして連結される（ジャンルの誤爆判定をしない）: ' + nazoRowText);
    assert(nazoRowText.includes('その他'), 'ジャンル欄が無効な場合はローカルの推測（該当なし→その他）にフォールバックする: ' + nazoRowText);

    // --- 確認リストから一括で追加すると、支出一覧に反映される ---
    await page.click('[data-action="commit-import"]');
    await page.waitForTimeout(300);
    const toastText = await page.locator('#toast').textContent();
    assert(toastText.includes('5件の支出を追加しました'), 'テキストインポートで取り込んだ5件が一括で追加される: ' + toastText);
    const toggles = await page.locator('[data-action="toggle-expense-cycle"]').all();
    for (const t of toggles) {
      const expanded = await t.getAttribute('aria-expanded');
      if (expanded !== 'true') await t.click();
    }
    await page.waitForTimeout(150);
    const expenseRowCount = await page.locator('#expenses-list .row').count();
    assert(expenseRowCount === 5, 'すべての締め月グループを展開すると5件とも支出一覧に表示される: ' + expenseRowCount);

    // --- マルイ渋谷店のジャンルが記憶され、以降は記憶が優先される ---
    // (同じメモで別のジャンルを指定した行を再度貼り付けても上書きされない)
    await page.click('[data-action="paste-import-trigger"]');
    await page.waitForTimeout(250);
    await page.fill('#paste-import-textarea', '2026-11-11|9000|マルイ渋谷店|食料品');
    await page.click('[data-action="parse-paste-import"]');
    await page.waitForTimeout(300);
    const maruiAgainText = await page.locator('#import-review-list .import-row', { hasText: 'マルイ渋谷店' }).innerText();
    assert(maruiAgainText.includes('美容・衣服') && !maruiAgainText.includes('食料品'), '過去に記憶した「マルイ渋谷店」のジャンルは、Claudeが別のジャンルを指定しても上書きされない: ' + maruiAgainText);
    await page.click('[data-action="close-sheet"][data-sheet="import"]');
    await page.waitForTimeout(200);

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
