import requests

payload = {
    "subject": "Win a free iPhone right now!!!",
    "sender": "scam@badguy.com",
    "body": "Click here http://badurl.com to claim your prize! Attached is the invoice.exe."
}
resp = requests.post("http://localhost:8000/analyze/email", json=payload)
print("MALICIOUS:", resp.json())

payload2 = {
    "subject": "Lunch meeting at 2PM",
    "sender": "coworker@company.com",
    "body": "Hey, do you want to grab lunch today at 2PM?"
}
resp2 = requests.post("http://localhost:8000/analyze/email", json=payload2)
print("BENIGN:", resp2.json())
