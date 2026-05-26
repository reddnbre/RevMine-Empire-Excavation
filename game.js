const SAVE_KEY = "revmine_empire_excavation_v1";
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const BOOST_DURATION_MS = 15 * 60 * 1000;

const minerTiers = [
  { name: "Rusty Miner", hashPower: 1, powerUse: 0.02, cost: 0, asset: "assets/miners/rusty-miner.svg" },
  { name: "Steel Miner", hashPower: 3, powerUse: 0.06, cost: 75, asset: "assets/miners/steel-miner.svg" },
  { name: "Bronze Drill", hashPower: 8, powerUse: 0.16, cost: 260, asset: "assets/miners/bronze-drill.svg" },
  { name: "Industrial Excavator", hashPower: 20, powerUse: 0.44, cost: 900, asset: "assets/miners/industrial-excavator.svg" },
  { name: "Diamond Mining Rig", hashPower: 50, powerUse: 1.2, cost: 3200, asset: "assets/miners/diamond-mining-rig.svg" },
  { name: "Plasma Excavator", hashPower: 125, powerUse: 3.1, cost: 12000, asset: "assets/miners/plasma-excavator.svg" },
  { name: "Empire Extractor", hashPower: 310, powerUse: 8, cost: 44000, asset: "assets/miners/empire-extractor.svg" },
  { name: "Legendary Core Miner", hashPower: 800, powerUse: 21, cost: 150000, asset: "assets/miners/legendary-core-miner.svg" }
];

const defaultState = {
  coins: 0,
  premiumCoins: 0,
  minerTier: 0,
  difficulty: 1,
  condition: 100,
  powerLevel: 0,
  coolingLevel: 0,
  boostUntil: 0,
  lastSaved: Date.now()
};

let state = loadGame();
let pendingOffline = 0;
let lastTick = Date.now();
let toastTimer;

const el = {
  coinBalance: document.getElementById("coinBalance"),
  premiumBalance: document.getElementById("premiumBalance"),
  netPerSecond: document.getElementById("netPerSecond"),
  minerName: document.getElementById("minerName"),
  hashPower: document.getElementById("hashPower"),
  difficulty: document.getElementById("difficulty"),
  electricityCost: document.getElementById("electricityCost"),
  conditionText: document.getElementById("conditionText"),
  conditionBar: document.getElementById("conditionBar"),
  boostText: document.getElementById("boostText"),
  boostBar: document.getElementById("boostBar"),
  minerImage: document.getElementById("minerImage"),
  tapValue: document.getElementById("tapValue"),
  mineButton: document.getElementById("mineButton"),
  minerUpgradeButton: document.getElementById("minerUpgradeButton"),
  repairButton: document.getElementById("repairButton"),
  powerUpgradeButton: document.getElementById("powerUpgradeButton"),
  coolingUpgradeButton: document.getElementById("coolingUpgradeButton"),
  minerUpgradeCost: document.getElementById("minerUpgradeCost"),
  repairCost: document.getElementById("repairCost"),
  powerUpgradeCost: document.getElementById("powerUpgradeCost"),
  coolingUpgradeCost: document.getElementById("coolingUpgradeCost"),
  adBoostButton: document.getElementById("adBoostButton"),
  adRepairButton: document.getElementById("adRepairButton"),
  adChestButton: document.getElementById("adChestButton"),
  adPremiumButton: document.getElementById("adPremiumButton"),
  offlinePanel: document.getElementById("offlinePanel"),
  offlineReward: document.getElementById("offlineReward"),
  claimOfflineButton: document.getElementById("claimOfflineButton"),
  resetButton: document.getElementById("resetButton"),
  tierList: document.getElementById("tierList"),
  toast: document.getElementById("toast")
};

function loadGame() {
  const saved = localStorage.getItem(SAVE_KEY);
  if (!saved) return { ...defaultState, lastSaved: Date.now() };

  try {
    return { ...defaultState, ...JSON.parse(saved) };
  } catch {
    return { ...defaultState, lastSaved: Date.now() };
  }
}

