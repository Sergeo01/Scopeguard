# ScopeGuard Deployment Guide (v0.4.0)

This guide provides the exact commands required to deploy the ScopeGuard v0.4.0 policy contract to a fresh NEAR Testnet account, register an agent with independent rolling spend caps, provision scoped credentials, update environment configuration, and run the end-to-end verification test suite.

---

## 1. Prerequisites

Before starting, ensure the following tools are installed and configured:

1. **Rust Toolchain:** Rust 1.99.1 (pinned in `rust-toolchain.toml`) with the `wasm32-unknown-unknown` target:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```
2. **Node.js:** v18 or v20 with `npm`.
3. **NEAR CLI RS:** Install the official NEAR CLI:
   ```bash
   cargo install near-cli-rs
   ```
4. **Testnet Credentials:** Ensure your owner account (for example `sergeo-guard.testnet`) and agent account (`agent.sergeo-guard.testnet`) credentials are stored in `~/.near-credentials/testnet/`.

---

## 2. Compile Contract Bytecode (v0.4.0)

Build the release WebAssembly binary from the repository root:

```bash
cargo build --manifest-path contracts/Cargo.toml --target wasm32-unknown-unknown --release
```

The compiled binary will be located at:
`contracts/target/wasm32-unknown-unknown/release/policy_contract.wasm`

Verify that the file exists and is approximately 400-500 KB:

```bash
ls -lh contracts/target/wasm32-unknown-unknown/release/policy_contract.wasm
```

---

## 3. Automated Deployment Option

A deployment script is provided that automates all account creation, deployment, initialization, policy registration, key generation, and vault funding steps:

```bash
# Set target configuration
export OWNER_ACCOUNT_ID="sergeo-guard.testnet"
export SCOPEGUARD_POLICY_CONTRACT="guard-v4.sergeo-guard.testnet"
export SCOPEGUARD_AGENT_ACCOUNT="agent.sergeo-guard.testnet"
export SCOPEGUARD_TOKEN_CONTRACT="sergeo-guard-token.testnet"
export SCOPEGUARD_DEX_CONTRACT="sergeo-guard-dex.testnet"
export NEAR_TESTNET_RPC="https://test.rpc.fastnear.com"

# Execute deployment script
node scripts/deploy.js
```

---

## 4. Manual Step-by-Step Deployment (NEAR CLI)

If you prefer using the command line directly, follow these sequential steps.

### Step 4.1: Create Fresh Guard Account

Create the dedicated sub-account funded with 5 NEAR:

```bash
near account create-account fund-myself guard-v4.sergeo-guard.testnet '5 NEAR' \
  use-manually-provided-seed-phrase 'YOUR_NEW_ACCOUNT_SEED_PHRASE' \
  sign-as sergeo-guard.testnet \
  network-config testnet
```

### Step 4.2: Deploy Wasm Bytecode

Deploy the compiled v0.4.0 contract bytecode to the new account:

```bash
near contract deploy guard-v4.sergeo-guard.testnet \
  use-file contracts/target/wasm32-unknown-unknown/release/policy_contract.wasm \
  without-init-call \
  network-config testnet \
  sign-as guard-v4.sergeo-guard.testnet
```

### Step 4.3: Initialize Contract State

Initialize the contract state by calling `new`:

```bash
near contract call-function as-transaction guard-v4.sergeo-guard.testnet new \
  json-args {} \
  prepaid-gas '30.0 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as guard-v4.sergeo-guard.testnet \
  network-config testnet
