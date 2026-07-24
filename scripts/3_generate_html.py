import argparse
import html
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


BASE_DIR = Path(__file__).resolve().parent.parent


def render_rows(data):
    rows = []
    for item in data:
        rank = int(item["rank"])
        agent = html.escape(str(item["agent"]), quote=True)
        premium = html.escape(str(item["premium_str"]), quote=True)

        if rank <= 12:
            alpha = max(0.0, 0.22 - (rank - 1) * 0.02)
            row_class = "data-row"
            style = f' style="background-color: rgba(5, 150, 105, {alpha:.2f});"'
        else:
            row_class = "data-row out-of-bounds"
            style = ""

        rows.append(
            f"""
          <tr class="{row_class}"{style}>
            <td><span class="rank-num">{rank}</span></td>
            <td><span class="agent-name">{agent}</span></td>
            <td><span class="premium-amount">{premium}</span><span class="currency-symbol">원</span></td>
          </tr>"""
        )
    return "".join(rows)


def generate_html(data_path, template_path, output_path, as_of_date=None):
    source = Path(data_path).expanduser().resolve(strict=True)
    template_source = Path(template_path).expanduser().resolve(strict=True)
    destination = Path(output_path).expanduser().resolve()

    data = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("data.json 최상위 값은 배열이어야 합니다.")

    template = template_source.read_text(encoding="utf-8")
    if "{DATA_ROWS}" not in template or "{CURRENT_DATE}" not in template:
        raise ValueError("HTML 템플릿 치환 토큰이 누락되었습니다.")

    effective_date = as_of_date or datetime.now(ZoneInfo("Asia/Seoul")).date()
    final_html = template.replace("{DATA_ROWS}", render_rows(data))
    final_html = final_html.replace("{CURRENT_DATE}", effective_date.strftime("%m. %d"))

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(final_html, encoding="utf-8")
    return destination


def parse_args():
    parser = argparse.ArgumentParser(
        description="추출된 랭킹 JSON을 미래로 써머 HTML에 렌더링합니다."
    )
    parser.add_argument(
        "--input",
        default=str(BASE_DIR / "scripts" / "data.json"),
        help="검증된 랭킹 data.json 경로",
    )
    parser.add_argument(
        "--template",
        default=str(BASE_DIR / "resources" / "index_template.html"),
        help="HTML 템플릿 경로",
    )
    parser.add_argument(
        "--output",
        default=str(BASE_DIR / "index.html"),
        help="생성할 HTML 경로",
    )
    parser.add_argument(
        "--date",
        help="기준일(YYYY-MM-DD). 생략 시 Asia/Seoul 당일",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    as_of_date = datetime.strptime(args.date, "%Y-%m-%d").date() if args.date else None
    destination = generate_html(
        args.input,
        args.template,
        args.output,
        as_of_date,
    )
    print(
        json.dumps(
            {
                "status": "HTML_GENERATED",
                "output": str(destination),
                "date": (as_of_date or datetime.now(ZoneInfo("Asia/Seoul")).date()).isoformat(),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
