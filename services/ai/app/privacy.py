"""
Privacy and PII Minimization Utility (AGENTS.md §39, task AI-04).

AI is an informer, not an authority.
In strict compliance with DoSJE data protection and Netram architecture:
- Zero unredacted PII (names, phone numbers, Aadhaar numbers, email addresses)
- Zero unhashed biometric data
- Data minimization and sanitization applied prior to logging or returning results
"""

import re
from typing import Any

# Regex patterns for common Indian identifiers & PII
AADHAAR_PATTERN = re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b")
PHONE_PATTERN = re.compile(r"\b(\+91[- ]?)?[6-9]\d{9}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")


def sanitize_text(text: str) -> str:
    """Masks potential PII strings from log entries, explanations, and prompts."""
    if not text:
        return text
    redacted = AADHAAR_PATTERN.sub("[REDACTED_AADHAAR]", text)
    redacted = PHONE_PATTERN.sub("[REDACTED_PHONE]", redacted)
    redacted = EMAIL_PATTERN.sub("[REDACTED_EMAIL]", redacted)
    return redacted


def sanitize_payload(obj: Any) -> Any:
    """Recursively traverses dictionaries/lists and redacts sensitive PII fields."""
    if isinstance(obj, dict):
        sanitized = {}
        for k, v in obj.items():
            lower_k = k.lower()
            if any(term in lower_k for term in ["biometric", "fingerprint", "face_vector", "iris"]):
                sanitized[k] = "[REDACTED_RAW_BIOMETRIC]"
            elif any(term in lower_k for term in ["password", "secret", "token"]):
                sanitized[k] = "[REDACTED_SECRET]"
            elif isinstance(v, str):
                sanitized[k] = sanitize_text(v)
            else:
                sanitized[k] = sanitize_payload(v)
        return sanitized
    elif isinstance(obj, list):
        return [sanitize_payload(item) for item in obj]
    elif isinstance(obj, str):
        return sanitize_text(obj)
    return obj
