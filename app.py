from flask import Flask, jsonify, render_template, request


app = Flask(__name__)


@app.get("/")
def home():
    return render_template("index.html")


@app.post("/api/quote")
def request_quote():
    payload = request.get_json(silent=True) or {}
    required = ("name", "email", "zip", "service")
    missing = [field for field in required if not str(payload.get(field, "")).strip()]

    if missing:
        return jsonify({"ok": False, "message": "Please complete all required fields."}), 400

    # Demo behavior: a production version would send this request to a CRM or database.
    return jsonify(
        {
            "ok": True,
            "message": (
                f"Thanks, {payload['name'].strip()}! We received your request and "
                "will follow up with availability and an estimate."
            ),
        }
    )


@app.get("/health")
def health():
    return jsonify({"status": "healthy"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=4900, debug=True)
