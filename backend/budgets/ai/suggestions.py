"""Canned example questions shown in the assistant's empty state.

Kept next to the tools and prompts so the suggested prompts stay in step with
what the assistant can actually answer. Served to the frontend so the list
lives in exactly one place.
"""

ASSISTANT_SUGGESTIONS: list[str] = [
    "Show favorable variances",
    "Group this by department and show only high-risk items",
    "Are there any data-quality issues?",
    "How do you calculate high risk?",
]
