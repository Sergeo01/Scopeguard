import test from "node:test";
import assert from "node:assert";
import { checkIsAdmin, ScopeGuardUser } from "../lib/admin";

test("auth: checkIsAdmin accurately identifies administrator identities", () => {
  // Admin emails
  assert.strictEqual(checkIsAdmin("sergeo@scopeguard.io", null), true);
  assert.strictEqual(checkIsAdmin("admin@scopeguard.cloud", null), true);
  assert.strictEqual(checkIsAdmin("sergeo.developer@gmail.com", null), true);

  // Admin NEAR account
  assert.strictEqual(checkIsAdmin(null, "sergeo-guard.testnet"), true);
  assert.strictEqual(checkIsAdmin(null, "admin.sergeo-guard.testnet"), true);

  // Explicit admin flag
  assert.strictEqual(checkIsAdmin("custom@domain.com", "custom.testnet", true), true);

  // Non-admin identities must return false
  assert.strictEqual(checkIsAdmin("alice@example.com", "alice.testnet"), false);
  assert.strictEqual(checkIsAdmin("bob@trading.org", "bob-dex.testnet"), false);
  assert.strictEqual(checkIsAdmin("attack_sergeo@evil.com", null), false);
  assert.strictEqual(checkIsAdmin("fakeadmin@hacker.io", null), false);
  assert.strictEqual(checkIsAdmin(null, "agent123.testnet"), false);
  assert.strictEqual(checkIsAdmin("", ""), false);
  assert.strictEqual(checkIsAdmin(null, null), false);
});

test("auth: social login keeps standard clients unprivileged with isolated wallets", () => {
  // Standard user social sign in simulation
  const clientEmail = "alice@example.com";
  const clientName = clientEmail.split("@")[0];
  const isClientAdmin = checkIsAdmin(clientEmail, null, false);
  const clientDefaultWallet = isClientAdmin ? "sergeo-guard.testnet" : `${clientName}.testnet`;

  const clientUser: ScopeGuardUser = {
    id: `usr_google_${clientName}`,
    email: clientEmail,
    displayName: clientName.charAt(0).toUpperCase() + clientName.slice(1),
    provider: "google",
    isAdmin: isClientAdmin,
    connectedWallets: isClientAdmin ? ["sergeo-guard.testnet", "agent.sergeo-guard.testnet"] : [clientDefaultWallet],
    activeAccountId: clientDefaultWallet,
  };

  assert.strictEqual(clientUser.isAdmin, false);
  assert.strictEqual(clientUser.activeAccountId, "alice.testnet");
  assert.strictEqual(clientUser.connectedWallets.includes("sergeo-guard.testnet"), false);

  // Admin user social sign in simulation
  const adminEmail = "sergeo@scopeguard.io";
  const adminName = adminEmail.split("@")[0];
  const isAdminUser = checkIsAdmin(adminEmail, null, false);
  const adminDefaultWallet = isAdminUser ? "sergeo-guard.testnet" : `${adminName}.testnet`;

  const adminUser: ScopeGuardUser = {
    id: `usr_google_${adminName}`,
    email: adminEmail,
    displayName: adminName.charAt(0).toUpperCase() + adminName.slice(1),
    provider: "google",
    isAdmin: isAdminUser,
    connectedWallets: isAdminUser ? ["sergeo-guard.testnet", "agent.sergeo-guard.testnet"] : [adminDefaultWallet],
    activeAccountId: adminDefaultWallet,
  };

  assert.strictEqual(adminUser.isAdmin, true);
  assert.strictEqual(adminUser.activeAccountId, "sergeo-guard.testnet");
  assert.strictEqual(adminUser.connectedWallets.length, 2);
});

test("auth: ScopeGuard user profile handles multiple linked sub-accounts and active switching", () => {
  const initialUser: ScopeGuardUser = {
    id: "usr_sergeo_1",
    email: "sergeo@scopeguard.io",
    displayName: "Sergeo",
    provider: "google",
    isAdmin: true,
    connectedWallets: ["sergeo-guard.testnet", "agent.sergeo-guard.testnet"],
    activeAccountId: "sergeo-guard.testnet",
  };

  // Verify initial active wallet
  assert.strictEqual(initialUser.activeAccountId, "sergeo-guard.testnet");
  assert.strictEqual(initialUser.connectedWallets.length, 2);
  assert.strictEqual(initialUser.isAdmin, true);

  // Link a third sub-account
  const updatedWallets = [...initialUser.connectedWallets, "bot.sergeo-guard.testnet"];
  const userWithThirdWallet: ScopeGuardUser = {
    ...initialUser,
    connectedWallets: updatedWallets,
    activeAccountId: "bot.sergeo-guard.testnet",
  };

  assert.strictEqual(userWithThirdWallet.connectedWallets.length, 3);
  assert.strictEqual(userWithThirdWallet.activeAccountId, "bot.sergeo-guard.testnet");

  // Switch back to agent sub-account
  const switchedUser: ScopeGuardUser = {
    ...userWithThirdWallet,
    activeAccountId: "agent.sergeo-guard.testnet",
  };
  assert.strictEqual(switchedUser.activeAccountId, "agent.sergeo-guard.testnet");

  // Unlink a wallet
  const unlinkedWallets = switchedUser.connectedWallets.filter(w => w !== "bot.sergeo-guard.testnet");
  const finalUser: ScopeGuardUser = {
    ...switchedUser,
    connectedWallets: unlinkedWallets,
  };
  assert.strictEqual(finalUser.connectedWallets.length, 2);
  assert.strictEqual(finalUser.connectedWallets.includes("bot.sergeo-guard.testnet"), false);
});
