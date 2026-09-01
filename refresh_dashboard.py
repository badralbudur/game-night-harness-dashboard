#!/usr/bin/env python3
"""Refresh only the curated public dashboard state from a team workspace.

Raw workspace messages/verdicts are intentionally NOT copied to public/.
This script reads the durable status-summary.md and milestone-progress.md,
updates data/dashboard-data.json's concise checkpoint/overview/timeline,
and writes the safe publication manifest.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "dashboard-data.json"


def section(markdown: str, heading: str) -> str:
    match = re.search(rf"^## {re.escape(heading)}\s*$\n(.*?)(?=^## |\Z)", markdown, re.M | re.S)
    return " ".join(match.group(1).strip().split()) if match else ""


def metadata(markdown: str, label: str) -> str:
    match = re.search(rf"^- \*\*{re.escape(label)}:\*\*\s*(.+)$", markdown, re.M)
    return match.group(1).strip() if match else ""


def main() -> int:
    if len(sys.argv) not in (3, 4):
        print("usage: refresh_dashboard.py <status-summary.md> <milestone-progress.md> [latest-decision.md]", file=sys.stderr)
        return 2
    status_path, progress_path = map(Path, sys.argv[1:3])
    decision_path = Path(sys.argv[3]) if len(sys.argv) == 4 else None
    data = json.loads(DATA.read_text())
    status = status_path.read_text() if status_path.exists() else ""
    progress = progress_path.read_text() if progress_path.exists() else ""
    decision = decision_path.read_text() if decision_path and decision_path.exists() else ""

    current = re.search(r"^current:\s*(.+)$", progress, re.M)
    completed = re.search(r"^completed:\s*(.*)$", progress, re.M)
    current_id = current.group(1).strip() if current else data["overview"]["currentMilestone"]
    completed_ids = [x.strip() for x in (completed.group(1) if completed else "").split(",") if x.strip()]
    if current_id and not current_id.startswith("("):
        data["overview"]["currentMilestone"] = current_id
        for milestone in data["milestones"]:
            if milestone["id"] == current_id:
                data["overview"]["currentMilestoneTitle"] = milestone["title"]
                break
    if completed_ids:
        data["overview"]["completedMilestones"] = completed_ids

    # Reconcile the visual flight plan from durable workspace progress on
    # every refresh. Previously the overview advanced but the individual
    # cards retained stale generator-time statuses (e.g. M2 looked current
    # after milestone-progress had already moved to M3).
    for milestone in data.get("milestones", []):
        if milestone["id"] in completed_ids:
            milestone["status"] = "passed"
        elif milestone["id"] == current_id and current_id and not current_id.startswith("("):
            milestone["status"] = "current"
        elif milestone.get("status") == "current":
            milestone["status"] = "queued"

    outcome = metadata(status, "Outcome") or "UPDATED"
    milestone = metadata(status, "Milestone") or data["overview"]["currentMilestone"]
    retry_mode = metadata(status, "Retry mode")
    updated = metadata(status, "Updated") or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    where = section(status, "Where we are") or data["checkpoint"]["whereWeAre"]
    going = section(status, "Where we're going") or data["checkpoint"]["whereWeGo"]
    next_action = section(status, "Next bearing") or data["checkpoint"]["nextAction"]
    # A terminal status can name a newly appended milestone before the
    # workspace progress pointer advances (for example, an evaluator capacity
    # escalation). The dashboard must show that live M9-style status rather
    # than retaining the prior completed milestone as its headline context.
    if milestone and not milestone.startswith("("):
        data["overview"]["currentMilestone"] = milestone
        for entry in data.get("milestones", []):
            if entry.get("id") == milestone:
                data["overview"]["currentMilestoneTitle"] = entry.get("title", milestone)
                if entry.get("status") != "passed":
                    entry["status"] = "current"
                break
    data["checkpoint"] = {
        "headline": f"{milestone}: {outcome}",
        "whereWeAre": where,
        "whereWeGo": going,
        "nextAction": next_action,
    }
    data["project"]["lastUpdated"] = updated
    data["overview"]["workspaceStatus"] = "Needs operator review" if "ESCALATED" in outcome else "Ready for next scheduled run" if retry_mode == "automatic-enabled" else "Ready for next manual run"
    if retry_mode == "automatic-enabled":
        data["overview"]["retryMode"] = "Automatic — bounded retries enabled"
    elif retry_mode == "manual":
        data["overview"]["retryMode"] = "Manual — automatic retries disabled"

    # Open Items is a live operations panel, not a static project brief.
    # Decision pointers contain a concise Coordinator-extracted question;
    # use that instead of the generic status fallback when available.
    long_lived = [item for item in data.get("openItems", []) if item.get("kind") == "Spec decision"]
    decision_question = re.search(r"^question:\s*(.+)$", decision, re.M)
    if "DECISION" in outcome and decision_question:
        live_item = {"kind": "Decision required", "status": "open", "text": decision_question.group(1).strip()}
    elif "ESCALATED" in outcome or "DECISION" in outcome:
        live_item = {"kind": "Blocking issue" if "ESCALATED" in outcome else "Decision required", "status": "open", "text": where}
    else:
        live_item = {"kind": "Current work", "status": "ready", "text": next_action}
    data["openItems"] = long_lived + [live_item]

    run_status = "decision" if "DECISION" in outcome else "escalated" if "ESCALATED" in outcome else "passed"
    fingerprint = f"{updated}|{milestone}|{outcome}"
    known = {run.get("fingerprint") for run in data.get("runs", [])}
    if fingerprint not in known:
        data["runs"].append({
            "fingerprint": fingerprint,
            "time": updated,
            "milestone": milestone,
            "status": run_status,
            "title": f"{milestone}: {outcome}",
            "detail": where,
        })
    else:
        # Reclassify old rendered events when dashboard semantics improve
        # (e.g. a decision-required run was previously colored as PASS).
        for run in data["runs"]:
            if run.get("fingerprint") == fingerprint:
                run["status"] = run_status
                run["detail"] = where
                break

    DATA.write_text(json.dumps(data, indent=2) + "\n")
    print(f"refreshed curated dashboard state: {milestone} / {outcome}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
