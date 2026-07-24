import json
import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook

from importlib import util


MODULE_PATH = Path(__file__).with_name("2_extract.py")
SPEC = util.spec_from_file_location("miraero_extract", MODULE_PATH)
EXTRACT = util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXTRACT)


class ExtractTests(unittest.TestCase):
    def make_workbook(self, rows):
        temporary = tempfile.TemporaryDirectory()
        path = Path(temporary.name) / "input.xlsx"
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.append(["신계약 전체"])
        worksheet.append([])
        worksheet.append(["모집자명", "계약상태", "보험료"])
        for row in rows:
            worksheet.append(row)
        workbook.save(path)
        workbook.close()
        return temporary, path

    def test_exact_status_exclusions_aggregation_and_ranking(self):
        temporary, path = self.make_workbook([
            ["가나다", "정상", "1,000"],
            ["가나다", "정상", 2500],
            ["라마바", "비정상", 999999],
            ["박성빈", "정상", 800000],
            ["사아자", "정상", None],
        ])
        self.addCleanup(temporary.cleanup)

        result = EXTRACT.process_data(path)

        self.assertEqual(result, [
            {
                "rank": 1,
                "agent": "가나다",
                "premium_str": "3,500",
                "premium_raw": 3500,
            },
            {
                "rank": 2,
                "agent": "사아자",
                "premium_str": "0",
                "premium_raw": 0,
            },
        ])

    def test_write_data_is_utf8_json(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "nested" / "data.json"
            destination = EXTRACT.write_data(
                [{"rank": 1, "agent": "홍길동", "premium_raw": 10}],
                output,
            )
            self.assertEqual(destination, output.resolve())
            self.assertEqual(
                json.loads(output.read_text(encoding="utf-8"))[0]["agent"],
                "홍길동",
            )


if __name__ == "__main__":
    unittest.main()
