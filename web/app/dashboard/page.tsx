"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CreditCard,
  Gauge,
  Clock,
  ShieldCheck,
  ShieldAlert,
  PauseCircle,
  PlayCircle,
  DownloadCloud,
  KeyRound,
  ExternalLink,
  Activity,
  RefreshCw,
  XCircle,
  Search,
  Check,
  AlertTriangle,
  Zap,
  CheckCircle2,
  X,
  Copy,
  Coins,
  Lock,
  Layers,
  ChevronRight,
  Shield,
  Trash2,
  ArrowRight,
  ArrowUpRight,
  TrendingDown,
  Timer,
  Crosshair,
  Wand2,
  Terminal,
  Sliders,
  Settings2,
} from "lucide-react";
import { CircuitBreakerBanner, RejectionEvent } from "@/components/CircuitBreakerBanner";
import { StagedPolicyBanner, StagedPolicyItem } from "@/components/StagedPolicyBanner";
import { useWallet } from "@/context/WalletContext";
import { tryGetPolicyContractId } from "@/lib/config";
import { ReceiptModal } from "@/components/ReceiptModal";
import { WorstCaseBoundIndicator } from "@/components/WorstCaseBoundIndicator";
import { IncidentExportModal } from "@/components/IncidentExportModal";
import { BudgetVelocityGauge } from "@/components/BudgetVelocityGauge";
import { WebhookAlertSettings } from "@/components/WebhookAlertSettings";
import { PolicyEditorModal } from "@/components/PolicyEditorModal";

interface ActivityItem {
  id: string;
  txHash?: string;
  type: "ALLOW" | "REJECT" | "AUTO_PAUSE" | "SETTLED" | "CANCELLED" | "PAUSE" | "UNPAUSE" | "PENDING";
  timestamp: number;
  agent: string;
  target?: string;
  method?: string;
  amount?: string;
  reason?: string;
}

interface PendingActionItem {
  id: number;
  target: string;
  method: string;
  amount: string;
  recipient?: string | null;
  executable_at: number;
  secondsRemaining?: number;
}

function formatNearBalance(raw: string): string {
  if (!raw || raw === "0") return "0";
  try {
    const b = BigInt(raw);
    if (b === BigInt(0)) return "0";
    const oneNear = BigInt("1000000000000000000000000"); // 10^24
    if (b < BigInt("1000000000000000000")) {
      return b.toString();
    }
    const whole = b / oneNear;
    const factor = BigInt("100000000000000000000"); // 10^20
    const rem = (b % oneNear) / factor;
    const remStr = rem.toString().padStart(4, "0").replace(/0+$/, "");
    return remStr ? `${whole}.${remStr}` : `${whole}`;
  } catch {
    return "0";
  }
}

