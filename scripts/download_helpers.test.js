'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requireSingleTargetPageId,
  selectFreshDownloadRow,
  seoulMonthToDate,
  targetPageIdsFromResponse
} = require('./download_helpers');
const { createDownloadPlan } = require('./1_download');

function pages(text) {
  return { result: { content: [{ type: 'text', text }] } };
}

test('Asia/Seoul UTC boundary maps to July 24', () => {
  assert.deepEqual(seoulMonthToDate(new Date('2026-07-23T15:00:00.000Z')), {
    year: 2026, month: 7, day: 24,
    startDate: '2026-07-01', endDate: '2026-07-24'
  });
});

test('month boundary maps to August 1', () => {
  assert.deepEqual(seoulMonthToDate(new Date('2026-07-31T15:00:00.000Z')), {
    year: 2026, month: 8, day: 1,
    startDate: '2026-08-01', endDate: '2026-08-01'
  });
});

test('year boundary maps to January 1', () => {
  assert.equal(seoulMonthToDate(new Date('2026-12-31T15:00:00.000Z')).endDate, '2027-01-01');
});

test('leap day and invalid date', () => {
  assert.equal(seoulMonthToDate(new Date('2028-02-29T03:00:00.000Z')).endDate, '2028-02-29');
  assert.throws(() => seoulMonthToDate(new Date('invalid')), /INVALID_NOW/);
});

test('unrelated page 9 is ignored and OPENGA page is selected dynamically', () => {
  const response = pages('## Pages\n9: about:blank [selected]\n12: 신계약(조직) - OPENGA (https://openga.calsplatz.com/mgt_newplcy)');
  assert.deepEqual(targetPageIdsFromResponse(response), [12]);
  assert.equal(requireSingleTargetPageId(response), 12);
});

test('query and hash on exact OPENGA path are allowed', () => {
  assert.equal(requireSingleTargetPageId(pages('3: 신계약(조직) - OPENGA (https://openga.calsplatz.com/mgt_newplcy?x=1#top)')), 3);
});

test('missing, multiple, and MCP error targets fail closed', () => {
  assert.throws(() => requireSingleTargetPageId(pages('9: about:blank')), /TARGET_TAB_NOT_FOUND/);
  assert.throws(() => requireSingleTargetPageId(pages('2: 신계약(조직) - OPENGA (https://openga.calsplatz.com/mgt_newplcy)\n7: 신계약(조직) - OPENGA (https://openga.calsplatz.com/mgt_newplcy?copy=1)')), /TARGET_TAB_AMBIGUOUS/);
  assert.throws(() => requireSingleTargetPageId({ error: { message: 'boom' } }), /LIST_PAGES_FAILED/);
});

test('download plan injects dynamic Seoul date without fixed pageId', () => {
  const plan = createDownloadPlan(new Date('2026-07-23T15:00:00.000Z'));
  assert.deepEqual(plan.dateRange, {
    year: 2026, month: 7, day: 24,
    startDate: '2026-07-01', endDate: '2026-07-24'
  });
  assert.match(plan.evaluateFunction, /2026-07-01/);
  assert.match(plan.evaluateFunction, /2026-07-24/);
  assert.doesNotMatch(plan.evaluateFunction, /targetPageId\s*=\s*9/);
  assert.match(plan.evaluateFunction, /healthInput\.value\.trim\(\) !== 'Y'/);
  assert.match(plan.evaluateFunction, /HEALTH_Y_NOT_APPLIED/);
  assert.match(plan.evaluateFunction, /selectFreshDownloadRow/);
  assert.match(plan.evaluateFunction, /FRESH_DOWNLOAD_ROW_TIMEOUT/);
  assert.doesNotMatch(plan.evaluateFunction, /text\.includes\('확인'\)/);
  assert.doesNotMatch(plan.evaluateFunction, /querySelectorAll\('a, button, span'\)/);
});

