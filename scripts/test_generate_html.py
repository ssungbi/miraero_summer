import json
import tempfile
import unittest
from datetime import date
from importlib import util
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("3_generate_html.py")
SPEC = util.spec_from_file_location("miraero_generate", MODULE_PATH)
GENERATE = util.module_from_spec(SPEC)
SPEC.loader.exec_module(GENERATE)


class GenerateHtmlTests(unittest.TestCase):
    def test_generates_date_rows_and_escapes_agent_name(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data_path = root / "data.json"
            template_path = root / "template.html"
            output_path = root / "index.html"
            data_path.write_text(
                json.dumps([
                    {
                        "rank": 1,
                        "agent": "<홍길동>",
                        "premium_str": "1,000",
                    },
                    {
                        "rank": 13,
                        "agent": "임꺽정",
                        "premium_str": "500",
                    },
                ], ensure_ascii=False),
                encoding="utf-8",
            )
            template_path.write_text(
                "<main>{DATA_ROWS}</main><time>{CURRENT_DATE}</time>",
                encoding="utf-8",
            )

            destination = GENERATE.generate_html(
                data_path,
                template_path,
                output_path,
                date(2026, 7, 24),
            )
            content = destination.read_text(encoding="utf-8")

            self.assertIn("&lt;홍길동&gt;", content)
            self.assertNotIn("<홍길동>", content)
            self.assertIn("data-row out-of-bounds", content)
            self.assertIn("<time>07. 24</time>", content)


if __name__ == "__main__":
    unittest.main()
