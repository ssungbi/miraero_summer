# miraero_summer_skill 파이프라인 종합 실행 스크립트
$ErrorActionPreference = "Stop"
$BaseDir = $PSScriptRoot

Write-Host "=========================================="
Write-Host "미래로 써머 인포그래픽 자동화 파이프라인 시작"
Write-Host "=========================================="

# 1. 패키지 설치
Write-Host "[1/6] 의존성 패키지 확인 및 설치 중..."
cd $BaseDir
npm install --silent
pip install -r requirements.txt -q

# 2. 엑셀 다운로드 (웹 자동화)
Write-Host "[2/6] 웹사이트 접속 및 최신 엑셀 데이터 다운로드 중 (약 10~20초 소요)..."
node scripts\1_download.js

# 3. 데이터 추출
Write-Host "[3/6] 다운로드된 엑셀에서 데이터 추출 및 정제 중..."
python scripts\2_extract.py

# 4. HTML 렌더링
Write-Host "[4/6] HTML 템플릿에 데이터 주입하여 렌더링 중..."
python scripts\3_generate_html.py

# 5. PNG 캡처
Write-Host "[5/6] Puppeteer를 활용한 고해상도 PNG 인포그래픽 캡처 중..."
node scripts\4_capture.js

Write-Host "[6/6] 모든 파이프라인이 완료되었습니다!"
Write-Host "최종 파일 경로: $BaseDir\final_infographic.png"
Write-Host "=========================================="