test('fresh download row must be new, same-day, complete, and actionable', () => {
  const previous = {
    fileNames: ['신계약 전체_20260724211911.xlsx'],
    hrefs: ['https://example.test/old']
  };
  const selected = selectFreshDownloadRow([
    {
      screenName: '신계약(조직) 전체 리스트',
      fileName: '신계약 전체_20260724211911.xlsx',
      href: 'https://example.test/old',
      requestTime: '2026-07-24 21:19:11',
      status: '완료',
      actionText: '다운로드'
    },
    {
      screenName: '신계약(조직) 전체 리스트',
      fileName: '신계약 전체_20260724223001.xlsx',
      href: 'https://example.test/new',
      requestTime: '2026-07-24 22:30:01',
      status: '완료',
      actionText: '다운로드'
    }
  ], previous, '20260724', '2026-07-24 22:29:55');

  assert.equal(selected.ready, true);
  assert.equal(selected.row.href, 'https://example.test/new');
});

test('fresh row remains pending until its own download link is ready', () => {
  const selected = selectFreshDownloadRow([{
    screenName: '신계약(조직) 전체 리스트',
    fileName: '신계약 전체_20260724223102.xlsx',
    href: 'https://example.test/pending',
    requestTime: '2026-07-24 22:31:02',
    status: '처리중',
    actionText: ''
  }], { fileNames: [], hrefs: [] }, '20260724', '2026-07-24 22:30:00');

  assert.equal(selected.ready, false);
  assert.equal(selected.row.requestTime, '2026-07-24 22:31:02');
});

test('stale, wrong-date, and ambiguous rows fail closed', () => {
  assert.equal(selectFreshDownloadRow([{
    screenName: '신계약(조직) 전체 리스트',
    fileName: '신계약 전체_20260723235959.xlsx',
    href: 'https://example.test/yesterday',
    requestTime: '2026-07-23 23:59:59',
    status: '완료',
    actionText: '다운로드'
  }], { fileNames: [], hrefs: [] }, '20260724', '2026-07-24 00:00:00'), null);

  assert.equal(selectFreshDownloadRow([{
    screenName: '신계약(조직) 전체 리스트',
    fileName: '신계약 전체_20260724213648.xlsx',
    href: 'https://example.test/stale-today',
    requestTime: '2026-07-24 21:36:48',
    status: '완료',
    actionText: '다운로드'
  }], { fileNames: [], hrefs: [] }, '20260724', '2026-07-24 22:22:45'), null);

  assert.throws(() => selectFreshDownloadRow([
    {
      screenName: '신계약(조직) 전체 리스트',
      fileName: '신계약 전체_20260724223201.xlsx',
      href: 'https://example.test/a',
      requestTime: '2026-07-24 22:32:01',
      status: '완료',
      actionText: '다운로드'
    },
    {
      screenName: '신계약(조직) 전체 리스트',
      fileName: '신계약 전체_20260724223202.xlsx',
      href: 'https://example.test/b',
      requestTime: '2026-07-24 22:32:02',
      status: '완료',
      actionText: '다운로드'
    }
  ], { fileNames: [], hrefs: [] }, '20260724', '2026-07-24 22:31:00'), /FRESH_DOWNLOAD_ROW_AMBIGUOUS/);

  assert.throws(() => selectFreshDownloadRow(
    [],
    { fileNames: [], hrefs: [] },
    '20260724',
    'not-a-timestamp'
  ), /INVALID_DOWNLOAD_NOT_BEFORE/);

  assert.throws(() => selectFreshDownloadRow([{
    screenName: '신계약(조직) 전체 리스트',
    fileName: '부산.zip',
    href: 'https://example.test/wrong-file',
    requestTime: '2026-07-24 22:33:00',
    status: '완료',
    actionText: '다운로드'
  }], { fileNames: [], hrefs: [] }, '20260724', '2026-07-24 22:32:00'),
  /FRESH_DOWNLOAD_FILE_NAME_UNEXPECTED/);
});
