
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import os
import re
import html
import urllib.request
import xml.etree.ElementTree as ET

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


app = Flask(__name__)
CORS(app)

# --------------------------------------------------
# LOAD TRAINED ML MODEL
# --------------------------------------------------


MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

model = joblib.load(os.path.join(MODEL_DIR, "cyclone_model.pkl"))
label_encoder = joblib.load(os.path.join(MODEL_DIR, "label_encoder.pkl"))
features = joblib.load(os.path.join(MODEL_DIR, "model_features.pkl"))


# --------------------------------------------------
# OFFICIAL IMD CAP FEED
# --------------------------------------------------

IMD_CAP_FEED = (
    "https://cap-sources.s3.amazonaws.com/in-imd-en/rss.xml"
)

IMD_SOURCE = "India Meteorological Department"

CYCLONE_KEYWORDS = [
    "cyclone",
    "cyclonic",
    "tropical storm",
    "depression",
    "deep depression",
    "very severe cyclonic",
    "extremely severe cyclonic",
    "super cyclonic"
]


# --------------------------------------------------
# XML HELPERS
# --------------------------------------------------

def local_name(tag):
    return tag.split("}")[-1].lower()


def find_text(element, tag_name):
    for child in element.iter():
        if local_name(child.tag) == tag_name.lower():
            if child.text:
                return child.text.strip()

    return ""


def find_all_text(element, tag_name):
    values = []

    for child in element.iter():
        if local_name(child.tag) == tag_name.lower():
            if child.text and child.text.strip():
                values.append(child.text.strip())

    return values


def clean_text(value):
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def get_item_link(item):
    for child in item:
        if local_name(child.tag) == "link":
            if child.text and child.text.strip():
                return child.text.strip()

            return child.attrib.get("href", "")

    return ""


def is_cyclone_related(text):
    text = text.lower()

    return any(
        keyword in text
        for keyword in CYCLONE_KEYWORDS
    )


def parse_datetime(value):
    if not value:
        return None

    try:
        result = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )

        if result.tzinfo is None:
            result = result.replace(tzinfo=timezone.utc)

        return result

    except ValueError:
        try:
            return parsedate_to_datetime(value)
        except (ValueError, TypeError):
            return None


# --------------------------------------------------
# FETCH XML
# --------------------------------------------------

def fetch_xml(url):
    request_object = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Cyclonex-Research-Prototype/1.0"
        }
    )

    with urllib.request.urlopen(
        request_object,
        timeout=20
    ) as response:

        return ET.fromstring(response.read())


# --------------------------------------------------
# PARSE INDIVIDUAL CAP ALERT
# --------------------------------------------------

def parse_cap_alert(item):

    title = clean_text(
        find_text(item, "title")
    )

    description = clean_text(
        find_text(item, "description")
    )

    published = find_text(item, "pubDate")
    link = get_item_link(item)

    alert = {
        "id": find_text(item, "guid") or link or title,
        "event": title,
        "headline": title,
        "description": description,
        "severity": "Unknown",
        "urgency": "Unknown",
        "certainty": "Unknown",
        "effective": "",
        "expires": "",
        "affected_areas": [],
        "source": IMD_SOURCE,
        "source_url": link,
        "published": published,
        "status": "active"
    }

    # Try to retrieve detailed CAP XML.
    if link.startswith("http"):

        try:
            cap_root = fetch_xml(link)

            info_nodes = [
                node
                for node in cap_root.iter()
                if local_name(node.tag) == "info"
            ]

            if info_nodes:

                info = info_nodes[0]

                event = find_text(info, "event")
                headline = find_text(info, "headline")
                cap_description = find_text(
                    info, "description"
                )

                if event:
                    alert["event"] = clean_text(event)

                if headline:
                    alert["headline"] = clean_text(headline)

                if cap_description:
                    alert["description"] = clean_text(
                        cap_description
                    )

                for field in [
                    "severity",
                    "urgency",
                    "certainty",
                    "effective",
                    "expires"
                ]:
                    value = find_text(info, field)

                    if value:
                        alert[field] = value

                alert["affected_areas"] = [
                    clean_text(area)
                    for area in find_all_text(
                        info, "areaDesc"
                    )
                ]

        except Exception as error:
            print(
                "CAP detail could not be retrieved:",
                error
            )

    searchable_text = " ".join([
        alert["event"],
        alert["headline"],
        alert["description"],
        title,
        description
    ])

    if not is_cyclone_related(searchable_text):
        return None

    now = datetime.now(timezone.utc)

    expiry = parse_datetime(alert["expires"])
    effective = parse_datetime(alert["effective"])

    # Do not display expired alerts.
    if expiry and expiry < now:
        return None

    if effective and effective > now:
        alert["status"] = "upcoming"

    return alert


# --------------------------------------------------
# HOME
# --------------------------------------------------

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "message": "Cyclonex ML API is running",
        "status": "operational"
    })


# --------------------------------------------------
# ML PREDICTION
# --------------------------------------------------

@app.route("/predict", methods=["POST"])
def predict():

    try:
        input_data = request.get_json()

        if not input_data:
            return jsonify({
                "error": "No input data provided"
            }), 400

        missing = [
            feature
            for feature in features
            if feature not in input_data
        ]

        if missing:
            return jsonify({
                "error": "Missing input features",
                "missing_features": missing
            }), 400

        input_df = pd.DataFrame(
            [[input_data[feature] for feature in features]],
            columns=features
        )

        prediction = model.predict(input_df)[0]

        predicted_grade = label_encoder.inverse_transform(
            [int(prediction)]
        )[0]

        probabilities = model.predict_proba(input_df)[0]

        confidence = float(max(probabilities))

        return jsonify({
            "predicted_grade": predicted_grade,
            "confidence": round(confidence * 100, 2)
        })

    except (ValueError, TypeError) as error:

        return jsonify({
            "error": str(error)
        }), 400

    except Exception as error:

        return jsonify({
            "error": str(error)
        }), 500


# --------------------------------------------------
# LIVE CYCLONE ALERTS
# --------------------------------------------------

@app.route("/api/cyclone-alerts", methods=["GET"])
def cyclone_alerts():

    try:
        root = fetch_xml(IMD_CAP_FEED)

        items = [
            node
            for node in root.iter()
            if local_name(node.tag) in ("item", "entry")
        ]

        alerts = []

        for item in items[:40]:

            alert = parse_cap_alert(item)

            if alert:
                alerts.append(alert)

        alerts.sort(
            key=lambda item: (
                parse_datetime(item["effective"])
                or parse_datetime(item["published"])
                or datetime.min.replace(tzinfo=timezone.utc)
            ),
            reverse=True
        )

        return jsonify({
            "source": IMD_SOURCE,
            "feed_url": IMD_CAP_FEED,
            "fetched_at": datetime.now(
                timezone.utc
            ).isoformat(),
            "total_alerts": len(alerts),
            "alerts": alerts
        })

    except Exception as error:

        app.logger.exception(
            "Unable to retrieve IMD cyclone alerts"
        )

        return jsonify({
            "error": "Unable to retrieve the official IMD alert feed.",
            "details": str(error)
        }), 502


# --------------------------------------------------
# RUN SERVER
# --------------------------------------------------

if __name__ == "__main__":

    app.run(
        debug=True,
        port=5000
    )
