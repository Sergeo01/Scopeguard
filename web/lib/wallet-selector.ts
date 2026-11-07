"use client";

import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import "@near-wallet-selector/modal-ui/styles.css";
import { tryGetPolicyContractId } from "@/lib/config";

let selectorInstance: { selector: WalletSelector; modal: WalletSelectorModal } | null = null;
let initPromise: Promise<{ selector: WalletSelector; modal: WalletSelectorModal }> | null = null;

export async function getNearWalletSelector(): Promise<{ selector: WalletSelector; modal: WalletSelectorModal } | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (selectorInstance) {
    return selectorInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const selector = await setupWalletSelector({
        network: "testnet",
        modules: [
          setupMyNearWallet(),
          setupMeteorWallet(),
          setupHereWallet(),
          setupSender(),
        ],
      });

      const modal = setupModal(selector, {
        contractId: tryGetPolicyContractId() || "policy-contract-not-configured.testnet",
        theme: "dark",
      });

      selectorInstance = { selector, modal };
      return selectorInstance;
    })();
  }

  return initPromise;
}
