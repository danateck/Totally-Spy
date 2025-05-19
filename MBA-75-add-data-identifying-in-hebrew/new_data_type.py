import re
from textblob import TextBlob 


patterns = {
    "OTP": re.compile(r"(?i)(?:code|otp|passcode|one-time|קוד|אימות|סיסמה)[^\d]{0,10}(\d{5,6})"),
    "CREDIT_CARD": re.compile(r"\b(?:\d{4}[- ]?){3}\d{4}\b"),
    "PHONE_NUMBER": re.compile(r"(?:(?:\+972|0)[-\s]?(?:[23489]|5[0123456789])[-\s]?\d{7})|(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})"),
    "EMAIL": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "PASSWORD": re.compile(r"(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}"),
    "ID": re.compile(r"\b\d{9}\b"), 
    "DATE": re.compile(r"\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b"),
    "DOMAIN": re.compile(r"\b(?:https?://)?(?:www\.)?([\w\-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)"),
    "CVC": re.compile(r"(?i)(?:cvc|cvv|security code|קוד אבטחה)[^\d]{0,10}(\d{3,4})"),

    
    "ADDRESS_HEBREW": re.compile(
        r"(?:רחוב|שדרות|דרך|כיכר)\s+[א-ת\"'\-\s]+\s+\d{1,4}(?:[,]\s*[א-ת\"'\-\s]+)?"
    ),
    "ADDRESS_ENGLISH": re.compile(
        r"\b\d{1,5}\s+(?:[A-Z][a-z]*\s){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Lane|Ln|Dr|Drive|Ct|Court)\b(?:,\s*\w+)*"
    ),
}

def classify_text(text: str) -> list[tuple[str, str]]:
    detected = []
    detected_spans = []

    priority_order = [
        "OTP", "EMAIL", "CREDIT_CARD", "CVC", "PHONE_NUMBER", "PASSWORD",
        "ID", "DATE", "DOMAIN", "ADDRESS_HEBREW", "ADDRESS_ENGLISH"
    ]

    for label in priority_order:
        pattern = patterns[label]
        for match in pattern.finditer(text):
            value = match.group(1) if match.groups() else match.group()
            span = match.span()

         
            if any(start <= span[0] < end or start < span[1] <= end for start, end in detected_spans):
                continue

          
            normalized_label = "ADDRESS" if "ADDRESS" in label else label

            detected.append((value.strip(), normalized_label))
            detected_spans.append(span)

   
    fallback_matches = re.findall(r"\b\d{5,12}\b", text)
    for val in fallback_matches:
        if any(val in item[0] for item in detected):
            continue
        context_blob = TextBlob(text)
        if context_blob.words.count(val) == 0:
            continue 
        detected.append((val, "POTENTIALLY_SENSITIVE")) 

    return detected
