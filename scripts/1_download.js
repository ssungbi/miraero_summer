const { spawn } = require('child_process');

const child = spawn('npx.cmd', ['-y', 'chrome-devtools-mcp@latest', '--auto-connect'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: true
});

let messageId = 1;
const pendingRequests = new Map();
let buffer = '';

child.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pendingRequests.has(msg.id)) {
        pendingRequests.get(msg.id)(msg);
        pendingRequests.delete(msg.id);
      }
    } catch (e) {}
  }
});

function sendRequest(method, params = {}) {
  return new Promise((resolve) => {
    const id = messageId++;
    const req = { jsonrpc: '2.0', id, method, params };
    pendingRequests.set(id, resolve);
    child.stdin.write(JSON.stringify(req) + '\n');
  });
}

async function run() {
  await new Promise(r => setTimeout(r, 2000));
  await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'final-v2-runner', version: '1.0.0' }
  });
  await sendRequest('notifications/initialized', {});

  const pagesRes = await sendRequest('tools/call', { name: 'list_pages', arguments: {} });
  let targetPageId = 9;
  const content = pagesRes.result?.content || [];
  for (let item of content) {
    if (item.type === 'text') {
      const lines = (item.text || '').split('\n');
      for (let l of lines) {
        if (l.includes('openga.calsplatz.com') || l.includes('신계약(조직)')) {
          const match = l.match(/^(\d+):/);
          if (match) targetPageId = parseInt(match[1], 10);
        }
      }
    }
  }

  await sendRequest('tools/call', {
    name: 'select_page',
    arguments: { pageId: targetPageId, bringToFront: true }
  });

  const finalScriptV2 = `
  async () => {
    console.log('🚀 [Antigravity Agent] 신계약(조직) 1~5단계 정밀 실행 및 다운로드 링크 클릭');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const logs = [];

    // 1단계: 계약일 (2026-07-01 ~ 오늘날짜 2026-07-24) 달력 선택
    const datePicker = document.querySelector('.el-date-editor--daterange, .qs-datepicker .el-date-editor');
    if (datePicker) {
      datePicker.click();
      await sleep(500);

      const cells = Array.from(document.querySelectorAll('.el-date-table td.available, .el-date-range-picker td.available'));
      const july1 = cells.find(c => c.textContent.trim() === '1');
      const july24 = cells.find(c => c.textContent.trim() === '24');

      if (july1 && july24) {
        july1.click();
        await sleep(300);
        july24.click();
        await sleep(300);
        const inputs = datePicker.querySelectorAll('input');
        logs.push(\`1단계 성공: 계약일 설정 완료 => 시작일=\${inputs[0]?.value}, 종료일=\${inputs[1]?.value}\`);
      }
    }
    await sleep(600);

    // 2단계: 건강보험(전략) -> Y 선택
    const healthInput = document.querySelector('input[placeholder="건강보험(전략)"]');
    if (healthInput) {
      const healthSelect = healthInput.closest('.el-select');
      const wrapper = healthSelect.querySelector('.el-input__wrapper, .el-select__wrapper, input') || healthSelect;
      wrapper.click();
      await sleep(500);

      const allPoppers = Array.from(document.querySelectorAll('.el-popper, .el-select-dropdown'));
      const targetP = allPoppers.find(p => p.textContent.includes('건강보험(전략)')) || 
                      allPoppers.find(p => p.textContent.includes('Y') && p.textContent.includes('N') && p.textContent.includes('건강보험'));

      if (targetP) {
        const yOpt = Array.from(targetP.querySelectorAll('.el-select-dropdown__item, li, span')).find(el => el.textContent.trim() === 'Y');
        if (yOpt) {
          yOpt.click();
          await sleep(300);
          logs.push(\`2단계 성공: 건강보험(전략) => \${healthInput.value}\`);
        }
      }
    }
    await sleep(800);

    // 3단계: '조회' 버튼 클릭
    const buttons = Array.from(document.querySelectorAll('button, .el-button'));
    const searchBtn = buttons.find(b => b.textContent.trim() === '조회' || b.textContent.trim().includes('조회'));
    if (searchBtn) {
      searchBtn.click();
      logs.push("3단계 성공: '조회' 버튼 클릭 완료");
    }
    await sleep(3500);

    // 4단계: '엑셀다운로드' -> 팝업 내 Download 클릭
    const excelBtn = Array.from(document.querySelectorAll('button, .el-button')).find(b => b.textContent.includes('엑셀다운로드') || b.textContent.includes('엑셀'));
    if (excelBtn) {
      excelBtn.click();
      await sleep(1200);

      const popupBtns = Array.from(document.querySelectorAll('.el-message-box button, .vfm__content button, .el-dialog button'));
      const downloadBtn = popupBtns.find(b => {
        const txt = b.textContent.trim().toLowerCase();
        return txt.includes('download') || txt.includes('다운로드') || txt.includes('확인');
      });
      if (downloadBtn) {
        downloadBtn.click();
        logs.push("4단계 성공: 엑셀다운로드 팝업 Download 클릭 완료");
      }
    }
    await sleep(2000);

    // 5단계: '다운로드함 열기' -> 다운로드 링크 클릭
    const boxBtn = Array.from(document.querySelectorAll('button, .el-button, a, span')).find(b => b.textContent.includes('다운로드함') || b.textContent.includes('다운로드 함'));
    if (boxBtn) {
      boxBtn.click();
      await sleep(1500);

      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        // Find any <a> or <button> inside the download box table that has text '다운로드'
        const allLinks = Array.from(document.querySelectorAll('a, button, span'));
        const dlLink = allLinks.find(el => el.textContent.trim() === '다운로드' && !el.textContent.includes('다운로드함'));

        if (dlLink) {
          dlLink.click();
          logs.push(\`🎉 5단계 성공: \${attempts + 1}회 시도 만에 다운로드 링크 클릭 완료!\`);
          return JSON.stringify({ status: "ALL_STEPS_COMPLETED_SUCCESS", logs });
        }

        attempts++;
        logs.push(\`5단계 대기 (\${attempts}/\${maxAttempts}): 2.5초 후 우측 상단 '조회' 클릭...\`);
        await sleep(2500);

        const popupHeaderBtns = Array.from(document.querySelectorAll('button'));
        let refreshBtn = popupHeaderBtns.find(b => b.textContent.trim() === '조회' && b.closest('.qs-popup, .qs-notification-popup, .modal-container'));
        if (refreshBtn) refreshBtn.click();
        await sleep(1000);
      }
    }

    return JSON.stringify({ status: "ALL_STEPS_COMPLETED_TIMEOUT", logs });
  }
  `;

  console.log('Executing final v2 automation script...');
  const evalRes = await sendRequest('tools/call', {
    name: 'evaluate_script',
    arguments: { function: finalScriptV2 }
  });

  console.log('Final V2 Execution Result:\n', JSON.stringify(evalRes, null, 2));

  setTimeout(() => {
    child.kill();
    process.exit(0);
  }, 2000);
}

run().catch(err => {
  console.error(err);
  child.kill();
});