function saveGame() {
  state.lastSaved = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function currentMiner() {
  return minerTiers[state.minerTier];
}

function powerDiscount() {
  return Math.min(0.5, state.powerLevel * 0.08);
}

function coolingProtection() {
  return 1 + state.coolingLevel * 0.18;
}

function conditionMultiplier() {
  return Math.max(0.2, state.condition / 100);
}

function boostMultiplier(now = Date.now()) {
  return state.boostUntil > now ? 2 : 1;
}

function electricityCost() {
  return currentMiner().powerUse * (1 - powerDiscount());
}

function netEarningsPerSecond(now = Date.now()) {
  const miner = currentMiner();
  const gross = (miner.hashPower / state.difficulty) * conditionMultiplier() * boostMultiplier(now);
  return Math.max(0, gross - electricityCost());
}

function manualTapValue() {
  return Math.max(0.05, netEarningsPerSecond() * 0.18 + currentMiner().hashPower * 0.035);
}

function repairCost() {
  const missingCondition = 100 - state.condition;
  return Math.ceil((20 + currentMiner().hashPower * 2.5) * (missingCondition / 100));
}

function powerUpgradeCost() {
  return Math.ceil(120 * Math.pow(2.15, state.powerLevel));
}

function coolingUpgradeCost() {
  return Math.ceil(100 * Math.pow(2, state.coolingLevel));
}

function nextMinerCost() {
  return minerTiers[state.minerTier + 1]?.cost ?? null;
}

function formatNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(value >= 10 ? 1 : 2);
}

function showToast(message) {
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.add("show");
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}

function addCoins(amount) {
  state.coins += Math.max(0, amount);
}

function spendCoins(cost) {
  if (state.coins < cost) {
    showToast("Not enough RevCoins yet.");
    return false;
  }

  state.coins -= cost;
  return true;
}

function buildTierList() {
  el.tierList.innerHTML = minerTiers.map((tier, index) => `
    <article class="tier-card ${index === state.minerTier ? "active" : ""}">
      <img src="${tier.asset}" alt="" />
      <div>
        <strong>${tier.name}</strong>
        <span>${tier.hashPower} hash power</span>
      </div>
      <em>${index === 0 ? "Start" : formatNumber(tier.cost)}</em>
    </article>
  `).join("");
}

function updateUI() {
  const miner = currentMiner();
  const net = netEarningsPerSecond();
  const nextCost = nextMinerCost();
  const boostRemaining = Math.max(0, state.boostUntil - Date.now());
  const repair = repairCost();
  const powerCost = powerUpgradeCost();
  const coolingCost = coolingUpgradeCost();

  el.coinBalance.textContent = formatNumber(state.coins);
  el.premiumBalance.textContent = Math.floor(state.premiumCoins).toString();
  el.netPerSecond.textContent = `${formatNumber(net)}/s`;
  el.minerName.textContent = miner.name;
  el.hashPower.textContent = miner.hashPower.toFixed(1);
  el.difficulty.textContent = state.difficulty.toFixed(2);
  el.electricityCost.textContent = `${formatNumber(electricityCost())}/sec`;
  el.conditionText.textContent = `${Math.floor(state.condition)}%`;
  el.conditionBar.style.width = `${state.condition}%`;
  el.minerImage.src = miner.asset;
  el.minerImage.alt = miner.name;
  el.tapValue.textContent = `+${formatNumber(manualTapValue())}`;

  el.boostText.textContent = boostRemaining > 0 ? `${Math.ceil(boostRemaining / 1000)}s` : "Inactive";
  el.boostBar.style.width = boostRemaining > 0 ? `${Math.max(3, (boostRemaining / BOOST_DURATION_MS) * 100)}%` : "0%";

  el.minerUpgradeCost.textContent = nextCost ? formatNumber(nextCost) : "Max";
  el.repairCost.textContent = repair > 0 ? formatNumber(repair) : "Full";
  el.powerUpgradeCost.textContent = formatNumber(powerCost);
  el.coolingUpgradeCost.textContent = formatNumber(coolingCost);

  el.minerUpgradeButton.disabled = !nextCost || state.coins < nextCost;
  el.repairButton.disabled = repair <= 0 || state.coins < repair;
  el.powerUpgradeButton.disabled = state.coins < powerCost;
  el.coolingUpgradeButton.disabled = state.coins < coolingCost;

  buildTierList();
}

