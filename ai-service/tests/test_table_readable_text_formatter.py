import unittest

from app.content_layout.table_readable_text_formatter import TableReadableTextFormatter


class TableReadableTextFormatterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.formatter = TableReadableTextFormatter()

    def test_standard_rectangular_table(self) -> None:
        actual = self.formatter.format_table([
            ["Name", "Amount", "Status"],
            ["Item A", "100", "Paid"],
            ["Item B", "200", "Pending"],
        ])
        self.assertEqual(
            actual,
            "Name | Amount | Status\nItem A | 100 | Paid\nItem B | 200 | Pending",
        )

    def test_current_mixed_content_fixture(self) -> None:
        actual = self.formatter.format_table([
            ["Step", "Block Type", "Unique Test Token", "Expected Position"],
            ["1", "HEADING", "HEADING_BLOCK_01", "First"],
            ["2", "TEXT", "PARAGRAPH_BEFORE_IMAGE", "Second"],
            ["3", "IMAGE", "IMAGE_BLOCK_01", "Third"],
            ["4", "TABLE", "TABLE_BLOCK_01", "Fourth"],
            ["5", "TEXT", "PARAGRAPH_AFTER_TABLE", "Fifth"],
        ])
        self.assertIn("Step | Block Type | Unique Test Token | Expected Position", actual)
        self.assertIn("1 | HEADING | HEADING_BLOCK_01 | First", actual)
        self.assertIn("5 | TEXT | PARAGRAPH_AFTER_TABLE | Fifth", actual)

    def test_null_and_non_string_cells(self) -> None:
        actual = self.formatter.format_table([
            ["Missing", "Count", "Enabled"], [None, 3, True],
        ])
        self.assertEqual(actual, "Missing | Count | Enabled\n | 3 | true")
        self.assertNotIn("None", actual)

    def test_multiline_cells_use_safe_separator(self) -> None:
        actual = self.formatter.format_table([
            ["Address"], [" Address line 1\r\nAddress line 2 "],
        ])
        self.assertEqual(actual, "Address\nAddress line 1 / Address line 2")

    def test_uneven_rows_are_padded_and_extra_cells_get_headers(self) -> None:
        actual = self.formatter.format_table([
            ["A", "B"], ["one"], ["two", "three", "four"],
        ])
        self.assertEqual(actual, "A | B | column_3\none |  | \ntwo | three | four")

    def test_pipe_characters_are_backslash_escaped(self) -> None:
        actual = self.formatter.format_table([["Expression"], ["A | B"]])
        self.assertEqual(actual, "Expression\nA \\| B")

    def test_empty_or_invalid_table_returns_empty_string(self) -> None:
        self.assertEqual(self.formatter.format_table([]), "")
        self.assertEqual(self.formatter.format_table(None), "")
        self.assertEqual(self.formatter.format_table(["not-a-row"]), "")

    def test_repeated_header_row_is_not_duplicated(self) -> None:
        actual = self.formatter.format_table([["A", "B"], ["1", "2"], ["A", "B"]])
        self.assertEqual(actual, "A | B\n1 | 2")


if __name__ == "__main__":
    unittest.main()
