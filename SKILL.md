---
name: miraero_summer
description: 미래로 써머 인포그래픽 생성 자동화 파이프라인
---

# 🌴 미래로 써머 인포그래픽 생성 자동화 (miraero_summer)

이 스킬은 웹사이트에서 최신 엑셀 데이터를 자동으로 다운로드하여 추출 및 정제하고, 사전에 세팅된 HTML 템플릿(S-Core Dream 폰트, 커트라인 그라데이션)을 통해 인포그래픽을 렌더링한 후, 최종적으로 고해상도(9:16 비율) PNG 파일로 캡처해내는 End-to-End 파이프라인입니다.

## 🚀 사용 목적
- 매일 혹은 특정 주기(Cron job 등)마다 변동되는 실적 데이터를 기반으로 최신 랭킹 인포그래픽을 자동 생성하기 위함입니다.
- 1위~12위까지는 에메랄드 그라데이션 커트라인 컷, 13위~20위는 톤 다운 처리되어 자동 렌더링됩니다.

## 📁 디렉토리 구조
```
miraero_summer/
├── SKILL.md                  # 스킬 명세서 (현재 파일)
├── run_pipeline.ps1          # 종합 파이프라인 실행 스크립트
├── package.json              # Node.js 의존성
├── requirements.txt          # Python 의존성
├── scripts/
│   ├── 1_download.js         # 웹 브라우저 제어 및 엑셀 다운로드 (Chrome DevTools MCP)
│   ├── 2_extract.py          # 엑셀 데이터 추출, 필터링, 정렬, JSON 저장 (Pandas)
│   ├── 3_generate_html.py    # 데이터 템플릿 주입 및 HTML 렌더링
│   └── 4_capture.js          # Puppeteer 기반 HTML -> PNG 캡처
└── resources/
    ├── index_template.html   # 인포그래픽 HTML 템플릿
    └── banner.png            # 상단 배너 이미지
```

## ⚙️ 사전 요구사항
1. Node.js 및 npm 설치
2. Python (3.x) 및 pip 설치
3. 크롬 브라우저 설치 (UI 제어 및 다운로드 용도)

## ▶️ 실행 방법

터미널이나 cron job 환경에서 아래의 PowerShell 스크립트를 실행하면 전체 1~5단계 과정이 자동으로 수행됩니다.

```powershell
.\run_pipeline.ps1
```

## 🛠 수정 및 유지보수 가이드
- **디자인/폰트 수정**: `resources/index_template.html` 을 수정하십시오.
- **예외 대상자 추가**: `scripts/2_extract.py` 내 `exclude_names` 배열을 수정하십시오.
- **커트라인 순위 변동**: `scripts/3_generate_html.py` 내의 `if rank <= 12:` 로직을 수정하십시오.