```

### Step 4.4: Register Agent with v0.4.0 Policy

Register the agent with independent rolling spend caps (500 token units, 5 NEAR native daily budget, 1 NEAR high-value threshold):

```bash
near contract call-function as-transaction guard-v4.sergeo-guard.testnet register_agent \
  json-args '{
    "agent_account": "agent.sergeo-guard.testnet",
    "policy": {
      "token": "sergeo-guard-token.testnet",
      "targets": {
        "sergeo-guard-dex.testnet": ["swap"],
        "sergeo-guard-token.testnet": ["ft_transfer"]
      },
      "daily_cap": 500,
      "near_daily_cap": "5000000000000000000000000",
      "near_high_value_threshold": "1000000000000000000000000",
      "recipients": ["sergeo-guard.testnet"],
      "max_actions_per_10min": 5,
      "auto_pause_rejects": 3,
      "auto_pause_window_minutes": 10,
      "high_value_threshold": 250,
      "high_value_delay_seconds": 60,
      "policy_change_delay_seconds": 60
    }
  }' \
  prepaid-gas '30.0 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as sergeo-guard.testnet \
  network-config testnet
```

### Step 4.5: Provision Scoped Passkey for Agent

Generate an Ed25519 keypair for the agent runtime and add a scoped function-call access key to the agent account:

```bash
near account add-key agent.sergeo-guard.testnet \
  grant-function-call-access \
  --allowance '0.25 NEAR' \
  --receiver-account-id guard-v4.sergeo-guard.testnet \
  --method-names execute \
  use-manually-provided-public-key 'ed25519:AGENT_PUBLIC_KEY' \
  sign-as agent.sergeo-guard.testnet \
  network-config testnet
```

Save the generated private key to `demo-agent/credentials/agent.json`:

```json
{
  "agentAccountId": "agent.sergeo-guard.testnet",
  "policyContractId": "guard-v4.sergeo-guard.testnet",
  "publicKey": "ed25519:AGENT_PUBLIC_KEY",
  "privateKey": "ed25519:AGENT_PRIVATE_KEY",
  "networkId": "testnet",
  "nodeUrl": "https://test.rpc.fastnear.com"
}
```

### Step 4.6: Register Storage and Fund Vaults

Register storage on the NEP-141 token contract:

```bash
near contract call-function as-transaction sergeo-guard-token.testnet storage_deposit \
  json-args '{"account_id": "guard-v4.sergeo-guard.testnet"}' \
  prepaid-gas '30.0 Tgas' \
  attached-deposit '0.00125 NEAR' \
  sign-as sergeo-guard.testnet \
  network-config testnet
```

Deposit 100 mUSD into the agent token vault:

```bash
near contract call-function as-transaction sergeo-guard-token.testnet ft_transfer_call \
  json-args '{
    "receiver_id": "guard-v4.sergeo-guard.testnet",
    "amount": "100",
    "msg": "agent.sergeo-guard.testnet"
  }' \
  prepaid-gas '60.0 Tgas' \
  attached-deposit '1 yoctoNEAR' \
  sign-as sergeo-guard.testnet \
  network-config testnet
```

Deposit 2 NEAR into the agent native NEAR vault:

```bash
near contract call-function as-transaction guard-v4.sergeo-guard.testnet deposit_near \
  json-args '{"agent_account": "agent.sergeo-guard.testnet"}' \
  prepaid-gas '30.0 Tgas' \
  attached-deposit '2 NEAR' \
  sign-as sergeo-guard.testnet \
  network-config testnet
```

### Step 4.7: Verify Contract State

Query `get_budget` to confirm both token and native NEAR vault balances:

```bash
near contract call-function as-read-only guard-v4.sergeo-guard.testnet get_budget \
  json-args '{"agent_account": "agent.sergeo-guard.testnet"}' \
  network-config testnet
