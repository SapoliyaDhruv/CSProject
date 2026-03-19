from flask import Flask, render_template, request
import requests
from bs4 import BeautifulSoup
import pickle
from feature_extractor import extract_features

app = Flask(__name__)

# Load models
url_model = pickle.load(open("model.pkl", "rb"))
email_model = pickle.load(open("email_model.pkl", "rb"))
vectorizer = pickle.load(open("vectorizer.pkl", "rb"))

# URL Rule Check
def rule_based_check(url, text):
    score = 0

    if any(word in url for word in ["login", "secure", "verify"]):
        score += 1

    if "-" in url:
        score += 1

    if "verify your account" in text:
        score += 1

    if "login" in text:
        score += 1

    return score


# EMAIL CHECK (ML)
def check_email(email_text):
    vec = vectorizer.transform([email_text])
    prediction = email_model.predict(vec)[0]

    if prediction == 1:
        return "🔴 Phishing Email (ML)"
    else:
        return "🟢 Safe Email"


@app.route("/", methods=["GET", "POST"])
def index():
    result = None
    confidence = None

    if request.method == "POST":
        mode = request.form.get("mode")

        # 🌐 URL DETECTION
        if mode == "url":
            url = request.form.get("url")

            try:
                response = requests.get(url, timeout=5)
                soup = BeautifulSoup(response.text, "html.parser")

                text = soup.get_text().lower()

                features = extract_features(url)
                prediction = url_model.predict([features])[0]
                prob = url_model.predict_proba([features])[0]
                confidence = round(max(prob) * 100, 2)

                score = rule_based_check(url, text)

                if score >= 2:
                    result = "🔴 Phishing Website (Content-Based)"
                elif prediction == 1:
                    result = "🔴 Phishing Website (ML)"
                else:
                    result = "🟢 Legitimate Website"

            except:
                result = "⚠️ Could not access website"

        # 📧 EMAIL DETECTION
        elif mode == "email":
            email_text = request.form.get("email_text")
            result = check_email(email_text)

    return render_template("index.html", result=result, confidence=confidence)


if __name__ == "__main__":
    app.run(debug=True)