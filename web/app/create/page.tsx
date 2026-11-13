"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Lock,
  Building2,
  RefreshCw,
  Code2,
  Check,
  Plus,
  Trash2,
  Send,
  Bell,
  ExternalLink,
  Layers,
  Wand2,
  ArrowUpRight,
  Zap,
  TrendingDown,
  Timer,
  Crosshair,
  Shield,
  AlertTriangle,
  AlertCircle,
  Sliders,
  Sparkles,
  ChevronDown,
  Info,
  ArrowRight,
} from "lucide-react";
import { KeyPair } from "near-api-js";
import { AgentHandoffCard } from "../../components/AgentHandoffCard";
import { PlatformPresets, PresetPlatform, PRESET_PLATFORMS } from "../../components/PlatformPresets";
import { CustomPlatformManager, ConfiguredPlatform } from "../../components/CustomPlatformManager";
import { PolicyChatAssistant } from "../../components/PolicyChatAssistant";
import { useWallet } from "@/context/WalletContext";
import { validatePolicyShape, lintPolicy, DrafterPolicy } from "@/lib/drafter";
import { tryGetPolicyContractId } from "@/lib/config";
import {
  suggestNextAgentName,
  isAgentSubaccountOwnerValid,
  checkAgentRegisteredOnchain,
  parseRegistrationError,
  ParsedRegistrationError,
} from "@/lib/registration";

interface TargetPlatform extends ConfiguredPlatform {}

