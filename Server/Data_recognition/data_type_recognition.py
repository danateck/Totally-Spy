import re


patterns = {
    "OTP": r"(?:(?:code|otp|one-time|passcode)[^\d]{0,10}(\d{5,6})|(\d{5,6})[^\d]{0,10}(?:code|otp|one-time|passcode))"
,  #smart OTP catch -  5 or 6 digits
    "CREDIT_CARD": r"\b(?:\d{4}[- ]?){3}\d{4}\b",  # 16-digit CC, supports space or - separators
    "PHONE_NUMBER": r"\b\d{10}\b",  # Strictly 10-digit phone number
    "EMAIL": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",  # Email
    "PASSWORD": r"(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}",  # Password with special char, min 8 chars
    "ID": r"\b\d{9}\b",  # Strictly 9-digit ID
    "DATE": r"\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b",  # Date format (e.g., 25/03/2023)
    "DOMAIN": r"\b(?:https?://)?(?:www\.)?([\w\-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)", #domain, url
}

def classify_text(text: str) -> list[tuple[str, str]]:
    detected = [] #store the matches found in the text, in the form of (value, label)
    detected_spans = []  # (start, end) of already detected items. 
    #to ensure that no match overlaps with another already detected match

    # this list defines the order in which the patterns will be applied
    priority_order = ["OTP", "EMAIL", "CREDIT_CARD", "PHONE_NUMBER", "PASSWORD", "ID", "DATE", "DOMAIN"]

    for label in priority_order:
        pattern = patterns[label]
        for match in re.finditer(pattern, text): #find all matches for the current regex pattern in the text.
            value = match.group(1) if match.groups() else match.group() #returns the first capturing group from the match
            span = match.span() #start and end positions of the match in the text

            # Skip if this match overlaps with anything already detected
            if any(start <= span[0] < end or start < span[1] <= end for start, end in detected_spans):
                continue

            detected.append((value, label))
            detected_spans.append(span)

    return detected


