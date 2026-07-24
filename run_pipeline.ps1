param(
    [Parameter(Mandatory = $true)]
    [string]$ExcelPath,

    [string]$AsOfDate = (Get-Date -Format "yyyy-MM-dd")
)

$ErrorActionPreference = "Stop"
$BaseDir = $PSScriptRoot
$ResolvedExcelPath = (Resolve-Path -LiteralPath $ExcelPath).Path
$DataPath = Join-Path $BaseDir "scripts\data.json"
$HtmlPath = Join-Path $BaseDir "index.html"
$PngPath = Join-Path $BaseDir "final_infographic.png"

if ([System.IO.Path]::GetExtension($ResolvedExcelPath).ToLowerInvariant() -ne ".xlsx") {
    throw "ExcelPath는 검증된 .xlsx 파일이어야 합니다."
}

Write-Host "[1/3] 검증된 엑셀 절대경로에서 데이터 추출"
python (Join-Path $BaseDir "scripts\2_extract.py") `
    --input $ResolvedExcelPath `
    --output $DataPath

Write-Host "[2/3] HTML 생성"
python (Join-Path $BaseDir "scripts\3_generate_html.py") `
    --input $DataPath `
    --template (Join-Path $BaseDir "resources\index_template.html") `
    --output $HtmlPath `
    --date $AsOfDate

Write-Host "[3/3] PNG 캡처"
node (Join-Path $BaseDir "scripts\4_capture.js") `
    --input $HtmlPath `
    --output $PngPath

$Png = Get-Item -LiteralPath $PngPath
if ($Png.Length -le 0) {
    throw "생성된 PNG가 비어 있습니다."
}

Write-Host "완료: $($Png.FullName) ($($Png.Length) bytes)"
