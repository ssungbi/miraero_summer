import json
import os
from datetime import datetime

def generate_html():
    base_dir = os.path.dirname(__file__)
    json_path = os.path.join(base_dir, 'data.json')
    template_path = os.path.join(base_dir, '..', 'resources', 'index_template.html')
    output_path = os.path.join(base_dir, '..', 'index.html')

    if not os.path.exists(json_path):
        raise FileNotFoundError(f"{json_path} 를 찾을 수 없습니다.")
        
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()

    rows_html = ""
    for item in data:
        rank = item['rank']
        agent = item['agent']
        premium = item['premium_str']
        
        if rank <= 12:
            # 1~12위 그라데이션 (알파값 0.22 부터 0.0까지 서서히 감소)
            # 12단계이므로 0.22 - (rank-1)*0.02
            alpha = max(0.0, 0.22 - (rank - 1) * 0.02)
            style_str = f"background-color: rgba(5, 150, 105, {alpha:.2f});"
            rows_html += f'''
          <tr class="data-row" style="{style_str}">
            <td><span class="rank-num">{rank}</span></td>
            <td><span class="agent-name">{agent}</span></td>
            <td><span class="premium-amount">{premium}</span><span class="currency-symbol">원</span></td>
          </tr>'''
        else:
            # 13위 이하 커트라인 밖
            rows_html += f'''
          <tr class="data-row out-of-bounds">
            <td><span class="rank-num">{rank}</span></td>
            <td><span class="agent-name">{agent}</span></td>
            <td><span class="premium-amount">{premium}</span><span class="currency-symbol">원</span></td>
          </tr>'''

    # 현재 날짜 MMDD 포맷
    current_date = datetime.now().strftime("%m. %d")
    
    # 템플릿 치환
    final_html = template.replace("{DATA_ROWS}", rows_html)
    final_html = final_html.replace("{CURRENT_DATE}", current_date)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(final_html)

    print(f"HTML 렌더링 완료! {output_path}")

if __name__ == "__main__":
    generate_html()
