'use strict';

const TARGET_ORIGIN = 'https://openga.calsplatz.com';
const TARGET_PATH = '/mgt_newplcy';
const TARGET_TITLE = '신계약(조직) - OPENGA';

function seoulMonthToDate(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('INVALID_NOW');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const valueOf = (type) => parts.find((part) => part.type === type)?.value;
  const yearText = valueOf('year');
  const monthText = valueOf('month');
  const dayText = valueOf('day');
  if (!yearText || !monthText || !dayText) throw new Error('SEOUL_DATE_FORMAT_FAILED');

  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    startDate: `${yearText}-${monthText}-01`,
    endDate: `${yearText}-${monthText}-${dayText}`
  };
}

function isTargetUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
    return url.origin === TARGET_ORIGIN && normalizedPath === TARGET_PATH;
  } catch {
    return false;
  }
}

function targetPageIdsFromResponse(pagesResponse) {
  if (pagesResponse?.error || pagesResponse?.result?.isError) throw new Error('LIST_PAGES_FAILED');

  const ids = new Set();
  for (const item of pagesResponse?.result?.content ?? []) {
    if (item.type !== 'text') continue;
    for (const line of String(item.text ?? '').split(/\r?\n/)) {
      const match = line.match(/^\s*(\d+):\s*(.*?)\s*(?:\[selected\])?\s*$/);
      if (!match) continue;

      const pageId = Number(match[1]);
      const description = match[2].trim();
      const parenthesizedUrl = description.match(/\((https?:\/\/[^)]+)\)\s*$/)?.[1];
      const bareUrl = description.match(/(https?:\/\/\S+)/)?.[1]?.replace(/[),]$/, '');
      const title = description.replace(/\s*\(https?:\/\/[^)]+\)\s*$/, '').trim();
      if (isTargetUrl(parenthesizedUrl || bareUrl) || title === TARGET_TITLE) ids.add(pageId);
    }
  }
  return [...ids];
}

function requireSingleTargetPageId(pagesResponse) {
  const ids = targetPageIdsFromResponse(pagesResponse);
  if (ids.length === 0) throw new Error('TARGET_TAB_NOT_FOUND');
  if (ids.length > 1) throw new Error('TARGET_TAB_AMBIGUOUS');
  return ids[0];
}

module.exports = {
  TARGET_ORIGIN,
  TARGET_PATH,
  TARGET_TITLE,
  isTargetUrl,
  requireSingleTargetPageId,
  seoulMonthToDate,
  targetPageIdsFromResponse
};
