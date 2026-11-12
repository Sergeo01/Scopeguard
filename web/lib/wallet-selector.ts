"use client";

import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui";
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

  // Automatically purge retired wallet cache from previous sessions so users never get sent to defunct login URLs
  try {
    const keysToPurge = [
      "near-wallet-selector:selectedWalletId",
      "near-wallet-selector:recentlySignedInWallets",
      "near_app_wallet_auth_key",
      "_wallet_auth_key",
      "null_wallet_auth_key",
    ];
    for (const key of keysToPurge) {
      const val = localStorage.getItem(key);
      if (val && (val.includes("my-near-wallet") || val.includes("mynearwallet"))) {
        localStorage.removeItem(key);
      }
    }
  } catch {}

  if (selectorInstance) {
    return selectorInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const selector = await setupWalletSelector({
        network: "testnet",
        modules: [
          setupMeteorWallet(),
          setupHereWallet(),
          setupSender(),
        ],
      });

      const modal = setupModal(selector, {
        contractId: tryGetPolicyContractId() || "scopeguard.testnet",
        theme: "dark",
      });

      selectorInstance = { selector, modal };
      return selectorInstance;
    })();
  }

  return initPromise;
}
