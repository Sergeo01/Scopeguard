import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  resolveContractAlias,
  toGuardAction,
  formatPendingEscalationMessage,
  getEscalationGuidance,
  Outcome,
} from "../src/index";

describe("SDK: Contract Alias Resolver", () => {
  it("resolves USDC alias on testnet and mainnet", () => {
    assert.equal(resolveContractAlias("USDC", "testnet"), "sergeo-guard-token.testnet");
    assert.equal(
      resolveContractAlias("usdc", "mainnet"),
      "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
    );
  });

  it("resolves Ref Finance aliases on testnet and mainnet", () => {
    assert.equal(resolveContractAlias("REF", "testnet"), "sergeo-guard-dex.testnet");
    assert.equal(resolveContractAlias("REF_FINANCE", "testnet"), "sergeo-guard-dex.testnet");
    assert.equal(resolveContractAlias("ref", "mainnet"), "v2.ref-finance.near");
    assert.equal(resolveContractAlias("ref-finance", "mainnet"), "v2.ref-finance.near");
  });

  it("resolves INTENTS and DEFUSE canonical address", () => {
    assert.equal(resolveContractAlias("INTENTS", "testnet"), "intents.near");
    assert.equal(resolveContractAlias("defuse", "mainnet"), "intents.near");
  });

  it("resolves WRAP_NEAR and WNEAR", () => {
    assert.equal(resolveContractAlias("WRAP_NEAR", "testnet"), "wrap.testnet");
    assert.equal(resolveContractAlias("wnear", "testnet"), "wrap.testnet");
    assert.equal(resolveContractAlias("WRAP_NEAR", "mainnet"), "wrap.near");
    assert.equal(resolveContractAlias("wnear", "mainnet"), "wrap.near");
  });

  it("preserves non-aliased accounts", () => {
    assert.equal(resolveContractAlias("alice.near", "mainnet"), "alice.near");
    assert.equal(resolveContractAlias("custom-contract.testnet", "testnet"), "custom-contract.testnet");
  });
});

describe("SDK: toGuardAction with Aliases and NearTransfer", () => {
  it("constructs NearTransfer when method is near_transfer or token is NEAR", () => {
    const action1 = toGuardAction({
      target: "alice.near",
      method: "near_transfer",
      amount: "1000000000000000000000000",
    });
    assert.deepEqual(action1, {
      NearTransfer: {
        to: "alice.near",
        amount: "1000000000000000000000000",
      },
    });

    const action2 = toGuardAction({
      token: "NEAR",
      recipient: "bob.near",
      amount: "500",
    });
    assert.deepEqual(action2, {
      NearTransfer: {
        to: "bob.near",
        amount: "500",
      },
    });
  });

  it("resolves aliases in ContractCall and attaches deposit", () => {
    const action = toGuardAction(
      {
        target: "REF",
        method: "storage_deposit",
        deposit: "12500000000000000000000",
      },
      "testnet"
    );
    assert.deepEqual(action, {
      ContractCall: {
        target: "sergeo-guard-dex.testnet",
        method: "storage_deposit",
        args: "{}",
        deposit: "12500000000000000000000",
      },
    });
  });

  it("resolves aliases in Swap and Transfer actions", () => {
    const swapAction = toGuardAction(
      {
        target: "REF",
        method: "swap",
        token: "USDC",
        amount: "100",
      },
      "testnet"
    );
    assert.deepEqual(swapAction, {
      Swap: {
        dex: "sergeo-guard-dex.testnet",
        token_in: "sergeo-guard-token.testnet",
        amount_in: "100",
        min_out: "0",
      },
    });

    const swapActionWithDex = toGuardAction(
      {
        dex: "ref finance",
        method: "swap",
        token: "USDC",
        amount: "100",
      },
      "testnet"
    );
    assert.deepEqual(swapActionWithDex, {
      Swap: {
        dex: "sergeo-guard-dex.testnet",
        token_in: "sergeo-guard-token.testnet",
        amount_in: "100",
        min_out: "0",
      },
    });

    const transferAction = toGuardAction(
      {
        method: "ft_transfer",
        target: "USDC",
        recipient: "wrap near",
        amount: "50",
      },
      "testnet"
    );
    assert.deepEqual(transferAction, {
      Transfer: {
        token: "sergeo-guard-token.testnet",
        to: "wrap.testnet",
        amount: "50",
        memo: null,
      },
    });
  });
});

describe("SDK: Escalation Helpers", () => {
  it("formats standard quarantine message for PENDING outcomes", () => {
    const outcome: Outcome = {
      status: "PENDING",
      pending_id: 42,
    };
    const message = formatPendingEscalationMessage(outcome, 60);
    assert.equal(
      message,
      "Action queued in ScopeGuard review quarantine (Pending ID: #42). Estimated review delay: 60 seconds. The owner must approve this in the ScopeGuard dashboard before funds move."
    );
  });

  it("provides structured escalation guidance for conversational LLMs", () => {
    const pendingOutcome: Outcome = {
      status: "PENDING",
      pending_id: 7,
    };
    const guidance = getEscalationGuidance(pendingOutcome, 120);
    assert.equal(guidance.requires_owner_approval, true);
    assert.equal(guidance.pending_id, 7);
    assert.ok(guidance.message.includes("Pending ID: #7"));
    assert.ok(guidance.instructions.includes("The owner must log in to the ScopeGuard dashboard"));

    const allowedOutcome: Outcome = {
      status: "ALLOWED",
    };
    const nonPendingGuidance = getEscalationGuidance(allowedOutcome);
    assert.equal(nonPendingGuidance.requires_owner_approval, false);
  });
});
