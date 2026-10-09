"""Split conformal classification using bounded nonconformity 1 - vote frequency.

The underlying score need not be a calibrated probability. Validity requires
exchangeable calibration/test examples AND a fixed randomized scoring procedure.
See Angelopoulos & Bates, https://arxiv.org/abs/2107.07511.
"""
import hashlib
import json
import math
from decimal import Decimal, ROUND_CEILING

from pydantic import BaseModel, ConfigDict, Field, model_validator

METHOD = "split-conformal-vote-v1"


def label_id(value):
    # Preserve the distinction between boolean true and score index 1.
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def label_ids(labels):
    """JSON keys for a label list, rejecting duplicates."""
    keys = [label_id(v) for v in labels]
    if len(set(keys)) != len(keys):
        raise ValueError("Duplicate labels")
    return keys


def fingerprint(config):
    encoded = json.dumps(config, ensure_ascii=False, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def make_scores(labels, votes):
    """Nonconformity per label: 1 - (votes for that label / total votes)."""
    if not votes:
        raise ValueError("No samples")
    counts = dict.fromkeys(label_ids(labels), 0)
    for value in votes:
        if value is None:
            continue  # Unknown remains in the denominator; no artificial renormalization.
        key = label_id(value)
        if key not in counts:
            raise ValueError("Out-of-domain sample")
        counts[key] += 1
    return {key: 1 - count / len(votes) for key, count in counts.items()}


class Profile(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    method: str = METHOD
    fingerprint: str = Field(min_length=64, max_length=64)
    model_version: str | None
    labels: list[bool | int | str] = Field(min_length=2)
    alpha: float = Field(gt=0, lt=1)
    n: int = Field(ge=1)
    qhat: float = Field(ge=0, le=1)
    calibration_ids: list[str]
    calibration_context_hashes: list[str]

    @model_validator(mode="after")
    def validate_profile(self):
        if self.method != METHOD:
            raise ValueError("Unsupported calibration method")
        if not unique_with_length(self.calibration_ids, self.n):
            raise ValueError("Calibration IDs must be unique and match n")
        if not unique_with_length(self.calibration_context_hashes, self.n):
            raise ValueError("Calibration contexts must be unique and match n")
        label_ids(self.labels)
        return self

    def overlaps(self, row):
        """Whether a dataset row was part of this profile's calibration set."""
        return (row["id"] in self.calibration_ids
                or row["context_hash"] in self.calibration_context_hashes)


def unique_with_length(items, n):
    return len(items) == n and len(set(items)) == n


def validate_scores(labels, scores):
    if set(scores) != {label_id(v) for v in labels}:
        raise ValueError("Score labels do not match profile")
    for v in scores.values():
        if type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= 1:
            raise ValueError("Scores must be finite numbers between 0 and 1")


def conformal_rank(n, alpha):
    """ceil((n + 1) * (1 - alpha)), computed exactly."""
    rank = Decimal(n + 1) * (1 - Decimal(str(alpha)))
    return int(rank.to_integral_value(rounding=ROUND_CEILING))


def fit(rows, labels, alpha=0.1):
    if not rows or not 0 < alpha < 1:
        raise ValueError("Need calibration rows and 0 < alpha < 1")

    signature, version = rows[0]["fingerprint"], rows[0]["model_version"]
    true_label_scores = []
    for row in rows:
        if row["fingerprint"] != signature or row["model_version"] != version:
            raise ValueError("Mixed schemas, settings, or model versions")
        validate_scores(labels, row["scores"])
        key = label_id(row["label"])
        if key not in row["scores"]:
            raise ValueError("Ground truth outside label space")
        true_label_scores.append(row["scores"][key])

    n = len(true_label_scores)
    rank = conformal_rank(n, alpha)
    # Infinite conformal quantile becomes 1 because all scores are bounded by 1.
    qhat = sorted(true_label_scores)[rank - 1] if rank <= n else 1.0

    return Profile(
        fingerprint=signature,
        model_version=version,
        labels=labels,
        alpha=alpha,
        n=n,
        qhat=qhat,
        calibration_ids=[r["id"] for r in rows],
        calibration_context_hashes=[r["context_hash"] for r in rows],
    )


def prediction_set(profile, scores):
    validate_scores(profile.labels, scores)
    return [v for v in profile.labels if scores[label_id(v)] <= profile.qhat]