export default function CreateAgentPage() {
  const { accountId: connectedWalletId, isConnected: isWalletConnected } = useWallet();
  const [agentName, setAgentName] = useState("agent3.sergeo-guard.testnet");
  const [dailyCap, setDailyCap] = useState<number>(500);
  const [dailyCapInput, setDailyCapInput] = useState<string>("500");
  const [guardContractId, setGuardContractId] = useState<string | null>(tryGetPolicyContractId);
  const [creationMode, setCreationMode] = useState<"ai" | "manual">("ai");
  const [isAgentNameRegistered, setIsAgentNameRegistered] = useState<boolean | null>(null);
  const [isCheckingAgentOnchain, setIsCheckingAgentOnchain] = useState<boolean>(false);
  const [parsedDeployError, setParsedDeployError] = useState<ParsedRegistrationError | null>(null);

  useEffect(() => {
    setGuardContractId(tryGetPolicyContractId());
  }, []);

  // When a wallet connects, automatically set the agent subaccount to match the connected owner
  useEffect(() => {
    if (isWalletConnected && connectedWalletId) {
      setAgentName((prev) => {
        if (
          prev === "agent.sergeo-guard.testnet" ||
          prev === "agent2.sergeo-guard.testnet" ||
          prev === "agent3.sergeo-guard.testnet" ||
          !prev.endsWith(`.${connectedWalletId}`)
        ) {
          return `agent.${connectedWalletId}`;
        }
        return prev;
      });
    }
  }, [isWalletConnected, connectedWalletId]);

  // Debounced preflight onchain check to detect duplicate agent registration before submission
  useEffect(() => {
    const trimmed = agentName.trim();
    if (!trimmed || !guardContractId || trimmed.length < 2) {
      setIsAgentNameRegistered(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingAgentOnchain(true);
      try {
        const exists = await checkAgentRegisteredOnchain(guardContractId, trimmed);
        setIsAgentNameRegistered(exists);
      } catch {
        setIsAgentNameRegistered(null);
      } finally {
        setIsCheckingAgentOnchain(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [agentName, guardContractId]);

  const [platforms, setPlatforms] = useState<TargetPlatform[]>([
    {
      id: "p1",
      contract: "sergeo-guard-dex.testnet",
      methods: "swap",
      label: "ScopeGuard Testnet DEX",
      isPreset: true,
    },
  ]);

  const [allowExternalTransfers, setAllowExternalTransfers] = useState(false);
  const [externalRecipient, setExternalRecipient] = useState("");
  const [speedLimit, setSpeedLimit] = useState<number>(5);
  const [autoPauseAfter, setAutoPauseAfter] = useState<number>(3);
  const [autoPauseWindowMinutes, setAutoPauseWindowMinutes] = useState<number>(10);
  const [timelockThreshold, setTimelockThreshold] = useState<number>(250);
  const [telegramChatId, setTelegramChatId] = useState<string>("@sergeo");

  // Autonomous Risk Protocol Primitives
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState<number>(20);
  const [enableLeaseExpiry, setEnableLeaseExpiry] = useState<boolean>(false);
  const [taskLeaseHours, setTaskLeaseHours] = useState<number>(24);
  const [intentRecipientsInput, setIntentRecipientsInput] = useState<string>("");
  const [canaryMethodsInput, setCanaryMethodsInput] = useState<string>(
    "drain_vault, admin_drain, emergency_withdraw_all"
  );

  const [activeView, setActiveView] = useState<"visual" | "json">("visual");
  const [isDeploying, setIsDeploying] = useState(false);
  const [issuedSuccess, setIssuedSuccess] = useState(false);
        const [generatedPasskey, setGeneratedPasskey] = useState<string>("");
  const [generatedPublicKey, setGeneratedPublicKey] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [explorerUrl, setExplorerUrl] = useState<string>("");
  const [registrationStatus, setRegistrationStatus] = useState<"idle" | "broadcasting" | "registered" | "manual">("idle");
  const [registrationCommand, setRegistrationCommand] = useState<string>("");
  const [deployError, setDeployError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("issued") === "true") {
        setIssuedSuccess(true);
      }
    }
  }, []);

  const handleDailyCapChange = (val: string) => {
    setDailyCapInput(val);
    const parsed = Number(val);
    if (!isNaN(parsed) && parsed > 0 && Number.isInteger(parsed)) {
      setDailyCap(parsed);
      setTimelockThreshold(Math.max(1, Math.floor(parsed / 2)));
    }
  };

  const setPresetChip = (amount: number) => {
    setDailyCap(amount);
    setDailyCapInput(amount.toString());
    setTimelockThreshold(Math.max(1, Math.floor(amount / 2)));
  };

  const addCustomPlatform = (newPlatform: { contract: string; methods: string; label?: string }) => {
    setPlatforms((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        contract: newPlatform.contract,
        methods: newPlatform.methods,
        label: newPlatform.label,
        isPreset: false,
      },
    ]);
  };

  const removePlatform = (id: string) => {
    if (platforms.length <= 1) return;
    setPlatforms((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePlatformMethods = (id: string, methods: string) => {
    setPlatforms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, methods } : p))
    );
  };

  const togglePresetPlatform = (preset: PresetPlatform) => {
    const exists = platforms.some((p) => p.contract === preset.contract);
    if (exists) {
      if (platforms.length > 1) {
        setPlatforms((prev) => prev.filter((p) => p.contract !== preset.contract));
      }
    } else {
      setPlatforms((prev) => [
        ...prev,
        {
          id: `preset-${Date.now()}`,
          contract: preset.contract,
          methods: preset.methods,
          label: preset.name,
          isPreset: true,
        },
      ]);
    }
  };

  const compiledTargets: Record<string, string[]> = {};
  platforms.forEach((p) => {
    if (p.contract.trim()) {
      const methods = p.methods
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m.length > 0);
      compiledTargets[p.contract.trim()] = methods.length > 0 ? methods : ["swap"];
    }
  });

  const compiledRecipients = allowExternalTransfers && externalRecipient.trim()
    ? externalRecipient
        .split(",")
        .map((r) => r.trim().toLowerCase())
        .filter((r) => r.length > 0)
    : [];

  // When external transfers are allowed to recipients, auto-add ft_transfer target on the policy token
  if (allowExternalTransfers && compiledRecipients.length > 0) {
    const tokenContract = "sergeo-guard-token.testnet";
    const existingMethods = compiledTargets[tokenContract] || [];
    if (!existingMethods.includes("ft_transfer")) {
      compiledTargets[tokenContract] = [...existingMethods, "ft_transfer"];
    }
  }

  const numericDailyCap = Number(dailyCapInput);
  const isDailyCapValid =
    dailyCapInput.trim().length > 0 &&
    !isNaN(numericDailyCap) &&
    numericDailyCap > 0 &&
    Number.isInteger(numericDailyCap);

  const compiledPolicyJson = {
    token: "sergeo-guard-token.testnet",
    targets: compiledTargets,
    daily_cap: isDailyCapValid ? numericDailyCap : 0,
    recipients: compiledRecipients,
    max_actions_per_10min: speedLimit,
    auto_pause_rejects: autoPauseAfter,
    auto_pause_window_minutes: autoPauseWindowMinutes,
    high_value_threshold: Number(timelockThreshold),
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 60,
    max_drawdown_bps: Math.round(Number(maxDrawdownPercent) * 100),
    lease_expires_at: enableLeaseExpiry
      ? (Date.now() + Number(taskLeaseHours) * 3600 * 1000) * 1_000_000
      : null,
    intent_recipients: intentRecipientsInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    canary_methods: canaryMethodsInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    near_daily_cap: null,
    near_high_value_threshold: null,
  };

  const policyValidationErrors = validatePolicyShape(compiledPolicyJson);
  const policyLintWarnings = lintPolicy(compiledPolicyJson as any);
  const hasDangerPolicyLint = policyLintWarnings.some((w) => w.severity === "danger");
  const isPolicyValid = policyValidationErrors.length === 0 && !hasDangerPolicyLint;

  const handleApplyDraftPolicy = (draft: DrafterPolicy) => {
    if (draft.daily_cap) {
      setDailyCap(draft.daily_cap);
      setDailyCapInput(draft.daily_cap.toString());
      setTimelockThreshold(draft.high_value_threshold || Math.max(1, Math.floor(draft.daily_cap / 2)));
    }
    if (draft.max_actions_per_10min) {
      setSpeedLimit(draft.max_actions_per_10min);
    }
    if (draft.auto_pause_rejects) {
      setAutoPauseAfter(draft.auto_pause_rejects);
    }
    if (draft.auto_pause_window_minutes) {
      setAutoPauseWindowMinutes(draft.auto_pause_window_minutes);
    }
    if (draft.targets && Object.keys(draft.targets).length > 0) {
      const newPlatforms: TargetPlatform[] = Object.entries(draft.targets).map(([contract, methods], idx) => ({
        id: `draft-p-${Date.now()}-${idx}`,
        contract,
        methods: Array.isArray(methods) ? methods.join(", ") : "swap",
        label: contract.includes("dex") ? "ScopeGuard Testnet DEX" : contract,
        isPreset: false,
      }));
      setPlatforms(newPlatforms);
    }
    if (draft.recipients && draft.recipients.length > 0) {
      setAllowExternalTransfers(true);
      setExternalRecipient(draft.recipients.join(", "));
    } else {
      setAllowExternalTransfers(false);
      setExternalRecipient("");
    }
    if (draft.canary_methods && draft.canary_methods.length > 0) {
      setCanaryMethodsInput(draft.canary_methods.join(", "));
    }
    if (draft.intent_recipients && draft.intent_recipients.length > 0) {
      setIntentRecipientsInput(draft.intent_recipients.join(", "));
    }
  };

  const isAgentNameValid =
    agentName.trim().length >= 2 &&
    agentName.trim().length <= 64 &&
    /^[a-z0-9._-]+$/.test(agentName.trim());
  const hasValidPlatforms = platforms.length > 0 && Object.keys(compiledTargets).length > 0;
  const isRecipientValid =
    !allowExternalTransfers ||
    (compiledRecipients.length > 0 &&
      compiledRecipients.every(
        (r) => r.length >= 2 && r.length <= 64 && /^[a-z0-9._-]+$/.test(r)
      ));
  const isAutoPauseValid = Number.isInteger(autoPauseAfter) && autoPauseAfter >= 1 && autoPauseAfter <= 50;
  const isSpeedLimitValid = Number.isInteger(speedLimit) && speedLimit >= 1 && speedLimit <= 100;
  const isAutoPauseWindowValid =
    Number.isInteger(autoPauseWindowMinutes) && autoPauseWindowMinutes >= 1 && autoPauseWindowMinutes <= 1440;

  const buttonBlockers: {
    id: string;
    field: string;
    message: string;
    fix: string;
    targetElementId?: string;
    quickFix?: () => void;
    quickFixLabel?: string;
  }[] = [];

  const handleRemoveForbiddenMethod = (contractName: string, methodName: string) => {
    setPlatforms((prev) => {
      const updated = prev.map((p) => {
        if (p.contract.toLowerCase() === contractName.toLowerCase()) {
          const list = p.methods
            .split(",")
            .map((m) => m.trim())
            .filter((m) => m.toLowerCase() !== methodName.toLowerCase() && m.length > 0);
          return {
            ...p,
            methods: list.join(", "),
          };
        }
        return p;
      });
      const cleaned = updated.filter((p) => p.contract.toLowerCase() !== contractName.toLowerCase() || p.methods.trim().length > 0);
      return cleaned.length > 0 ? cleaned : [
        {
          id: "p1",
          contract: "sergeo-guard-dex.testnet",
          methods: "swap",
          label: "ScopeGuard Testnet DEX",
          isPreset: true,
        },
      ];
    });
  };

  const effectiveOwner = connectedWalletId || process.env.NEXT_PUBLIC_OWNER_ACCOUNT_ID || "sergeo-guard.testnet";

  if (!agentName.trim()) {
    buttonBlockers.push({
      id: "missing-agent-name",
      field: "Agent Sub-Account",
      message: "Agent Sub-Account ID is required.",
      fix: "Enter a valid NEAR account name in the Agent Sub-Account field.",
      targetElementId: "agent-subaccount-input",
      quickFixLabel: connectedWalletId ? `⚡ Use agent.${connectedWalletId}` : "⚡ Use agent2.sergeo-guard.testnet",
      quickFix: () => setAgentName(connectedWalletId ? `agent.${connectedWalletId}` : "agent2.sergeo-guard.testnet"),
    });
  } else if (agentName.trim().length < 2 || agentName.trim().length > 64) {
    buttonBlockers.push({
      id: "invalid-agent-name-length",
      field: "Agent Sub-Account",
      message: "Agent Sub-Account length must be between 2 and 64 characters.",
      fix: "Provide an account identifier between 2 and 64 characters to satisfy NEAR standards.",
      targetElementId: "agent-subaccount-input",
    });
  } else if (!/^[a-z0-9._-]+$/.test(agentName.trim())) {
    buttonBlockers.push({
      id: "invalid-agent-name",
      field: "Agent Sub-Account",
      message: "Agent Sub-Account contains invalid characters or spaces.",
      fix: "Use only lowercase alphanumeric characters, dots, hyphens, and underscores (e.g. agent.alice.testnet).",
      targetElementId: "agent-subaccount-input",
    });
  } else if (isWalletConnected && connectedWalletId && !isAgentSubaccountOwnerValid(agentName.trim(), connectedWalletId)) {
    buttonBlockers.push({
      id: "agent-owner-mismatch",
      field: "Agent Sub-Account",
      message: `Account "${agentName.trim()}" must be a sub-account of your connected wallet (${connectedWalletId}) or match your account.`,
      fix: `Change your agent sub-account name so it ends with .${connectedWalletId} (e.g. agent.${connectedWalletId}).`,
      targetElementId: "agent-subaccount-input",
      quickFixLabel: `⚡ Set to agent.${connectedWalletId}`,
      quickFix: () => setAgentName(`agent.${connectedWalletId}`),
    });
  } else if (!isWalletConnected && !isAgentSubaccountOwnerValid(agentName.trim(), effectiveOwner)) {
    buttonBlockers.push({
      id: "agent-owner-mismatch",
      field: "Agent Sub-Account",
      message: `In demo signing mode, account "${agentName.trim()}" must be a sub-account of ${effectiveOwner}.`,
      fix: `Change sub-account to end with .${effectiveOwner} (e.g. agent2.${effectiveOwner}) or connect your NEAR wallet.`,
      targetElementId: "agent-subaccount-input",
      quickFixLabel: `⚡ Set to agent2.${effectiveOwner}`,
      quickFix: () => setAgentName(`agent2.${effectiveOwner}`),
    });
  } else if (isAgentNameRegistered) {
    const nextAgent = suggestNextAgentName(agentName.trim(), effectiveOwner);
    buttonBlockers.push({
      id: "agent-already-registered",
      field: "Agent Sub-Account",
      message: `Sub-account "${agentName.trim()}" is already registered on this Guard.`,
      fix: `Each agent requires a unique sub-account on NEAR. Use ${nextAgent} or click the 1-click fix.`,
      targetElementId: "agent-subaccount-input",
      quickFixLabel: `⚡ Use ${nextAgent} (1-Click Fix)`,
      quickFix: () => setAgentName(nextAgent),
    });
  }

  if (!isDailyCapValid) {
    buttonBlockers.push({
      id: "invalid-daily-cap",
      field: "Daily Spending Cap",
      message: "Daily Spending Cap must be a positive whole number greater than 0 mUSD.",
      fix: "Type an integer amount greater than 0 (e.g. 100) or click one of the quick preset chips.",
      targetElementId: "daily-spending-cap-input",
      quickFixLabel: "⚡ Set to 100 mUSD",
      quickFix: () => {
        setDailyCap(100);
        setDailyCapInput("100");
        setTimelockThreshold(50);
      },
    });
  }

  if (!hasValidPlatforms) {
    buttonBlockers.push({
      id: "missing-platforms",
      field: "Approved Platforms",
      message: "At least one target platform contract with callable methods is required.",
      fix: "Select a pre-vetted platform (e.g. Testnet DEX) or add a custom contract with at least one callable method.",
      targetElementId: "platform-presets-section",
      quickFixLabel: "⚡ Add Testnet DEX",
      quickFix: () => {
        if (PRESET_PLATFORMS[0]) togglePresetPlatform(PRESET_PLATFORMS[0]);
      },
    });
  }

  if (allowExternalTransfers && compiledRecipients.length === 0) {
    buttonBlockers.push({
      id: "missing-recipient",
      field: "Designated Recipient",
      message: "Direct cash transfers are enabled but no recipient account is specified.",
      fix: "Enter destination NEAR account(s) (e.g. sergeo-guard.testnet) or turn off the external transfers toggle.",
      targetElementId: "external-recipient-input",
    });
  } else if (
    allowExternalTransfers &&
    compiledRecipients.some(
      (r) => r.length < 2 || r.length > 64 || !/^[a-z0-9._-]+$/.test(r)
    )
  ) {
    const invalidRecipient = compiledRecipients.find(
      (r) => r.length < 2 || r.length > 64 || !/^[a-z0-9._-]+$/.test(r)
    );
    buttonBlockers.push({
      id: "invalid-recipient",
      field: "Designated Recipient",
      message: `Recipient account "${invalidRecipient}" contains invalid characters or length.`,
      fix: "Enter valid NEAR account IDs between 2 and 64 characters (lowercase letters, numbers, hyphens, dots).",
      targetElementId: "external-recipient-input",
    });
  }

  if (!isAutoPauseValid) {
    buttonBlockers.push({
      id: "invalid-auto-pause",
      field: "Auto-Brake Strikes",
      message: "Auto-brake strikes must be an integer between 1 and 50.",
      fix: "Set a strike count between 1 and 50 rejections.",
      targetElementId: "auto-pause-after-input",
    });
  }

  if (!isSpeedLimitValid) {
    buttonBlockers.push({
      id: "invalid-speed-limit",
      field: "Speed Throttle",
      message: "Speed limit must be between 1 and 100 calls per 10 minutes.",
      fix: "Set the speed limit between 1 and 100.",
      targetElementId: "speed-limit-input",
    });
  }

  if (!isAutoPauseWindowValid) {
    buttonBlockers.push({
      id: "invalid-auto-pause-window",
      field: "Check Window",
      message: "Check window must be between 1 and 1440 minutes.",
      fix: "Set rolling minutes between 1 and 1440.",
      targetElementId: "auto-pause-window-input",
    });
  }

  policyValidationErrors.forEach((err, idx) => {
    if (err.includes("daily_cap") && buttonBlockers.some((b) => b.id === "invalid-daily-cap")) return;
    if (err.includes("targets") && buttonBlockers.some((b) => b.id === "missing-platforms")) return;
    buttonBlockers.push({
      id: `schema-err-${idx}`,
      field: "Policy Schema",
      message: err,
      fix: "Update policy inputs to satisfy onchain schema requirements.",
      targetElementId: "agent-subaccount-input",
    });
  });

  policyLintWarnings
    .filter((w) => w.severity === "danger")
    .forEach((w, idx) => {
      const isValueMoving = w.message.includes("forbidden value-moving method");
      const methodMatch = w.message.match(/forbidden value-moving method:\s*([a-z0-9_]+)/i);
      const targetMatch = w.message.match(/Target\s+([a-z0-9_.-]+)\s+includes/i);
      const forbiddenMethod = methodMatch ? methodMatch[1] : null;
      const offendingTarget = targetMatch ? targetMatch[1] : null;

      buttonBlockers.push({
        id: `lint-danger-${idx}`,
        field: "Security Policy Lint",
        message: w.message,
        fix: isValueMoving
          ? "Remove the forbidden transfer method. ScopeGuard enforces token transfers natively through guarded transfer actions, so you don't need to add it to custom contract calls."
          : "Remove dangerous administrative methods or wildcard '*' to satisfy security invariants.",
        targetElementId: "custom-platforms-container",
        quickFix: isValueMoving && offendingTarget && forbiddenMethod ? () => {
          handleRemoveForbiddenMethod(offendingTarget, forbiddenMethod);
        } : undefined,
        quickFixLabel: isValueMoving && forbiddenMethod ? `⚡ Remove '${forbiddenMethod}' (1-Click Fix)` : undefined,
      });
    });

  const isFormValid = buttonBlockers.length === 0 && !isDeploying;

  const handleJumpToField = (elementId: string) => {
    if (creationMode === "ai") {
      const aiAccordion = document.getElementById("ai-manual-settings-details") as HTMLDetailsElement | null;
      if (aiAccordion) {
        aiAccordion.open = true;
      }
    }

    setTimeout(() => {
      const target = document.getElementById(elementId);
      if (!target) return;

      let parent = target.parentElement;
      while (parent) {
        if (parent.tagName.toLowerCase() === "details") {
          (parent as HTMLDetailsElement).open = true;
        }
        parent = parent.parentElement;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });

      if (typeof (target as HTMLElement).focus === "function") {
        (target as HTMLElement).focus();
      }

      target.classList.add("ring-4", "ring-brand-blue/60", "transition-all", "duration-300");
      setTimeout(() => {
        target.classList.remove("ring-4", "ring-brand-blue/60", "transition-all", "duration-300");
      }, 2500);
    }, 60);
  };

  const handleIssueCard = async (override?: { agentAccountId?: string; policy?: any }) => {
    setIsDeploying(true);
    setDeployError(null);
    setRegistrationStatus("broadcasting");
    const targetAgent = override?.agentAccountId || agentName;
    const targetPolicy = override?.policy || compiledPolicyJson;

    try {
      const keyPair = KeyPair.fromRandom("ed25519");
      const pubKey = keyPair.getPublicKey().toString();
      const privKey = keyPair.toString();
      setGeneratedPasskey(privKey);
      setGeneratedPublicKey(pubKey);

      // When wallet is connected, sign and broadcast onchain directly via NEAR Wallet Selector
      if (isWalletConnected && connectedWalletId) {
        const { getNearWalletSelector } = await import("@/lib/wallet-selector");
        const ws = await getNearWalletSelector();
        if (!ws) throw new Error("Wallet selector could not be initialized");
        const wallet = await ws.selector.wallet();
        const { transactions, utils } = await import("near-api-js");
        const guardId = tryGetPolicyContractId();
        if (!guardId) {
          throw new Error("Policy contract not configured. Set NEXT_PUBLIC_POLICY_CONTRACT_ID to register onchain.");
        }

        // Preflight 1: Validate subaccount ownership against connected wallet
        if (!isAgentSubaccountOwnerValid(targetAgent, connectedWalletId)) {
          const suggested = `agent.${connectedWalletId}`;
          const parsed: ParsedRegistrationError = {
            title: "Sub-Account Owner Mismatch",
            message: `Account "${targetAgent}" must be a sub-account of your connected wallet (${connectedWalletId}) or match it directly.`,
            fixGuidance: `Change the sub-account name so it ends with .${connectedWalletId}.`,
            quickFixLabel: `⚡ Set to ${suggested}`,
            suggestedAccount: suggested,
            targetElementId: "agent-subaccount-input",
          };
          setParsedDeployError(parsed);
          setDeployError(parsed.message);
          setIsDeploying(false);
          setRegistrationStatus("idle");
          return;
        }

        // Preflight 2: Check if agent is already registered onchain before calling wallet
        try {
          const isRegistered = await checkAgentRegisteredOnchain(guardId, targetAgent);
          if (isRegistered) {
            const nextName = suggestNextAgentName(targetAgent, connectedWalletId);
            const parsed: ParsedRegistrationError = {
              title: "Agent Sub-Account Already In Use",
              message: `The agent sub-account "${targetAgent}" is already registered on ScopeGuard. Each agent requires a unique sub-account name.`,
              fixGuidance: `Select a new sub-account name (for example, ${nextName}) or click the 1-click fix below.`,
              quickFixLabel: `⚡ Switch to ${nextName} (1-Click Fix)`,
              suggestedAccount: nextName,
              targetElementId: "agent-subaccount-input",
            };
            setParsedDeployError(parsed);
            setDeployError(parsed.message);
            setIsDeploying(false);
            setRegistrationStatus("idle");
            return;
          }
        } catch {
          // Non-blocking if preflight view fails
        }

        const registerAction = transactions.functionCall(
          "register_agent",
          Buffer.from(JSON.stringify({
            agent_account: targetAgent,
            policy: targetPolicy,
          })),
          BigInt("100000000000000"), // 100 TGas
          BigInt(0)
        );

        const txList: any[] = [
          {
            receiverId: guardId,
            actions: [registerAction],
          },
        ];

        // Check if agent subaccount already exists onchain
        let accountExists = false;
        try {
          const rpcUrl = process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com";
          const checkRes = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "check-acct",
              method: "query",
              params: {
                request_type: "view_account",
                finality: "final",
                account_id: targetAgent,
              },
            }),
          });
          const checkData = await checkRes.json();
          accountExists = !checkData.error;
        } catch {
          accountExists = false;
        }

        const keyAction = transactions.addKey(
          utils.PublicKey.from(pubKey),
          transactions.functionCallAccessKey(
            guardId,
            ["execute"],
            BigInt("250000000000000000000000") // 0.25 NEAR allowance for gas
          )
        );

        // If sub-account does not exist yet under connected owner, create and attach passkey
        if (!accountExists && targetAgent.endsWith(`.${connectedWalletId}`)) {
          txList.push({
            receiverId: targetAgent,
            actions: [
              transactions.createAccount(),
              transactions.transfer(BigInt("250000000000000000000000")), // 0.25 NEAR for storage deposit and keys
              keyAction,
            ],
          });
        } else if (accountExists && targetAgent === connectedWalletId) {
          txList.push({
            receiverId: connectedWalletId,
            actions: [keyAction],
          });
        }

        let signedTxHash = "";
        if (txList.length > 1 && typeof wallet.signAndSendTransactions === "function") {
          const res = await wallet.signAndSendTransactions({ transactions: txList });
          if (Array.isArray(res) && res[0]?.status && (res[0].status as any).Failure) {
            throw (res[0].status as any).Failure;
          }
          if (Array.isArray(res) && res[0]?.transaction?.hash) {
            signedTxHash = res[0].transaction.hash;
          }
        } else {
          const res = await wallet.signAndSendTransaction(txList[0]);
          if (res && typeof res === "object" && (res as any).status?.Failure) {
            throw (res as any).status.Failure;
          }
          if (res && typeof res === "object" && "transaction" in res) {
            signedTxHash = (res as any).transaction.hash;
          }
          if (txList.length > 1) {
            try {
              await wallet.signAndSendTransaction(txList[1]);
            } catch {
              // Non-blocking passkey attachment if wallet requires separate approval
            }
          }
        }

        if (signedTxHash) {
          setTxHash(signedTxHash);
          setExplorerUrl(`https://testnet.nearblocks.io/txns/${signedTxHash}`);
        }
        setRegistrationStatus("registered");
        setIsDeploying(false);
        setIssuedSuccess(true);
        return;
      }

      // Non-wallet flow: invoke /api/register
      const regRes = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentAccountId: targetAgent,
          policy: targetPolicy,
          publicKey: pubKey,
        }),
      });

      const regData = await regRes.json();

      if (!regRes.ok || !regData.success) {
        const errorMsg = regData.error || regData.message || `Registration failed with status ${regRes.status}`;
        if (regData.command) {
          setRegistrationCommand(regData.command);
          setRegistrationStatus("manual");
          setIsDeploying(false);
          setIssuedSuccess(true);
        } else {
          const parsed = regData.parsedError || parseRegistrationError(errorMsg, targetAgent, connectedWalletId || effectiveOwner);
          setParsedDeployError(parsed);
          setDeployError(parsed.message);
          setRegistrationStatus("idle");
          setIsDeploying(false);
          return;
        }
      } else {
        if (regData.txHash) {
          setTxHash(regData.txHash);
          setExplorerUrl(regData.explorerUrl);
          setRegistrationStatus("registered");
        } else if (regData.command) {
          setRegistrationCommand(regData.command);
          setRegistrationStatus("manual");
        }
        setIsDeploying(false);
        setIssuedSuccess(true);
      }
    } catch (e: any) {
      setIsDeploying(false);
      setRegistrationStatus("idle");
      const parsed = parseRegistrationError(e, targetAgent, connectedWalletId || effectiveOwner);
      setParsedDeployError(parsed);
      setDeployError(parsed.message);
    }
  };

  const handleDirectGenerateFromDraft = async (draft: DrafterPolicy) => {
    handleApplyDraftPolicy(draft);
    const targetAgent =
      agentName.trim().length >= 2
        ? agentName.trim()
        : isWalletConnected && connectedWalletId
        ? `agent.${connectedWalletId}`
        : "agent2.sergeo-guard.testnet";
    if (!agentName.trim()) {
      setAgentName(targetAgent);
    }
    const targetsToUse: Record<string, string[]> =
      draft.targets && Object.keys(draft.targets).length > 0
        ? { ...draft.targets }
        : { "sergeo-guard-dex.testnet": ["swap"] };
    if (draft.recipients && draft.recipients.length > 0) {
      const tokenContract = "sergeo-guard-token.testnet";
      const existing = targetsToUse[tokenContract] || [];
      if (!existing.includes("ft_transfer")) {
        targetsToUse[tokenContract] = [...existing, "ft_transfer"];
      }
    }
    const policyToUse = {
      token: "sergeo-guard-token.testnet",
      targets: targetsToUse,
      daily_cap: draft.daily_cap || 500,
      recipients: draft.recipients || [],
      max_actions_per_10min: draft.max_actions_per_10min || 5,
      auto_pause_rejects: draft.auto_pause_rejects || 3,
      auto_pause_window_minutes: draft.auto_pause_window_minutes || 10,
      high_value_threshold: draft.high_value_threshold || Math.max(1, Math.floor((draft.daily_cap || 500) / 2)),
      high_value_delay_seconds: 60,
      policy_change_delay_seconds: 60,
      max_drawdown_bps: draft.max_drawdown_bps || 2000,
      lease_expires_at: null,
      intent_recipients: draft.intent_recipients || [],
      canary_methods: draft.canary_methods && draft.canary_methods.length > 0
        ? draft.canary_methods
        : ["drain_vault", "admin_drain", "emergency_withdraw_all"],
      near_daily_cap: null,
      near_high_value_threshold: null,
    };
    await handleIssueCard({ agentAccountId: targetAgent, policy: policyToUse });
  };

  const renderManualBuilder = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Form Side (Col 7: Clean Single-Layer Card) */}
      <div className="lg:col-span-7 bg-white dark:bg-obsidian-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        {/* 1. Agent Sub-Account */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="agent-subaccount-input" className="text-xs font-semibold text-slate-900 dark:text-white block">
              Agent Sub-Account
            </label>
            {!isAgentNameValid && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Required
              </span>
            )}
          </div>
          <input
            id="agent-subaccount-input"
            name="agent-subaccount"
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g. agent.sergeo-guard.testnet"
            className={`w-full px-3 py-2 bg-slate-50 dark:bg-obsidian-950 border rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none transition ${
              !isAgentNameValid
                ? "border-rose-500 ring-2 ring-rose-500/30"
                : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500"
            }`}
          />
          {!isAgentNameValid && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
              <span>Please enter a valid NEAR agent sub-account (e.g. agent.sergeo-guard.testnet)</span>
            </p>
          )}
          {isAgentNameRegistered && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Account already registered on Guard.</span>
              </span>
              <button
                type="button"
                onClick={() => setAgentName(suggestNextAgentName(agentName, connectedWalletId || effectiveOwner))}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Sparkles className="w-3 h-3" />
                <span>Use {suggestNextAgentName(agentName, connectedWalletId || effectiveOwner)}</span>
              </button>
            </div>
          )}
          {isWalletConnected && connectedWalletId && !isAgentSubaccountOwnerValid(agentName, connectedWalletId) && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Must be a sub-account of {connectedWalletId}</span>
              </span>
              <button
                type="button"
                onClick={() => setAgentName(`agent.${connectedWalletId}`)}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Sparkles className="w-3 h-3" />
                <span>Set to agent.{connectedWalletId}</span>
              </button>
            </div>
          )}
          {isWalletConnected && connectedWalletId && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Connected account prefix:</span>
              <button
                type="button"
                onClick={() => setAgentName(`agent.${connectedWalletId}`)}
                className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Use agent.{connectedWalletId}
              </button>
            </div>
          )}
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
            The NEAR account holding the scoped passkey. Isolated from your master wallet.
          </span>
        </div>

        {/* 2. Daily Spending Cap: Free-form manual input */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <label htmlFor="daily-spending-cap-input" className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Daily Spending Cap (mUSD / day)
                </label>
                {!isDailyCapValid && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Must be &gt; 0 mUSD
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Type any figure manually. Can be 1 mUSD or any custom budget.
              </span>
            </div>
            <span className={`font-mono font-bold text-sm px-2.5 py-1 rounded-lg ${
              isDailyCapValid
                ? "text-slate-900 dark:text-white bg-slate-100 dark:bg-obsidian-800"
                : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/30"
            }`}>
              {isDailyCapValid ? `$${dailyCapInput} mUSD` : "Invalid Cap"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
              <input
                id="daily-spending-cap-input"
                name="daily-spending-cap"
                type="number"
                min="1"
                step="1"
                value={dailyCapInput}
                onChange={(e) => handleDailyCapChange(e.target.value)}
                className={`w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-obsidian-950 border rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none transition ${
                  !isDailyCapValid
                    ? "border-rose-500 ring-2 ring-rose-500/30"
                    : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500"
                }`}
                placeholder="100"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {[25, 100, 250, 500, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPresetChip(preset)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium border transition ${
                    dailyCap === preset
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 dark:bg-obsidian-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-obsidian-800"
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>
          {!isDailyCapValid && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
              <span>Enter a positive spending cap greater than 0 mUSD</span>
            </p>
          )}
        </div>

        {/* 3. Quick-Add Pre-Vetted Platforms */}
        <div id="platform-presets-section" className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <PlatformPresets
            activeContracts={platforms.map((p) => p.contract)}
            onTogglePreset={togglePresetPlatform}
          />
          {!hasValidPlatforms && (
            <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Select at least one platform above (e.g. Ref Finance DEX) to enable your agent.</span>
              </div>
              <button
                type="button"
                onClick={() => PRESET_PLATFORMS[0] && togglePresetPlatform(PRESET_PLATFORMS[0])}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] shrink-0 cursor-pointer shadow-xs"
              >
                Add Testnet DEX
              </button>
            </div>
          )}
        </div>

        {/* Custom Multi-Platform Manager */}
        <div id="custom-platforms-container">
          <CustomPlatformManager
            platforms={platforms}
            onAddCustomPlatform={addCustomPlatform}
            onRemovePlatform={removePlatform}
            onUpdatePlatformMethods={updatePlatformMethods}
          />
        </div>

        {/* DROPDOWN 1: Speed Limits & Auto-Pause Circuit Breaker */}
        <details id="speed-limits-details" className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-obsidian-950/60 p-4 transition">
          <summary className="flex items-center justify-between cursor-pointer list-none select-none text-xs font-semibold text-slate-900 dark:text-white">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-blue" />
              <span>Speed Limits &amp; Auto-Pause Circuit Breakers (Optional)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[10px] font-mono group-open:hidden">{autoPauseAfter} rejects / {autoPauseWindowMinutes}m</span>
              <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
            </div>
          </summary>
          <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Configure how many failed calls freeze the key, and how fast the agent can act.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <label htmlFor="auto-pause-after-input" className="text-[11px] text-slate-500 dark:text-slate-400 block">Auto-Brake Strikes</label>
                <input
                  id="auto-pause-after-input"
                  name="auto-pause-after"
                  type="number"
                  min="1"
                  max="20"
                  value={autoPauseAfter}
                  onChange={(e) => setAutoPauseAfter(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-rose-600 dark:text-rose-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 block">Rejections to freeze</span>
              </div>
              <div className="p-3 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <label htmlFor="auto-pause-window-input" className="text-[11px] text-slate-500 dark:text-slate-400 block">Check Window (Min)</label>
                <input
                  id="auto-pause-window-input"
                  name="auto-pause-window"
                  type="number"
                  min="1"
                  max="120"
                  value={autoPauseWindowMinutes}
                  onChange={(e) => setAutoPauseWindowMinutes(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 block">Rolling minutes</span>
              </div>
              <div className="p-3 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <label htmlFor="speed-limit-input" className="text-[11px] text-slate-500 dark:text-slate-400 block">Speed Throttle</label>
                <input
                  id="speed-limit-input"
                  name="speed-limit"
                  type="number"
                  min="1"
                  max="100"
                  value={speedLimit}
                  onChange={(e) => setSpeedLimit(Number(e.target.value) || 1)}
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 block">Max calls / window</span>
              </div>
            </div>
          </div>
        </details>

        {/* DROPDOWN 2: Direct External Cash Transfers */}
        <details id="cash-transfers-details" className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-obsidian-950/60 p-4 transition">
          <summary className="flex items-center justify-between cursor-pointer list-none select-none text-xs font-semibold text-slate-900 dark:text-white">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              <span>Direct Cash Transfers &amp; Outside Recipients (Optional)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[10px] font-mono group-open:hidden">{allowExternalTransfers ? "Active: " + (externalRecipient || "Not set") : "Off by default"}</span>
              <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
            </div>
          </summary>
          <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white block">
                  Allow Direct Transfers to Outside Wallets?
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Default is OFF. Blocks sending funds to third-party personal accounts.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAllowExternalTransfers(!allowExternalTransfers)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                  allowExternalTransfers ? "bg-emerald-600" : "bg-slate-300 dark:bg-obsidian-800"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    allowExternalTransfers ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {allowExternalTransfers && (
              <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <label htmlFor="external-recipient-input" className="text-slate-700 dark:text-slate-300 font-medium">
                    Designated Allowed Recipients (comma-separated)
                  </label>
                  {!isRecipientValid && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Recipient Required
                    </span>
                  )}
                </div>
                <input
                  id="external-recipient-input"
                  name="external-recipient"
                  type="text"
                  value={externalRecipient}
                  onChange={(e) => setExternalRecipient(e.target.value)}
                  placeholder="e.g. sergeo-guard.testnet, treasury.testnet"
                  className={`w-full px-3 py-2 bg-white dark:bg-obsidian-900 border rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none transition ${
                    !isRecipientValid
                      ? "border-rose-500 ring-2 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500"
                  }`}
                />
                {!isRecipientValid && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>Enter an authorized recipient account (e.g. alice.testnet) or turn off external transfers</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </details>

        {/* DROPDOWN 3: Advanced Security (Canary Tripwires, Drawdowns & Timelocks) */}
        <details id="advanced-security-details" className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-obsidian-950/60 p-4 transition">
          <summary className="flex items-center justify-between cursor-pointer list-none select-none text-xs font-semibold text-slate-900 dark:text-white">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-amber-500" />
              <span>Advanced Security: Canary Tripwires, Drawdowns &amp; Timelocks (Optional)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-[10px] font-mono group-open:hidden">Honeypots &amp; Quarantine</span>
              <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
            </div>
          </summary>
          <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Onchain circuit breakers, cross-chain allowlists, and decoy honeypots.
            </p>

            {/* 1. Net Drawdown Breaker */}
            <div className="p-3.5 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Net Drawdown Breaker
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {maxDrawdownPercent}% Max Loss
                </span>
              </div>
              <input
                id="max-drawdown-range"
                name="max-drawdown"
                type="range"
                min="5"
                max="50"
                step="5"
                value={maxDrawdownPercent}
                onChange={(e) => setMaxDrawdownPercent(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Trips automatic freeze if agent trading losses exceed {maxDrawdownPercent}% from peak vault balance.
              </span>
            </div>

            {/* 2. High-Value Quarantine Timelock */}
            <div className="p-3.5 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    High-Value Quarantine Timelock Threshold
                  </span>
                </div>
                <span className={`font-mono font-bold text-xs ${
                  timelockThreshold > 0 ? "text-blue-600 dark:text-blue-400" : "text-rose-600 dark:text-rose-400"
                }`}>
                  {timelockThreshold > 0 ? `$${timelockThreshold} mUSD` : "Invalid Threshold"}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                <input
                  id="high-value-threshold-input"
                  name="high-value-threshold"
                  type="number"
                  min="1"
                  step="1"
                  value={timelockThreshold}
                  onChange={(e) => setTimelockThreshold(Math.max(1, Number(e.target.value) || 1))}
                  placeholder="250"
                  className={`w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-obsidian-950 border rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-none transition ${
                    timelockThreshold <= 0
                      ? "border-rose-500 ring-2 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500"
                  }`}
                />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Actions at or above this threshold enter a 60-second owner quarantine queue for manual review before execution.
              </span>
            </div>

            {/* 3. Task Lease Expiry Duration */}
            <div className="p-3.5 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="w-3.5 h-3.5 text-purple-500" />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Task Lease Duration
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableLeaseExpiry(!enableLeaseExpiry)}
                  className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    enableLeaseExpiry ? "bg-purple-600" : "bg-slate-300 dark:bg-obsidian-800"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      enableLeaseExpiry ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {enableLeaseExpiry ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      id="task-lease-hours-input"
                      name="task-lease-hours"
                      type="number"
                      min="1"
                      max="168"
                      value={taskLeaseHours}
                      onChange={(e) => setTaskLeaseHours(Math.max(1, Math.min(168, Number(e.target.value) || 1)))}
                      className="w-20 px-2 py-1 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">hours from activation</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    The policy automatically expires after {taskLeaseHours} hour(s), after which actions fail closed with LEASE_EXPIRED.
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Perpetual lease (does not auto-expire until manually revoked).
                </span>
              )}
            </div>

            {/* 4. Cross-Chain Allowlists */}
            <div className="p-3.5 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  Cross-Chain Intent Destinations (Defuse / 1Click)
                </span>
              </div>
              <input
                id="intent-recipients-input"
                name="intent-recipients"
                type="text"
                value={intentRecipientsInput}
                onChange={(e) => setIntentRecipientsInput(e.target.value)}
                placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e, bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Comma-separated destination addresses for IntentTransfer actions. Live contract checks recipient allowlist.
              </span>
            </div>

            {/* 5. Canary Decoy Tripwires */}
            <div className="p-3.5 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  Canary Decoy Tripwires (drain_vault, admin_drain, emergency_withdraw_all)
                </span>
              </div>
              <input
                id="canary-methods-input"
                name="canary-methods"
                type="text"
                value={canaryMethodsInput}
                onChange={(e) => setCanaryMethodsInput(e.target.value)}
                placeholder="drain_vault, admin_drain, emergency_withdraw_all"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Honeypot method names advertised to bait rogue agents or prompt attackers. Calling these trips auto-pause immediately.
              </span>
            </div>
          </div>
        </details>

        {/* Registration Guidance / Error Assist Card */}
        {(parsedDeployError || deployError) && (
          <div
            id="registration-error-assistance"
            className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-700/60 space-y-3 animate-in fade-in shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    {parsedDeployError?.title || "Registration Assistance"}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {parsedDeployError?.message || deployError}
                  </p>
                  {parsedDeployError?.fixGuidance && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium pt-0.5">
                      Fix: {parsedDeployError.fixGuidance}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setParsedDeployError(null);
                  setDeployError(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                Dismiss
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
              {parsedDeployError?.quickFixLabel && parsedDeployError?.suggestedAccount && (
                <button
                  type="button"
                  onClick={() => {
                    setAgentName(parsedDeployError.suggestedAccount!);
                    setParsedDeployError(null);
                    setDeployError(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{parsedDeployError.quickFixLabel}</span>
                </button>
              )}

              {parsedDeployError?.targetElementId && (
                <button
                  type="button"
                  onClick={() => handleJumpToField(parsedDeployError.targetElementId!)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <span>Go to Field</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {parsedDeployError?.rawError && (
              <details className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <summary className="cursor-pointer hover:underline text-[10px] text-slate-400 dark:text-slate-500">
                  Technical details
                </summary>
                <pre className="mt-1.5 p-2 rounded-lg bg-slate-900 text-slate-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
                  {parsedDeployError.rawError}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Friendly Guidance Checklist Explaining Exactly What to Complete Before Previewing */}
        {buttonBlockers.length > 0 && (
          <div
            id="preview-scope-button-blockers"
            className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-300/80 dark:border-amber-700/60 space-y-3 animate-in fade-in shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-xs">
                <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>Almost ready! {buttonBlockers.length} requirement{buttonBlockers.length > 1 ? "s" : ""} to complete before issuing passkey:</span>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 shrink-0">
                {buttonBlockers.length} step{buttonBlockers.length > 1 ? "s" : ""} left
              </span>
            </div>
            <p className="text-xs text-amber-900/80 dark:text-amber-300/90 leading-relaxed">
              Click any link below to jump directly to the field and fix it:
            </p>
            <ul className="space-y-2">
              {buttonBlockers.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white/95 dark:bg-obsidian-900/90 p-3 rounded-xl border border-amber-200/80 dark:border-amber-800/40 shadow-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {b.field}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {b.message}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-700 dark:text-slate-300">How to fix:</span> {b.fix}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    {b.quickFix && (
                      <button
                        type="button"
                        onClick={b.quickFix}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700/60 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{b.quickFixLabel || "Auto-Fix"}</span>
                      </button>
                    )}
                    {b.targetElementId && (
                      <button
                        type="button"
                        onClick={() => handleJumpToField(b.targetElementId!)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-blue dark:text-sky-400 bg-brand-blue/10 dark:bg-sky-950/50 hover:bg-brand-blue/20 dark:hover:bg-sky-900/50 border border-brand-blue/20 dark:border-sky-800/50 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>Fix manually</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Register Action Button & Status */}
        <div className="space-y-1.5">
          <button
            type="button"
            disabled={!isFormValid}
            onClick={() => handleIssueCard()}
            title={
              buttonBlockers.length > 0
                ? `Button disabled: ${buttonBlockers.map((b) => b.message).join(" | ")}`
                : "Preview policy scope and issue agent passkey"
            }
            className={`w-full py-3 px-4 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 ${
              isFormValid
                ? "bg-brand-blue hover:bg-brand-blueHover text-white cursor-pointer shadow-sm"
                : "bg-slate-200 dark:bg-obsidian-800 text-slate-500 dark:text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700"
            }`}
          >
            {isDeploying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Policy Specification...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Preview Scope &amp; Generate Handoff</span>
              </>
            )}
          </button>
          {buttonBlockers.length > 0 && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 pt-1 flex-wrap">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                To enable this button, complete the {buttonBlockers.length} item{buttonBlockers.length > 1 ? "s" : ""} in the checklist above.
              </span>
              {buttonBlockers[0]?.targetElementId && (
                <button
                  type="button"
                  onClick={() => handleJumpToField(buttonBlockers[0].targetElementId!)}
                  className="text-brand-blue hover:underline font-semibold cursor-pointer inline-flex items-center gap-0.5"
                >
                  <span>Fix first item</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Blueprint & Physical Card (Col 5: Clean Single-Layer Card) */}
      <div className="lg:col-span-5 bg-white dark:bg-obsidian-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Digital Key Specification</h2>
          <div className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-obsidian-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveView("visual")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                activeView === "visual"
                  ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Card
            </button>
            <button
              type="button"
              onClick={() => setActiveView("json")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                activeView === "json"
                  ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              JSON
            </button>
          </div>
        </div>

        {activeView === "visual" ? (
          <div className="space-y-4">
            {/* Physical Passkey Widget */}
            <div className="p-6 rounded-xl bg-obsidian-900 text-white space-y-4 border border-obsidian-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold tracking-wider text-slate-200 text-[11px]">
                    SCOPEGUARD PASSKEY
                  </span>
                </div>
                <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                  NEAR TESTNET
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Assigned Agent
                </span>
                <span className={`font-mono text-sm font-semibold block truncate ${
                  !isAgentNameValid ? "text-rose-400" : "text-slate-100"
                }`}>
                  {agentName.trim() || "(Agent name required)"}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Daily Limit</span>
                  <span className={`font-mono font-bold ${
                    isDailyCapValid ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {isDailyCapValid ? `${dailyCapInput} mUSD` : "Invalid Cap"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Platforms</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {Object.keys(compiledTargets).length} Approved
                  </span>
                </div>
              </div>
            </div>

            {/* Policy Invariants */}
            <div className="p-4 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">
                Enforceable Invariants
              </span>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Calls restricted to {Object.keys(compiledTargets).length} allowlisted contract(s)
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Daily spending strictly bounded to {dailyCap} mUSD
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Auto-freeze after {autoPauseAfter} rejects in {autoPauseWindowMinutes}m
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Max {maxDrawdownPercent}% portfolio drawdown breaker
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Task lease: {enableLeaseExpiry ? `${taskLeaseHours}h fixed duration` : "Perpetual lease"}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  {canaryMethodsInput.split(',').filter((s) => s.trim().length > 0).length} armed canary decoy tripwires
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  {intentRecipientsInput.split(',').filter((s) => s.trim().length > 0).length > 0
                    ? `${intentRecipientsInput.split(',').filter((s) => s.trim().length > 0).length} allowlisted cross-chain destination(s)`
                    : "Cross-chain payouts restricted"}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  {allowExternalTransfers && compiledRecipients.length > 0
                    ? `Transfers allowed to ${compiledRecipients.join(", ")} (via ${compiledPolicyJson.token} ft_transfer)`
                    : "Transfers to outside accounts are refused"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
            <pre>{JSON.stringify(compiledPolicyJson, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Hero Passkey Studio Card (Clean Single-Layer Container) */}
      <div className="bg-white dark:bg-obsidian-900 rounded-2xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/80">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              POLICY & PASSKEY STUDIO
            </span>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Issue Agent Passkey
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                FunctionCall Scope
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
              Create a restricted NEAR FunctionCall access key scoped strictly to ScopeGuard. The agent machine never holds a master key, bounding its spend to rules you sign.
            </p>
          </div>

          {/* Clean Metric Widget */}
          <div className="bg-slate-50 dark:bg-obsidian-950/70 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 w-full sm:w-auto sm:min-w-[200px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                PROTOCOL INTEGRITY
              </span>
              <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                Scoped Key
              </span>
              <span className="bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Validated
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Exclusive Guard receiver
            </span>
          </div>
        </div>

        {!guardContractId && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-bold">Policy contract not configured</p>
              <p className="mt-1">
                Set NEXT_PUBLIC_POLICY_CONTRACT_ID in your environment to target an active onchain guard.
              </p>
            </div>
          </div>
        )}

        {/* Clean Neutral 4-Column Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tile A: Target Receiver */}
          <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                EXCLUSIVE TARGET
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono truncate" title={guardContractId || "Policy contract not configured"}>
                {guardContractId ? (guardContractId.length > 12 ? `${guardContractId.slice(0, 8)}...` : guardContractId) : "Policy contract not configured"}
              </span>
              <span className="bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Fixed
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Protocol locked receiver
            </span>
          </div>

          {/* Tile B: Single Entrypoint */}
          <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Code2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                ALLOWED METHOD
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                execute
              </span>
              <span className="bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                Single
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Only callable function
            </span>
          </div>

          {/* Tile C: Daily Cap */}
          <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                DAILY SPEND CAP
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {dailyCap} mUSD
              </span>
              <span className="bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                Custom
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manual 1 mUSD to any budget
            </span>
          </div>

          {/* Tile D: 1-Tap Revoke */}
          <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                REVOCATION
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                1-Tap
              </span>
              <span className="bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Instant
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Protocol level key deletion
            </span>
          </div>
        </div>

          </div>

      {issuedSuccess ? (
        <AgentHandoffCard
          agentName={agentName}
          dailyCap={dailyCap}
          platformsCount={platforms.length}
          autoPauseAfter={autoPauseAfter}
          autoPauseWindowMinutes={autoPauseWindowMinutes}
          telegramChatId={telegramChatId}
          ownerAccount={connectedWalletId || process.env.NEXT_PUBLIC_OWNER_ACCOUNT_ID || "sergeo-guard.testnet"}
          passkey={generatedPasskey}
          publicKey={generatedPublicKey}
          policyJson={compiledPolicyJson}
          onReset={() => setIssuedSuccess(false)}
          txHash={txHash}
          explorerUrl={explorerUrl}
          registrationStatus={registrationStatus}
          registrationCommand={registrationCommand}
        />
      ) : (
        <div className="space-y-6">
          {/* Two Big Prominent Choice Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: AI Prompt Assistant */}
            <button
              type="button"
              onClick={() => setCreationMode("ai")}
              className={`p-5 sm:p-6 rounded-2xl border-2 text-left transition relative cursor-pointer ${
                creationMode === "ai"
                  ? "border-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10 shadow-md ring-1 ring-brand-blue/30"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between pb-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    creationMode === "ai"
                      ? "bg-brand-blue text-white shadow-sm"
                      : "bg-slate-100 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                {creationMode === "ai" ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-blue text-white inline-flex items-center gap-1 shadow-xs">
                    <Check className="w-3 h-3" /> Selected Mode
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">Click to select</span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Describe with AI
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Type what your agent is allowed to do in plain English. The AI configures safety limits, approved platforms, and budgets, and lets you issue your passkey in 1 click. Zero manual sliders needed.
              </p>
            </button>

            {/* Card 2: Manual Builder */}
            <button
              type="button"
              onClick={() => setCreationMode("manual")}
              className={`p-5 sm:p-6 rounded-2xl border-2 text-left transition relative cursor-pointer ${
                creationMode === "manual"
                  ? "border-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10 shadow-md ring-1 ring-brand-blue/30"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between pb-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    creationMode === "manual"
                      ? "bg-brand-blue text-white shadow-sm"
                      : "bg-slate-100 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Sliders className="w-5 h-5" />
                </div>
                {creationMode === "manual" ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-blue text-white inline-flex items-center gap-1 shadow-xs">
                    <Check className="w-3 h-3" /> Selected Mode
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">Click to select</span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Build Step-by-Step
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Configure spending budgets and platform permissions yourself using clean visual buttons and preset chips. Zero typing required. Advanced safety options are tucked away in dropdowns.
              </p>
            </button>
          </div>

          {/* Mode View: AI Assistant vs Manual Builder */}
          {creationMode === "ai" ? (
            <div className="space-y-6">
              <PolicyChatAssistant
                onApplyPolicy={handleApplyDraftPolicy}
                onDirectGenerate={handleDirectGenerateFromDraft}
                currentDailyCap={dailyCap}
                currentAgentName={agentName}
              />

              {/* Optional Collapsible Dropdown for fine-tuning manual settings in AI mode */}
              <details id="ai-manual-settings-details" className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-obsidian-950/40 p-4 transition">
                <summary className="flex items-center justify-between cursor-pointer list-none select-none text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-brand-blue">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-brand-blue" />
                    <span>View or Fine-tune Settings Manually (Optional)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="text-[10px] font-mono group-open:hidden">Collapsed</span>
                    <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                  </div>
                </summary>
                <div className="pt-5 mt-3 border-t border-slate-200/80 dark:border-slate-800">
                  {renderManualBuilder()}
                </div>
              </details>
            </div>
          ) : (
            renderManualBuilder()
          )}
        </div>
    )}
  </div>
);
}
