import unittest
from app.rag.conversation import BoundedConversationContext,ConversationQueryResolver,validate_summary

class ConversationTests(unittest.TestCase):
 def test_standalone_skips_rewrite(self):self.assertEqual(ConversationQueryResolver().resolve("What is the balance?",[]).strategy,"STANDALONE")
 def test_followup_resolves_from_prior_user_question(self):
  r=ConversationQueryResolver().resolve("How was that calculated?",[{"role":"USER","content":"What is the invoice net payable?"}]);self.assertTrue(r.was_follow_up);self.assertIn("invoice net payable",r.question)
 def test_topic_switch_not_rewritten(self):self.assertFalse(ConversationQueryResolver().resolve("What is the inspection risk rating?",[{"role":"USER","content":"invoice"}]).was_follow_up)
 def test_history_bounded(self):self.assertEqual(len(BoundedConversationContext(max_messages=2).select([{"sequence_number":i,"role":"USER","content":"x"} for i in range(5)])),2)
 def test_summary_rejects_unknown_document(self):self.assertIsNone(validate_summary({"summary_text":"x","covered_through_sequence":2,"facts":[{"citation_ids":["c"],"citations":[{"document_id":"other"}]}]},{"allowed"}))
 def test_summary_requires_citations(self):self.assertIsNone(validate_summary({"summary_text":"x","covered_through_sequence":2,"facts":[{}]},{"allowed"}))

if __name__=="__main__":unittest.main()
