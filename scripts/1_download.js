'use strict';

const {
  TARGET_ORIGIN,
  TARGET_PATH,
  TARGET_TITLE,
  selectFreshDownloadRow,
  seoulMonthToDate
} = require('./download_helpers');

function buildPageAutomationScript(dateRange) {
  return `
  async () => {
    const expected = ${JSON.stringify(dateRange)};
    ${selectFreshDownloadRow.toString()}
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const logs = [];
    const visible = (element) => Boolean(element && element.getClientRects().length);
    const compact = (value) => (value || '').replace(/\\s+/g, ' ').trim();
    const monthOrdinal = (year, month) => (year * 12) + month - 1;
    const seoulTimestamp = (date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        calendar: 'gregory',
        numberingSystem: 'latn',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(date);
      const valueOf = (type) => parts.find((part) => part.type === type)?.value;
      return valueOf('year') + '-' + valueOf('month') + '-' + valueOf('day') +
        ' ' + valueOf('hour') + ':' + valueOf('minute') + ':' + valueOf('second');
    };

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

    function visibleHistoryDialogs() {
      return Array.from(document.querySelectorAll('.modal-container'))
        .filter(visible)
        .filter((dialog) => (
          compact(dialog.textContent).includes('나의 엑셀 다운로드 및 파기 이력')
        ));
    }

    function requireSingleHistoryDialog() {
      const dialogs = visibleHistoryDialogs();
      if (dialogs.length !== 1) throw new Error('DOWNLOAD_HISTORY_DIALOG_AMBIGUOUS_OR_MISSING');
      return dialogs[0];
    }

    function parseHistoryRows(dialog) {
      return Array.from(dialog.querySelectorAll(
        '.el-table__body-wrapper tbody tr.el-table__row'
      )).filter(visible).map((row) => {
        const valueFor = (controlTitle) => {
          const cell = row.querySelector(
            '.qs-list__data-wrap[control-title="' + controlTitle + '"]'
          );
          const value = cell?.querySelector('.qs-list__cell-control');
          return compact(value?.getAttribute('title') || value?.textContent || '');
        };
        const screenName = valueFor('SYM_APLY_SCRN');
        const fileName = valueFor('SYM_EXCEL_DOWNLOAD_FILE_NAME');
        const status = valueFor('SYM_REQ_STAT');
        const requestTime = valueFor('SYM_REQ_DT');
        const actionCell = row.querySelector(
          '.qs-list__data-wrap[control-title="SYM_EXCEL_BUTTON_DOWNLOAD"]'
        );
        const action = Array.from(actionCell?.querySelectorAll('a, button') ?? [])
          .filter(visible)
          .find((element) => compact(element.textContent) === '다운로드');
        const hrefElement = Array.from(actionCell?.querySelectorAll('a[href]') ?? [])
          .find((element) => (
            element.href.includes('/api/file/downloadFileHistory')
          ));
        return {
          element: row,
          screenName,
          fileName,
          status,
          requestTime,
          actionText: action ? '다운로드' : '',
          action,
          href: hrefElement?.href ?? ''
        };
      });
    }

    function findHistoryBoxControl() {
      const wrappers = Array.from(document.querySelectorAll(
        'div.qs-button[control-title], div.qs-form-button[control-title]'
      )).filter(visible).filter((wrapper) => (
        !wrapper.closest('.modal-container') &&
        (
          compact(
            (wrapper.getAttribute('control-title') || '') + ' ' + wrapper.textContent
          ).replace(/\\s+/g, '').includes('다운로드함') ||
          wrapper.getAttribute('control-title') === 'SYM_OPEN_DWLD_POP'
        )
      ));
      if (wrappers.length === 1) {
        return wrappers[0].querySelector('button, a') || wrappers[0];
      }

      const buttons = Array.from(document.querySelectorAll('button, a'))
        .filter(visible)
        .filter((element) => (
          !element.closest('.modal-container') &&
          compact(element.textContent).replace(/\\s+/g, '') === '다운로드함'
        ));
      if (buttons.length !== 1) throw new Error('DOWNLOAD_BOX_BUTTON_AMBIGUOUS_OR_MISSING');
      return buttons[0];
    }

    async function openHistoryDialog() {
      if (visibleHistoryDialogs().length === 0) {
        findHistoryBoxControl().click();
        await sleep(1200);
      }
      return requireSingleHistoryDialog();
    }

    async function closeHistoryDialog() {
      const dialog = requireSingleHistoryDialog();
      const closeButton = dialog.querySelector('.qs-popup__button-close');
      if (!closeButton) throw new Error('DOWNLOAD_HISTORY_CLOSE_BUTTON_MISSING');
      closeButton.click();
      await sleep(500);
      if (visibleHistoryDialogs().length !== 0) {
        throw new Error('DOWNLOAD_HISTORY_CLOSE_FAILED');
      }
    }

    const historyBefore = await openHistoryDialog();
    const initialRefreshButtons = Array.from(historyBefore.querySelectorAll('button'))
      .filter(visible)
      .filter((button) => compact(button.textContent) === '조회');
    if (initialRefreshButtons.length !== 1) {
      throw new Error('DOWNLOAD_HISTORY_INITIAL_REFRESH_AMBIGUOUS_OR_MISSING');
    }
    initialRefreshButtons[0].click();
    await sleep(3500);
    const previousRows = parseHistoryRows(requireSingleHistoryDialog());
    const previous = {
      fileNames: previousRows.map((row) => row.fileName).filter(Boolean),
      hrefs: previousRows.map((row) => row.href).filter(Boolean)
    };
    logs.push('기존 다운로드 이력: ' + previous.fileNames.length + '건');
    await closeHistoryDialog();

    const searchButton = Array.from(document.querySelectorAll('button, .el-button'))
      .filter(visible)
      .filter((button) => !button.closest('.modal-container'))
      .filter((button) => compact(button.textContent) === '조회');
    if (searchButton.length !== 1) throw new Error('SEARCH_BUTTON_AMBIGUOUS_OR_MISSING');
    searchButton[0].click();
    await sleep(3500);

    const excelWrappers = Array.from(document.querySelectorAll(
      'div.qs-button[control-title], div.qs-form-button[control-title]'
    )).filter(visible).filter((wrapper) => (
      !wrapper.closest('.modal-container') &&
      (
        compact(
          (wrapper.getAttribute('control-title') || '') + ' ' + wrapper.textContent
        ).replace(/\\s+/g, '').includes('엑셀다운로드') ||
        wrapper.getAttribute('control-title') === 'SYM_DOWN_EXCEL'
      )
    ));
    if (excelWrappers.length !== 1) throw new Error('EXCEL_BUTTON_AMBIGUOUS_OR_MISSING');
    const excelButton = excelWrappers[0].querySelector('button, a') || excelWrappers[0];
    const requestNotBefore = seoulTimestamp(new Date(Date.now() - 5000));
    excelButton.click();
    await sleep(1200);

    const excelDialogs = Array.from(document.querySelectorAll('.modal-container'))
      .filter(visible)
      .filter((dialog) => (
        compact(dialog.querySelector('.qs-popup__title')?.textContent) === 'Excel Download'
      ));
    if (excelDialogs.length !== 1) throw new Error('EXCEL_DIALOG_AMBIGUOUS_OR_MISSING');
    const confirmButtons = Array.from(excelDialogs[0].querySelectorAll(
      '.qs-button__wrap--bottom button, .qs-popup__footer button'
    )).filter(visible).filter((button) => (
      ['Download', '다운로드'].includes(compact(button.textContent))
    ));
    if (confirmButtons.length !== 1) {
      throw new Error('DOWNLOAD_CONFIRM_BUTTON_AMBIGUOUS_OR_MISSING');
    }
    confirmButtons[0].click();
    await sleep(2000);

    let history = await openHistoryDialog();
    for (let attempt = 1; attempt <= 120; attempt += 1) {
      const refreshButtons = Array.from(history.querySelectorAll('button'))
        .filter(visible)
        .filter((button) => compact(button.textContent) === '조회');
      if (refreshButtons.length !== 1) {
        throw new Error('DOWNLOAD_HISTORY_REFRESH_AMBIGUOUS_OR_MISSING');
      }
      refreshButtons[0].click();
      await sleep(3500);

      history = requireSingleHistoryDialog();
      const rows = parseHistoryRows(history);
      const selected = selectFreshDownloadRow(
        rows,
        previous,
        expected.endDate.replace(/-/g, ''),
        requestNotBefore
      );
      if (selected?.ready) {
        selected.row.action.click();
        logs.push('신규 이력 다운로드: ' + selected.row.fileName + ' (' + attempt + '회차)');
        return JSON.stringify({
          status: 'ALL_STEPS_COMPLETED_SUCCESS',
          range: expected,
          fileName: selected.row.fileName,
          requestTime: selected.row.requestTime,
          downloadHref: selected.row.href,
          logs
        });
      }
      await sleep(1500);
    }
    throw new Error('FRESH_DOWNLOAD_ROW_TIMEOUT');
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
