import os
import glob
import pandas as pd
import json

def get_latest_excel(download_dir):
    list_of_files = glob.glob(os.path.join(download_dir, '*.xlsx'))
    if not list_of_files:
        raise FileNotFoundError("엑셀 파일을 찾을 수 없습니다.")
    latest_file = max(list_of_files, key=os.path.getctime)
    return latest_file

def process_data(file_path):
    print(f"[{file_path}] 파일을 읽어 데이터를 추출합니다...")
    # 실제 엑셀 양식에 따라 header row index를 지정해야 할 수 있음. (보통 0 또는 1)
    df = pd.read_excel(file_path)

    # 컬럼명이 정확히 일치하지 않을 수 있으므로 포함 여부로 찾기
    col_name = next((c for c in df.columns if '모집자명' in str(c)), None)
    col_status = next((c for c in df.columns if '계약상태' in str(c)), None)
    col_premium = next((c for c in df.columns if '보험료' in str(c)), None)

    if not all([col_name, col_status, col_premium]):
        print(f"발견된 컬럼: {df.columns}")
        raise ValueError("필수 컬럼(모집자명, 계약상태, 보험료)을 찾을 수 없습니다.")

    # 1. 계약상태가 '정상'인 것만 필터링
    df_normal = df[df[col_status].astype(str).str.contains('정상')]

    # 2. 숫자(보험료) 형변환 방어 로직
    df_normal.loc[:, col_premium] = pd.to_numeric(
        df_normal[col_premium].astype(str).str.replace(',', ''), errors='coerce'
    ).fillna(0)

    # 3. 특정 모집자 제외
    exclude_names = ['한만희', '박지수', '박성빈', '김지훈', '서태환', '권우원']
    df_filtered = df_normal[~df_normal[col_name].isin(exclude_names)]

    # 4. 모집자별 합계 구하기
    grouped = df_filtered.groupby(col_name)[col_premium].sum().reset_index()

    # 5. 합계 높은 순으로 정렬
    grouped = grouped.sort_values(by=col_premium, ascending=False)

    # 6. 상위 20위까지만 커트
    top_20 = grouped.head(20)

    # 결과 리스트 구성
    results = []
    rank = 1
    for _, row in top_20.iterrows():
        agent = row[col_name]
        amount = int(row[col_premium])
        amount_str = f"{amount:,}" # 1,000단위 쉼표
        results.append({
            "rank": rank,
            "agent": agent,
            "premium_str": amount_str,
            "premium_raw": amount
        })
        rank += 1
        
    return results

if __name__ == "__main__":
    download_dir = os.path.expanduser('~\\Downloads')
    
    try:
        latest_file = get_latest_excel(download_dir)
        data = process_data(latest_file)
        
        output_file = os.path.join(os.path.dirname(__file__), 'data.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        print(f"데이터 추출 완료! 결과가 {output_file} 에 저장되었습니다.")
        
    except Exception as e:
        print(f"에러 발생: {e}")
        import sys
        sys.exit(1)
