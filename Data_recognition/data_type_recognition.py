import re


patterns = {
    "OTP": r"\b\d{6}\b",  # OTP can be 5 or 6 digits
    "CREDIT_CARD": r"\b(?:\d{4}[-]?){3}\d{4}\b",  # 16-digit CC, supports space or - separators
    "PHONE_NUMBER": r"\b\d{10}\b",  # Strictly 10-digit phone number
    "EMAIL": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",  # Email
    "PASSWORD": r"(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}",  # Password with special char, min 8 chars
    "ID": r"\b\d{9}\b",  # Strictly 9-digit ID
    "DATE": r"\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b",  # Date format (e.g., 25/03/2023)
}

def classify_text(text: str)-> list[tuple[str, str]]:
    detected = []
    # Go through each pattern and match it in the text
    for label, pattern in patterns.items():
        matches = re.findall(pattern, text)
        for match in matches:
            # Ensure that each match is classified once
            detected.append((match, label))
    return detected # results have data, data_type


