import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import pickle
from feature_extractor import extract_features

df = pd.read_csv(r"dataset/PhiUSIIL_Phishing_URL_Dataset.csv")

X = []
y = []

for _, row in df.iterrows():
    url = row["URL"]
    label = row["label"]

    X.append(extract_features(url))
    y.append(label)

model = RandomForestClassifier()
model.fit(X, y)

pickle.dump(model, open("model.pkl", "wb"))

print("✅ URL Model Trained")