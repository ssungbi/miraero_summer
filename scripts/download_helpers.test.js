'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  requireSingleTargetPageId,
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
});
