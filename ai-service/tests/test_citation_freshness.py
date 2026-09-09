import unittest

from app.rag.citation_freshness import CitationFreshnessState, current_trusted_citations


class CitationFreshnessTests(unittest.TestCase):
    def test_only_current_non_stale_citations_reach_trusted_summary_input(self):
        current, states = current_trusted_citations([
            {"citation_id": "current", "freshness_state": "CURRENT", "stale": False},
            {"citation_id": "changed", "freshness_state": "STALE_FINGERPRINT", "stale": True},
            {"citation_id": "missing"},
        ])
        self.assertEqual([item["citation_id"] for item in current], ["current"])
        self.assertEqual(states[CitationFreshnessState.CURRENT], 1)
        self.assertEqual(states[CitationFreshnessState.STALE_FINGERPRINT], 1)
        self.assertEqual(states[CitationFreshnessState.UNKNOWN_EVIDENCE], 1)

    def test_every_non_current_state_is_excluded(self):
        citations = [{"citation_id": state, "freshness_state": state, "stale": False}
                     for state in CitationFreshnessState if state is not CitationFreshnessState.CURRENT]
        current, _ = current_trusted_citations(citations)
        self.assertEqual(current, [])


if __name__ == "__main__":
    unittest.main()