```

Expected output structure:
```json
{
  "spent": "0",
  "remaining": "500",
  "daily_cap": "500",
  "actions_in_window": 0,
  "max_actions": 5,
  "paused": false,
  "vault_balance": "100",
  "near_spent": "0",
  "near_remaining": "5000000000000000000000000",
  "near_daily_cap": "5000000000000000000000000",
  "near_vault_balance": "2000000000000000000000000"
}
```

---

## 5. Environment Variables Update

Update the environment configuration across packages to target the new guard contract:

In `.env` / root:
```bash
SCOPEGUARD_POLICY_CONTRACT="guard-v4.sergeo-guard.testnet"
SCOPEGUARD_AGENT_ACCOUNT="agent.sergeo-guard.testnet"
SCOPEGUARD_TOKEN_CONTRACT="sergeo-guard-token.testnet"
SCOPEGUARD_DEX_CONTRACT="sergeo-guard-dex.testnet"
OWNER_ACCOUNT_ID="sergeo-guard.testnet"
NEAR_TESTNET_RPC="https://test.rpc.fastnear.com"
```

In `web/.env.local`:
```bash
NEXT_PUBLIC_POLICY_CONTRACT_ID="guard-v4.sergeo-guard.testnet"
NEXT_PUBLIC_TOKEN_CONTRACT="sergeo-guard-token.testnet"
NEXT_PUBLIC_DEX_CONTRACT="sergeo-guard-dex.testnet"

# Optional Server-Side Signing (Development / Demo only; keep unset in production):
# SCOPEGUARD_ALLOW_SERVER_SIGNING="true"
# SCOPEGUARD_SHARED_SECRET="<your-random-shared-secret>"
```

### Server-Side Signing Environment Controls

For web endpoints executing owner transactions (`/api/register`, `/api/fund`, `/api/demo/reset`):
- `SCOPEGUARD_ALLOW_SERVER_SIGNING`: When unset or false (production default), server-side signing is disabled. Endpoints return the exact CLI command for local signing.
- `SCOPEGUARD_SHARED_SECRET`: Required whenever `SCOPEGUARD_ALLOW_SERVER_SIGNING=true`. Verified against incoming headers via timing-safe comparison (`crypto.timingSafeEqual`).
- **Fail-Closed Behavior:** If `SCOPEGUARD_ALLOW_SERVER_SIGNING=true` but `SCOPEGUARD_SHARED_SECRET` is unset, the endpoints fail closed with HTTP status 500.

In any production or public deployment, both `SCOPEGUARD_ALLOW_SERVER_SIGNING` and `SCOPEGUARD_SHARED_SECRET` must remain unset. The browser UI sends no shared secret, and the attack demonstration route operates strictly via the restricted agent key. Leaving these variables unset ensures that no server routes can execute owner-level transactions.

### Nginx Reverse Proxy Configuration

When deploying the web studio behind an Nginx reverse proxy, configure the location block as follows:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

#### Why `proxy_set_header X-Forwarded-For $remote_addr;`

We explicitly set `proxy_set_header X-Forwarded-For $remote_addr;` instead of `$proxy_add_x_forwarded_for`. Using `$proxy_add_x_forwarded_for` appends incoming client-supplied headers, allowing an attacker to spoof arbitrary client IP addresses or rotate them to bypass rate limits. By setting `X-Forwarded-For` strictly to `$remote_addr`, the trusted reverse proxy overwrites any client-supplied spoofed headers with the real client IP address seen at the network layer.

---

## 6. End-to-End Testnet Verification

Run the testnet verification script against live consensus:

```bash
node scripts/testnet-demo-agent-e2e.js
```

This script exercises:
1. Preflight status checks.
2. Legitimate swap execution within policy allowance.
3. High-value transaction quarantine in timelock queue.
4. Owner cancellation of quarantined action.
5. Unauthorized target rejection (`TARGET_NOT_ALLOWED`).
6. Unauthorized method rejection (`METHOD_NOT_ALLOWED`).
7. Unauthorized recipient rejection (`RECIPIENT_NOT_ALLOWED`).
8. Circuit breaker auto-pause tripwire after 3 successive rejections (`AUTO_PAUSE`).
9. Execution rejection while paused (`PAUSED`).
10. Owner unpause and system recovery.

---

## 7. Operator Action Required

Please execute the deployment steps above on NEAR Testnet.

Once deployment is complete, provide:
1. Deployed Guard Contract Account ID (e.g. `guard-v4.sergeo-guard.testnet`).
2. Deployment Transaction Hash.
3. Agent Registration Transaction Hash.
4. End-to-End Suite Run Output and Transaction Hashes.

The activity ledger and repository documentation will then be updated exclusively with those verified on-chain transaction records.
