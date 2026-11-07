# ScopeGuard Event Watcher

A lightweight, stateless background daemon that tails NEAR Protocol block logs, detects ScopeGuard contract events, and dispatches real-time alerts to Telegram and Discord webhooks.

---

## 1. Overview

The Watcher connects to NEAR RPC endpoints and scans for `EVENT_JSON:` log lines emitted by the ScopeGuard policy contract. When an event is detected, it formats a human-readable alert and pushes it to configured notification channels.

### Monitored Events

- `AUTO_PAUSE`: 3-strike circuit breaker or canary honeypot triggered onchain
- `REJECT`: Policy check failure with structured reason code
- `PENDING`: High-value transaction quarantined in the 24-hour timelock review queue
- `CANARY_TRIPPED`: Honeypot method invocation attempt detected
- `ALLOW`: Legitimate transaction cleared by onchain policy
- `SETTLED`: Quarantined action approved and executed by owner
- `CANCELLED`: Quarantined action vetoed and purged by owner
- `POLICY_SET` / `POLICY_STAGED`: Policy configuration update or staging event
- `PAUSE` / `UNPAUSE`: Manual administrative state change
- `REVOKE`: Permanent agent key deauthorization
- `WINDOWS_RESET`: Administrative spend and rate-limit recovery

---

## 2. Configuration

Configure the daemon via environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `SCOPEGUARD_POLICY_CONTRACT` | Account ID of the deployed policy contract | Required |
| `NEAR_TESTNET_RPC` | NEAR JSON-RPC endpoint URL | `https://test.rpc.fastnear.com` |
| `WEBHOOK_URL` | Discord or Slack webhook URL for alerts | Optional |
| `TELEGRAM_BOT_TOKEN` | Telegram bot API token | Optional |
| `TELEGRAM_CHAT_ID` | Telegram chat or group ID for alert delivery | Optional |

---

## 3. Running the Watcher

Start the watcher daemon:

```bash
# Standalone run
npm start --prefix watcher

# Run in background via systemd or process manager
node watcher/dist/index.js
```

Run test suite:

```bash
npm test --prefix watcher
```

---

## 4. Failure Modes and Resilience

The watcher is designed to run unattended with robust error recovery:

### 1. RPC Downtime or Transient Connection Drops
- When the NEAR RPC endpoint is unreachable, timeouts, or returns HTTP 5xx errors, the poll loop catches the error non-destructively.
- The `lastBlockHeight` cursor is **never decremented or corrupted**.
- The daemon logs a diagnostic warning (`[Watcher] Poll error: ...`) and retries automatically on the next scheduled poll tick (default: every 2.5 seconds).
- Once RPC connectivity restores, the daemon resumes scanning immediately from the exact block where it left off.

### 2. Block Lag and Head Catch-Up
- If the daemon is stopped for an extended period (or during network reconnects where lag exceeds 50 blocks), it detects block lag:
  `[Watcher] Block lag detected (X blocks). Fast-forwarding cursor near tip.`
- The cursor is fast-forwarded to `currentHeight - 5` to resume live real-time tailing without flooding webhook endpoints with historic backlog.

### 3. Notification Dispatch Failures
- Network failures while delivering webhooks to Discord or Telegram are wrapped in isolated try/catch blocks.
- A failed webhook dispatch never crashes the block scanning loop or halts event ingestion.
