
import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import GroupShuffleSplit
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

# ==========================================
# 1. LOAD DATASET
# ==========================================

df = pd.read_csv(
    r"D:\CSE276 project\dataset\cyclone.csv"
)

df.columns = df.columns.str.strip().str.lower()

print("Original dataset shape:", df.shape)
print("\nAvailable columns:")
print(df.columns.tolist())

# ==========================================
# 2. SELECT FEATURES AND TARGET
# ==========================================

features = [
    "latitude of the center",
    "longitude of the center",
    "maximum sustained wind speed",
    "central pressure"
]

target = "grade"
storm_id = "international number id"

df = df[features + [target, storm_id]].copy()

# ==========================================
# 3. DATA CLEANING
# ==========================================

for col in features:
    df[col] = pd.to_numeric(df[col], errors="coerce")

df = df.replace([np.inf, -np.inf], np.nan)

df[target] = df[target].astype("string").str.strip()

df = df.dropna(
    subset=features + [target, storm_id]
)

df = df[df[target] != ""]

print("\nDataset shape after cleaning:", df.shape)

print("\nGrade distribution:")
print(df[target].value_counts())

print("\nUnique cyclones:", df[storm_id].nunique())

# ==========================================
# 4. SEPARATE X AND Y
# ==========================================

X = df[features]

encoder = LabelEncoder()
y = encoder.fit_transform(df[target])

groups = df[storm_id]

print("\nEncoded cyclone grades:")
for i, grade in enumerate(encoder.classes_):
    print(i, ":", grade)

# ==========================================
# 5. STORM-WISE TRAIN TEST SPLIT
# ==========================================

splitter = GroupShuffleSplit(
    n_splits=1,
    test_size=0.2,
    random_state=42
)

train_idx, test_idx = next(
    splitter.split(X, y, groups=groups)
)

X_train = X.iloc[train_idx]
X_test = X.iloc[test_idx]

y_train = y[train_idx]
y_test = y[test_idx]

print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))

print(
    "Training cyclones:",
    groups.iloc[train_idx].nunique()
)

print(
    "Testing cyclones:",
    groups.iloc[test_idx].nunique()
)

# Check that no cyclone is shared
assert set(groups.iloc[train_idx]).isdisjoint(
    set(groups.iloc[test_idx])
)

print("\nNo overlapping cyclones between train and test.")

# ==========================================
# 6. CREATE RANDOM FOREST MODEL
# ==========================================

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=None,
    min_samples_split=2,
    min_samples_leaf=1,
    random_state=42,
    n_jobs=-1,
    class_weight="balanced"
)

# ==========================================
# 7. TRAIN MODEL
# ==========================================

print("\nTraining started...")

model.fit(X_train, y_train)

print("Training completed!")

# ==========================================
# 8. MAKE PREDICTIONS
# ==========================================

y_pred = model.predict(X_test)

# ==========================================
# 9. EVALUATE MODEL
# ==========================================

accuracy = accuracy_score(y_test, y_pred)

print("\n================================")
print("MODEL EVALUATION")
print("================================")

print("\nAccuracy:", round(accuracy * 100, 2), "%")

print("\nClassification Report:")

print(
    classification_report(
        y_test,
        y_pred,
        labels=np.arange(len(encoder.classes_)),
        target_names=encoder.classes_,
        zero_division=0
    )
)

print("\nConfusion Matrix:")

print(
    confusion_matrix(
        y_test,
        y_pred,
        labels=np.arange(len(encoder.classes_))
    )
)

# ==========================================
# 10. FEATURE IMPORTANCE
# ==========================================

importance = pd.DataFrame({
    "Feature": features,
    "Importance": model.feature_importances_
})

importance = importance.sort_values(
    by="Importance",
    ascending=False
)

print("\nFeature Importance:")
print(importance.to_string(index=False))

# ==========================================
# 11. SAVE MODEL
# ==========================================

joblib.dump(model, "cyclone_model.pkl")
joblib.dump(encoder, "label_encoder.pkl")

joblib.dump(features, "model_features.pkl")

print("\n================================")
print("MODEL SAVED SUCCESSFULLY!")
print("================================")
