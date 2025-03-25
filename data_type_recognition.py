import re

def classify_text(text):
    patterns = {
        "OTP Code": r"^\d{4,8}$",  # 4-8 digit numbers
        "Credit Card Info": r"\b(?:\d{4}[- ]?){3}\d{4}\b|\b\d{16}\b",   # 16-digit CC format
        "Phone Number": r"\b\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b",  # International phone numbers
        "Email Address": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",  # Standard email format
        "Password": r"(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}",  # At least 6 chars with letters, numbers, special chars
        "ID ":  r"\b\d{9}\b(?![-\d])|\b\d{3}-\d{2}-\d{4}\b",

    }

    for category, pattern in patterns.items():
        if re.search(pattern, text):
            return category

    return "Other"

# Test cases
samples = [
    "123456",  # OTP
    "4111-1111-1111-1111",  # Credit Card
    "0561234567",  # Phone Number
    "test@example.com",  # Email
    "Passw0rd!",  # Password
    "123456789",  # ID

]

for sample in samples:
    print(f"{sample} -> {classify_text(sample)}")
