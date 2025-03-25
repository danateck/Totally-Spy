import spacy
from spacy.pipeline import EntityRuler

# Load a pre-trained spaCy model
nlp = spacy.load("en_core_web_sm")

# Create an EntityRuler to add custom patterns
ruler = nlp.add_pipe("entity_ruler", last=True)  # Add EntityRuler using spaCy's factory

# Add custom patterns to recognize OTP, Credit Card, Phone Number, etc.
patterns = [
    {"label": "OTP", "pattern": [{"lower": "otp"}, {"is_digit": True}]},  # Simple OTP pattern (e.g., OTP 123456)
    {"label": "CREDIT_CARD", "pattern": [{"text": {"regex": r"\d{4} \d{4} \d{4} \d{4}"}}]},  # Credit card format
    {"label": "CREDIT_CARD", "pattern": [{"text": {"regex": r"\d{16}"}}]},  # 16-digit credit card number
    {"label": "PHONE_NUMBER",
     "pattern": [{"text": {"regex": r"\b\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b"}}]},
    # Phone number format
    {"label": "EMAIL", "pattern": [{"text": {"regex": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"}}]},
    # Email format
    {"label": "PASSWORD",
     "pattern": [{"text": {"regex": r"(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}"}}]},
    # Password format
    {"label": "ID", "pattern": [{"text": {"regex": r"\b\d{9}\b"}}]},  # ID format (e.g., SSN)
    {"label": "DATE", "pattern": [{"text": {"regex": r"\b\d{4}-\d{2}-\d{2}\b"}}]},  # Date format (e.g., 2023-03-25)
]

# Add the patterns to the ruler
ruler.add_patterns(patterns)

# Test the model with different samples
test_texts = [
    "My OTP is 123456.",
    "The credit card number is 1234 5678 9012 3456.",
    "Call me at +123-456-7890.",
    "My email is test@example.com.",
    "My password is Passw0rd!",
    "My ID is 123456789.",
    "The meeting is scheduled for 2023-03-25.",
    "Please send the OTP 654321."
]

# Process the test samples
for text in test_texts:
    doc = nlp(text)

    print(f"Text: {text}")
    for ent in doc.ents:
        print(f"Entity: {ent.text}, Label: {ent.label_}")
    print("\n---\n")
