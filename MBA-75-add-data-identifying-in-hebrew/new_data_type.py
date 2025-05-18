import re
from textblob import TextBlob  # Lightweight NLP

# Precompile patterns for performance
patterns = {
    "OTP": re.compile(r"(?i)(?:code|otp|passcode|one-time|קוד|אימות|סיסמה)[^\d]{0,10}(\d{5,6})"),
    "CREDIT_CARD": re.compile(r"\b(?:\d{4}[- ]?){3}\d{4}\b"),
    "PHONE_NUMBER": re.compile(r"(?:(?:\+972|0)[-\s]?(?:[23489]|5[0123456789])[-\s]?\d{7})|(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})"),
    "EMAIL": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "PASSWORD": re.compile(r"(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}"),
    "ID": re.compile(r"\b\d{9}\b"),  # Israeli ID is 9 digits
    "DATE": re.compile(r"\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b"),
    "DOMAIN": re.compile(r"\b(?:https?://)?(?:www\.)?([\w\-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)"),
    "CVC": re.compile(r"(?i)(?:cvc|cvv|security code|קוד אבטחה)[^\d]{0,10}(\d{3,4})"),
}

def classify_text(text: str) -> list[tuple[str, str]]:
    detected = []
    detected_spans = [] #Track start/end of each match to avoid overlaps
    # Detection priority — earlier items are matched first
    priority_order = ["OTP", "EMAIL", "CREDIT_CARD", "CVC", "PHONE_NUMBER", "PASSWORD", "ID", "DATE", "DOMAIN"]

    for label in priority_order:
        pattern = patterns[label]
        for match in pattern.finditer(text):
            value = match.group(1) if match.groups() else match.group()
            span = match.span()

            # Skip overlapping matches
            if any(start <= span[0] < end or start < span[1] <= end for start, end in detected_spans):
                continue

            detected.append((value.strip(), label))
            detected_spans.append(span)

    # --- AI-style heuristic: Detect ambiguous sensitive numbers ---
    fallback_matches = re.findall(r"\b\d{5,12}\b", text)
    for val in fallback_matches:
        if any(val in item[0] for item in detected):
            continue  # already detected
        context_blob = TextBlob(text)
        if context_blob.words.count(val) == 0:
            continue  # Low-confidence noise, skip
        detected.append((val, "POTENTIALLY_SENSITIVE"))  # AI-style guess

    return detected

