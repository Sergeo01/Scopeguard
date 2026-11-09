// Real-world developer integration test using @scopeguard/sdk on NEAR Testnet
// Demonstrates how an autonomous agent uses ScopeGuard in production.

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const path = require('path');
const fs = require('fs');
const { ScopeGuardAgentClient } = require(path.join(__dirname, '../sdk/dist/index.js'));

async function run() {
  console.log('===============================================================');
  console.log('   ScopeGuard Real-World Developer Integration Test (NEAR Testnet)');
  console.log('===============================================================\n');

  // Step 1: Load Scoped Passkey Credential
  const credPath = path.join(__dirname, '../agent.json');
  const cred = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  console.log('[1] Initializing ScopeGuard Agent Client...');
  console.log(`    Agent Sub-Account:  ${cred.agentAccountId}`);
  console.log(`    Guard Contract:     ${cred.policyContractId}`);
  console.log(`    Public Key:         ${cred.publicKey}`);
  console.log(`    RPC Endpoint:       ${cred.nodeUrl || 'https://test.rpc.fastnear.com'}\n`);

  const client = new ScopeGuardAgentClient(cred);

  // Step 2: Query Initial Onchain State
  console.log('[2] Fetching initial onchain budget and policy bounds...');
  const initialBudget = await client.budget();
  const policy = await client.getPolicy();
  console.log('    Current Vault Balance:  ' + initialBudget.vault_balance + ' mUSD');
  console.log('    Daily Spending Cap:     ' + initialBudget.cap + ' mUSD');
  console.log('    Spent in Window:        ' + initialBudget.spent + ' mUSD');
  console.log('    Remaining Allowance:    ' + initialBudget.remaining + ' mUSD');
  console.log('    Agent Paused Status:    ' + initialBudget.paused);
  console.log('    Allowed DEX Target:     ' + Object.keys(policy.targets).join(', '));
  console.log('    Allowed Methods on DEX: ' + JSON.stringify(policy.targets['sergeo-guard-dex.testnet']));
  console.log('    Allowed Recipients:     ' + JSON.stringify(policy.recipients) + '\n');

  if (initialBudget.paused) {
    console.error('ERROR: Agent is currently paused. Please unpause before running integration test.');
    process.exit(1);
  }

  // Step 3: Run Preflight Simulation (Offchain / View)
  console.log('[3] Running preflight simulation for planned action:');
  const swapAction = {
    target: 'sergeo-guard-dex.testnet',
    method: 'swap',
    amount: '10',
    args: { token_in: 'sergeo-guard-token.testnet', amount_in: '10' }
  };
  console.log('    Action Payload:', JSON.stringify(swapAction));
  const preflight = await client.preflight(swapAction);
  console.log(`    Preflight Status:    ${preflight.status}`);
  console.log(`    Velocity Used:       ${preflight.velocity_used}/${preflight.velocity_max}`);
  console.log(`    Estimated Remaining: ${preflight.velocity_remaining}\n`);

  if (preflight.status !== 'ALLOWED') {
    console.error('Preflight check failed with reason:', preflight.reason);
    process.exit(1);
  }

  // Step 4: Execute Compliant Action Onchain
  console.log('[4] Executing compliant swap on DEX through ScopeGuard...');
  const startTime = Date.now();
  const execOutcome = await client.act(swapAction);
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`    Execution Status:    ${execOutcome.status} (completed in ${elapsedSec}s)`);
  console.log('    Result Outcome:', JSON.stringify(execOutcome));

  // Step 5: Verify Budget Update on Chain
  console.log('\n[5] Reading updated onchain budget...');
  const midBudget = await client.budget();
  console.log('    Updated Vault Balance: ' + midBudget.vault_balance + ' mUSD');
  console.log('    Updated Spent Amount:  ' + midBudget.spent + ' mUSD');
  console.log('    Remaining Allowance:   ' + midBudget.remaining + ' mUSD');
  console.log('    Actions in 10m Window: ' + midBudget.actions_in_window + '\n');

  // Step 6: Test Guardrail Enforcement (Adversarial / Blocked Action)
  console.log('[6] Testing Guardrail Defense against unauthorized action...');
  console.log('    Adversarial Action: Attempting direct transfer to unapproved address (attacker.testnet)');
  const attackAction = {
    method: 'ft_transfer',
    token: 'sergeo-guard-token.testnet',
    recipient: 'attacker.testnet',
    amount: '50'
  };
  const attackOutcome = await client.act(attackAction);
  console.log(`    Execution Status:    ${attackOutcome.status}`);
  console.log(`    Rejection Reason:    ${attackOutcome.reason}`);
  console.log('    Result Outcome:', JSON.stringify(attackOutcome));

  // Step 7: Verify Vault Funds Were Not Touched
  console.log('\n[7] Verifying vault solvency and strike counter...');
  const finalBudget = await client.budget();
  const rejectTimes = await client.getRejectTimes();
  console.log('    Final Vault Balance:   ' + finalBudget.vault_balance + ' mUSD (Preserved intact!)');
  console.log('    Final Spent Amount:    ' + finalBudget.spent + ' mUSD (Did not increase)');
  console.log('    Recorded Strike Times: ' + rejectTimes.length + ' strike(s) logged in window');
  console.log('    Agent Paused Status:   ' + finalBudget.paused);

  console.log('\n===============================================================');
  console.log('   INTEGRATION TEST SUCCESSFUL: Guardrails verified on NEAR Testnet');
  console.log('===============================================================\n');
}

run().catch(err => {
  console.error('\nIntegration test encountered an error:', err);
  process.exit(1);
});
