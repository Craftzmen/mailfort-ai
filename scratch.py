import requests

payload = {
    "subject": "Win a free iPhone right now!!!",
    "sender": "scam@badguy.com",
    "body": "Click here http://badurl.com to claim your prize! Attached is the invoice.exe."
}
resp = requests.post("http://localhost:8000/analyze/email", json=payload)
print(resp.json())
