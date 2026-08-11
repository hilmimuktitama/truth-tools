// Public-safe demo data: raw source bodies are stripped by scripts/demo.js
// and asserted absent before this file is written or deployed to Pages.
export const TRUTH_DEMO = {
  "version": "0.3.0",
  "publicSafe": true,
  "broken": {
    "as_of": "2026-08-11T00:00:00.000Z",
    "initiative": {
      "name": "Checkout migration launch readiness",
      "owner": "Platform TPM",
      "objective": "Ship the checkout migration on time with verifiable readiness."
    },
    "policy": {
      "max_observation_age_days": 7,
      "max_source_content_age_days": 3
    },
    "sources": [
      {
        "id": "jira-release",
        "type": "jira",
        "url": "https://example.atlassian.net/browse/PLAT-123",
        "observed_at": "2026-07-20T08:00:00.000Z",
        "source_updated_at": "2026-07-20T08:00:00.000Z",
        "owner": "Platform TPM"
      },
      {
        "id": "decision-log",
        "type": "decision-log",
        "url": "https://example.com/decisions/checkout-launch",
        "observed_at": "2026-08-01T14:00:00.000Z",
        "source_updated_at": "2026-08-01T14:00:00.000Z"
      },
      {
        "id": "risk-review",
        "type": "meeting-note",
        "url": "https://example.com/notes/risk-review",
        "observed_at": "2026-08-08T09:00:00.000Z",
        "source_updated_at": "2026-08-08T09:00:00.000Z"
      }
    ],
    "claims": [
      {
        "id": "launch-date-jira",
        "kind": "fact",
        "subject": "launch.date",
        "value": "2026-08-20",
        "text": "Jira records the launch date as August 20.",
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "launch-date-decision",
        "kind": "fact",
        "subject": "launch.date",
        "value": "2026-08-22",
        "text": "The decision log records the launch date as August 22.",
        "source_refs": [
          {
            "source_id": "decision-log",
            "locator": "https://example.com/decisions/checkout-launch"
          }
        ]
      },
      {
        "id": "rollback-owner",
        "kind": "blocker",
        "text": "The rollback decision has no accountable owner.",
        "source_refs": [
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      },
      {
        "id": "capacity-risk",
        "kind": "risk",
        "text": "Peak traffic headroom has not been verified in production-like load tests.",
        "source_refs": [
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      }
    ]
  },
  "brokenReview": {
    "kind": "truth_review",
    "schema_version": "1.0.0",
    "initiative": {
      "name": "Checkout migration launch readiness",
      "owner": "Platform TPM",
      "objective": "Ship the checkout migration on time with verifiable readiness."
    },
    "as_of": "2026-08-11T00:00:00.000Z",
    "policy": {
      "max_observation_age_days": 7,
      "max_source_content_age_days": 3
    },
    "artifact_quality": "fail",
    "program_health": "blocked",
    "summary": {
      "sources": 3,
      "claims": 4,
      "facts": 2,
      "blockers": 1,
      "risks": 1,
      "unknowns": 0,
      "conflicts": 1,
      "issues": 9,
      "deprecations": 0
    },
    "sources": [
      {
        "id": "jira-release",
        "type": "jira",
        "url": "https://example.atlassian.net/browse/PLAT-123",
        "observed_at": "2026-07-20T08:00:00.000Z",
        "source_updated_at": "2026-07-20T08:00:00.000Z",
        "owner": "Platform TPM"
      },
      {
        "id": "decision-log",
        "type": "decision-log",
        "url": "https://example.com/decisions/checkout-launch",
        "observed_at": "2026-08-01T14:00:00.000Z",
        "source_updated_at": "2026-08-01T14:00:00.000Z"
      },
      {
        "id": "risk-review",
        "type": "meeting-note",
        "url": "https://example.com/notes/risk-review",
        "observed_at": "2026-08-08T09:00:00.000Z",
        "source_updated_at": "2026-08-08T09:00:00.000Z"
      }
    ],
    "claims": [
      {
        "id": "launch-date-jira",
        "kind": "fact",
        "state": "active",
        "subject": "launch.date",
        "value": "2026-08-20",
        "text": "Jira records the launch date as August 20.",
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "launch-date-decision",
        "kind": "fact",
        "state": "active",
        "subject": "launch.date",
        "value": "2026-08-22",
        "text": "The decision log records the launch date as August 22.",
        "source_refs": [
          {
            "source_id": "decision-log",
            "locator": "https://example.com/decisions/checkout-launch"
          }
        ]
      },
      {
        "id": "rollback-owner",
        "kind": "blocker",
        "state": "active",
        "text": "The rollback decision has no accountable owner.",
        "source_refs": [
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      },
      {
        "id": "capacity-risk",
        "kind": "risk",
        "state": "active",
        "text": "Peak traffic headroom has not been verified in production-like load tests.",
        "source_refs": [
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      }
    ],
    "findings": {
      "facts": [
        {
          "id": "launch-date-jira",
          "kind": "fact",
          "state": "active",
          "subject": "launch.date",
          "value": "2026-08-20",
          "text": "Jira records the launch date as August 20.",
          "source_refs": [
            {
              "source_id": "jira-release",
              "locator": "https://example.atlassian.net/browse/PLAT-123"
            }
          ]
        },
        {
          "id": "launch-date-decision",
          "kind": "fact",
          "state": "active",
          "subject": "launch.date",
          "value": "2026-08-22",
          "text": "The decision log records the launch date as August 22.",
          "source_refs": [
            {
              "source_id": "decision-log",
              "locator": "https://example.com/decisions/checkout-launch"
            }
          ]
        }
      ],
      "blockers": [
        {
          "id": "rollback-owner",
          "kind": "blocker",
          "state": "active",
          "text": "The rollback decision has no accountable owner.",
          "source_refs": [
            {
              "source_id": "risk-review",
              "locator": "https://example.com/notes/risk-review"
            }
          ]
        }
      ],
      "risks": [
        {
          "id": "capacity-risk",
          "kind": "risk",
          "state": "active",
          "text": "Peak traffic headroom has not been verified in production-like load tests.",
          "source_refs": [
            {
              "source_id": "risk-review",
              "locator": "https://example.com/notes/risk-review"
            }
          ]
        }
      ],
      "unknowns": [],
      "conflicts": [
        {
          "subject": "launch.date",
          "values": [
            {
              "value": "2026-08-20",
              "claim_ids": [
                "launch-date-jira"
              ],
              "source_refs": [
                {
                  "source_id": "jira-release",
                  "locator": "https://example.atlassian.net/browse/PLAT-123"
                }
              ]
            },
            {
              "value": "2026-08-22",
              "claim_ids": [
                "launch-date-decision"
              ],
              "source_refs": [
                {
                  "source_id": "decision-log",
                  "locator": "https://example.com/decisions/checkout-launch"
                }
              ]
            }
          ],
          "action": "Reconcile 'launch.date' with the accountable owner before publishing status."
        }
      ],
      "issues": [
        {
          "type": "raw_source_content",
          "severity": "blocking",
          "location": "sources[0]",
          "message": "Remove raw source fields (content); keep source bodies in their system of record."
        },
        {
          "type": "stale_observation",
          "severity": "review",
          "location": "sources[0]",
          "message": "Source 'jira-release' was observed 21.667 days ago; policy allows 7 (stale_observation).",
          "source_id": "jira-release",
          "age_days": 21.667
        },
        {
          "type": "stale_source_content",
          "severity": "review",
          "location": "sources[0]",
          "message": "Source 'jira-release' content was last updated 21.667 days ago; policy allows 3 (stale_source_content).",
          "source_id": "jira-release",
          "age_days": 21.667
        },
        {
          "type": "stale_observation",
          "severity": "review",
          "location": "sources[1]",
          "message": "Source 'decision-log' was observed 9.417 days ago; policy allows 7 (stale_observation).",
          "source_id": "decision-log",
          "age_days": 9.417
        },
        {
          "type": "stale_source_content",
          "severity": "review",
          "location": "sources[1]",
          "message": "Source 'decision-log' content was last updated 9.417 days ago; policy allows 3 (stale_source_content).",
          "source_id": "decision-log",
          "age_days": 9.417
        },
        {
          "type": "blocker_missing_owner",
          "severity": "blocking",
          "location": "claims[2]",
          "message": "Active blocker 'rollback-owner' has no accountable owner; add owner and due_at."
        },
        {
          "type": "blocker_missing_due",
          "severity": "blocking",
          "location": "claims[2]",
          "message": "Active blocker 'rollback-owner' has no resolution date; add owner and due_at."
        },
        {
          "type": "risk_missing_owner",
          "severity": "review",
          "location": "claims[3]",
          "message": "Active risk 'capacity-risk' has no accountable owner; add owner and mitigation."
        },
        {
          "type": "risk_missing_mitigation",
          "severity": "review",
          "location": "claims[3]",
          "message": "Active risk 'capacity-risk' has no mitigation; add owner and mitigation."
        }
      ],
      "deprecations": []
    },
    "recommended_actions": [
      {
        "priority": "P0",
        "type": "resolve_blocker",
        "claim_id": "rollback-owner",
        "action": "Assign an owner and resolution date for blocker 'The rollback decision has no accountable owner'."
      },
      {
        "priority": "P0",
        "type": "reconcile_conflict",
        "subject": "launch.date",
        "action": "Reconcile 'launch.date' with the accountable owner before publishing status."
      },
      {
        "priority": "P0",
        "type": "fix_evidence",
        "action": "Remove raw source fields (content); keep source bodies in their system of record.",
        "location": "sources[0]"
      },
      {
        "priority": "P0",
        "type": "fix_evidence",
        "action": "Active blocker 'rollback-owner' has no accountable owner; add owner and due_at.",
        "location": "claims[2]"
      },
      {
        "priority": "P0",
        "type": "fix_evidence",
        "action": "Active blocker 'rollback-owner' has no resolution date; add owner and due_at.",
        "location": "claims[2]"
      },
      {
        "priority": "P1",
        "type": "mitigate_risk",
        "claim_id": "capacity-risk",
        "action": "Assign an owner and mitigation for risk 'Peak traffic headroom has not been verified in production-like load tests'."
      },
      {
        "priority": "P2",
        "type": "improve_evidence",
        "action": "Source 'jira-release' was observed 21.667 days ago; policy allows 7 (stale_observation).",
        "location": "sources[0]"
      },
      {
        "priority": "P2",
        "type": "improve_evidence",
        "action": "Source 'jira-release' content was last updated 21.667 days ago; policy allows 3 (stale_source_content).",
        "location": "sources[0]"
      },
      {
        "priority": "P2",
        "type": "improve_evidence",
        "action": "Source 'decision-log' was observed 9.417 days ago; policy allows 7 (stale_observation).",
        "location": "sources[1]"
      },
      {
        "priority": "P2",
        "type": "improve_evidence",
        "action": "Source 'decision-log' content was last updated 9.417 days ago; policy allows 3 (stale_source_content).",
        "location": "sources[1]"
      },
      {
        "priority": "P2",
        "type": "improve_evidence",
        "action": "Active risk 'capacity-risk' has no accountable owner; add owner and mitigation.",
        "location": "claims[3]"
      },
      {
        "priority": "P2",
        "type": "improve_evidence",
        "action": "Active risk 'capacity-risk' has no mitigation; add owner and mitigation.",
        "location": "claims[3]"
      }
    ]
  },
  "brokenReport": "# Truth Review: Checkout migration launch readiness\n\n**Artifact quality:** fail\n**Program health:** blocked\n**As of:** 2026-08-11T00:00:00.000Z\n\n## Scorecard\n\n| Sources | Claims | Facts | Blockers | Risks | Unknowns | Conflicts | Evidence issues | Deprecations |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n| 3 | 4 | 2 | 1 | 1 | 0 | 1 | 9 | 0 |\n\n## Facts\n\n- **`launch-date-jira`:** Jira records the launch date as August 20. Sources: `jira-release`.\n- **`launch-date-decision`:** The decision log records the launch date as August 22. Sources: `decision-log`.\n\n## Blockers\n\n- **`rollback-owner`:** The rollback decision has no accountable owner. Sources: `risk-review`.\n\n## Risks\n\n- **`capacity-risk`:** Peak traffic headroom has not been verified in production-like load tests. Sources: `risk-review`.\n\n## Unknowns\n\n- None.\n\n## Conflicts\n\n- **launch.date:** \"2026-08-20\" vs \"2026-08-22\". Reconcile 'launch.date' with the accountable owner before publishing status.\n\n## Evidence Issues\n\n- **BLOCKING — raw\\_source\\_content** at `sources\\[0\\]`: Remove raw source fields (content); keep source bodies in their system of record.\n- **REVIEW — stale\\_observation** at `sources\\[0\\]`: Source 'jira-release' was observed 21.667 days ago; policy allows 7 (stale\\_observation).\n- **REVIEW — stale\\_source\\_content** at `sources\\[0\\]`: Source 'jira-release' content was last updated 21.667 days ago; policy allows 3 (stale\\_source\\_content).\n- **REVIEW — stale\\_observation** at `sources\\[1\\]`: Source 'decision-log' was observed 9.417 days ago; policy allows 7 (stale\\_observation).\n- **REVIEW — stale\\_source\\_content** at `sources\\[1\\]`: Source 'decision-log' content was last updated 9.417 days ago; policy allows 3 (stale\\_source\\_content).\n- **BLOCKING — blocker\\_missing\\_owner** at `claims\\[2\\]`: Active blocker 'rollback-owner' has no accountable owner; add owner and due\\_at.\n- **BLOCKING — blocker\\_missing\\_due** at `claims\\[2\\]`: Active blocker 'rollback-owner' has no resolution date; add owner and due\\_at.\n- **REVIEW — risk\\_missing\\_owner** at `claims\\[3\\]`: Active risk 'capacity-risk' has no accountable owner; add owner and mitigation.\n- **REVIEW — risk\\_missing\\_mitigation** at `claims\\[3\\]`: Active risk 'capacity-risk' has no mitigation; add owner and mitigation.\n\n## Deprecations\n\n- None.\n\n## Next Actions\n\n- **P0** Assign an owner and resolution date for blocker 'The rollback decision has no accountable owner'.\n- **P0** Reconcile 'launch.date' with the accountable owner before publishing status.\n- **P0** Remove raw source fields (content); keep source bodies in their system of record.\n- **P0** Active blocker 'rollback-owner' has no accountable owner; add owner and due\\_at.\n- **P0** Active blocker 'rollback-owner' has no resolution date; add owner and due\\_at.\n- **P1** Assign an owner and mitigation for risk 'Peak traffic headroom has not been verified in production-like load tests'.\n- **P2** Source 'jira-release' was observed 21.667 days ago; policy allows 7 (stale\\_observation).\n- **P2** Source 'jira-release' content was last updated 21.667 days ago; policy allows 3 (stale\\_source\\_content).\n- **P2** Source 'decision-log' was observed 9.417 days ago; policy allows 7 (stale\\_observation).\n- **P2** Source 'decision-log' content was last updated 9.417 days ago; policy allows 3 (stale\\_source\\_content).\n- **P2** Active risk 'capacity-risk' has no accountable owner; add owner and mitigation.\n- **P2** Active risk 'capacity-risk' has no mitigation; add owner and mitigation.\n\n## Evidence\n\n- `jira-release` (jira) observed 2026-07-20T08:00:00.000Z, source updated 2026-07-20T08:00:00.000Z — https://example.atlassian.net/browse/PLAT-123\n- `decision-log` (decision-log) observed 2026-08-01T14:00:00.000Z, source updated 2026-08-01T14:00:00.000Z — https://example.com/decisions/checkout-launch\n- `risk-review` (meeting-note) observed 2026-08-08T09:00:00.000Z, source updated 2026-08-08T09:00:00.000Z — https://example.com/notes/risk-review\n",
  "fixed": {
    "kind": "status_artifact",
    "schema_version": "1.0.0",
    "as_of": "2026-08-11T00:00:00.000Z",
    "initiative": {
      "name": "Checkout migration launch readiness",
      "owner": "Platform TPM",
      "objective": "Ship the checkout migration on time with verifiable readiness."
    },
    "policy": {
      "max_observation_age_days": 14,
      "max_source_content_age_days": 14
    },
    "sources": [
      {
        "id": "jira-release",
        "type": "jira",
        "url": "https://example.atlassian.net/browse/PLAT-123",
        "observed_at": "2026-08-10T08:00:00.000Z",
        "source_updated_at": "2026-08-10T08:00:00.000Z",
        "owner": "Platform TPM"
      },
      {
        "id": "jira-rollback",
        "type": "jira",
        "url": "https://example.atlassian.net/browse/PLAT-124",
        "observed_at": "2026-08-10T09:00:00.000Z",
        "source_updated_at": "2026-08-10T09:00:00.000Z",
        "owner": "Platform TPM"
      },
      {
        "id": "decision-log",
        "type": "decision-log",
        "url": "https://example.com/decisions/checkout-launch",
        "observed_at": "2026-08-09T14:00:00.000Z",
        "source_updated_at": "2026-08-09T14:00:00.000Z"
      },
      {
        "id": "risk-review",
        "type": "meeting-note",
        "url": "https://example.com/notes/risk-review",
        "observed_at": "2026-08-08T09:00:00.000Z",
        "source_updated_at": "2026-08-08T09:00:00.000Z"
      }
    ],
    "claims": [
      {
        "id": "launch-date",
        "kind": "fact",
        "state": "active",
        "subject": "launch.date",
        "value": "2026-08-20",
        "text": "The decision log and the Jira tracker agree on August 20 as the launch date.",
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          },
          {
            "source_id": "decision-log",
            "locator": "https://example.com/decisions/checkout-launch"
          }
        ]
      },
      {
        "id": "release-freeze",
        "kind": "fact",
        "state": "active",
        "subject": "release.freeze",
        "value": "2026-08-10",
        "text": "Release freeze started August 10 and is in effect.",
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "rollback-owner",
        "kind": "blocker",
        "state": "active",
        "subject": "rollback.owner",
        "value": "unassigned",
        "text": "The rollback decision has no accountable owner; PLAT-124 has no assignee.",
        "owner": "Platform TPM",
        "due_at": "2026-08-14",
        "source_refs": [
          {
            "source_id": "jira-rollback",
            "locator": "https://example.atlassian.net/browse/PLAT-124"
          },
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      },
      {
        "id": "capacity-risk",
        "kind": "risk",
        "state": "active",
        "subject": "capacity.headroom",
        "value": "unverified",
        "text": "Peak traffic headroom has not been verified in production-like load tests.",
        "owner": "Platform Engineering",
        "mitigation": "Run the load test at 200% peak before the release window and sign off on headroom.",
        "source_refs": [
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      }
    ],
    "timeline": [
      {
        "id": "t1",
        "title": "Rollback drill complete",
        "type": "task",
        "start": "2026-07-27",
        "end": "2026-07-27",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "done",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t2",
        "title": "Load test at 200% peak",
        "type": "task",
        "start": "2026-08-14",
        "end": "2026-08-14",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform Engineering",
        "status": "in_progress",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t3",
        "title": "Release freeze",
        "type": "task",
        "start": "2026-08-10",
        "end": "2026-08-10",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "done",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t4",
        "title": "Launch",
        "type": "milestone",
        "start": "2026-08-20",
        "end": "2026-08-20",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [
          "Load test at 200% peak",
          "Rollback drill complete"
        ],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "decision-log",
            "locator": "https://example.com/decisions/checkout-launch"
          }
        ]
      },
      {
        "id": "t5",
        "title": "Rollback owner named",
        "type": "task",
        "start": "2026-08-12",
        "end": "2026-08-12",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      }
    ],
    "baseline_timeline": [
      {
        "id": "t1",
        "title": "Rollback drill complete",
        "type": "task",
        "start": "2026-07-27",
        "end": "2026-07-27",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t2",
        "title": "Load test at 200% peak",
        "type": "task",
        "start": "2026-08-03",
        "end": "2026-08-03",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform Engineering",
        "status": "planned",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t3",
        "title": "Release freeze",
        "type": "task",
        "start": "2026-08-10",
        "end": "2026-08-10",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t4",
        "title": "Launch",
        "type": "milestone",
        "start": "2026-08-17",
        "end": "2026-08-17",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [
          "Load test at 200% peak",
          "Rollback drill complete"
        ],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "decision-log",
            "locator": "https://example.com/decisions/checkout-launch"
          }
        ]
      }
    ]
  },
  "fixedReview": {
    "kind": "truth_review",
    "schema_version": "1.0.0",
    "initiative": {
      "name": "Checkout migration launch readiness",
      "owner": "Platform TPM",
      "objective": "Ship the checkout migration on time with verifiable readiness."
    },
    "as_of": "2026-08-11T00:00:00.000Z",
    "policy": {
      "max_observation_age_days": 14,
      "max_source_content_age_days": 14
    },
    "artifact_quality": "pass",
    "program_health": "blocked",
    "summary": {
      "sources": 4,
      "claims": 4,
      "facts": 2,
      "blockers": 1,
      "risks": 1,
      "unknowns": 0,
      "conflicts": 0,
      "issues": 0,
      "deprecations": 0
    },
    "sources": [
      {
        "id": "jira-release",
        "type": "jira",
        "url": "https://example.atlassian.net/browse/PLAT-123",
        "observed_at": "2026-08-10T08:00:00.000Z",
        "source_updated_at": "2026-08-10T08:00:00.000Z",
        "owner": "Platform TPM"
      },
      {
        "id": "jira-rollback",
        "type": "jira",
        "url": "https://example.atlassian.net/browse/PLAT-124",
        "observed_at": "2026-08-10T09:00:00.000Z",
        "source_updated_at": "2026-08-10T09:00:00.000Z",
        "owner": "Platform TPM"
      },
      {
        "id": "decision-log",
        "type": "decision-log",
        "url": "https://example.com/decisions/checkout-launch",
        "observed_at": "2026-08-09T14:00:00.000Z",
        "source_updated_at": "2026-08-09T14:00:00.000Z"
      },
      {
        "id": "risk-review",
        "type": "meeting-note",
        "url": "https://example.com/notes/risk-review",
        "observed_at": "2026-08-08T09:00:00.000Z",
        "source_updated_at": "2026-08-08T09:00:00.000Z"
      }
    ],
    "claims": [
      {
        "id": "launch-date",
        "kind": "fact",
        "state": "active",
        "subject": "launch.date",
        "value": "2026-08-20",
        "text": "The decision log and the Jira tracker agree on August 20 as the launch date.",
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          },
          {
            "source_id": "decision-log",
            "locator": "https://example.com/decisions/checkout-launch"
          }
        ]
      },
      {
        "id": "release-freeze",
        "kind": "fact",
        "state": "active",
        "subject": "release.freeze",
        "value": "2026-08-10",
        "text": "Release freeze started August 10 and is in effect.",
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "rollback-owner",
        "kind": "blocker",
        "state": "active",
        "subject": "rollback.owner",
        "value": "unassigned",
        "text": "The rollback decision has no accountable owner; PLAT-124 has no assignee.",
        "owner": "Platform TPM",
        "due_at": "2026-08-14T00:00:00.000Z",
        "source_refs": [
          {
            "source_id": "jira-rollback",
            "locator": "https://example.atlassian.net/browse/PLAT-124"
          },
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      },
      {
        "id": "capacity-risk",
        "kind": "risk",
        "state": "active",
        "subject": "capacity.headroom",
        "value": "unverified",
        "text": "Peak traffic headroom has not been verified in production-like load tests.",
        "owner": "Platform Engineering",
        "mitigation": "Run the load test at 200% peak before the release window and sign off on headroom.",
        "source_refs": [
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      }
    ],
    "timeline": [
      {
        "id": "t1",
        "title": "Rollback drill complete",
        "type": "task",
        "start": "2026-07-27",
        "end": "2026-07-27",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "done",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t2",
        "title": "Load test at 200% peak",
        "type": "task",
        "start": "2026-08-14",
        "end": "2026-08-14",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform Engineering",
        "status": "in_progress",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t3",
        "title": "Release freeze",
        "type": "task",
        "start": "2026-08-10",
        "end": "2026-08-10",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "done",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t4",
        "title": "Launch",
        "type": "milestone",
        "start": "2026-08-20",
        "end": "2026-08-20",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [
          "Load test at 200% peak",
          "Rollback drill complete"
        ],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "decision-log",
            "locator": "https://example.com/decisions/checkout-launch"
          }
        ]
      },
      {
        "id": "t5",
        "title": "Rollback owner named",
        "type": "task",
        "start": "2026-08-12",
        "end": "2026-08-12",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      }
    ],
    "timeline_drift": {
      "added": [
        {
          "key": "t5",
          "item": {
            "id": "t5",
            "title": "Rollback owner named",
            "type": "task",
            "start": "2026-08-12",
            "end": "2026-08-12",
            "duration": "1d",
            "exact_date_needed": false,
            "owner": "Platform TPM",
            "status": "planned",
            "dependencies": [],
            "date_derivation": "explicit",
            "evidence_grade": "exact",
            "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
            "missing_title": false,
            "dangerous_fields": [],
            "source_refs": [
              {
                "source_id": "risk-review",
                "locator": "https://example.com/notes/risk-review"
              }
            ]
          }
        }
      ],
      "removed": [],
      "changed": [
        {
          "key": "t1",
          "title": "Rollback drill complete",
          "changes": [
            "status"
          ],
          "from": {
            "status": "planned"
          },
          "to": {
            "status": "done"
          }
        },
        {
          "key": "t2",
          "title": "Load test at 200% peak",
          "changes": [
            "start",
            "end",
            "status"
          ],
          "from": {
            "start": "2026-08-03",
            "end": "2026-08-03",
            "status": "planned"
          },
          "to": {
            "start": "2026-08-14",
            "end": "2026-08-14",
            "status": "in_progress"
          }
        },
        {
          "key": "t3",
          "title": "Release freeze",
          "changes": [
            "status"
          ],
          "from": {
            "status": "planned"
          },
          "to": {
            "status": "done"
          }
        },
        {
          "key": "t4",
          "title": "Launch",
          "changes": [
            "start",
            "end"
          ],
          "from": {
            "start": "2026-08-17",
            "end": "2026-08-17"
          },
          "to": {
            "start": "2026-08-20",
            "end": "2026-08-20"
          }
        }
      ],
      "unchanged": [],
      "summary": {
        "baseline": 4,
        "current": 5,
        "added": 1,
        "removed": 0,
        "changed": 4,
        "unchanged": 0
      }
    },
    "findings": {
      "facts": [
        {
          "id": "launch-date",
          "kind": "fact",
          "state": "active",
          "subject": "launch.date",
          "value": "2026-08-20",
          "text": "The decision log and the Jira tracker agree on August 20 as the launch date.",
          "source_refs": [
            {
              "source_id": "jira-release",
              "locator": "https://example.atlassian.net/browse/PLAT-123"
            },
            {
              "source_id": "decision-log",
              "locator": "https://example.com/decisions/checkout-launch"
            }
          ]
        },
        {
          "id": "release-freeze",
          "kind": "fact",
          "state": "active",
          "subject": "release.freeze",
          "value": "2026-08-10",
          "text": "Release freeze started August 10 and is in effect.",
          "source_refs": [
            {
              "source_id": "jira-release",
              "locator": "https://example.atlassian.net/browse/PLAT-123"
            }
          ]
        }
      ],
      "blockers": [
        {
          "id": "rollback-owner",
          "kind": "blocker",
          "state": "active",
          "subject": "rollback.owner",
          "value": "unassigned",
          "text": "The rollback decision has no accountable owner; PLAT-124 has no assignee.",
          "owner": "Platform TPM",
          "due_at": "2026-08-14T00:00:00.000Z",
          "source_refs": [
            {
              "source_id": "jira-rollback",
              "locator": "https://example.atlassian.net/browse/PLAT-124"
            },
            {
              "source_id": "risk-review",
              "locator": "https://example.com/notes/risk-review"
            }
          ]
        }
      ],
      "risks": [
        {
          "id": "capacity-risk",
          "kind": "risk",
          "state": "active",
          "subject": "capacity.headroom",
          "value": "unverified",
          "text": "Peak traffic headroom has not been verified in production-like load tests.",
          "owner": "Platform Engineering",
          "mitigation": "Run the load test at 200% peak before the release window and sign off on headroom.",
          "source_refs": [
            {
              "source_id": "risk-review",
              "locator": "https://example.com/notes/risk-review"
            }
          ]
        }
      ],
      "unknowns": [],
      "conflicts": [],
      "issues": [],
      "deprecations": []
    },
    "recommended_actions": [
      {
        "priority": "P0",
        "type": "resolve_blocker",
        "claim_id": "rollback-owner",
        "action": "Resolve blocker 'The rollback decision has no accountable owner; PLAT-124 has no assignee' with Platform TPM by 2026-08-14."
      },
      {
        "priority": "P1",
        "type": "mitigate_risk",
        "claim_id": "capacity-risk",
        "action": "Track mitigation for risk 'Peak traffic headroom has not been verified in production-like load tests' with Platform Engineering."
      }
    ]
  },
  "fixedReport": "# Truth Review: Checkout migration launch readiness\n\n**Artifact quality:** pass\n**Program health:** blocked\n**As of:** 2026-08-11T00:00:00.000Z\n\n## Scorecard\n\n| Sources | Claims | Facts | Blockers | Risks | Unknowns | Conflicts | Evidence issues | Deprecations |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n| 4 | 4 | 2 | 1 | 1 | 0 | 0 | 0 | 0 |\n\n## Facts\n\n- **`launch-date`:** The decision log and the Jira tracker agree on August 20 as the launch date. Sources: `jira-release`, `decision-log`.\n- **`release-freeze`:** Release freeze started August 10 and is in effect. Sources: `jira-release`.\n\n## Blockers\n\n- **`rollback-owner`:** The rollback decision has no accountable owner; PLAT-124 has no assignee. Owner: Platform TPM. Due: 2026-08-14. Sources: `jira-rollback`, `risk-review`.\n\n## Risks\n\n- **`capacity-risk`:** Peak traffic headroom has not been verified in production-like load tests. Owner: Platform Engineering. Sources: `risk-review`.\n\n## Unknowns\n\n- None.\n\n## Conflicts\n\n- None.\n\n## Timeline Drift\n\n**Baseline:** 4 items — **Current:** 5 items — **Added:** 1 — **Removed:** 0 — **Changed:** 4 — **Unchanged:** 0\n\n### Added\n\n- **Rollback owner named** (2026-08-12, planned)\n\n### Removed\n\n- None.\n\n### Changed\n\n- **Rollback drill complete:** status planned -> done\n- **Load test at 200% peak:** start 2026-08-03 -> 2026-08-14; end 2026-08-03 -> 2026-08-14; status planned -> in_progress\n- **Release freeze:** status planned -> done\n- **Launch:** start 2026-08-17 -> 2026-08-20; end 2026-08-17 -> 2026-08-20\n\n## Evidence Issues\n\n- None.\n\n## Deprecations\n\n- None.\n\n## Next Actions\n\n- **P0** Resolve blocker 'The rollback decision has no accountable owner; PLAT-124 has no assignee' with Platform TPM by 2026-08-14.\n- **P1** Track mitigation for risk 'Peak traffic headroom has not been verified in production-like load tests' with Platform Engineering.\n\n## Evidence\n\n- `jira-release` (jira) observed 2026-08-10T08:00:00.000Z, source updated 2026-08-10T08:00:00.000Z — https://example.atlassian.net/browse/PLAT-123\n- `jira-rollback` (jira) observed 2026-08-10T09:00:00.000Z, source updated 2026-08-10T09:00:00.000Z — https://example.atlassian.net/browse/PLAT-124\n- `decision-log` (decision-log) observed 2026-08-09T14:00:00.000Z, source updated 2026-08-09T14:00:00.000Z — https://example.com/decisions/checkout-launch\n- `risk-review` (meeting-note) observed 2026-08-08T09:00:00.000Z, source updated 2026-08-08T09:00:00.000Z — https://example.com/notes/risk-review\n",
  "baseline": {
    "public_safe": true,
    "plan": "Launch readiness baseline",
    "as_of": "2026-07-20T00:00:00.000Z",
    "timeline": [
      {
        "id": "t1",
        "title": "Rollback drill complete",
        "type": "task",
        "start": "2026-07-27",
        "end": "2026-07-27",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t2",
        "title": "Load test at 200% peak",
        "type": "task",
        "start": "2026-08-03",
        "end": "2026-08-03",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform Engineering",
        "status": "planned",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t3",
        "title": "Release freeze",
        "type": "task",
        "start": "2026-08-10",
        "end": "2026-08-10",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t4",
        "title": "Launch",
        "type": "milestone",
        "start": "2026-08-17",
        "end": "2026-08-17",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [
          "Load test at 200% peak",
          "Rollback drill complete"
        ],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "decision-log",
            "locator": "https://example.com/decisions/checkout-launch"
          }
        ]
      }
    ]
  },
  "current": {
    "public_safe": true,
    "plan": "Launch readiness current plan",
    "as_of": "2026-08-11T00:00:00.000Z",
    "timeline": [
      {
        "id": "t1",
        "title": "Rollback drill complete",
        "type": "task",
        "start": "2026-07-27",
        "end": "2026-07-27",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "done",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t2",
        "title": "Load test at 200% peak",
        "type": "task",
        "start": "2026-08-14",
        "end": "2026-08-14",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform Engineering",
        "status": "in_progress",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t3",
        "title": "Release freeze",
        "type": "task",
        "start": "2026-08-10",
        "end": "2026-08-10",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "done",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "jira-release",
            "locator": "https://example.atlassian.net/browse/PLAT-123"
          }
        ]
      },
      {
        "id": "t4",
        "title": "Launch",
        "type": "milestone",
        "start": "2026-08-20",
        "end": "2026-08-20",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [
          "Load test at 200% peak",
          "Rollback drill complete"
        ],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "decision-log",
            "locator": "https://example.com/decisions/checkout-launch"
          }
        ]
      },
      {
        "id": "t5",
        "title": "Rollback owner named",
        "type": "task",
        "start": "2026-08-12",
        "end": "2026-08-12",
        "duration": "1d",
        "exact_date_needed": false,
        "owner": "Platform TPM",
        "status": "planned",
        "dependencies": [],
        "date_derivation": "explicit",
        "evidence_grade": "exact",
        "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
        "missing_title": false,
        "dangerous_fields": [],
        "source_refs": [
          {
            "source_id": "risk-review",
            "locator": "https://example.com/notes/risk-review"
          }
        ]
      }
    ]
  },
  "drift": {
    "added": [
      {
        "key": "t5",
        "item": {
          "id": "t5",
          "title": "Rollback owner named",
          "type": "task",
          "start": "2026-08-12",
          "end": "2026-08-12",
          "duration": "1d",
          "exact_date_needed": false,
          "owner": "Platform TPM",
          "status": "planned",
          "dependencies": [],
          "date_derivation": "explicit",
          "evidence_grade": "exact",
          "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
          "missing_title": false,
          "dangerous_fields": [],
          "source_refs": [
            {
              "source_id": "risk-review",
              "locator": "https://example.com/notes/risk-review"
            }
          ]
        }
      }
    ],
    "removed": [],
    "changed": [
      {
        "key": "t1",
        "title": "Rollback drill complete",
        "changes": [
          "status"
        ],
        "from": {
          "status": "planned"
        },
        "to": {
          "status": "done"
        }
      },
      {
        "key": "t2",
        "title": "Load test at 200% peak",
        "changes": [
          "start",
          "end",
          "status"
        ],
        "from": {
          "start": "2026-08-03",
          "end": "2026-08-03",
          "status": "planned"
        },
        "to": {
          "start": "2026-08-14",
          "end": "2026-08-14",
          "status": "in_progress"
        }
      },
      {
        "key": "t3",
        "title": "Release freeze",
        "changes": [
          "status"
        ],
        "from": {
          "status": "planned"
        },
        "to": {
          "status": "done"
        }
      },
      {
        "key": "t4",
        "title": "Launch",
        "changes": [
          "start",
          "end"
        ],
        "from": {
          "start": "2026-08-17",
          "end": "2026-08-17"
        },
        "to": {
          "start": "2026-08-20",
          "end": "2026-08-20"
        }
      }
    ],
    "unchanged": [],
    "summary": {
      "baseline": 4,
      "current": 5,
      "added": 1,
      "removed": 0,
      "changed": 4,
      "unchanged": 0
    }
  },
  "driftMarkdown": "# Timeline Drift\n\n**Baseline:** 4 items — **Current:** 5 items — **Added:** 1 — **Removed:** 0 — **Changed:** 4 — **Unchanged:** 0\n\n### Added\n\n- **Rollback owner named** (2026-08-12, planned)\n\n### Removed\n\n- None.\n\n### Changed\n\n- **Rollback drill complete:** status planned -> done\n- **Load test at 200% peak:** start 2026-08-03 -> 2026-08-14; end 2026-08-03 -> 2026-08-14; status planned -> in_progress\n- **Release freeze:** status planned -> done\n- **Launch:** start 2026-08-17 -> 2026-08-20; end 2026-08-17 -> 2026-08-20\n",
  "sibling": {
    "capture": {
      "kind": "capture_truth_evidence_pack",
      "schema_version": "0.4.0",
      "generated_at": "2026-08-11T00:00:00.000Z",
      "sources": [
        {
          "id": "jira-release",
          "type": "jira",
          "observed_at": "2026-08-10T08:00:00.000Z",
          "locator": "https://example.atlassian.net/browse/PLAT-123",
          "content_hash": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
          "raw_included": false
        },
        {
          "id": "jira-rollback",
          "type": "jira",
          "observed_at": "2026-08-10T09:00:00.000Z",
          "locator": "https://example.atlassian.net/browse/PLAT-124",
          "content_hash": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
          "raw_included": false
        },
        {
          "id": "decision-log",
          "type": "decision-log",
          "observed_at": "2026-08-09T14:00:00.000Z",
          "locator": "https://example.com/decisions/checkout-launch",
          "content_hash": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
          "raw_included": false
        },
        {
          "id": "risk-review",
          "type": "meeting-note",
          "observed_at": "2026-08-08T09:00:00.000Z",
          "locator": "https://example.com/notes/risk-review",
          "content_hash": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
          "raw_included": false
        }
      ],
      "candidate_claims": [],
      "diagnostics": [
        {
          "type": "missing_locator",
          "severity": "warning",
          "source_id": "jira-release",
          "message": "locator was not supplied; a stable fallback was used."
        },
        {
          "type": "missing_locator",
          "severity": "warning",
          "source_id": "jira-rollback",
          "message": "locator was not supplied; a stable fallback was used."
        },
        {
          "type": "missing_locator",
          "severity": "warning",
          "source_id": "decision-log",
          "message": "locator was not supplied; a stable fallback was used."
        },
        {
          "type": "missing_locator",
          "severity": "warning",
          "source_id": "risk-review",
          "message": "locator was not supplied; a stable fallback was used."
        }
      ],
      "summary": {
        "source_count": 4,
        "candidate_claim_count": 0,
        "diagnostic_count": 4,
        "raw_included_count": 0
      }
    },
    "timeline": {
      "kind": "timeline",
      "schema_version": "0.3.0",
      "version": "0.3.0",
      "items": [
        {
          "id": "t1",
          "title": "Rollback drill complete",
          "type": "task",
          "start": "2026-07-27",
          "end": "2026-07-27",
          "duration": "1d",
          "exact_date_needed": false,
          "owner": "Platform TPM",
          "status": "done",
          "dependencies": [],
          "date_derivation": "explicit",
          "evidence_grade": "exact",
          "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
          "missing_title": false,
          "dangerous_fields": [],
          "source_refs": [
            {
              "source_id": "jira-release",
              "locator": "https://example.atlassian.net/browse/PLAT-123"
            }
          ]
        },
        {
          "id": "t2",
          "title": "Load test at 200% peak",
          "type": "task",
          "start": "2026-08-14",
          "end": "2026-08-14",
          "duration": "1d",
          "exact_date_needed": false,
          "owner": "Platform Engineering",
          "status": "in_progress",
          "dependencies": [],
          "date_derivation": "explicit",
          "evidence_grade": "exact",
          "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
          "missing_title": false,
          "dangerous_fields": [],
          "source_refs": [
            {
              "source_id": "jira-release",
              "locator": "https://example.atlassian.net/browse/PLAT-123"
            }
          ]
        },
        {
          "id": "t3",
          "title": "Release freeze",
          "type": "task",
          "start": "2026-08-10",
          "end": "2026-08-10",
          "duration": "1d",
          "exact_date_needed": false,
          "owner": "Platform TPM",
          "status": "done",
          "dependencies": [],
          "date_derivation": "explicit",
          "evidence_grade": "exact",
          "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
          "missing_title": false,
          "dangerous_fields": [],
          "source_refs": [
            {
              "source_id": "jira-release",
              "locator": "https://example.atlassian.net/browse/PLAT-123"
            }
          ]
        },
        {
          "id": "t4",
          "title": "Launch",
          "type": "milestone",
          "start": "2026-08-20",
          "end": "2026-08-20",
          "duration": "1d",
          "exact_date_needed": false,
          "owner": "Platform TPM",
          "status": "planned",
          "dependencies": [
            "Load test at 200% peak",
            "Rollback drill complete"
          ],
          "date_derivation": "explicit",
          "evidence_grade": "exact",
          "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
          "missing_title": false,
          "dangerous_fields": [],
          "source_refs": [
            {
              "source_id": "decision-log",
              "locator": "https://example.com/decisions/checkout-launch"
            }
          ]
        },
        {
          "id": "t5",
          "title": "Rollback owner named",
          "type": "task",
          "start": "2026-08-12",
          "end": "2026-08-12",
          "duration": "1d",
          "exact_date_needed": false,
          "owner": "Platform TPM",
          "status": "planned",
          "dependencies": [],
          "date_derivation": "explicit",
          "evidence_grade": "exact",
          "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
          "missing_title": false,
          "dangerous_fields": [],
          "source_refs": [
            {
              "source_id": "risk-review",
              "locator": "https://example.com/notes/risk-review"
            }
          ]
        }
      ],
      "milestones": [
        {
          "id": "t4",
          "title": "Launch",
          "type": "milestone",
          "start": "2026-08-20",
          "end": "2026-08-20",
          "duration": "1d",
          "exact_date_needed": false,
          "owner": "Platform TPM",
          "status": "planned",
          "dependencies": [
            "Load test at 200% peak",
            "Rollback drill complete"
          ],
          "date_derivation": "explicit",
          "evidence_grade": "exact",
          "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
          "missing_title": false,
          "dangerous_fields": [],
          "source_refs": [
            {
              "source_id": "decision-log",
              "locator": "https://example.com/decisions/checkout-launch"
            }
          ]
        }
      ],
      "assumptions": [
        "No dates were inferred. Missing dates are reported as gaps for agent or user follow-up.",
        "Critical path is not computed: it cannot be determined defensibly when dates or durations are missing."
      ],
      "gaps": [],
      "issues": [],
      "render": {
        "audience": "TPM/PM",
        "defaultFormats": [
          "mermaid_gantt",
          "mermaid_timeline",
          "markdown",
          "review_report"
        ]
      }
    },
    "diff": {
      "schema_version": "0.3.0",
      "baseline": {
        "label": "baseline",
        "item_count": 4
      },
      "current": {
        "label": "current",
        "item_count": 5
      },
      "summary": {
        "matched": 4,
        "changed": 4,
        "unchanged": 0,
        "added": 1,
        "removed": 0,
        "new_issues": 0,
        "ambiguous_matches": 0
      },
      "changes": [
        {
          "type": "status_changed",
          "category": "status",
          "field": "status",
          "old": "planned",
          "new": "done",
          "message": "\"Rollback drill complete\" status changed from planned to done.",
          "itemTitle": "Rollback drill complete",
          "itemId": "t1"
        },
        {
          "type": "range_changed",
          "category": "schedule",
          "field": "range",
          "old": "2026-08-03 to 2026-08-03",
          "new": "2026-08-14 to 2026-08-14",
          "message": "\"Load test at 200% peak\" range changed from 2026-08-03 to 2026-08-03 to 2026-08-14 to 2026-08-14.",
          "itemTitle": "Load test at 200% peak",
          "itemId": "t2"
        },
        {
          "type": "status_changed",
          "category": "status",
          "field": "status",
          "old": "planned",
          "new": "in_progress",
          "message": "\"Load test at 200% peak\" status changed from planned to in_progress.",
          "itemTitle": "Load test at 200% peak",
          "itemId": "t2"
        },
        {
          "type": "status_changed",
          "category": "status",
          "field": "status",
          "old": "planned",
          "new": "done",
          "message": "\"Release freeze\" status changed from planned to done.",
          "itemTitle": "Release freeze",
          "itemId": "t3"
        },
        {
          "type": "range_changed",
          "category": "schedule",
          "field": "range",
          "old": "2026-08-17 to 2026-08-17",
          "new": "2026-08-20 to 2026-08-20",
          "message": "\"Launch\" range changed from 2026-08-17 to 2026-08-17 to 2026-08-20 to 2026-08-20.",
          "itemTitle": "Launch",
          "itemId": "t4"
        },
        {
          "type": "added",
          "category": "scope",
          "itemTitle": "Rollback owner named",
          "itemId": "t5",
          "item": {
            "id": "t5",
            "title": "Rollback owner named",
            "type": "task",
            "start": "2026-08-12",
            "end": "2026-08-12",
            "duration": "1d",
            "exact_date_needed": false,
            "owner": "Platform TPM",
            "status": "planned",
            "dependencies": [],
            "date_derivation": "explicit",
            "evidence_grade": "exact",
            "evidence_reason": "Exact date evidence (YYYY-MM-DD) found in source text.",
            "missing_title": false,
            "dangerous_fields": [],
            "source_refs": [
              {
                "source_id": "risk-review",
                "locator": "https://example.com/notes/risk-review"
              }
            ]
          },
          "message": "\"Rollback owner named\" was added to the current timeline."
        }
      ],
      "new_issues": [],
      "ambiguities": [],
      "critical_path": {
        "computed": false,
        "reason": "Critical path is not computed. It cannot be determined defensibly with incomplete data: missing dates, durations, or owners leave the schedule under-constrained."
      }
    },
    "program": {
      "artifact": {
        "kind": "status_artifact",
        "schema_version": "1.0.0",
        "as_of": "2026-08-11T09:00:00.000Z",
        "initiative": {
          "name": "Launch Readiness",
          "owner": "Program Operator",
          "objective": "Ship the billing + quota + campaign launch by 2026-08-28 with a clean release call."
        },
        "policy": {
          "max_observation_age_days": 14,
          "max_source_content_age_days": 14
        },
        "sources": [
          {
            "id": "jira-billing",
            "type": "jira",
            "url": "https://demo.atlassian.net/browse/BILL-920",
            "observed_at": "2026-08-11T08:00:00.000Z",
            "source_updated_at": "2026-08-11T08:00:00.000Z",
            "owner": "Eng Lead A"
          },
          {
            "id": "jira-quota",
            "type": "jira",
            "url": "https://demo.atlassian.net/browse/QUOTA-311",
            "observed_at": "2026-08-11T08:00:00.000Z",
            "source_updated_at": "2026-08-11T08:00:00.000Z",
            "owner": "Eng Lead B"
          },
          {
            "id": "jira-campaign",
            "type": "jira",
            "url": "https://demo.atlassian.net/browse/CMP-188",
            "observed_at": "2026-08-11T08:00:00.000Z",
            "source_updated_at": "2026-08-11T08:00:00.000Z",
            "owner": "Eng Lead C"
          },
          {
            "id": "confluence-sync",
            "type": "confluence",
            "url": "https://demo.atlassian.net/wiki/spaces/PLAT/pages/2026-08-07",
            "observed_at": "2026-08-07T15:00:00.000Z",
            "source_updated_at": "2026-08-07T15:00:00.000Z",
            "owner": "Program Operator"
          },
          {
            "id": "local-status",
            "type": "local",
            "path": "status/2026-08-10.md",
            "observed_at": "2026-08-10T18:00:00.000Z",
            "source_updated_at": "2026-08-10T18:00:00.000Z",
            "owner": "Program Operator"
          }
        ],
        "claims": [
          {
            "id": "fact-billing-done",
            "kind": "fact",
            "state": "active",
            "subject": "billing.scope",
            "value": "complete",
            "text": "All billing required tasks (children of BILL-920) are Done.",
            "source_refs": [
              {
                "source_id": "jira-billing",
                "locator": "https://demo.atlassian.net/browse/BILL-920"
              }
            ]
          },
          {
            "id": "fact-quota-open",
            "kind": "fact",
            "state": "active",
            "subject": "quota.task",
            "value": "open",
            "text": "Quota API task QUOTA-311 remains open with no assignee.",
            "source_refs": [
              {
                "source_id": "jira-quota",
                "locator": "https://demo.atlassian.net/browse/QUOTA-311"
              }
            ]
          },
          {
            "id": "fact-campaign-waiting",
            "kind": "fact",
            "state": "active",
            "subject": "campaign.integration",
            "value": "waiting_on_quota",
            "text": "Campaign orchestration integration validation is waiting on the quota API.",
            "source_refs": [
              {
                "source_id": "jira-campaign",
                "locator": "https://demo.atlassian.net/browse/CMP-188"
              }
            ]
          },
          {
            "id": "fact-qa-pending",
            "kind": "fact",
            "state": "active",
            "subject": "qa.signoff",
            "value": "pending",
            "text": "The 2026-08-07 sync note records QA sign-off as pending until integration validation completes.",
            "source_refs": [
              {
                "source_id": "confluence-sync",
                "locator": "https://demo.atlassian.net/wiki/spaces/PLAT/pages/2026-08-07"
              }
            ]
          },
          {
            "id": "blocker-quota",
            "kind": "blocker",
            "state": "active",
            "subject": "release.gate",
            "value": "quota",
            "text": "Release and campaign integration validation are blocked by the open quota API contract task QUOTA-311.",
            "owner": "Eng Lead B",
            "due_at": "2026-08-18",
            "source_refs": [
              {
                "source_id": "jira-quota",
                "locator": "https://demo.atlassian.net/browse/QUOTA-311"
              }
            ]
          },
          {
            "id": "risk-quota-slip",
            "kind": "risk",
            "state": "active",
            "subject": "release.date",
            "value": "at_risk",
            "text": "Quota API could slip past 2026-08-18 and push the launch date.",
            "owner": "Program Operator",
            "mitigation": "Daily sync with quota service owner; pre-approve contract freeze; identify fallback scope cut for campaign orchestration.",
            "source_refs": [
              {
                "source_id": "jira-quota",
                "locator": "https://demo.atlassian.net/browse/QUOTA-311"
              }
            ]
          },
          {
            "id": "unknown-quota-eta",
            "kind": "unknown",
            "state": "active",
            "text": "Quota API completion ETA from the quota service owner is unconfirmed.",
            "owner": "Eng Lead B",
            "source_refs": [
              {
                "source_id": "jira-quota",
                "locator": "https://demo.atlassian.net/browse/QUOTA-311"
              }
            ]
          },
          {
            "id": "unknown-staging-signoff",
            "kind": "unknown",
            "state": "active",
            "text": "No dated confirmation of staging sign-off after 2026-08-10.",
            "owner": "QA Lead",
            "source_refs": [
              {
                "source_id": "local-status",
                "locator": "status/2026-08-10.md"
              }
            ]
          }
        ]
      },
      "review": {
        "kind": "truth_review",
        "schema_version": "1.0.0",
        "initiative": {
          "name": "Launch Readiness",
          "owner": "Program Operator",
          "objective": "Ship the billing + quota + campaign launch by 2026-08-28 with a clean release call."
        },
        "as_of": "2026-08-11T09:00:00.000Z",
        "policy": {
          "max_observation_age_days": 14,
          "max_source_content_age_days": 14
        },
        "artifact_quality": "pass",
        "program_health": "blocked",
        "summary": {
          "sources": 5,
          "claims": 8,
          "facts": 4,
          "blockers": 1,
          "risks": 1,
          "unknowns": 2,
          "conflicts": 0,
          "issues": 0,
          "deprecations": 0
        },
        "sources": [
          {
            "id": "jira-billing",
            "type": "jira",
            "url": "https://demo.atlassian.net/browse/BILL-920",
            "observed_at": "2026-08-11T08:00:00.000Z",
            "source_updated_at": "2026-08-11T08:00:00.000Z",
            "owner": "Eng Lead A"
          },
          {
            "id": "jira-quota",
            "type": "jira",
            "url": "https://demo.atlassian.net/browse/QUOTA-311",
            "observed_at": "2026-08-11T08:00:00.000Z",
            "source_updated_at": "2026-08-11T08:00:00.000Z",
            "owner": "Eng Lead B"
          },
          {
            "id": "jira-campaign",
            "type": "jira",
            "url": "https://demo.atlassian.net/browse/CMP-188",
            "observed_at": "2026-08-11T08:00:00.000Z",
            "source_updated_at": "2026-08-11T08:00:00.000Z",
            "owner": "Eng Lead C"
          },
          {
            "id": "confluence-sync",
            "type": "confluence",
            "url": "https://demo.atlassian.net/wiki/spaces/PLAT/pages/2026-08-07",
            "observed_at": "2026-08-07T15:00:00.000Z",
            "source_updated_at": "2026-08-07T15:00:00.000Z",
            "owner": "Program Operator"
          },
          {
            "id": "local-status",
            "type": "local",
            "path": "status/2026-08-10.md",
            "observed_at": "2026-08-10T18:00:00.000Z",
            "source_updated_at": "2026-08-10T18:00:00.000Z",
            "owner": "Program Operator"
          }
        ],
        "claims": [
          {
            "id": "fact-billing-done",
            "kind": "fact",
            "state": "active",
            "subject": "billing.scope",
            "value": "complete",
            "text": "All billing required tasks (children of BILL-920) are Done.",
            "source_refs": [
              {
                "source_id": "jira-billing",
                "locator": "https://demo.atlassian.net/browse/BILL-920"
              }
            ]
          },
          {
            "id": "fact-quota-open",
            "kind": "fact",
            "state": "active",
            "subject": "quota.task",
            "value": "open",
            "text": "Quota API task QUOTA-311 remains open with no assignee.",
            "source_refs": [
              {
                "source_id": "jira-quota",
                "locator": "https://demo.atlassian.net/browse/QUOTA-311"
              }
            ]
          },
          {
            "id": "fact-campaign-waiting",
            "kind": "fact",
            "state": "active",
            "subject": "campaign.integration",
            "value": "waiting_on_quota",
            "text": "Campaign orchestration integration validation is waiting on the quota API.",
            "source_refs": [
              {
                "source_id": "jira-campaign",
                "locator": "https://demo.atlassian.net/browse/CMP-188"
              }
            ]
          },
          {
            "id": "fact-qa-pending",
            "kind": "fact",
            "state": "active",
            "subject": "qa.signoff",
            "value": "pending",
            "text": "The 2026-08-07 sync note records QA sign-off as pending until integration validation completes.",
            "source_refs": [
              {
                "source_id": "confluence-sync",
                "locator": "https://demo.atlassian.net/wiki/spaces/PLAT/pages/2026-08-07"
              }
            ]
          },
          {
            "id": "blocker-quota",
            "kind": "blocker",
            "state": "active",
            "subject": "release.gate",
            "value": "quota",
            "text": "Release and campaign integration validation are blocked by the open quota API contract task QUOTA-311.",
            "owner": "Eng Lead B",
            "due_at": "2026-08-18T00:00:00.000Z",
            "source_refs": [
              {
                "source_id": "jira-quota",
                "locator": "https://demo.atlassian.net/browse/QUOTA-311"
              }
            ]
          },
          {
            "id": "risk-quota-slip",
            "kind": "risk",
            "state": "active",
            "subject": "release.date",
            "value": "at_risk",
            "text": "Quota API could slip past 2026-08-18 and push the launch date.",
            "owner": "Program Operator",
            "mitigation": "Daily sync with quota service owner; pre-approve contract freeze; identify fallback scope cut for campaign orchestration.",
            "source_refs": [
              {
                "source_id": "jira-quota",
                "locator": "https://demo.atlassian.net/browse/QUOTA-311"
              }
            ]
          },
          {
            "id": "unknown-quota-eta",
            "kind": "unknown",
            "state": "active",
            "text": "Quota API completion ETA from the quota service owner is unconfirmed.",
            "owner": "Eng Lead B",
            "source_refs": [
              {
                "source_id": "jira-quota",
                "locator": "https://demo.atlassian.net/browse/QUOTA-311"
              }
            ]
          },
          {
            "id": "unknown-staging-signoff",
            "kind": "unknown",
            "state": "active",
            "text": "No dated confirmation of staging sign-off after 2026-08-10.",
            "owner": "QA Lead",
            "source_refs": [
              {
                "source_id": "local-status",
                "locator": "status/2026-08-10.md"
              }
            ]
          }
        ],
        "findings": {
          "facts": [
            {
              "id": "fact-billing-done",
              "kind": "fact",
              "state": "active",
              "subject": "billing.scope",
              "value": "complete",
              "text": "All billing required tasks (children of BILL-920) are Done.",
              "source_refs": [
                {
                  "source_id": "jira-billing",
                  "locator": "https://demo.atlassian.net/browse/BILL-920"
                }
              ]
            },
            {
              "id": "fact-quota-open",
              "kind": "fact",
              "state": "active",
              "subject": "quota.task",
              "value": "open",
              "text": "Quota API task QUOTA-311 remains open with no assignee.",
              "source_refs": [
                {
                  "source_id": "jira-quota",
                  "locator": "https://demo.atlassian.net/browse/QUOTA-311"
                }
              ]
            },
            {
              "id": "fact-campaign-waiting",
              "kind": "fact",
              "state": "active",
              "subject": "campaign.integration",
              "value": "waiting_on_quota",
              "text": "Campaign orchestration integration validation is waiting on the quota API.",
              "source_refs": [
                {
                  "source_id": "jira-campaign",
                  "locator": "https://demo.atlassian.net/browse/CMP-188"
                }
              ]
            },
            {
              "id": "fact-qa-pending",
              "kind": "fact",
              "state": "active",
              "subject": "qa.signoff",
              "value": "pending",
              "text": "The 2026-08-07 sync note records QA sign-off as pending until integration validation completes.",
              "source_refs": [
                {
                  "source_id": "confluence-sync",
                  "locator": "https://demo.atlassian.net/wiki/spaces/PLAT/pages/2026-08-07"
                }
              ]
            }
          ],
          "blockers": [
            {
              "id": "blocker-quota",
              "kind": "blocker",
              "state": "active",
              "subject": "release.gate",
              "value": "quota",
              "text": "Release and campaign integration validation are blocked by the open quota API contract task QUOTA-311.",
              "owner": "Eng Lead B",
              "due_at": "2026-08-18T00:00:00.000Z",
              "source_refs": [
                {
                  "source_id": "jira-quota",
                  "locator": "https://demo.atlassian.net/browse/QUOTA-311"
                }
              ]
            }
          ],
          "risks": [
            {
              "id": "risk-quota-slip",
              "kind": "risk",
              "state": "active",
              "subject": "release.date",
              "value": "at_risk",
              "text": "Quota API could slip past 2026-08-18 and push the launch date.",
              "owner": "Program Operator",
              "mitigation": "Daily sync with quota service owner; pre-approve contract freeze; identify fallback scope cut for campaign orchestration.",
              "source_refs": [
                {
                  "source_id": "jira-quota",
                  "locator": "https://demo.atlassian.net/browse/QUOTA-311"
                }
              ]
            }
          ],
          "unknowns": [
            {
              "id": "unknown-quota-eta",
              "kind": "unknown",
              "state": "active",
              "text": "Quota API completion ETA from the quota service owner is unconfirmed.",
              "owner": "Eng Lead B",
              "source_refs": [
                {
                  "source_id": "jira-quota",
                  "locator": "https://demo.atlassian.net/browse/QUOTA-311"
                }
              ]
            },
            {
              "id": "unknown-staging-signoff",
              "kind": "unknown",
              "state": "active",
              "text": "No dated confirmation of staging sign-off after 2026-08-10.",
              "owner": "QA Lead",
              "source_refs": [
                {
                  "source_id": "local-status",
                  "locator": "status/2026-08-10.md"
                }
              ]
            }
          ],
          "conflicts": [],
          "issues": [],
          "deprecations": []
        },
        "recommended_actions": [
          {
            "priority": "P0",
            "type": "resolve_blocker",
            "claim_id": "blocker-quota",
            "action": "Resolve blocker 'Release and campaign integration validation are blocked by the open quota API contract task QUOTA-311' with Eng Lead B by 2026-08-18."
          },
          {
            "priority": "P1",
            "type": "mitigate_risk",
            "claim_id": "risk-quota-slip",
            "action": "Track mitigation for risk 'Quota API could slip past 2026-08-18 and push the launch date' with Program Operator."
          },
          {
            "priority": "P1",
            "type": "close_unknown",
            "claim_id": "unknown-quota-eta",
            "action": "Resolve unknown 'Quota API completion ETA from the quota service owner is unconfirmed' with Eng Lead B, or explicitly accept it."
          },
          {
            "priority": "P1",
            "type": "close_unknown",
            "claim_id": "unknown-staging-signoff",
            "action": "Resolve unknown 'No dated confirmation of staging sign-off after 2026-08-10' with QA Lead, or explicitly accept it."
          }
        ]
      },
      "report": "# Truth Review: Launch Readiness\n\n**Artifact quality:** pass\n**Program health:** blocked\n**As of:** 2026-08-11T09:00:00.000Z\n\n## Scorecard\n\n| Sources | Claims | Facts | Blockers | Risks | Unknowns | Conflicts | Evidence issues | Deprecations |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n| 5 | 8 | 4 | 1 | 1 | 2 | 0 | 0 | 0 |\n\n## Facts\n\n- **`fact-billing-done`:** All billing required tasks (children of BILL-920) are Done. Sources: `jira-billing`.\n- **`fact-quota-open`:** Quota API task QUOTA-311 remains open with no assignee. Sources: `jira-quota`.\n- **`fact-campaign-waiting`:** Campaign orchestration integration validation is waiting on the quota API. Sources: `jira-campaign`.\n- **`fact-qa-pending`:** The 2026-08-07 sync note records QA sign-off as pending until integration validation completes. Sources: `confluence-sync`.\n\n## Blockers\n\n- **`blocker-quota`:** Release and campaign integration validation are blocked by the open quota API contract task QUOTA-311. Owner: Eng Lead B. Due: 2026-08-18. Sources: `jira-quota`.\n\n## Risks\n\n- **`risk-quota-slip`:** Quota API could slip past 2026-08-18 and push the launch date. Owner: Program Operator. Sources: `jira-quota`.\n\n## Unknowns\n\n- **`unknown-quota-eta`:** Quota API completion ETA from the quota service owner is unconfirmed. Owner: Eng Lead B. Sources: `jira-quota`.\n- **`unknown-staging-signoff`:** No dated confirmation of staging sign-off after 2026-08-10. Owner: QA Lead. Sources: `local-status`.\n\n## Conflicts\n\n- None.\n\n## Evidence Issues\n\n- None.\n\n## Deprecations\n\n- None.\n\n## Next Actions\n\n- **P0** Resolve blocker 'Release and campaign integration validation are blocked by the open quota API contract task QUOTA-311' with Eng Lead B by 2026-08-18.\n- **P1** Track mitigation for risk 'Quota API could slip past 2026-08-18 and push the launch date' with Program Operator.\n- **P1** Resolve unknown 'Quota API completion ETA from the quota service owner is unconfirmed' with Eng Lead B, or explicitly accept it.\n- **P1** Resolve unknown 'No dated confirmation of staging sign-off after 2026-08-10' with QA Lead, or explicitly accept it.\n\n## Evidence\n\n- `jira-billing` (jira) observed 2026-08-11T08:00:00.000Z, source updated 2026-08-11T08:00:00.000Z — https://demo.atlassian.net/browse/BILL-920\n- `jira-quota` (jira) observed 2026-08-11T08:00:00.000Z, source updated 2026-08-11T08:00:00.000Z — https://demo.atlassian.net/browse/QUOTA-311\n- `jira-campaign` (jira) observed 2026-08-11T08:00:00.000Z, source updated 2026-08-11T08:00:00.000Z — https://demo.atlassian.net/browse/CMP-188\n- `confluence-sync` (confluence) observed 2026-08-07T15:00:00.000Z, source updated 2026-08-07T15:00:00.000Z — https://demo.atlassian.net/wiki/spaces/PLAT/pages/2026-08-07\n- `local-status` (local) observed 2026-08-10T18:00:00.000Z, source updated 2026-08-10T18:00:00.000Z\n"
    }
  }
};
