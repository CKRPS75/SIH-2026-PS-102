from __future__ import annotations

import unittest

from app.services.flash_summarization_service import FlashSummarizationService


class FlashSummarizationServiceTest(unittest.TestCase):
    def test_disabled_without_api_key(self) -> None:
        service = FlashSummarizationService(api_key="", model="gemini-test")

        result = service.summarize(
            flag="YELLOW",
            rating=4.5,
            comment="Technical fallback",
            reason_description="Technical fallback reason",
            reasons=["The requested amount is higher than similar past projects"],
            component_scores={"financial": 45.0},
        )

        self.assertIsNone(result)

    def test_parse_json_response_from_gemini_payload(self) -> None:
        service = FlashSummarizationService(api_key="", model="gemini-test")

        parsed = service._parse_response(
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": '{"comment":"Needs review.","reason_description":"The amount is higher than similar local work."}'
                                }
                            ]
                        }
                    }
                ]
            }
        )

        self.assertEqual(parsed["comment"], "Needs review.")
        self.assertEqual(parsed["reason_description"], "The amount is higher than similar local work.")


if __name__ == "__main__":
    unittest.main()
