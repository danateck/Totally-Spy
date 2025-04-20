import json
import csv

#list of sites
otp_services = [
    {"name": "Google / Gmail", "usage": "Login, password reset", "method": "SMS or Authenticator App"},
    {"name": "Facebook", "usage": "Login, password reset", "method": "SMS"},
    {"name": "Instagram", "usage": "Login, password reset", "method": "SMS"},
    {"name": "Microsoft / Outlook / Teams", "usage": "Login, password reset", "method": "SMS or App"},
    {"name": "WhatsApp", "usage": "New device login", "method": "SMS"},
    {"name": "Telegram", "usage": "Login, password reset", "method": "SMS"},
    {"name": "Apple ID / iCloud", "usage": "Login from new device", "method": "SMS"},
    {"name": "PayPal", "usage": "Login, money transfers", "method": "SMS"},
    {"name": "Binance", "usage": "Login, withdrawal", "method": "SMS or 2FA"},
    {"name": "Bank Hapoalim / Leumi", "usage": "Login to account", "method": "SMS"},
    {"name": "Clalit / Maccabi / Meuhedet", "usage": "Login to personal health account", "method": "SMS"},
    {"name": "gov.il", "usage": "Government login portal", "method": "SMS or ID-based OTP"},
    {"name": "Netflix", "usage": "New device login", "method": "SMS (if enabled)"},
    {"name": "Amazon", "usage": "Login or purchase", "method": "SMS"},
    {"name": "Wolt / TenBis", "usage": "Login or reset password", "method": "SMS"},
    {"name": "Dropbox / Zoom / Slack", "usage": "Login from new device", "method": "SMS or App"},
    {"name": "ChatGPT (OpenAI)", "usage": "Initial login", "method": "SMS"},
]

#save as JASON
with open("otp_services_list.json", "w", encoding="utf-8") as json_file:
    json.dump(otp_services, json_file, indent=4, ensure_ascii=False)

# save as CSV
with open("otp_services_list.csv", "w", newline='', encoding="utf-8") as csv_file:
    writer = csv.DictWriter(csv_file, fieldnames=["name", "usage", "method"])
    writer.writeheader()
    for service in otp_services:
        writer.writerow(service)

#print("Files 'otp_services_list.json' and 'otp_services_list.csv' created successfully.")
