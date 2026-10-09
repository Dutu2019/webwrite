"""Collect scores, fit a split-conformal profile, or evaluate an untouched test set."""
import argparse
import json
from pathlib import Path

import httpx
from pydantic import TypeAdapter

from app import DecisionInput
from calibration import Profile, fingerprint, fit, label_id, prediction_set

parse_request = TypeAdapter(DecisionInput).validate_python


def read_jsonl(path):
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def contains_label(labels, label):
    return label_id(label) in {label_id(v) for v in labels}


def load_dataset(path):
    """Validate rows and return (rows, labels). All rows must share one question."""
    rows = read_jsonl(path)
    if not rows:
        raise ValueError("Dataset is empty")

    seen_ids, seen_contexts, schema = set(), set(), None
    for row in rows:
        if not isinstance(row.get("id"), str) or not row["id"].strip() or row["id"] in seen_ids:
            raise ValueError("Each row needs a unique nonempty string id")

        request = parse_request(row["request"])
        row["request"] = request.model_dump()

        context_hash = fingerprint(request.context)
        if context_hash in seen_contexts:
            raise ValueError("Repeated contexts are not allowed within a dataset")
        seen_ids.add(row["id"])
        seen_contexts.add(context_hash)
        row["context_hash"] = context_hash

        current = request.model_dump(exclude={"context", "mode"})
        if schema is not None and current != schema:
            raise ValueError("Use one fixed question/rubric/settings per calibration profile")
        schema = current

        labels = request.labels()
        if not contains_label(labels, row["label"]):
            raise ValueError("Ground truth must be an allowed label; "
                             "encode 'unknown' as an explicit choice if needed")
    return rows, labels


def collect(rows, endpoint):
    """Request sampled scores from the running server for every row."""
    results = []
    # The server samples in parallel, and each model call has a 60-second timeout.
    with httpx.Client(timeout=180) as client:
        for i, row in enumerate(rows, 1):
            response = client.post(endpoint, json={**row["request"], "mode": "sample"})
            response.raise_for_status()
            scored = response.json()
            if scored.get("calibration_status") != "scored":
                raise ValueError("Expected a sampled-score response")
            results.append({**scored, "id": row["id"], "label": row["label"],
                            "context_hash": row["context_hash"]})
            print(f"Scored {i}/{len(rows)} ({scored['model_calls']} model calls)")
    return results


def evaluate(profile, rows):
    if not rows:
        raise ValueError("Test set is empty")

    covered = singles = correct_singles = total_size = 0
    for row in rows:
        if profile.overlaps(row):
            raise ValueError("Test set overlaps calibration set")
        if row["fingerprint"] != profile.fingerprint or row["model_version"] != profile.model_version:
            raise ValueError("Test configuration/version differs from calibration")

        answers = prediction_set(profile, row["scores"])
        hit = contains_label(answers, row["label"])
        covered += hit
        total_size += len(answers)
        if len(answers) == 1:
            singles += 1
            correct_singles += hit

    n = len(rows)
    return {
        "test_n": n,
        "empirical_coverage": covered / n,
        "target_coverage": 1 - profile.alpha,
        "average_set_size": total_size / n,
        "abstention_rate": 1 - singles / n,
        "singleton_accuracy": correct_singles / singles if singles else None,
        "note": "Held-out estimates, not per-example confidence or conditional guarantees.",
    }


def write_new(path, text):
    """Write to a file that must not already exist."""
    with Path(path).open("x", encoding="utf-8") as output:
        output.write(text)


def run_fit(args, rows, labels):
    path = Path(args.profile)
    if path.exists():
        raise ValueError("Profile already exists; choose a new filename")
    if not 0 < args.alpha < 1:
        raise ValueError("alpha must be between 0 and 1")

    profile = fit(collect(rows, args.endpoint), labels, args.alpha)
    write_new(path, profile.model_dump_json(indent=2))
    print(f"Saved {path}; n={profile.n}, qhat={profile.qhat}. Evaluate on separate test data.")
    if profile.qhat == 1:
        print("Threshold returns ALL labels: the scores/data do not support selective decisions at this alpha.")


def run_evaluate(args, rows):
    profile = Profile.model_validate_json(Path(args.profile).read_text(encoding="utf-8"))
    if Path(args.report).exists():
        raise ValueError("Report already exists; choose a new filename")
    # Check before collecting so overlap doesn't waste model calls.
    if any(profile.overlaps(row) for row in rows):
        raise ValueError("Test data overlaps calibration data")

    report = json.dumps(evaluate(profile, collect(rows, args.endpoint)), indent=2)
    write_new(args.report, report)
    print(report)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["fit", "evaluate"])
    parser.add_argument("dataset", help="JSONL rows containing id, request, label")
    parser.add_argument("--profile", required=True)
    parser.add_argument("--endpoint", default="http://127.0.0.1:8000/v1/decide")
    parser.add_argument("--alpha", type=float, default=0.1)
    parser.add_argument("--report", default="evaluation.json")
    args = parser.parse_args()

    rows, labels = load_dataset(args.dataset)
    if args.action == "fit":
        run_fit(args, rows, labels)
    else:
        run_evaluate(args, rows)


if __name__ == "__main__":
    main()
