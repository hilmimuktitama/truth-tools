# ADR 0008: Portable source metadata boundary

Status: accepted

Artifacts carry portable source metadata and locators only. Bodies remain in
the source system of record. Recursive fields and metadata are bounded and
sanitized; raw-like keys are stripped with blocking path findings.
