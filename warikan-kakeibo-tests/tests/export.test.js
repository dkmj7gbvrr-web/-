import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assert, setupHousehold, collectPageErrors } from './helpers.js';

// Covers: バックアップを書き出す（JSON）and 支出をCSVで書き出す.
export async function run({ browser, baseUrl }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, acceptDownloads: true });
  const errors = collectPageErrors(page);
  try {
    await setupHousehold(page, baseUrl);

    // 2件の支出を作成。1件はメモにカンマを含めてCSVエスケープを検証する。
    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    await page.fill('#expense-memo', 'カフェ, 喫茶店');
    await page.fill('#expense-date', '2026-10-05');
    await page.fill('#expense-amount', '1500');
    await page.click('[data-action="select-split-type"][data-type="equal"]');
    await page.click('[data-action="select-paidby"][data-person="a"]');
    await page.click('[data-action="save-expense"]');
    await page.waitForTimeout(300);

    await page.click('[data-action="add-expense"]');
    await page.waitForTimeout(300);
    await page.fill('#expense-memo', '電気代');
    await page.fill('#expense-date', '2026-10-10');
    await page.fill('#expense-amount', '8000');
    await page.click('[data-action="select-split-type"][data-type="bOnly"]');
    await page.click('[data-action="save-expense"]');
    await page.waitForTimeout(300);

    // --- JSONバックアップ ---
    await page.click('[data-action="switch-tab"][data-tab="settings"]');
    await page.waitForTimeout(150);
    const [jsonDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="export-data"]')
    ]);
    assert(/^warikan-kakeibo-\d{8}\.json$/.test(jsonDownload.suggestedFilename()), 'JSONバックアップのファイル名が想定の形式: ' + jsonDownload.suggestedFilename());
    const jsonPath = path.join(os.tmpdir(), 'warikan-kakeibo-backup-test.json');
    await jsonDownload.saveAs(jsonPath);
    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    fs.unlinkSync(jsonPath);
    assert(Array.isArray(jsonContent.expenses) && jsonContent.expenses.length === 2, 'JSONバックアップに2件の支出データが含まれる: ' + jsonContent.expenses.length);
    assert(jsonContent.settings && jsonContent.settings.personAName === 'たろう', 'JSONバックアップに設定（表示名）が含まれる');

    // --- 支出CSV書き出し ---
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="export-expenses-csv"]')
    ]);
    assert(/^warikan-kakeibo-expenses-\d{8}\.csv$/.test(csvDownload.suggestedFilename()), 'CSVのファイル名が想定の形式: ' + csvDownload.suggestedFilename());
    const csvPath = path.join(os.tmpdir(), 'warikan-kakeibo-backup-test.csv');
    await csvDownload.saveAs(csvPath);
    let csvContent = fs.readFileSync(csvPath, 'utf8');
    fs.unlinkSync(csvPath);
    assert(csvContent.charCodeAt(0) === 0xFEFF, 'CSVの先頭にExcel用のBOMが付いている');
    csvContent = csvContent.slice(1);
    const lines = csvContent.split('\r\n');
    assert(lines[0] === '日付,ジャンル,メモ,備考,金額,負担の分け方,実際に立て替えた人,特別費,初期費用,翌月請求分', 'CSVのヘッダー行が想定どおり: ' + lines[0]);
    assert(lines.length === 3, 'CSVの行数はヘッダー+支出2件の3行: ' + lines.length);
    assert(lines[1].includes('2026-10-05'), '1行目(日付の古い順)は10/5の支出: ' + lines[1]);
    assert(lines[1].includes('"カフェ, 喫茶店"'), 'メモにカンマが含まれる場合はダブルクォートで囲まれる: ' + lines[1]);
    assert(lines[1].includes('たろう'), '立替えた人の表示名がそのままCSVに入っている');
    assert(lines[2].includes('はなこ') && lines[2].includes('電気代'), '2行目は10/10の電気代（はなこのみ負担）: ' + lines[2]);

    assert(errors.length === 0, 'ページ上でconsole/pageエラーが発生していない: ' + errors.join(' | '));
  } finally {
    await page.close();
  }
}