export default function DashboardPage() {
  const { user, accountId: connectedWalletId, isConnected: isWalletConnected, openAuthModal, refreshBalance } = useWallet();
  const [isMounted, setIsMounted] = useState(false);
  const [agentId, setAgentId] = useState("agent.sergeo-guard.testnet");
  const [guardId, setGuardId] = useState<string | null>(tryGetPolicyContractId);
  const [ownerId, setOwnerId] = useState("sergeo-guard.testnet");
  const [queriedAgent, setQueriedAgent] = useState<string | null>(null);
  const [queriedOwner, setQueriedOwner] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const qAgent = sp.get("agent");
      const qOwner = sp.get("owner");
      const qGuard = sp.get("guard");
      if (qAgent) {
        setAgentId(qAgent);
        setQueriedAgent(qAgent);
      }
      if (qOwner) {
        setOwnerId(qOwner);
        setQueriedOwner(qOwner);
      }
      if (qGuard) {
        setGuardId(qGuard);
      }
    }
  }, []);

  useEffect(() => {
    if (isWalletConnected && connectedWalletId) {
      setOwnerId(connectedWalletId);
    }
  }, [isWalletConnected, connectedWalletId]);

  const [agentPublicKey, setAgentPublicKey] = useState<string>("");
  const [policy, setPolicy] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [rejectCount, setRejectCount] = useState(0);
  const [vaultBalance, setVaultBalance] = useState("350");
  const [nearVaultBalance, setNearVaultBalance] = useState("0");
  const [rawNearVaultBalance, setRawNearVaultBalance] = useState("0");
  const [fleetAgents, setFleetAgents] = useState<string[]>([]);
  const [highWaterMark, setHighWaterMark] = useState<string>("350");
  const [maxDrawdownBps, setMaxDrawdownBps] = useState<number | null>(2000);
  const [leaseExpiresAt, setLeaseExpiresAt] = useState<number | string | null>(null);
  const [canaryMethods, setCanaryMethods] = useState<string[]>(["drain_vault", "admin_transfer"]);
  const [intentRecipients, setIntentRecipients] = useState<string[]>([]);
  const [dailyCapTotal, setDailyCapTotal] = useState(500);
  const [dailyCapSpent, setDailyCapSpent] = useState(0);
  const [velocityUsed, setVelocityUsed] = useState(0);
  const [velocityMax, setVelocityMax] = useState(5);
  const [ruleToggles, setRuleToggles] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
    8: true,
    9: true,
    10: true,
    11: true,
    12: true,
    13: true,
    14: true,
  });
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [inspectHash, setInspectHash] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "approved" | "declined">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedAgent, setCopiedAgent] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [stagedPolicy, setStagedPolicy] = useState<StagedPolicyItem | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([]);

  // Non-custodial Owner Command Modal state
  const [activeOwnerModal, setActiveOwnerModal] = useState<{
    title: string;
    description: string;
    command: string;
    contractId?: string;
    method?: string;
    args?: Record<string, any>;
    isDanger?: boolean;
    builderLink?: boolean;
  } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [isSigningAction, setIsSigningAction] = useState(false);
  const [actionTxHash, setActionTxHash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Policy Editor state
  const [isEditPolicyOpen, setIsEditPolicyOpen] = useState(false);
  const [editDailyCap, setEditDailyCap] = useState<number>(500);
  const [editVelocityMax, setEditVelocityMax] = useState<number>(5);
  const [editRecipients, setEditRecipients] = useState<string>("");
  const [editTargets, setEditTargets] = useState<string>("sergeo-guard-dex.testnet");
  const [editCanaryMethods, setEditCanaryMethods] = useState<string>("");
  const [editMaxDrawdown, setEditMaxDrawdown] = useState<number | "">("");
  const [editIntentRecipients, setEditIntentRecipients] = useState<string>("");
  const [editNearDailyCap, setEditNearDailyCap] = useState<string>("");
  const [editNearHighValueThreshold, setEditNearHighValueThreshold] = useState<string>("");
  const [isSigningPolicy, setIsSigningPolicy] = useState(false);
  const [policyUpdateTxHash, setPolicyUpdateTxHash] = useState<string | null>(null);
  const [policyUpdateError, setPolicyUpdateError] = useState<string | null>(null);

  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const fetchFleet = async () => {
      const effectiveOwner = (isWalletConnected && connectedWalletId)
        ? connectedWalletId
        : (queriedOwner || ownerId);
      if (!effectiveOwner) return;
      try {
        const resp = await fetch(`/api/agents?owner=${encodeURIComponent(effectiveOwner)}`);
        const data = await resp.json();
        if (data.success && Array.isArray(data.agents)) {
          const list = data.agents.map((a: any) => a.account);
          setFleetAgents(list);
        }
      } catch (e) {
        console.warn("Could not fetch fleet agents", e);
      }
    };
    fetchFleet();
  }, [ownerId, connectedWalletId, isWalletConnected, queriedOwner]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveOwnerModal(null);
        setCopiedCmd(false);
      }
    };
    if (activeOwnerModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeOwnerModal]);

  const loadOnchainState = useCallback(async () => {
    setLoading(true);
    try {
      const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const explicitAgent = sp?.get("agent") || queriedAgent;
      const effectiveOwner = (isWalletConnected && connectedWalletId)
        ? connectedWalletId
        : (sp?.get("owner") || queriedOwner || ownerId);

      const params = new URLSearchParams();
      if (explicitAgent) {
        params.set("agent", explicitAgent);
      } else if (!isWalletConnected && agentId) {
        params.set("agent", agentId);
      }
      if (effectiveOwner) params.set("owner", effectiveOwner);
      if (guardId) params.set("guard", guardId);

      const resp = await fetch(`/api/state?${params.toString()}`);
      const data = await resp.json();
      if (data.success) {
        if (data.agentId) {
          setAgentId(data.agentId);
        }
        if (data.guardId) setGuardId(data.guardId);
        if (!isWalletConnected && !sp?.get("owner") && !queriedOwner && data.ownerId) {
          setOwnerId(data.ownerId);
        }
        if (data.agentPublicKey) setAgentPublicKey(data.agentPublicKey);
        if (data.policy) {
          setPolicy(data.policy);
          if (data.policy.max_actions_per_10min) {
            setVelocityMax(Number(data.policy.max_actions_per_10min));
          }
          if (data.policy.max_drawdown_bps !== undefined) {
            setMaxDrawdownBps(data.policy.max_drawdown_bps);
          }
          if (data.policy.lease_expires_at !== undefined) {
            setLeaseExpiresAt(data.policy.lease_expires_at);
          }
          if (Array.isArray(data.policy.canary_methods) && data.policy.canary_methods.length > 0) {
            setCanaryMethods(data.policy.canary_methods);
          }
          if (Array.isArray(data.policy.intent_recipients)) {
            setIntentRecipients(data.policy.intent_recipients);
          }
        }
        if (data.budget) {
          const paused = Boolean(data.budget.paused);
          setIsPaused(paused);
          setRuleToggles((prev) => ({ ...prev, 2: !paused }));
          setDailyCapTotal(data.budget.cap !== undefined ? Number(data.budget.cap) : 500);
          setDailyCapSpent(data.budget.spent !== undefined ? Number(data.budget.spent) : 0);
          const vBalance = data.budget.vault_balance !== undefined ? String(data.budget.vault_balance) : "350";
          setVaultBalance(vBalance);
          const rawNear = data.budget.near_vault_balance !== undefined ? String(data.budget.near_vault_balance) : "0";
          setRawNearVaultBalance(rawNear);
          setNearVaultBalance(formatNearBalance(rawNear));
          setHighWaterMark(data.budget.high_water_mark !== undefined ? String(data.budget.high_water_mark) : vBalance);
          if (data.budget.max_drawdown_bps !== undefined) {
            setMaxDrawdownBps(data.budget.max_drawdown_bps);
          }
          setVelocityUsed(data.budget.actions_in_window !== undefined ? Number(data.budget.actions_in_window) : 0);
        }
        setPendingActions(Array.isArray(data.pendingActions) ? data.pendingActions : []);
        if (data.stagedPolicy !== undefined) setStagedPolicy(data.stagedPolicy);
        if (data.activities && Array.isArray(data.activities)) setActivities(data.activities);
      }
    } catch (e) {
      console.warn("Could not fetch /api/state", e);
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  }, [agentId, connectedWalletId, guardId, isWalletConnected, ownerId, queriedAgent, queriedOwner]);

  useEffect(() => {
    loadOnchainState();
    const interval = setInterval(loadOnchainState, 15000);
    return () => clearInterval(interval);
  }, [loadOnchainState]);

  useEffect(() => {
    if (isMounted && connectedWalletId) {
      loadOnchainState();
    }
  }, [connectedWalletId, isMounted, loadOnchainState]);

  // Timelock countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setPendingActions((prev) =>
        prev.map((item) => {
          const nowSeconds = Math.floor(Date.now() / 1000);
          const rem = Math.max(0, item.executable_at - nowSeconds);
          return { ...item, secondsRemaining: rem };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSignOwnerAction = async () => {
    if (!activeOwnerModal?.method) return;
    setIsSigningAction(true);
    setActionError(null);
    try {
      const { getNearWalletSelector } = await import("@/lib/wallet-selector");
      const ws = await getNearWalletSelector();
      if (!ws) throw new Error("Wallet selector could not be initialized");
      const wallet = await ws.selector.wallet();
      const { transactions } = await import("near-api-js");
      const targetContract = activeOwnerModal.contractId || guardId;
      if (!targetContract) {
        throw new Error("Policy contract not configured. Set NEXT_PUBLIC_POLICY_CONTRACT_ID to sign onchain.");
      }
      const depositYocto =
        activeOwnerModal.method === "deposit_near"
          ? BigInt("1000000000000000000000000") // 1 NEAR
          : activeOwnerModal.method === "ft_transfer_call"
          ? BigInt(1) // 1 yoctoNEAR
          : activeOwnerModal.method === "storage_deposit"
          ? BigInt("1250000000000000000000") // 0.00125 NEAR
          : BigInt(0);

      const action = transactions.functionCall(
        activeOwnerModal.method,
        Buffer.from(JSON.stringify(activeOwnerModal.args || {})),
        BigInt("100000000000000"),
        depositYocto
      );

      const txActions: any[] = [];

      // Auto-check and bundle token storage registration if depositing mUSD
      if (activeOwnerModal.method === "ft_transfer_call") {
        const effectiveSender = connectedWalletId || ownerId;
        try {
          const rpcUrl = process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com";
          const storageCheck = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "storage-check",
              method: "query",
              params: {
                request_type: "call_function",
                finality: "final",
                account_id: targetContract,
                method_name: "storage_balance_of",
                args_base64: Buffer.from(JSON.stringify({ account_id: effectiveSender })).toString("base64"),
              },
            }),
          }).then((r) => r.json());

          const resBytes = storageCheck?.result?.result;
          const storageData = resBytes ? JSON.parse(Buffer.from(resBytes).toString("utf-8")) : null;

          if (!storageData || storageData.total === "0") {
            txActions.push(
              transactions.functionCall(
                "storage_deposit",
                Buffer.from(JSON.stringify({ registration_only: true })),
                BigInt("30000000000000"),
                BigInt("1250000000000000000000") // 0.00125 NEAR
              )
            );
          }
        } catch {
          // If storage check query encounters RPC rate limits, proceed with deposit
        }
      }

      txActions.push(action);

      const res = await wallet.signAndSendTransaction({
        receiverId: targetContract,
        actions: txActions as any[],
      });
      if (res && typeof res === "object" && "transaction" in res) {
        setActionTxHash((res as any).transaction.hash);
      } else {
        setActionTxHash("Confirmed onchain");
      }
      setTimeout(() => {
        loadOnchainState();
      }, 2000);
    } catch (err: any) {
      setActionError(err.message || "Failed to execute wallet transaction");
    } finally {
      setIsSigningAction(false);
    }
  };

  const handlePause = async () => {
    setActionTxHash(null);
    setActionError(null);
    const cliGuard = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Emergency Pause Key",
      description: "Freezes all agent transactions on NEAR Testnet immediately. The Guard contract will refuse all calls until unpaused by the owner.",
      command: `near call ${cliGuard} pause '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      method: "pause",
      args: { agent_account: agentId },
      isDanger: false,
    });
  };

  const handleUnpause = async () => {
    setActionTxHash(null);
    setActionError(null);
    const cliGuard = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Unpause Agent Key",
      description: "Resumes normal agent operation on NEAR Testnet. The Guard will resume checking transactions against approved policy rules.",
      command: `near call ${cliGuard} unpause '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      method: "unpause",
      args: { agent_account: agentId },
      isDanger: false,
    });
  };

  const handleWithdrawVault = async () => {
    setActionTxHash(null);
    setActionError(null);
    const cliGuard = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Withdraw Vault to Owner",
      description: "Empties 100% of the agent spending pot back into your owner wallet. The destination is forced to the verified owner account onchain.",
      command: `near call ${cliGuard} withdraw '{"agent_account":"${agentId}","amount":"${vaultBalance}"}' --accountId ${ownerId} --gas 100000000000000`,
      method: "withdraw",
      args: { agent_account: agentId, amount: vaultBalance },
      isDanger: true,
    });
  };

  const handleWithdrawNear = async () => {
    setActionTxHash(null);
    setActionError(null);
    const cliGuard = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Withdraw Native NEAR to Owner",
      description: "Empties 100% of the native NEAR pot back into your owner wallet. Destination is strictly forced to the verified owner account onchain.",
      command: `near call ${cliGuard} withdraw_near '{"agent_account":"${agentId}","amount":"${rawNearVaultBalance}"}' --accountId ${ownerId} --gas 100000000000000`,
      method: "withdraw_near",
      args: { agent_account: agentId, amount: rawNearVaultBalance },
      isDanger: true,
    });
  };

  const handleDepositMusd = () => {
    setActionTxHash(null);
    setActionError(null);
    const tokenId = policy?.token || "sergeo-guard-token.testnet";
    const effectiveSender = connectedWalletId || ownerId;
    const effectiveReceiver = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Deposit $100 mUSD into Vault",
      description: "Transfers 100 mUSD test tokens from your wallet into the agent working pot onchain via NEP-141 ft_transfer_call.",
      command: `near call ${tokenId} ft_transfer_call '{"receiver_id":"${effectiveReceiver}","amount":"100","msg":"${agentId}"}' --accountId ${effectiveSender} --depositYocto 1 --gas 60000000000000`,
      contractId: tokenId,
      method: "ft_transfer_call",
      args: { receiver_id: effectiveReceiver, amount: "100", msg: agentId },
      isDanger: false,
    });
  };

  const handleMintFaucetTokens = () => {
    setActionTxHash(null);
    setActionError(null);
    const tokenId = policy?.token || "sergeo-guard-token.testnet";
    const effectiveSender = connectedWalletId || ownerId;
    setActiveOwnerModal({
      title: "Mint 100 mUSD to Wallet",
      description: "Calls the public faucet method on the token contract to mint 100 mUSD to your connected testnet wallet.",
      command: `near call ${tokenId} mint_faucet '{"amount":"100"}' --accountId ${effectiveSender} --gas 30000000000000`,
      contractId: tokenId,
      method: "mint_faucet",
      args: { amount: "100" },
      isDanger: false,
    });
  };

  const handleQuickFund = async () => {
    setIsFunding(true);
    try {
      const resp = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          amount: "100",
        }),
      });
      const data = await resp.json();
      if (data.success) {
        await loadOnchainState();
        if (refreshBalance) refreshBalance();
      } else if (data.command) {
        setActiveOwnerModal({
          title: "Deposit $100 mUSD into Vault",
          description: data.message || "Run this command from your terminal to mint test tokens and deposit into the vault:",
          command: data.command,
          isDanger: false,
        });
      }
    } catch (err) {
      console.error("Fund failed:", err);
    } finally {
      setIsFunding(false);
    }
  };

  const handleDepositNear = () => {
    setActionTxHash(null);
    setActionError(null);
    const cliGuard = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Deposit 1 NEAR into Vault",
      description: "Transfers 1 native NEAR from your connected owner wallet into the agent working pot onchain.",
      command: `near call ${cliGuard} deposit_near '{"agent_account":"${agentId}"}' --deposit 1 --accountId ${ownerId} --gas 100000000000000`,
      method: "deposit_near",
      args: { agent_account: agentId },
      isDanger: false,
    });
  };

  const handleSettlePending = (pendingId: number) => {
    setActionTxHash(null);
    setActionError(null);
    const cliGuard = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Settle Quarantined Action",
      description: `Authorizes and executes quarantined action #${pendingId} on NEAR Testnet. The 60-second review timelock has completed.`,
      command: `near call ${cliGuard} settle_pending '{"agent_account":"${agentId}","id":${pendingId}}' --accountId ${ownerId} --gas 100000000000000`,
      method: "settle_pending",
      args: { agent_account: agentId, id: pendingId },
      isDanger: false,
    });
  };

  const handleCancelPending = (pendingId: number) => {
    setActionTxHash(null);
    setActionError(null);
    const cliGuard = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Veto Quarantined Action",
      description: `Vetoes and deletes quarantined action #${pendingId} from the onchain queue. No funds will be transferred.`,
      command: `near call ${cliGuard} cancel_pending '{"agent_account":"${agentId}","id":${pendingId}}' --accountId ${ownerId} --gas 100000000000000`,
      method: "cancel_pending",
      args: { agent_account: agentId, id: pendingId },
      isDanger: true,
    });
  };

  const handleCancelPolicyChange = async () => {
    setActionTxHash(null);
    setActionError(null);
    const cliGuard = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Cancel Staged Policy Change",
      description: "Cancels the pending policy change currently sitting in the timelock queue. The existing policy rules remain active.",
      command: `near call ${cliGuard} cancel_policy_change '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      method: "cancel_policy_change",
      args: { agent_account: agentId },
      isDanger: true,
    });
  };

  const handleRevoke = async () => {
    setActionTxHash(null);
    setActionError(null);
    const cliGuard = guardId || "<POLICY_CONTRACT_ID>";
    setActiveOwnerModal({
      title: "Permanently Revoke Agent Passkey",
      description: "Permanently revokes all allowlisted targets and recipients onchain and pauses the agent. Even if unpaused, the agent cannot execute any future actions.",
      command: `near call ${cliGuard} revoke_agent '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      method: "revoke_agent",
      args: { agent_account: agentId },
      isDanger: true,
    });
  };

  const toggleRule = (ruleNum: number) => {
    if (ruleNum === 1) return;
    if (ruleNum === 2) {
      if (isPaused) {
        handleUnpause();
      } else {
        handlePause();
      }
      return;
    }
    handleOpenPolicyEditor();
  };

  const handleOpenPolicyEditor = () => {
    setEditDailyCap(dailyCapTotal || 500);
    setEditVelocityMax(velocityMax || 5);
    const existingRecipients = Array.isArray(policy?.recipients)
      ? policy.recipients.join(", ")
      : "";
    setEditRecipients(existingRecipients);
    const existingTargets = policy?.targets && typeof policy.targets === "object"
      ? Object.keys(policy.targets).join(", ")
      : "sergeo-guard-dex.testnet";
    setEditTargets(existingTargets);
    const existingCanaries = Array.isArray(policy?.canary_methods)
      ? policy.canary_methods.join(", ")
      : canaryMethods.join(", ");
    setEditCanaryMethods(existingCanaries);
    const existingDrawdown = policy?.max_drawdown_bps !== undefined && policy?.max_drawdown_bps !== null
      ? Number(policy.max_drawdown_bps) / 100
      : maxDrawdownBps !== null
      ? Number(maxDrawdownBps) / 100
      : "";
    setEditMaxDrawdown(existingDrawdown);
    const existingIntents = Array.isArray(policy?.intent_recipients)
      ? policy.intent_recipients.join(", ")
      : intentRecipients.join(", ");
    setEditIntentRecipients(existingIntents);
    const existingNearCap = policy?.near_daily_cap !== undefined && policy?.near_daily_cap !== null
      ? String(policy.near_daily_cap)
      : "";
    setEditNearDailyCap(existingNearCap);
    const existingNearThresh = policy?.near_high_value_threshold !== undefined && policy?.near_high_value_threshold !== null
      ? String(policy.near_high_value_threshold)
      : "";
    setEditNearHighValueThreshold(existingNearThresh);
    setPolicyUpdateTxHash(null);
    setPolicyUpdateError(null);
    setIsEditPolicyOpen(true);
  };

  const handleSavePolicyOnchain = async () => {
    setIsSigningPolicy(true);
    setPolicyUpdateError(null);
    setPolicyUpdateTxHash(null);
    try {
      const { getNearWalletSelector } = await import("@/lib/wallet-selector");
      const ws = await getNearWalletSelector();
      if (!ws) throw new Error("Wallet selector could not be initialized");
      const wallet = await ws.selector.wallet();
      const { transactions } = await import("near-api-js");

      const targetAccounts = editTargets.split(",").map((s) => s.trim()).filter(Boolean);
      const targetsObj: Record<string, string[]> = {};
      for (const t of targetAccounts) {
        targetsObj[t] = policy?.targets?.[t] || ["swap", "ft_transfer_call", "storage_deposit"];
      }
      if (Object.keys(targetsObj).length === 0) {
        targetsObj["sergeo-guard-dex.testnet"] = ["swap"];
      }

      const recipientsList = editRecipients.split(",").map((s) => s.trim()).filter(Boolean);
      const canaryList = editCanaryMethods.split(",").map((s) => s.trim()).filter(Boolean);
      const intentRecipientsList = editIntentRecipients.split(",").map((s) => s.trim()).filter(Boolean);
      const drawdownBps = typeof editMaxDrawdown === "number" && editMaxDrawdown > 0
        ? Math.round(editMaxDrawdown * 100)
        : null;

      const updatedPolicy = {
        token: policy?.token || "sergeo-guard-token.testnet",
        targets: targetsObj,
        daily_cap: String(editDailyCap || 500),
        recipients: recipientsList,
        max_actions_per_10min: Number(editVelocityMax || 5),
        auto_pause_rejects: policy?.auto_pause_rejects || 3,
        auto_pause_window_minutes: policy?.auto_pause_window_minutes || 10,
        high_value_threshold: policy?.high_value_threshold !== undefined ? String(policy.high_value_threshold) : "250",
        high_value_delay_seconds: policy?.high_value_delay_seconds !== undefined ? Number(policy.high_value_delay_seconds) : 60,
        policy_change_delay_seconds: policy?.policy_change_delay_seconds !== undefined ? Number(policy.policy_change_delay_seconds) : 60,
        max_drawdown_bps: drawdownBps,
        lease_expires_at: leaseExpiresAt ? Number(leaseExpiresAt) : null,
        canary_methods: canaryList,
        intent_recipients: intentRecipientsList,
        near_daily_cap: editNearDailyCap.trim() ? editNearDailyCap.trim() : null,
        near_high_value_threshold: editNearHighValueThreshold.trim() ? editNearHighValueThreshold.trim() : null,
      };

      const action = transactions.functionCall(
        "set_policy",
        Buffer.from(JSON.stringify({
          agent_account: agentId,
          policy: updatedPolicy,
        })),
        BigInt("100000000000000"), // 100 TGas
        BigInt(0)
      );

      if (!guardId) {
        throw new Error("Policy contract not configured. Set NEXT_PUBLIC_POLICY_CONTRACT_ID to sign onchain.");
      }

      const res = await wallet.signAndSendTransaction({
        receiverId: guardId,
        actions: [action as any],
      });

      const txHash = res && typeof res === "object" && "transaction" in res
        ? (res as any).transaction.hash
        : "Confirmed onchain";

      setPolicyUpdateTxHash(txHash);
      setTimeout(() => {
        loadOnchainState();
      }, 2500);
    } catch (err: any) {
      setPolicyUpdateError(err.message || "Failed to broadcast set_policy onchain");
    } finally {
      setIsSigningPolicy(false);
    }
  };

  const copyAgentId = () => {
    navigator.clipboard.writeText(agentId);
    setCopiedAgent(true);
    setTimeout(() => setCopiedAgent(false), 2000);
  };

  const filteredActivities = activities.filter((item) => {
    if (ledgerFilter === "approved" && item.type !== "ALLOW" && item.type !== "SETTLED") {
      return false;
    }
    if (ledgerFilter === "declined" && item.type !== "REJECT" && item.type !== "AUTO_PAUSE") {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCall = item.target ? item.target.toLowerCase().includes(q) : false;
      const matchMethod = item.method ? item.method.toLowerCase().includes(q) : false;
      const matchReason = item.reason ? item.reason.toLowerCase().includes(q) : false;
      const matchTx = item.txHash ? item.txHash.toLowerCase().includes(q) : false;
      return matchCall || matchMethod || matchReason || matchTx;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Unauthenticated Read-Only Demo Notice */}
      {!user && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <Shield className="w-4 h-4 text-brand-blue shrink-0" />
            <span>
              Viewing in <strong>Read-Only Demonstration Mode</strong> (<span className="font-mono">{agentId}</span>). Sign in with your NEAR owner account to modify policy and execute emergency controls.
            </span>
          </div>
          <button
            type="button"
            onClick={openAuthModal}
            className="px-3 py-1.5 rounded-lg bg-brand-blue hover:bg-blue-600 text-white text-xs font-semibold shrink-0 cursor-pointer transition"
          >
            Sign In with Wallet
          </button>
        </div>
      )}

      {/* Policy Contract Not Configured Banner */}
      {!guardId && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-bold block uppercase tracking-wider">Policy contract not configured</span>
            <span className="mt-0.5 block">Set NEXT_PUBLIC_POLICY_CONTRACT_ID in your environment to view and manage live agent policy.</span>
          </div>
        </div>
      )}

      {/* Mobile Greeting & Status Header */}
      <div className="lg:hidden flex items-center justify-between bg-white dark:bg-obsidian-900 p-3.5 rounded-xl border border-slate-200 dark:border-obsidian-800">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Security Console
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
            Welcome, <span className="text-brand-blue capitalize">{ownerId.split('.')[0]}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded-full px-2.5 py-0.5 text-xs font-mono bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-mint-green" />
            <span>Policy Active</span>
          </span>
        </div>
      </div>

      {/* Onboarding Quickstart Banner */}
      <div className="bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-obsidian-850 text-brand-blue border border-slate-200 dark:border-obsidian-800 shrink-0">
            <ShieldCheck className="w-5 h-5 text-mint-green" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-brand-blue">
                {user ? `Welcome, ${user.displayName}` : "Security Console"}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20">
                Live Demo Telemetry
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Guarded Agent: agent.sergeo-guard.testnet
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Real-time telemetry from the public ScopeGuard demo agent. Ready to secure your own trading bot or background agent? Issue a custom scoped passkey with your own spending cap and allowlisted contracts in under 60 seconds.
            </p>
          </div>
        </div>

        <Link
          href="/create"
          className="bg-brand-blue hover:bg-brand-blueHover text-white rounded-lg px-4 py-2 text-xs font-semibold shrink-0 transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>Issue Passkey</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Circuit Breaker Status Banner */}
      <CircuitBreakerBanner
        isPaused={isPaused}
        rejectCount={rejectCount}
        maxRejects={Number(policy?.auto_pause_rejects || 3)}
        windowMinutes={Number(policy?.auto_pause_window_minutes || 10)}
        recentRejections={[]}
        onUnpause={handleUnpause}
        isOwner={Boolean(user && connectedWalletId === ownerId)}
      />

      {/* Staged Policy Timelock Banner */}
      <StagedPolicyBanner
        stagedPolicy={stagedPolicy}
        onCancelPolicyChange={handleCancelPolicyChange}
        isOwner={Boolean(user && connectedWalletId === ownerId)}
      />

      {/* Hero Financial Vault Card */}
      <div className="bg-white dark:bg-obsidian-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-obsidian-800 space-y-6">
        {/* Top Header Row with Score Box */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-obsidian-800">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Protected Agent Vault
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20">
                Onchain Custody
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-4 sm:gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {isInitialLoading ? "--" : `$${vaultBalance}.00`}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  mUSD Working Pot
                </span>
              </div>
              <div className="flex items-baseline gap-2 border-l border-slate-200 dark:border-obsidian-800 pl-4 sm:pl-6">
                <span className="text-3xl sm:text-4xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {isInitialLoading ? "--" : `${nearVaultBalance} NEAR`}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Native Pot
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              Money custodied exclusively in the Guard contract. The absolute maximum loss boundary if the agent is fully compromised.
            </p>
          </div>

          {/* Clean Security Score Widget */}
          <div className="bg-slate-50 dark:bg-obsidian-950 rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 w-full sm:w-auto sm:min-w-[200px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Security Score
              </span>
              <ShieldCheck className="w-4 h-4 text-mint-green" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                100%
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-mint-green/10 text-mint-greenDark dark:text-mint-green">
                Grade A
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Onchain rules active
            </span>
          </div>
        </div>

        {/* 4-Column Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tile A: Daily Budget Cap */}
          <div className="rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Daily Budget Cap
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              {isInitialLoading ? (
                <span className="inline-block h-8 w-20 bg-slate-200 dark:bg-obsidian-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  ${dailyCapTotal}
                </span>
              )}
              <span className="text-[11px] font-mono text-slate-500">
                mUSD / 24h
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              Configured 24h ceiling
            </span>
          </div>

          {/* Tile B: Spent Today */}
          <div className="rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <Activity className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Spent Today
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              {isInitialLoading ? (
                <span className="inline-block h-8 w-16 bg-slate-200 dark:bg-obsidian-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  ${dailyCapSpent}
                </span>
              )}
              <span className="text-[11px] font-mono text-slate-500">
                {dailyCapTotal > 0 ? Math.round((dailyCapSpent / dailyCapTotal) * 100) : 0}% of Cap
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              {dailyCapSpent > 0 ? `$${dailyCapSpent} in rolling window` : "Zero spend in window"}
            </span>
          </div>

          {/* Tile C: Remaining Safe Allowance */}
          <div className="rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <Check className="w-3.5 h-3.5 text-mint-green" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Remaining Allowance
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              {isInitialLoading ? (
                <span className="inline-block h-8 w-20 bg-slate-200 dark:bg-obsidian-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  ${Math.max(0, dailyCapTotal - dailyCapSpent)}
                </span>
              )}
              <span className="text-[11px] font-mono text-mint-greenDark dark:text-mint-green font-semibold">
                Available
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              Unblocked spendable budget
            </span>
          </div>

          {/* Tile D: Speed Throttle */}
          <div className="rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <Gauge className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Speed Throttle
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              {isInitialLoading ? (
                <span className="inline-block h-8 w-16 bg-slate-200 dark:bg-obsidian-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {velocityUsed}/{velocityMax}
                </span>
              )}
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                velocityUsed >= velocityMax
                  ? "bg-rose-500/10 text-rose-500"
                  : "text-slate-500"
              }`}>
                {velocityUsed >= velocityMax ? "Brake Tripped" : "Normal"}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              Calls in 10m window
            </span>
          </div>
        </div>

        {/* Bottom Action Strip */}
        <div className="pt-4 border-t border-slate-100 dark:border-obsidian-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Assigned Passkey:</span>
            <span className="font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-obsidian-950 px-3 py-1 rounded-lg border border-slate-200 dark:border-obsidian-800 flex items-center gap-2 max-w-full">
              <span className="truncate">{agentId}</span>
              <button
                type="button"
                onClick={copyAgentId}
                className="hover:text-brand-blue transition cursor-pointer"
                title="Copy agent account ID"
              >
                {copiedAgent ? <Check className="w-3.5 h-3.5 text-mint-green" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </span>

            {fleetAgents.length > 1 && (
              <div className="flex items-center gap-1.5 ml-1 sm:ml-3">
                <span className="text-xs text-slate-500">Fleet Switcher:</span>
                <select
                  aria-label="Select Guarded Agent"
                  value={agentId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAgentId(next);
                    if (typeof window !== "undefined") {
                      const sp = new URLSearchParams(window.location.search);
                      sp.set("agent", next);
                      window.history.replaceState({}, "", `/dashboard?${sp.toString()}`);
                    }
                  }}
                  className="bg-slate-100 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:border-brand-blue cursor-pointer"
                >
                  {fleetAgents.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleDepositMusd}
              className="bg-brand-blue hover:bg-brand-blueHover text-white rounded-lg px-3.5 py-2 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              title="Deposit 100 mUSD into the agent vault onchain"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Deposit $100 mUSD</span>
            </button>


          </div>
        </div>
      </div>

      {/* Spending Limits, Speed Throttles & Autonomous Risk Gauges */}
      <BudgetVelocityGauge
        gasBudgetNearTotal={0.25}
        gasBudgetNearRemaining={0.23}
        dailyCapTotal={dailyCapTotal}
        dailyCapSpent={dailyCapSpent}
        velocityUsed={velocityUsed}
        velocityMax={velocityMax}
        vaultBalance={vaultBalance}
        highWaterMark={highWaterMark}
        maxDrawdownBps={maxDrawdownBps}
        leaseExpiresAt={leaseExpiresAt}
        canaryMethodsCount={canaryMethods.length}
        intentRecipientsCount={intentRecipients.length}
      />

      {/* Worst-Case Loss Bound Indicator */}
      <WorstCaseBoundIndicator dailyCap={dailyCapTotal} vaultBalance={vaultBalance} />

      {/* Autonomous Risk Panels: IntentShield & Canary Decoys */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* IntentShield Card */}
        <div className="rounded-xl border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-obsidian-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-blue" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                IntentShield: Cross-Chain Allowlist (targets intents.near)
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
              {intentRecipients.length > 0 ? `${intentRecipients.length} Recipient(s)` : "Strict Mode"}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Restricts IntentTransfer actions to pre-approved destination addresses across EVM, Cosmos, and Solana chains. Live contract checks recipient allowlist and deposit address target; does not verify 1Click quotes onchain.
          </p>

          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Allowlisted Destinations:
            </span>
            {intentRecipients.length > 0 ? (
              <div className="space-y-1">
                {intentRecipients.map((rec, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 font-mono text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between"
                  >
                    <span className="truncate">{rec}</span>
                    <span className="text-[10px] font-semibold text-mint-greenDark dark:text-mint-green px-1.5 py-0.5 rounded bg-mint-green/10">
                      Permitted
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-xs font-mono text-slate-500">
                No external recipients allowlisted. All cross-chain withdrawals are blocked onchain.
              </div>
            )}
          </div>
        </div>

        {/* Canary Decoy Honeypot Card */}
        <div className="rounded-xl border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-obsidian-800">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Canary Decoy Tripwires
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {canaryMethods.length} Armed
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Honeypot functions deliberately advertised to catch prompt injection attacks. If an agent tries calling any of these methods, the contract triggers immediate auto-pause.
          </p>

          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Active Decoy Methods:
            </span>
            <div className="flex flex-wrap gap-2">
              {canaryMethods.map((m, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 font-mono text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>{m}()</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Emergency Alerts: Telegram & Discord Webhooks */}
      <WebhookAlertSettings agentId={agentId} />

      {/* Enforced Policy Rules and Controls */}
      <div className="bg-white dark:bg-obsidian-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-obsidian-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-obsidian-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Active Onchain Policy
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20">
                Deterministic Order
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Policy Checks and Enforcement Rules
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sequence executed on NEAR before any token movement. If any check fails, the transaction is rejected with its reason code.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              type="button"
              onClick={() => handleOpenPolicyEditor()}
              className="px-3 py-1.5 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Edit Policy Limits</span>
            </button>
            <span className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-600 dark:text-slate-400">
              Contract: {guardId || "Policy contract not configured"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              num: 1,
              name: "Registered Agent Account",
              code: "NOT_AGENT",
              desc: "Caller must match registered agent sub-account. Impostors and third-party callers are refused before state access.",
              config: agentId,
              badge: "Bound",
              isLocked: true,
            },
            {
              num: 2,
              name: "Execution State & Circuit Breaker",
              code: "PAUSED",
              desc: "Refuses execution when paused by owner or tripped by consecutive rejects in configured window.",
              config: isInitialLoading ? "Syncing..." : isPaused ? "Paused by Owner" : "Active (Unpaused)",
              badge: isInitialLoading ? "Syncing" : isPaused ? "Paused" : "Active",
              isLocked: false,
            },
            {
              num: 3,
              name: "Task Lease Expiry",
              code: "LEASE_EXPIRED",
              desc: "Refuses execution if the task lease timestamp has expired. Prevents forgotten keys from executing indefinitely.",
              config: leaseExpiresAt
                ? `Expires: ${new Date(Number(leaseExpiresAt) / 1000000).toLocaleString()}`
                : "Perpetual (No Expiry)",
              badge: leaseExpiresAt ? "Timed" : "Perpetual",
              isLocked: false,
            },
            {
              num: 4,
              name: "Canary Decoy Honeypot Tripwire",
              code: "CANARY_TRIPPED",
              desc: "Calling honeypot methods trips auto-pause immediately and emits an onchain CANARY_TRIPPED security event.",
              config: canaryMethods.join(", "),
              badge: `${canaryMethods.length} Armed`,
              isLocked: true,
            },
            {
              num: 5,
              name: "Velocity Anti-Spam Limit",
              code: "OVER_VELOCITY_CAP",
              desc: `Maximum ${velocityMax} transactions per 10-minute sliding window. Blocks runaway loops and automated burst draining.`,
              config: `${velocityUsed} / ${velocityMax} calls recorded`,
              badge: `${velocityUsed}/${velocityMax} Used`,
              isLocked: false,
            },
            {
              num: 6,
              name: "Target Contract Allowlist",
              code: "TARGET_NOT_ALLOWED",
              desc: "Agent calls are restricted exclusively to allowlisted contracts. Calls to unlisted contracts are blocked onchain.",
              config: isInitialLoading
                ? "Syncing..."
                : policy?.targets && Object.keys(policy.targets).length > 0
                ? Object.keys(policy.targets).join(", ")
                : "No targets allowlisted",
              badge: isInitialLoading
                ? "Syncing"
                : `${policy?.targets ? Object.keys(policy.targets).length : 0} Target(s)`,
              isLocked: false,
            },
            {
              num: 7,
              name: "Method Call Allowlist",
              code: "METHOD_NOT_ALLOWED",
              desc: "Only approved contract methods can be invoked. Key-management, admin, and upgrade functions are refused.",
              config: isInitialLoading
                ? "Syncing..."
                : policy?.targets && Object.keys(policy.targets).length > 0
                ? Object.entries(policy.targets)
                    .map(([t, m]: any) => `${t}: ${Array.isArray(m) ? m.join(", ") : m}`)
                    .join(" | ")
                : "No methods allowlisted",
              badge: "Strict Methods",
              isLocked: false,
            },
            {
              num: 8,
              name: "Daily Spending Cap",
              code: "OVER_DAILY_CAP",
              desc: `Cumulative value spent across rolling 24 hours cannot exceed $${dailyCapTotal} mUSD ($${dailyCapSpent} spent, $${Math.max(0, dailyCapTotal - dailyCapSpent)} remaining).`,
              config: isInitialLoading ? "Syncing..." : `$${dailyCapSpent} / $${dailyCapTotal} mUSD`,
              badge: isInitialLoading ? "Syncing" : `$${Math.max(0, dailyCapTotal - dailyCapSpent)} Left`,
              isLocked: false,
            },
            {
              num: 9,
              name: "Direct Recipient Transfer Allowlist",
              code: "RECIPIENT_NOT_ALLOWED",
              desc: "Direct token payouts to personal wallets are refused unless explicitly allowlisted. Empty list = strict DEX isolation.",
              config: isInitialLoading
                ? "Syncing..."
                : policy?.recipients && policy.recipients.length > 0
                ? policy.recipients.join(", ")
                : "Strict Isolation (Transfers Refused)",
              badge: isInitialLoading
                ? "Syncing"
                : policy?.recipients && policy.recipients.length > 0
                ? `${policy.recipients.length} Recipient(s)`
                : "Isolated",
              isLocked: false,
            },
            {
              num: 10,
              name: "IntentShield Cross-Chain Allowlist",
              code: "INTENT_RECIPIENT_NOT_ALLOWED",
              desc: "Cross-chain Intent transfers (targets intents.near) are restricted to explicitly allowlisted destination recipient addresses. Live contract checks recipient allowlist and deposit address target; does not verify 1Click quotes onchain.",
              config: isInitialLoading
                ? "Syncing..."
                : intentRecipients.length > 0
                ? intentRecipients.join(", ")
                : "Strict Isolation (Transfers Refused)",
              badge: isInitialLoading
                ? "Syncing"
                : intentRecipients.length > 0
                ? `${intentRecipients.length} Recipient(s)`
                : "Isolated",
              isLocked: false,
            },
            {
              num: 11,
              name: "Net Drawdown Floor Breaker",
              code: "DRAWDOWN_EXCEEDED",
              desc: `Halts execution if vault drops below ${((10000 - (maxDrawdownBps ?? 2000)) / 100).toFixed(0)}% of peak high-water mark (${highWaterMark}).`,
              config: `${((maxDrawdownBps ?? 2000) / 100).toFixed(1)}% Max Drop`,
              badge: "Floor Protected",
              isLocked: false,
            },
            {
              num: 12,
              name: "Timelock Quarantine Queue",
              code: "PENDING",
              desc: "Transfers at or above high-value threshold enter timelock quarantine for explicit owner settlement.",
              config: "High-Value Delayed",
              badge: "Timelock Queue",
              isLocked: false,
            },
            {
              num: 13,
              name: "Vault Custody Balance Enforcement",
              code: "INSUFFICIENT_VAULT_BALANCE",
              desc: `Transfers cannot exceed internal custodied balance ($${vaultBalance} mUSD / ${nearVaultBalance} NEAR in vault).`,
              config: `$${vaultBalance} mUSD | ${nearVaultBalance} NEAR`,
              badge: "Vault Bounded",
              isLocked: false,
            },
            {
              num: 14,
              name: "Timelock Capacity Boundary",
              code: "PENDING_QUEUE_FULL",
              desc: "Timelock quarantine is strictly capped at 8 pending actions to prevent queue overload and unapproved buildup.",
              config: `${pendingActions.length} / 8 Queued`,
              badge: `${pendingActions.length}/8 Queue`,
              isLocked: false,
            },
          ].map((rule) => {
            const isEnabled = ruleToggles[rule.num] !== false;
            return (
              <div
                key={rule.num}
                className={`p-3.5 rounded-xl border transition ${
                  isEnabled
                    ? "bg-slate-50 dark:bg-obsidian-950 border-slate-200 dark:border-obsidian-800"
                    : "bg-slate-100/50 dark:bg-obsidian-950/20 border-slate-200/40 dark:border-obsidian-800/40 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-obsidian-850 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                      {rule.num}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {rule.name}
                      </h4>
                      <span className="font-mono text-[10px] text-slate-400">
                        {rule.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-obsidian-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-obsidian-800">
                      {rule.badge}
                    </span>

                    {rule.num === 1 ? (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                        Protocol Fixed
                      </span>
                    ) : rule.num === 2 ? (
                      <button
                        type="button"
                        onClick={() => toggleRule(rule.num)}
                        title={isPaused ? "Click to unpause key" : "Click to pause key"}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer ${
                          !isPaused ? "bg-brand-blue" : "bg-slate-300 dark:bg-obsidian-800"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                            !isPaused ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleRule(rule.num)}
                        title="Click to configure onchain rule"
                        className="text-[11px] font-semibold text-brand-blue hover:text-blue-500 cursor-pointer flex items-center gap-1"
                      >
                        <span>Configure</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {rule.desc}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-obsidian-800 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400 text-[10px]">Config:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[200px]">
                    {rule.config}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quarantined Actions in Timelock */}
      {pendingActions.length > 0 && (
        <div className="rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-blue font-semibold text-xs">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>Quarantined High-Value Actions ({pendingActions.length})</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Threshold: ${policy?.high_value_threshold || 250} mUSD
            </span>
          </div>

          <div className="space-y-2">
            {pendingActions.map((item) => {
              const isReady = !item.secondsRemaining || item.secondsRemaining <= 0;
              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        Action #{item.id}: {item.method}() on {item.target}
                      </span>
                      <span className="font-mono font-bold text-xs text-mint-greenDark dark:text-mint-green">
                        ${item.amount} mUSD
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {isReady
                        ? "Quarantine window ended. Ready for owner settlement."
                        : `Owner review delay: ${item.secondsRemaining}s remaining`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {isReady && (
                      <button
                        type="button"
                        onClick={() => handleSettlePending(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-mint-greenDark dark:bg-mint-green text-white dark:text-slate-950 text-xs font-semibold transition"
                      >
                        Settle & Execute
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCancelPending(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition"
                    >
                      Veto & Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Asymmetric Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Col 7): Activity Ledger Card */}
        <div className="lg:col-span-7 bg-white dark:bg-obsidian-900 rounded-xl p-5 border border-slate-200 dark:border-obsidian-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-obsidian-800">
            <div>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block">
                Onchain Audit Ledger
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Activity Receipts & Enforcements
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/20 text-xs font-semibold transition"
                title="Export Provenance & Security Incidents"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                Export Report
              </button>

              {/* Smart Filter Pills */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-xs">
              <button
                type="button"
                onClick={() => setLedgerFilter("all")}
                className={`px-2.5 py-1 rounded transition ${
                  ledgerFilter === "all"
                    ? "bg-white dark:bg-obsidian-850 text-slate-900 dark:text-white font-semibold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("approved")}
                className={`px-2.5 py-1 rounded transition ${
                  ledgerFilter === "approved"
                    ? "bg-white dark:bg-obsidian-850 text-slate-900 dark:text-white font-semibold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Allowed
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("declined")}
                className={`px-2.5 py-1 rounded transition ${
                  ledgerFilter === "declined"
                    ? "bg-white dark:bg-obsidian-850 text-slate-900 dark:text-white font-semibold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Refused
              </button>
            </div>
          </div>
        </div>

          {/* Search Box & Onchain Transaction Inspector */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter events or paste any NEAR testnet transaction hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white focus:outline-none focus:border-brand-blue"
              />
            </div>
            {searchQuery.trim().length >= 40 && (
              <button
                type="button"
                onClick={() => setInspectHash(searchQuery.trim())}
                className="px-2.5 py-1.5 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1"
                title="Inspect this transaction directly on NEAR RPC"
              >
                <Terminal className="w-3 h-3" />
                <span>Inspect Onchain</span>
              </button>
            )}
          </div>

          {/* Event Items */}
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {isInitialLoading ? (
              <div className="space-y-2 py-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 animate-pulse flex items-center justify-between"
                  >
                    <div className="h-3 w-32 bg-slate-200 dark:bg-obsidian-800 rounded" />
                    <div className="h-3 w-16 bg-slate-200 dark:bg-obsidian-800 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-mono">
                No activity receipts matching filter.
              </div>
            ) : (
              filteredActivities.map((act) => {
                const isAllowed = act.type === "ALLOW" || act.type === "SETTLED";
                const isPending = act.type === "PENDING";
                return (
                  <div
                    key={act.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isAllowed ? "bg-mint-green" : isPending ? "bg-brand-blue" : "bg-rose-500"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isAllowed
                                ? "bg-mint-green/10 text-mint-greenDark dark:text-mint-green"
                                : isPending
                                ? "bg-brand-blue/10 text-brand-blue"
                                : "bg-rose-500/10 text-rose-500"
                            }`}
                          >
                            {act.type}
                          </span>

                          {act.target && (
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200 font-medium truncate max-w-[170px] sm:max-w-xs">
                              {act.target}::{act.method || "call"}()
                            </span>
                          )}

                          {act.amount && (
                            <span className="font-mono text-xs text-mint-greenDark dark:text-mint-green font-bold">
                              ${act.amount}
                            </span>
                          )}
                        </div>

                        {act.reason && (
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {act.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center text-xs text-slate-400">
                      <span className="font-mono text-[10px]">
                        {new Date(act.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })} {new Date(act.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {act.txHash && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setInspectHash(act.txHash!)}
                            className="text-brand-blue hover:underline font-mono text-[10px]"
                          >
                            Inspect
                          </button>
                          <a
                            href={`https://testnet.nearblocks.io/txns/${act.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-mono text-[10px] inline-flex items-center gap-0.5"
                          >
                            <span>NearBlocks</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (Col 5): Policy Status & Controls */}
        <div className="lg:col-span-5 bg-white dark:bg-obsidian-900 rounded-xl p-5 border border-slate-200 dark:border-obsidian-800 space-y-5">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block">
              Policy Status
            </span>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Active Protection
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-mint-green/10 text-mint-greenDark dark:text-mint-green text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-green" />
                <span>Verified</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every attempted transaction is intercepted by ScopeGuard. Even if the agent is prompt-injected or stolen, loss is bounded to approved limits.
            </p>
          </div>

          {/* Metric Grid */}
          <div className="pt-3 border-t border-slate-100 dark:border-obsidian-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 bg-slate-50 dark:bg-obsidian-950 rounded-lg border border-slate-200 dark:border-obsidian-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium block">
                Brake
              </span>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">3 strikes</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-obsidian-950 rounded-lg border border-slate-200 dark:border-obsidian-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium block">
                Window
              </span>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">10 min</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-obsidian-950 rounded-lg border border-slate-200 dark:border-obsidian-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium block">
                Targets
              </span>
              <span className="font-mono text-xs font-bold text-mint-greenDark dark:text-mint-green">{policy?.targets ? `${Object.keys(policy.targets).length} Targets` : "3 Targets"}</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-obsidian-950 rounded-lg border border-slate-200 dark:border-obsidian-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium block">
                External
              </span>
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">Blocked</span>
            </div>
          </div>

          {/* Owner Emergency Controls */}
          <div className="pt-3 border-t border-slate-100 dark:border-obsidian-800 space-y-2">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block">
              Owner Controls
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {isPaused ? (
                <button
                  type="button"
                  onClick={handleUnpause}
                  className="py-2 px-2.5 rounded-lg bg-mint-greenDark dark:bg-mint-green text-white dark:text-slate-950 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Unpause</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-800 dark:hover:bg-obsidian-750 text-slate-900 dark:text-white text-xs font-semibold border border-slate-200 dark:border-obsidian-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleRevoke}
                className="py-2 px-2.5 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                title="Permanently revoke all target and recipient permissions onchain"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Revoke</span>
              </button>

              <button
                type="button"
                onClick={handleWithdrawVault}
                className="py-2 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                title="Withdraw custodied mUSD vault back to owner"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Drain mUSD</span>
              </button>


            </div>
          </div>
        </div>
      </div>

      {/* Owner Command Modal */}
      {activeOwnerModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveOwnerModal(null);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-obsidian-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeOwnerModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveOwnerModal(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {activeOwnerModal.description}
            </p>

            {activeOwnerModal.builderLink && (
              <div className="pt-1">
                <Link
                  href={`/create?agent=${encodeURIComponent(agentId)}`}
                  className="w-full py-2.5 px-3 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Customize in Policy Builder</span>
                </Link>
              </div>
            )}

            {activeOwnerModal.method && (
              <div className="pt-1 space-y-2">
                {isWalletConnected ? (
                  <button
                    type="button"
                    onClick={handleSignOwnerAction}
                    disabled={isSigningAction}
                    className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                      activeOwnerModal.isDanger
                        ? "bg-rose-600 hover:bg-rose-700 text-white"
                        : "bg-brand-blue hover:bg-brand-blueHover text-white"
                    }`}
                  >
                    {isSigningAction ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Signing with Wallet...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Sign with Connected Wallet ({connectedWalletId})</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (openAuthModal) openAuthModal();
                    }}
                    className="w-full py-2.5 px-3 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Connect Testnet Wallet to Sign Onchain</span>
                  </button>
                )}

                {activeOwnerModal.method === "ft_transfer_call" && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleQuickFund}
                      disabled={isFunding}
                      className="flex-1 py-2 px-2.5 rounded-lg border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 hover:bg-slate-100 dark:hover:bg-obsidian-850 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isFunding ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Minting via Faucet...</span>
                        </>
                      ) : (
                        <>
                          <Coins className="w-3 h-3 text-brand-blue" />
                          <span>Instant Server Faucet</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleMintFaucetTokens}
                      className="flex-1 py-2 px-2.5 rounded-lg border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 hover:bg-slate-100 dark:hover:bg-obsidian-850 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Coins className="w-3 h-3 text-mint-green" />
                      <span>Mint 100 to Wallet</span>
                    </button>
                  </div>
                )}

                {actionTxHash && (
                  <p className="text-[11px] font-mono text-center text-emerald-600 dark:text-emerald-400">
                    Confirmed onchain: {actionTxHash}
                  </p>
                )}
                {actionError && (
                  <p className="text-[11px] font-mono text-center text-rose-500">
                    {actionError}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Run in terminal:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeOwnerModal.command);
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-brand-blue font-medium"
                >
                  {copiedCmd ? <Check className="w-3 h-3 text-mint-green" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd ? "Copied" : "Copy Command"}</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-obsidian-950 text-slate-300 font-mono text-[11px] leading-relaxed overflow-x-auto border border-obsidian-800">
                {activeOwnerModal.command}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Onchain Policy Editor Modal */}
      <PolicyEditorModal
        isOpen={isEditPolicyOpen}
        onClose={() => setIsEditPolicyOpen(false)}
        editDailyCap={editDailyCap}
        setEditDailyCap={setEditDailyCap}
        editVelocityMax={editVelocityMax}
        setEditVelocityMax={setEditVelocityMax}
        editTargets={editTargets}
        setEditTargets={setEditTargets}
        editRecipients={editRecipients}
        setEditRecipients={setEditRecipients}
        editCanaryMethods={editCanaryMethods}
        setEditCanaryMethods={setEditCanaryMethods}
        editMaxDrawdown={editMaxDrawdown}
        setEditMaxDrawdown={setEditMaxDrawdown}
        editIntentRecipients={editIntentRecipients}
        setEditIntentRecipients={setEditIntentRecipients}
        editNearDailyCap={editNearDailyCap}
        setEditNearDailyCap={setEditNearDailyCap}
        editNearHighValueThreshold={editNearHighValueThreshold}
        setEditNearHighValueThreshold={setEditNearHighValueThreshold}
        isWalletConnected={isWalletConnected}
        connectedWalletId={connectedWalletId}
        ownerId={ownerId}
        agentId={agentId}
        guardId={guardId || "Policy contract not configured"}
        policy={policy}
        handleSavePolicyOnchain={handleSavePolicyOnchain}
        isSigningPolicy={isSigningPolicy}
        policyUpdateTxHash={policyUpdateTxHash}
        policyUpdateError={policyUpdateError}
        openAuthModal={openAuthModal}
      />

      {/* Policy Provenance & Incident Export Modal */}
      <IncidentExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        agentId={agentId}
        guardId={guardId || "Policy contract not configured"}
        ownerId={ownerId}
        policy={policy}
        stagedPolicy={stagedPolicy}
        vaultBalance={vaultBalance}
        dailyCapTotal={dailyCapTotal}
        dailyCapSpent={dailyCapSpent}
        activities={activities}
      />

      {/* Direct In-App Onchain Receipt Inspector */}
      <ReceiptModal
        txHash={inspectHash}
        accountId={agentId}
        ownerId={ownerId}
        onClose={() => setInspectHash(null)}
      />
    </div>
  );
}
