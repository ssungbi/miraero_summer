'use strict';

const {
  TARGET_ORIGIN,
  TARGET_PATH,
  TARGET_TITLE,
  seoulMonthToDate
} = require('./download_helpers');

function buildPageAutomationScript(dateRange) {
  return `
  async () => {
    const expected = ${JSON.stringify(dateRange)};
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const logs = [];
    const visible = (element) => Boolean(element && element.getClientRects().length);
    const monthOrdinal = (year, month) => (year * 12) + month - 1;

    function parsePanelYearMonth(panel) {
      const text = (panel.querySelector('.el-date-range-picker__header')?.textContent ?? '')
        .replace(/\\s+/g, ' ').trim();
      const compact = text.replace(/\\s+/g, '');
      const ko = compact.match(/(\\d{4})년(\\d{1,2})월/);
      if (ko) return { year: Number(ko[1]), month: Number(ko[2]) };

      const year = Number(text.match(/\\b(\\d{4})\\b/)?.[1]);
      const monthNames = ['january','february','march','april','may','june',
        'july','august','september','october','november','december'];
      const month = monthNames.findIndex((name) => text.toLowerCase().includes(name)) + 1;
      return year && month ? { year, month } : null;
    }

    function requireVisiblePicker() {
      const pickers = Array.from(document.querySelectorAll('.el-date-range-picker')).filter(visible);
      if (pickers.length !== 1) throw new Error('DATE_PICKER_AMBIGUOUS_OR_MISSING');
      return pickers[0];
    }

    async function targetMonthPanel() {
      const targetOrdinal = monthOrdinal(expected.year, expected.month);
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const picker = requireVisiblePicker();
        const panels = Array.from(picker.querySelectorAll('.el-date-range-picker__content')).filter(visible);
        const todayPanel = panels.find((panel) => panel.querySelector('td.today:not(.disabled)'));
        if (todayPanel) return todayPanel;

        const metadata = panels.map((panel) => ({ panel, date: parsePanelYearMonth(panel) }))
          .filter((entry) => entry.date);
        const exact = metadata.find((entry) => monthOrdinal(entry.date.year, entry.date.month) === targetOrdinal);
        if (exact) return exact.panel;
        if (!metadata.length) throw new Error('DATE_PANEL_HEADER_UNREADABLE');

        const ordinals = metadata.map((entry) => monthOrdinal(entry.date.year, entry.date.month));
        const selector = targetOrdinal < Math.min(...ordinals)
          ? '.el-date-range-picker__content.is-left .arrow-left'
          : '.el-date-range-picker__content.is-right .arrow-right';
        const navigationButton = picker.querySelector(selector);
        if (!navigationButton) throw new Error('DATE_MONTH_NAVIGATION_MISSING');
        navigationButton.click();
        await sleep(150);
      }
      throw new Error('DATE_MONTH_NAVIGATION_LIMIT');
    }

    async function selectDay(day) {
      const panel = await targetMonthPanel();
      const matches = Array.from(panel.querySelectorAll('td.available:not(.disabled)')).filter((cell) => {
        return !cell.classList.contains('prev-month') &&
          !cell.classList.contains('next-month') &&
          cell.textContent.trim() === String(day);
      });
      if (matches.length !== 1) throw new Error('DATE_DAY_AMBIGUOUS_OR_MISSING:' + day);
      matches[0].click();
      await sleep(250);
    }

    const dateEditor = document.querySelector('.el-date-editor--daterange, .qs-datepicker .el-date-editor');
    if (!dateEditor) throw new Error('DATE_EDITOR_MISSING');
    dateEditor.click();
    await sleep(500);
    await selectDay(1);
    await selectDay(expected.day);

    const dateInputs = Array.from(dateEditor.querySelectorAll('input'));
    if (dateInputs.length < 2) throw new Error('DATE_INPUTS_MISSING');
    const actual = dateInputs.slice(0, 2).map((input) => input.value.replace(/\\D/g, ''));
    const wanted = [expected.startDate, expected.endDate].map((value) => value.replace(/\\D/g, ''));
    if (actual[0] !== wanted[0] || actual[1] !== wanted[1]) {
      throw new Error('DATE_RANGE_NOT_APPLIED:' + JSON.stringify({ actual, wanted }));
    }
    logs.push('기간 설정: ' + expected.startDate + ' ~ ' + expected.endDate);

    const healthInput = document.querySelector('input[placeholder="건강보험(전략)"]');
    if (!healthInput) throw new Error('HEALTH_INPUT_MISSING');
    if (healthInput.value.trim() !== 'Y') {
      const healthSelect = healthInput.closest('.el-select');
      if (!healthSelect) throw new Error('HEALTH_SELECT_MISSING');
      (healthSelect.querySelector('.el-input__wrapper, .el-select__wrapper, input') || healthSelect).click();
      await sleep(500);

      const poppers = Array.from(document.querySelectorAll('.el-popper, .el-select-dropdown')).filter(visible);
      const targetPopper = poppers.find((item) => item.textContent.includes('Y') && item.textContent.includes('N'));
      const yOption = targetPopper && Array.from(targetPopper.querySelectorAll('.el-select-dropdown__item, li, span'))
        .find((element) => element.textContent.trim() === 'Y');
      if (!yOption) throw new Error('HEALTH_Y_OPTION_MISSING');
      yOption.click();
      await sleep(500);
    }
    if (healthInput.value.trim() !== 'Y') {
      throw new Error('HEALTH_Y_NOT_APPLIED:' + healthInput.value);
    }
    logs.push('건강보험(전략): Y');

    const searchButton = Array.from(document.querySelectorAll('button, .el-button'))
      .find((button) => button.textContent.trim() === '조회');
    if (!searchButton) throw new Error('SEARCH_BUTTON_MISSING');
    searchButton.click();
    await sleep(3500);

    const excelButton = Array.from(document.querySelectorAll('button, .el-button'))
      .find((button) => button.textContent.includes('엑셀다운로드') || button.textContent.trim() === '엑셀');
    if (!excelButton) throw new Error('EXCEL_BUTTON_MISSING');
    excelButton.click();
    await sleep(1200);

    const popupButtons = Array.from(document.querySelectorAll('.el-message-box button, .vfm__content button, .el-dialog button'));
    const downloadButton = popupButtons.find((button) => {
      const text = button.textContent.trim().toLowerCase();
      return text.includes('download') || text.includes('다운로드') || text.includes('확인');
    });
    if (!downloadButton) throw new Error('DOWNLOAD_CONFIRM_BUTTON_MISSING');
    downloadButton.click();
    await sleep(2000);

    const boxButton = Array.from(document.querySelectorAll('button, .el-button, a, span'))
      .find((element) => element.textContent.includes('다운로드함') || element.textContent.includes('다운로드 함'));
    if (!boxButton) throw new Error('DOWNLOAD_BOX_BUTTON_MISSING');
    boxButton.click();
    await sleep(1500);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const link = Array.from(document.querySelectorAll('a, button, span'))
        .find((element) => element.textContent.trim() === '다운로드' && !element.textContent.includes('다운로드함'));
      if (link) {
        link.click();
        logs.push('다운로드 링크 클릭: ' + attempt + '회차');
        return JSON.stringify({ status: 'ALL_STEPS_COMPLETED_SUCCESS', range: expected, logs });
      }
      await sleep(2500);
      const refreshButton = Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent.trim() === '조회' && button.closest('.qs-popup, .qs-notification-popup, .modal-container'));
      if (refreshButton) refreshButton.click();
      await sleep(1000);
    }
    throw new Error('DOWNLOAD_LINK_TIMEOUT');
  }
  `;
}

function createDownloadPlan(now = new Date()) {
  const dateRange = seoulMonthToDate(now);
  return {
    target: {
      origin: TARGET_ORIGIN,
      path: TARGET_PATH,
      title: TARGET_TITLE
    },
    dateRange,
    evaluateFunction: buildPageAutomationScript(dateRange)
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(createDownloadPlan())}\n`);
}

module.exports = { buildPageAutomationScript, createDownloadPlan };
