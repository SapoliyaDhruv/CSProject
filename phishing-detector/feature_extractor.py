def extract_features(url):
    features = []

    features.append(len(url))  # URL length
    features.append(url.count("."))  # dots
    features.append(url.count("-"))  # hyphen
    features.append(1 if "https" in url else 0)
    features.append(1 if "login" in url else 0)
    features.append(1 if "secure" in url else 0)
    features.append(1 if "verify" in url else 0)

    return features