function tick() {
  const now = Date.now();
  const seconds = Math.min(5, (now - lastTick) / 1000);
  lastTick = now;

  addCoins(netEarningsPerSecond(now) * seconds);
  state.difficulty += seconds * 0.0007;
  state.condition = Math.max(0, state.condition - (seconds * 0.018) / coolingProtection());

  updateUI();
}

function calculateOfflineEarnings() {
  const elapsed = Math.min(EIGHT_HOURS_MS, Math.max(0, Date.now() - state.lastSaved));
  if (elapsed < 60_000) return;

  pendingOffline = netEarningsPerSecond(state.lastSaved) * (elapsed / 1000) * 0.55;
  state.difficulty += (elapsed / 1000) * 0.00045;
  state.condition = Math.max(0, state.condition - ((elapsed / 1000) * 0.008) / coolingProtection());

  if (pendingOffline > 0) {
    el.offlineReward.textContent = `${formatNumber(pendingOffline)} RevCoins`;
    el.offlinePanel.classList.remove("hidden");
  }
}

function watchAdForBoost() {
  state.boostUntil = Date.now() + BOOST_DURATION_MS;
  showToast("Ad placeholder complete: 2x mining power active.");
}

function watchAdForFreeRepair() {
  state.condition = 100;
  showToast("Ad placeholder complete: miner repaired.");
}

function watchAdForTreasureChest() {
  const reward = 35 + currentMiner().hashPower * (4 + Math.random() * 8);
  addCoins(reward);
  showToast(`Chest opened: +${formatNumber(reward)} RevCoins.`);
}

function watchAdForPremiumRevCoins() {
  state.premiumCoins += 3;
  showToast("Ad placeholder complete: +3 Premium RevCoins.");
}

el.mineButton.addEventListener("click", () => {
  addCoins(manualTapValue());
  el.minerImage.classList.remove("pop");
  void el.minerImage.offsetWidth;
  el.minerImage.classList.add("pop");
  updateUI();
});

el.minerUpgradeButton.addEventListener("click", () => {
  const cost = nextMinerCost();
  if (!cost || !spendCoins(cost)) return;

  state.minerTier += 1;
  state.condition = Math.min(100, state.condition + 18);
  showToast(`${currentMiner().name} deployed.`);
  updateUI();
});

el.repairButton.addEventListener("click", () => {
  const cost = repairCost();
  if (cost <= 0 || !spendCoins(cost)) return;

  state.condition = 100;
  showToast("Miner condition restored.");
  updateUI();
});

el.powerUpgradeButton.addEventListener("click", () => {
  const cost = powerUpgradeCost();
  if (!spendCoins(cost)) return;

  state.powerLevel += 1;
  showToast("Electricity penalty reduced.");
  updateUI();
});

el.coolingUpgradeButton.addEventListener("click", () => {
  const cost = coolingUpgradeCost();
  if (!spendCoins(cost)) return;

  state.coolingLevel += 1;
  showToast("Wear rate reduced.");
  updateUI();
});

el.adBoostButton.addEventListener("click", watchAdForBoost);
el.adRepairButton.addEventListener("click", watchAdForFreeRepair);
el.adChestButton.addEventListener("click", watchAdForTreasureChest);
el.adPremiumButton.addEventListener("click", watchAdForPremiumRevCoins);

el.claimOfflineButton.addEventListener("click", () => {
  addCoins(pendingOffline);
  pendingOffline = 0;
  el.offlinePanel.classList.add("hidden");
  showToast("Offline RevCoins claimed.");
  updateUI();
});

el.resetButton.addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);
  state = { ...defaultState, lastSaved: Date.now() };
  pendingOffline = 0;
  el.offlinePanel.classList.add("hidden");
  showToast("Save reset.");
  updateUI();
});

window.addEventListener("beforeunload", saveGame);
setInterval(saveGame, 8000);
setInterval(tick, 1000);

calculateOfflineEarnings();
updateUI();
