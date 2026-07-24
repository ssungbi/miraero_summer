---
name: miraero_summer
description: OPENGA 신계약 데이터를 검증해 미래로 써머 인포그래픽 PNG를 생성하는 fail-closed 파이프라인
---

# 미래로 써머 인포그래픽 자동화

OPENGA `신계약(조직)` 화면의 월초~당일 데이터를 내려받아 정상 계약의 모집자별 보험료 순위를 계산하고, 900×1600 PNG를 생성한다.

## 안전 원칙

- Windows Chrome DevTools MCP의 현재 `list_pages` 응답에서 대상 탭을 매번 찾는다.
- `pageId`는 MCP 세션의 임시 탭 번호다. `pageId=9` 같은 고정값이나 fallback을 사용하지 않는다.
- 대상은 URL `https://openga.calsplatz.com/mgt_newplcy`와 제목 `신계약(조직) - OPENGA`가 정확히 1개일 때만 허용한다.
- 기간은 실행 시점의 `Asia/Seoul` 기준 당월 1일~당일로 계산한다.
- 건강보험(전략)은 `Y`가 실제 적용됐는지 확인한다.
- 엑셀 확인 팝업은 제목이 `Excel Download`인 팝업 하나로 제한하고, 그 안의 정확한 `Download` 버튼만 누른다.
- 다운로드 이력은 먼저 `조회`로 새로고침해 기존 파일명·링크를 기록한다.
- 이번 요청 시각 이후의 `신계약(조직) 전체 리스트` 행 하나만 추적한다.
- 행의 상태가 `완료`, 파일명이 `신계약 전체_YYYYMMDDHHMMSS.xlsx`, 버튼이 `다운로드`일 때 그 행 안의 링크만 누른다.
- 과거 행, 첫 번째 전역 `다운로드` 버튼, 최신 파일 추정, `.crdownload`, 기존 PNG를 재사용하지 않는다.
- 새 xlsx와 PNG가 검증되지 않으면 텔레그램으로 전송하지 않는다.

## 최초 준비

```bash
npm install
python3 -m pip install -r requirements.txt
```

Linux/WSL 캡처는 `/usr/bin/google-chrome-stable` 또는 `/usr/bin/google-chrome`을 자동 사용한다. 다른 위치라면 `CHROME_PATH`를 지정한다.

## 1. 다운로드 계획 생성

```bash
node scripts/1_download.js
```

출력 JSON의 `target`, `dateRange`, `evaluateFunction`을 확인한다. 이 명령 자체는 브라우저를 조작하지 않는다.

Windows MCP에서 다음 순서로 실행한다.

1. `list_pages({})`
2. 대상 OPENGA 탭이 정확히 하나인지 검증
3. 해당 응답의 `pageId`로 `select_page`
4. Windows Downloads의 xlsx·crdownload 목록과 실행 시작 시각 기록
5. `evaluate_script({function: evaluateFunction})`
6. 반환된 `fileName`, `requestTime`, `downloadHref` 기록
7. 실행 시작 이후 생성된 동일 파일명 xlsx가 정확히 하나이고 `.crdownload`가 없는지 확인
8. 파일 크기가 0보다 크고 Excel 2007+ ZIP 구조로 열리는지 확인

Windows Chrome 144+의 자동 연결이 필요한 경우:

```powershell
npx.cmd -y chrome-devtools-mcp@latest --autoConnect
```

전역 Linux MCP의 `about:blank`를 Windows 탭으로 오인하지 않는다. `DevToolsActivePort`가 이미 활성화되어 있으면 해당 세션의 WebSocket endpoint를 재사용할 수 있다.

## 2. 검증된 xlsx 추출

반드시 이번 실행에서 검증한 절대경로를 넘긴다.

```bash
python3 scripts/2_extract.py \
  --input "/absolute/path/신계약 전체_YYYYMMDDHHMMSS.xlsx" \
  --output scripts/data.json
```

처리 규칙:

- 실제 헤더 행에서 `모집자명`, `계약상태`, `보험료`를 찾는다.
- 계약상태는 `정상`과 정확히 일치하는 행만 포함한다.
- 제외 모집자: 한만희, 박지수, 박성빈, 김지훈, 서태환, 권우원
- 모집자별 보험료 합계 내림차순, 동률은 이름 오름차순
- 상위 20명

## 3. HTML 생성

```bash
python3 scripts/3_generate_html.py \
  --input scripts/data.json \
  --template resources/index_template.html \
  --output index.html \
  --date YYYY-MM-DD
```

배너는 `resources/banner.png`를 사용한다. 기준일은 `Asia/Seoul` 당일을 넘긴다.

## 4. PNG 캡처

```bash
node scripts/4_capture.js \
  --input index.html \
  --output final_infographic.png
```

다음을 모두 확인한다.

- 실행 시작 이후 수정된 새 파일
- 크기 0보다 큼
- 이미지 크기 900×1600
- 배너 로드 성공
- 랭킹 행 1~20개

## 5. 전송

검증된 `final_infographic.png`의 절대경로만 OpenClaw `message` 도구에 넘긴다. 대상 채팅 ID는 작업 정의에서 명시된 값을 그대로 사용한다. 전송 응답의 메시지 ID를 기록한다.

다운로드·추출·렌더링·PNG 검증 중 하나라도 실패하면 전송하지 않고 정확한 실패 단계와 오류를 보고한다.
