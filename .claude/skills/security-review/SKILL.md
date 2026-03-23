---
name: security-review
description: Security audit for FastAPI endpoints, ClickHouse SQL queries, Python ingestion code
disable-model-invocation: true
---
Use a security-reviewer subagent to audit: $ARGUMENTS

Scope the review to:

1. **SQL injection** — ClickHouse queries in `api/` must use parameterized queries via `clickhouse-driver` (e.g., `client.execute(query, params)`). Flag any f-string or `.format()` with user input in SQL.

2. **CORS misconfiguration** — FastAPI CORS must only allow `http://localhost:5173`. Flag wildcards (`*`) or overly broad origins.

3. **Credential exposure** — no hardcoded passwords, connection strings, or API keys. All secrets via environment variables. Flag anything that could be committed to git.

4. **Input validation** — all API query params (`dept`, `annee`, `type_local`) must be validated/typed before use in queries. Flag unvalidated user input.

5. **Path traversal** — any file path construction using user input.

6. **Dependency vulnerabilities** — note any known-vulnerable package versions in `requirements.txt` files.

For each finding: file path, line number, severity (CRITICAL / HIGH / MEDIUM / LOW), and suggested fix.
