const abi = [
    "function saveGame(uint256 _money, uint256 _toolLevel, uint256 _truckCount) public",
    "function loadGame(address _player) public view returns (uint256, uint256, uint256)"
];

const mines = [
    { id: "stone", name: "Stone Mine", resource: "Stone", icon: "🪨", toolLevel: 0, speed: 3000, sellPrice: 1, quota: 20, position: [20, 20] },
    { id: "copper", name: "Copper Mine", resource: "Copper", icon: "🟠", toolLevel: 1, speed: 2500, sellPrice: 3, quota: 15, position: [20, 80] },
    { id: "iron", name: "Iron Mine", resource: "Iron", icon: "⚙️", toolLevel: 2, speed: 2000, sellPrice: 8, quota: 12, position: [50, 84] },
    { id: "gold", name: "Gold Mine", resource: "Gold", icon: "🪙", toolLevel: 3, speed: 1500, sellPrice: 20, quota: 10, position: [70, 82] },
    { id: "diamond", name: "Diamond Mine", resource: "Diamond", icon: "💎", toolLevel: 4, speed: 1000, sellPrice: 50, quota: 8, position: [78, 18] }
];
const tools = [
    { name: "Wooden Pickaxe", cost: 0 },
    { name: "Stone Pickaxe", cost: 20 },
    { name: "Iron Pickaxe", cost: 100 },
    { name: "Gold Pickaxe", cost: 500 },
    { name: "Diamond Pickaxe", cost: 2500 }
];

const truckCapacity = 10;
const mineCapacity = 100;
const maxTruckCount = 3;
const truckPrices = [0, 100, 200];
const facilityCost = 25;
const localSaveKey = "malmining-valley-save-v1";

function createTruck(mineId = "stone") {
    const mine = mines.find(item => item.id === mineId) || mines[0];
    return {
        state: "idle",
        mineId: mine.id,
        amount: 0,
        warehouseAmount: 0,
        deadline: 0,
        path: [],
        pathIndex: 0,
        position: mine.position.slice(),
        roadToWarehouse: [],
        roadToMarket: []
    };
}

function createMineFacilities() {
    return Object.fromEntries(mines.map(mine => [mine.id, { well: false, kitchen: false }]));
}

let provider;
let signer;
let contract;
let money = 0;
let currentLevel = 0;
let truckCount = 1;
let trucks = [createTruck()];
let mineFacilities = createMineFacilities();
let nextTruckMineIndex = 0;
let hasLocalSave = false;
let activeMineId = "stone";
let miningCommandActive = false;
let roadBuilding = false;
let roadTiles = new Set();
let mineStock = Object.fromEntries(mines.map(mine => [mine.id, 0]));
let warehouseStock = Object.fromEntries(mines.map(mine => [mine.id, 0]));
let marketStock = Object.fromEntries(mines.map(mine => [mine.id, 0]));
let soldByMine = Object.fromEntries(mines.map(mine => [mine.id, 0]));
let paused = false;
let transactionPending = false;
let mineTimers = new Map();
let progressTimer;
let truckTimer;
let mineCycleStartedAt = new Map();
const workerElements = new Map();
const elements = {
    money: document.getElementById("money"),
    tool: document.getElementById("current-tool"),
    toolName: document.getElementById("tool-name"),
    toolLevel: document.getElementById("tool-level"),
    toolLevelDisplay: document.getElementById("tool-level-display"),
    toolSpeed: document.getElementById("tool-speed"),
    levelName: document.getElementById("level-name"),
    levelDetail: document.getElementById("level-detail"),
    productionState: document.getElementById("production-state"),
    winBanner: document.getElementById("win-banner"),
    gameFooter: document.getElementById("game-footer"),
    inventoryNote: document.getElementById("inventory-note"),
    storageCapacity: document.getElementById("storage-capacity"),
    storageFill: document.getElementById("storage-fill"),
    depotCount: document.getElementById("depot-count"),
    marketDepotCount: document.getElementById("market-depot-count"),
    warehouseStock: document.getElementById("warehouse-stock"),
    truckStatus: document.getElementById("truck-status"),
    truckFleet: document.getElementById("truck-fleet"),
    truckCount: document.getElementById("truck-count"),
    buyTruckTwo: document.getElementById("buy-truck-two"),
    buyTruckThree: document.getElementById("buy-truck-three"),
    resourceName: document.getElementById("resource-name"),
    activeMineName: document.getElementById("active-mine-name"),
    activeMineIcon: document.getElementById("active-mine-icon"),
    mineRequirement: document.getElementById("mine-requirement"),
    mineGoal: document.getElementById("mine-goal"),
    mineRate: document.getElementById("mine-rate"),
    currentResource: document.getElementById("current-resource"),
    oreValue: document.getElementById("ore-value"),
    marketStockTotal: document.getElementById("market-stock"),
    marketMessage: document.getElementById("market-message"),
    inventoryList: document.getElementById("inventory-list"),
    mineSelection: document.getElementById("mine-selection"),
    mineAction: document.getElementById("mine-action"),
    mineActionTitle: document.getElementById("mine-action-title"),
    mineActionIcon: document.getElementById("mine-action-icon"),
    buyTool: document.getElementById("buy-tool-btn"),
    upgradeAction: document.getElementById("upgrade-action"),
    upgradeTitle: document.getElementById("upgrade-title"),
    upgradeCost: document.getElementById("upgrade-cost"),
    walletButton: document.getElementById("connect-btn"),
    walletHint: document.getElementById("wallet-hint"),
    pauseButton: document.getElementById("pause-btn"),
    sellButton: document.getElementById("sell-btn"),
    worldPlane: document.querySelector(".world-plane"),
    routeStatus: document.getElementById("route-status"),
    buildRoadButton: document.getElementById("build-road-btn"),
    buildRoadAction: document.getElementById("build-road-action"),
    facilityStatus: document.getElementById("facility-status"),
    facilityNote: document.getElementById("facility-note"),
    wellStatus: document.getElementById("well-status"),
    kitchenStatus: document.getElementById("kitchen-status"),
    buildWell: document.getElementById("build-well"),
    buildKitchen: document.getElementById("build-kitchen")
};

const grid = document.getElementById("grid-container");
for (let index = 0; index < 100; index++) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "grid-tile";
    tile.disabled = true;
    tile.dataset.row = String(Math.floor(index / 10));
    tile.dataset.column = String(index % 10);
    tile.setAttribute("aria-label", `Map tile ${Math.floor(index / 10) + 1}, ${index % 10 + 1}`);
    tile.addEventListener("click", () => toggleRoadTile(Number(tile.dataset.row), Number(tile.dataset.column)));
    grid.appendChild(tile);
}

const buildingCells = {
    warehouse: [5, 5],
    market: [6, 7]
};
const buildingPositions = {
    warehouse: [50, 50],
    market: [64, 70]
};

function mineCell(mine) {
    return [Math.floor(mine.position[0] / 10), Math.floor(mine.position[1] / 10)];
}

function roadKey(row, column) {
    return `${row},${column}`;
}

function adjacentRoadKeys([row, column]) {
    return [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
        .filter(([nextRow, nextColumn]) => nextRow >= 0 && nextRow < 10 && nextColumn >= 0 && nextColumn < 10)
        .map(([nextRow, nextColumn]) => roadKey(nextRow, nextColumn))
        .filter(key => roadTiles.has(key));
}

function findRoadTilePath(startCell, endCell) {
    const destinations = new Set(adjacentRoadKeys(endCell));
    if (!destinations.size) return null;

    const queue = adjacentRoadKeys(startCell);
    const previous = new Map(queue.map(key => [key, null]));
    let destination;
    while (queue.length) {
        const key = queue.shift();
        if (destinations.has(key)) {
            destination = key;
            break;
        }
        const [row, column] = key.split(",").map(Number);
        for (const neighbor of adjacentRoadKeys([row, column])) {
            if (!previous.has(neighbor)) {
                previous.set(neighbor, key);
                queue.push(neighbor);
            }
        }
    }
    if (!destination) return null;

    const path = [];
    for (let key = destination; key !== null; key = previous.get(key)) {
        const [row, column] = key.split(",").map(Number);
        path.push([row, column]);
    }
    return path.reverse();
}

function roadConnectsBuildings(startCell, endCell) {
    return findRoadTilePath(startCell, endCell) !== null;
}

function hasDeliveryRoute(mine) {
    return roadConnectsBuildings(mineCell(mine), buildingCells.warehouse)
        && roadConnectsBuildings(buildingCells.warehouse, buildingCells.market);
}

function roadTilePosition([row, column]) {
    return [row * 10 + 5, column * 10 + 5];
}

function isValidPosition(position) {
    return Array.isArray(position)
        && position.length === 2
        && position.every(value => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100);
}

function isValidRoadCell(cell) {
    return Array.isArray(cell)
        && cell.length === 2
        && cell.every(value => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < 10);
}

function renderRoadTiles() {
    grid.classList.toggle("building-roads", roadBuilding);
    for (const tile of grid.children) {
        const row = Number(tile.dataset.row);
        const column = Number(tile.dataset.column);
        const isRoad = roadTiles.has(roadKey(row, column));
        tile.classList.toggle("road-tile", isRoad);
        tile.disabled = !roadBuilding;
        tile.setAttribute("aria-label", roadBuilding
            ? `${isRoad ? "Remove" : "Build"} road on row ${row + 1}, column ${column + 1}`
            : `Map tile ${row + 1}, ${column + 1}${isRoad ? ", road" : ""}`);
        tile.setAttribute("aria-pressed", String(isRoad));
    }
    elements.buildRoadButton.setAttribute("aria-pressed", String(roadBuilding));
    elements.buildRoadButton.classList.toggle("active", roadBuilding);
    elements.buildRoadAction.classList.toggle("road-mode-active", roadBuilding);
    elements.mineSelection.classList.toggle("build-mode", roadBuilding);
    if (roadBuilding) {
        elements.mineSelection.textContent = `Road mode · click tiles to build or remove · ${hasDeliveryRoute(getActiveMine()) ? "route connected" : "connect mine, warehouse and market"}`;
    }
}

function setRoadBuilding(value) {
    roadBuilding = value;
    render();
    setMessage(roadBuilding
        ? "Road-building mode is on. Click empty tiles to build or remove free road tiles."
        : "Road-building mode is off. Select a mine or issue a mining command.");
}

function toggleRoadTile(row, column) {
    if (!roadBuilding) return;
    const key = roadKey(row, column);
    const truckUsesRoad = trucks.some(truck => {
        const truckRoute = [...truck.roadToWarehouse, ...truck.roadToMarket];
        return truck.state !== "idle"
            && truckRoute.some(([roadRow, roadColumn]) => roadKey(roadRow, roadColumn) === key);
    });
    if (truckUsesRoad && roadTiles.has(key)) {
        setMessage("The truck is using this road. Wait until it returns before removing it.", true);
        return;
    }
    if (roadTiles.has(key)) roadTiles.delete(key);
    else roadTiles.add(key);
    saveLocalState();
    render();
    startMining();
    const mine = getActiveMine();
    if (hasDeliveryRoute(mine)) {
        setMessage(`Road route complete for ${mine.name}. The truck can deliver its next load.`);
    } else {
        setMessage(`Road built. Connect ${mine.name} to the warehouse, then connect the warehouse to the market.`);
    }
}

function getMine(id) {
    return mines.find(mine => mine.id === id);
}

function getActiveMine() {
    return getMine(activeMineId);
}

function getTotal(values) {
    return Object.values(values).reduce((total, amount) => total + amount, 0);
}

function isMineUnlocked(mine) {
    return currentLevel >= mine.toolLevel;
}

function hasMineFacilities(mine) {
    return mineFacilities[mine.id]?.well && mineFacilities[mine.id]?.kitchen;
}

function facilityPrice(mine) {
    return mine.id === mines[0].id ? 0 : facilityCost;
}

function isGameComplete() {
    return mines.every(mine => soldByMine[mine.id] >= mine.quota);
}

function setMessage(message, isError) {
    elements.marketMessage.textContent = message;
    elements.marketMessage.classList.toggle("error-message", Boolean(isError));
}

function saveLocalState() {
    try {
        window.localStorage.setItem(localSaveKey, JSON.stringify({
            money,
            currentLevel,
            truckCount,
            trucks,
            mineFacilities,
            activeMineId,
            miningCommandActive,
            roads: Array.from(roadTiles),
            mineStock,
            warehouseStock,
            marketStock,
            soldByMine
        }));
        hasLocalSave = true;
    } catch (error) {
        console.error("Could not save local game progress:", error);
        setMessage(`Local save failed: ${error.message || "browser storage is unavailable"}`, true);
    }
}

function loadLocalState() {
    try {
        const raw = window.localStorage.getItem(localSaveKey);
        if (!raw) return;

        const saved = JSON.parse(raw);
        hasLocalSave = true;
        money = Number.isFinite(Number(saved.money)) ? Math.max(0, Number(saved.money)) : 0;
        currentLevel = Math.min(tools.length - 1, Math.max(0, Number(saved.currentLevel) || 0));
        truckCount = Math.min(maxTruckCount, Math.max(1, Number(saved.truckCount) || 1));
        activeMineId = getMine(saved.activeMineId) ? saved.activeMineId : "stone";
        miningCommandActive = Boolean(saved.miningCommandActive);
        roadTiles = new Set((Array.isArray(saved.roads) ? saved.roads : [])
            .filter(key => /^\d,[0-9]$/.test(key)));
        for (const mine of mines) {
            const savedFacilities = saved.mineFacilities?.[mine.id];
            if (savedFacilities) {
                mineFacilities[mine.id] = {
                    well: Boolean(savedFacilities.well),
                    kitchen: Boolean(savedFacilities.kitchen)
                };
            }
        }

        for (const mine of mines) {
            mineStock[mine.id] = Math.max(0, Number(saved.mineStock?.[mine.id]) || 0);
            warehouseStock[mine.id] = Math.max(0, Number(saved.warehouseStock?.[mine.id]) || 0);
            marketStock[mine.id] = Math.max(0, Number(saved.marketStock?.[mine.id]) || 0);
            soldByMine[mine.id] = Math.max(0, Number(saved.soldByMine?.[mine.id]) || 0);
        }

        const savedTrucks = Array.isArray(saved.trucks) ? saved.trucks : saved.truck ? [saved.truck] : [];
        trucks = savedTrucks.slice(0, truckCount).map(savedTruck => {
            if (!savedTruck || !["idle", "to-warehouse", "to-market", "returning"].includes(savedTruck.state)) {
                return createTruck(activeMineId);
            }
            const path = Array.isArray(savedTruck.path) ? savedTruck.path.filter(isValidPosition).map(point => point.map(Number)) : [];
            const roadToWarehouse = Array.isArray(savedTruck.roadToWarehouse)
                ? savedTruck.roadToWarehouse.filter(isValidRoadCell).map(cell => cell.map(Number))
                : [];
            const roadToMarket = Array.isArray(savedTruck.roadToMarket)
                ? savedTruck.roadToMarket.filter(isValidRoadCell).map(cell => cell.map(Number))
                : [];
            const savedMineId = getMine(savedTruck.mineId) ? savedTruck.mineId : activeMineId;
            const savedWarehouseAmount = savedTruck.warehouseAmount === undefined && savedTruck.state === "to-market"
                ? warehouseStock[savedMineId]
                : Math.max(0, Number(savedTruck.warehouseAmount) || 0);
            return {
                state: savedTruck.state,
                mineId: savedMineId,
                amount: Math.max(0, Number(savedTruck.amount) || 0),
                warehouseAmount: savedWarehouseAmount,
                deadline: Date.now(),
                path,
                pathIndex: Math.min(path.length, Math.max(0, Number(savedTruck.pathIndex) || 0)),
                position: isValidPosition(savedTruck.position)
                    ? savedTruck.position.map(Number)
                    : getMine(activeMineId).position.slice(),
                roadToWarehouse,
                roadToMarket
            };
        });
        while (trucks.length < truckCount) trucks.push(createTruck(activeMineId));
    } catch (error) {
        console.error("Could not load local game progress:", error);
        setMessage(`Local save could not be loaded: ${error.message || "invalid save data"}`, true);
    }
}

function renderInventory() {
    for (const mine of mines) {
        const row = elements.inventoryList.querySelector(`#inv-${mine.id}`);
        if (row) row.textContent = marketStock[mine.id];
    }

    const total = getTotal(marketStock);
    const warehouseTotal = getTotal(warehouseStock);
    const truckCargoTotal = trucks.reduce((total, item) => total + item.amount, 0);
    elements.marketStockTotal.textContent = `${total} ${total === 1 ? "unit" : "units"}`;
    elements.marketDepotCount.textContent = total;
    elements.depotCount.textContent = warehouseTotal + truckCargoTotal;
    elements.warehouseStock.textContent = `${warehouseTotal} ${warehouseTotal === 1 ? "unit" : "units"}`;
    elements.sellButton.disabled = total === 0 || transactionPending;
}

function renderMineSites() {
    for (const button of document.querySelectorAll(".mine-site")) {
        const mine = getMine(button.dataset.mine);
        const locked = !isMineUnlocked(mine);
        const complete = soldByMine[mine.id] >= mine.quota;
        const facilities = mineFacilities[mine.id];
        button.classList.toggle("selected", mine.id === activeMineId);
        button.classList.toggle("locked", locked);
        button.classList.toggle("complete", complete);
        button.classList.toggle("has-well", facilities.well);
        button.classList.toggle("has-kitchen", facilities.kitchen);
        button.setAttribute("aria-pressed", String(mine.id === activeMineId));
        button.querySelector(".entity-progress").textContent = complete
            ? "Complete"
            : locked
                ? `Needs ${tools[mine.toolLevel].name.replace(" Pickaxe", "")}`
                : `${soldByMine[mine.id]} / ${mine.quota} sold`;
    }
}

function parkedTruckPosition(index, mine = getActiveMine()) {
    return [
        Math.min(94, mine.position[0] + 6 + Math.floor(index / 2) * 4),
        Math.min(94, mine.position[1] + 10 + (index % 2) * 6)
    ];
}

function renderTrucks() {
    while (elements.truckFleet.children.length < truckCount) {
        const truckElement = document.createElement("div");
        truckElement.className = "map-entity truck-entity";
        truckElement.innerHTML = '<span class="truck-model" aria-hidden="true"><span class="truck-cabin"></span><span class="truck-bed"></span><span class="truck-wheels"></span></span><span class="truck-cargo"></span>';
        elements.truckFleet.appendChild(truckElement);
    }

    while (elements.truckFleet.children.length > truckCount) {
        elements.truckFleet.lastElementChild.remove();
    }

    trucks.forEach((truck, index) => {
        const truckElement = elements.truckFleet.children[index];
        const position = truck.state === "idle" ? parkedTruckPosition(index) : truck.position;
        const cargo = truckElement.querySelector(".truck-cargo");
        truckElement.style.top = `${position[0]}%`;
        truckElement.style.left = `${position[1]}%`;
        truckElement.setAttribute("aria-label", `Truck ${index + 1}${truck.amount ? ` carrying ${truck.amount} units` : ""}`);
        cargo.textContent = truck.amount ? `${truck.amount}` : `#${index + 1}`;
    });
}

function renderWorkers() {
    for (const mine of mines) {
        let workers = workerElements.get(mine.id);
        if (!workers) {
            workers = [0, 1].map(() => {
                const worker = document.createElement("div");
                worker.className = "worker";
                worker.setAttribute("aria-hidden", "true");
                elements.worldPlane.appendChild(worker);
                return worker;
            });
            workerElements.set(mine.id, workers);
        }

        const working = miningCommandActive && !paused && isMineUnlocked(mine)
            && hasMineFacilities(mine) && hasDeliveryRoute(mine);
        workers.forEach((worker, index) => {
            worker.textContent = index === 0 ? "👷" : "🧑‍🔧";
            worker.style.top = `${mine.position[0] + 5 + index * 9}%`;
            worker.style.left = `${mine.position[1] + (index === 0 ? -8 : 12)}%`;
            worker.classList.toggle("on-shift", working);
        });
    }
}

function render() {
    const mine = getActiveMine();
    const unlocked = isMineUnlocked(mine);
    const facilitiesReady = hasMineFacilities(mine);
    const routeReady = hasDeliveryRoute(mine);
    const complete = isGameComplete();
    const nextTool = tools[currentLevel + 1];
    const stock = mineStock[mine.id];
    const marketTotal = getTotal(marketStock);
    const warehouseTotal = getTotal(warehouseStock);

    elements.money.textContent = `$${money.toLocaleString()}`;
    elements.tool.textContent = tools[currentLevel].name;
    elements.toolName.textContent = tools[currentLevel].name;
    elements.toolLevel.textContent = `Tool Lv. ${currentLevel + 1}`;
    elements.toolLevelDisplay.textContent = `Level ${currentLevel + 1}`;
    elements.toolSpeed.textContent = `Can mine ${mines.filter(item => isMineUnlocked(item)).map(item => item.resource).join(", ")}`;
    elements.levelName.textContent = complete ? "All mines completed!" : `Mine ${mines.filter(item => soldByMine[item.id] >= item.quota).length} / ${mines.length} complete`;
    elements.levelDetail.textContent = nextTool
        ? `Next pickaxe: ${nextTool.name} · $${nextTool.cost.toLocaleString()}`
        : "Every mining tool unlocked";
    elements.activeMineName.textContent = mine.name;
    elements.activeMineIcon.textContent = mine.icon;
    elements.currentResource.textContent = mine.resource;
    elements.mineActionTitle.textContent = miningCommandActive
        ? "Stop all mining"
        : !unlocked
        ? `${mine.resource} mine locked`
        : !facilitiesReady
            ? `Set up ${mine.resource} mine`
        : !routeReady
            ? `Build road to ${mine.resource}`
            : `Start mining ${mine.resource}`;
    elements.mineActionIcon.textContent = miningCommandActive ? "Ⅱ" : !facilitiesReady && unlocked ? "🔨" : "▶";
    elements.resourceName.textContent = miningCommandActive
        ? "Workers continue at every unlocked, prepared mine · click to stop"
        : !unlocked
        ? `Upgrade your tool to mine ${mine.resource}`
        : !facilitiesReady
            ? "Build a well and kitchen before mining"
        : !routeReady
            ? "Connect this mine → warehouse → market"
            : "Command workers at every unlocked, prepared mine";
    elements.mineAction.classList.toggle("command-active", miningCommandActive);
    elements.mineAction.setAttribute("aria-pressed", String(miningCommandActive));
    elements.mineRequirement.textContent = unlocked
        ? (!facilitiesReady
            ? "Build a well and kitchen to prepare this mine"
            : !routeReady
            ? "Build a road route before mining"
            : miningCommandActive
                ? "Workers are active at all ready mines"
                : "Available · waiting for your order")
        : `Requires ${tools[mine.toolLevel].name} · upgrade to unlock`;
    elements.mineAction.disabled = (!unlocked && !miningCommandActive) || complete || transactionPending;
    elements.mineGoal.textContent = `${Math.min(soldByMine[mine.id], mine.quota)} / ${mine.quota} sold`;
    elements.mineRate.textContent = unlocked ? `1 / ${(mine.speed / 1000).toFixed(1)}s` : "Not available yet";
    elements.oreValue.textContent = `$${mine.sellPrice} / unit`;
    elements.storageCapacity.textContent = `${stock} / ${truckCapacity} to truck`;
    elements.storageFill.style.width = `${Math.min(100, (stock / truckCapacity) * 100)}%`;
    elements.inventoryNote.textContent = !unlocked
        ? `Upgrade your tool to start mining ${mine.resource.toLowerCase()}.`
        : !facilitiesReady
            ? "Set up a well and kitchen before the miners can work."
        : stock >= mineCapacity
            ? "Mine stock is full. The truck will collect it when there is room."
            : `NPC miners collect ${mine.resource.toLowerCase()}; the truck ships each ${truckCapacity}-unit load.`;
    const facilityCostForMine = facilityPrice(mine);
    const wellBuilt = mineFacilities[mine.id].well;
    const kitchenBuilt = mineFacilities[mine.id].kitchen;
    elements.facilityStatus.textContent = !unlocked
        ? "Locked"
        : facilitiesReady
            ? "Ready"
            : `${Number(wellBuilt) + Number(kitchenBuilt)} / 2 built`;
    elements.facilityNote.textContent = mine.id === mines[0].id
        ? "Your first mine's well and kitchen are free."
        : `Each facility costs $${facilityCostForMine}. Build both before mining.`;
    elements.wellStatus.textContent = wellBuilt ? "Built" : "Required";
    elements.kitchenStatus.textContent = kitchenBuilt ? "Built" : "Required";
    elements.buildWell.textContent = wellBuilt
        ? "Well built"
        : `Build well · ${facilityCostForMine ? `$${facilityCostForMine}` : "Free"}`;
    elements.buildKitchen.textContent = kitchenBuilt
        ? "Kitchen built"
        : `Build kitchen · ${facilityCostForMine ? `$${facilityCostForMine}` : "Free"}`;
    elements.buildWell.disabled = !unlocked || wellBuilt || transactionPending || money < facilityCostForMine;
    elements.buildKitchen.disabled = !unlocked || kitchenBuilt || transactionPending || money < facilityCostForMine;
    elements.winBanner.hidden = !complete;
    elements.gameFooter.textContent = complete
        ? "🏆 You completed every mine in the valley!"
        : `Goal: sell ${mine.quota} ${mine.resource.toLowerCase()} from each mine. ${mines.filter(item => soldByMine[item.id] >= item.quota).length} of ${mines.length} complete.`;

    if (paused) {
        elements.productionState.classList.add("paused");
        elements.productionState.innerHTML = "<i></i> Game paused";
    } else if (complete) {
        elements.productionState.classList.remove("paused");
        elements.productionState.innerHTML = "<i></i> All mines complete";
    } else if (miningCommandActive && mines.some(item => isMineUnlocked(item)
        && hasMineFacilities(item) && hasDeliveryRoute(item))) {
        elements.productionState.classList.remove("paused");
        elements.productionState.innerHTML = "<i></i> Production running at ready mines";
    } else if (!unlocked) {
        elements.productionState.classList.add("paused");
        elements.productionState.innerHTML = "<i></i> Tool upgrade needed";
    } else if (!facilitiesReady) {
        elements.productionState.classList.add("paused");
        elements.productionState.innerHTML = "<i></i> Mine setup needed";
    } else if (!routeReady) {
        elements.productionState.classList.add("paused");
        elements.productionState.innerHTML = "<i></i> Road connection needed";
    } else if (!miningCommandActive) {
        elements.productionState.classList.add("paused");
        elements.productionState.innerHTML = "<i></i> Awaiting mining command";
    } else {
        elements.productionState.classList.remove("paused");
        elements.productionState.innerHTML = "<i></i> Production running";
    }

    elements.mineSelection.textContent = !unlocked
        ? `${mine.name} needs a ${tools[mine.toolLevel].name}`
        : !facilitiesReady
            ? `${mine.name} needs a well and kitchen`
        : !routeReady
            ? `Build roads from ${mine.resource} Mine → Warehouse → Market`
            : miningCommandActive
            ? `Workers active at every ready mine · ${mine.name} selected`
            : `${mine.name} selected · issue a command to start`;
    elements.mineSelection.classList.toggle("locked", !unlocked);
    elements.mineSelection.classList.toggle("command-active", miningCommandActive);
    elements.marketDepotCount.textContent = marketTotal;
    elements.routeStatus.textContent = routeReady ? "Connected" : "Road needed";
    elements.routeStatus.classList.toggle("connected", routeReady);
    elements.depotCount.textContent = warehouseTotal + trucks.reduce((total, item) => total + item.amount, 0);
    const movingTruck = trucks.find(item => item.state !== "idle") || trucks[0];
    elements.truckStatus.textContent = movingTruck ? truckStateLabel(movingTruck) : "No trucks available";

    const nextUpgradeCost = nextTool?.cost ?? 0;
    const upgradeDisabled = !nextTool || transactionPending;
    elements.upgradeTitle.textContent = nextTool ? "Upgrade tools" : "All tools unlocked";
    elements.upgradeCost.textContent = nextTool
        ? `In-game coins: $${nextUpgradeCost.toLocaleString()} · MetaMask network fee`
        : "All five mines available";
    elements.buyTool.textContent = nextTool
        ? `Upgrade tools · $${nextUpgradeCost.toLocaleString()}`
        : "Tools fully upgraded";
    elements.buyTool.disabled = upgradeDisabled;
    elements.upgradeAction.disabled = upgradeDisabled;
    elements.truckCount.textContent = `${truckCount} / ${maxTruckCount} trucks`;
    elements.buyTruckTwo.textContent = truckCount >= 2 ? "Truck 2 purchased" : `Buy truck 2 · $${truckPrices[1]}`;
    elements.buyTruckThree.textContent = truckCount >= 3 ? "Truck 3 purchased" : `Buy truck 3 · $${truckPrices[2]}`;
    elements.buyTruckTwo.disabled = truckCount !== 1 || transactionPending || money < truckPrices[1];
    elements.buyTruckThree.disabled = truckCount !== 2 || transactionPending || money < truckPrices[2];
    renderTrucks();
    renderWorkers();
    renderRoadTiles();
    renderMineSites();
    renderInventory();
}

function truckStateLabel(truck) {
    if (truck.state === "to-warehouse") return `Road to warehouse · ${truck.pathIndex}/${truck.path.length - 1}`;
    if (truck.state === "to-market") return `Road to market · ${truck.pathIndex}/${truck.path.length - 1}`;
    if (truck.state === "returning") return `Road back to ${getMine(truck.mineId).resource} mine`;
    const waitingMine = mines.find(item => mineStock[item.id] >= truckCapacity && !hasDeliveryRoute(item));
    return waitingMine ? `Road needed from ${waitingMine.resource}` : `Waiting for ${truckCapacity} ore`;
}

function clearMiningTimers() {
    for (const timer of mineTimers.values()) clearInterval(timer);
    mineTimers.clear();
    clearInterval(progressTimer);
    document.documentElement.style.setProperty("--mine-progress", "0%");
}

function startMining() {
    clearMiningTimers();
    if (paused || isGameComplete() || !miningCommandActive) return;

    for (const mine of mines) {
        if (!isMineUnlocked(mine) || !hasMineFacilities(mine) || !hasDeliveryRoute(mine)) continue;
        mineCycleStartedAt.set(mine.id, Date.now());
        const timer = setInterval(() => {
            if (paused || isGameComplete() || !miningCommandActive || !isMineUnlocked(mine)
                || !hasMineFacilities(mine) || !hasDeliveryRoute(mine)) return;
            if (mineStock[mine.id] < mineCapacity) {
                mineStock[mine.id] += 1;
                for (const worker of workerElements.get(mine.id) || []) {
                    worker.classList.add("working");
                    setTimeout(() => worker.classList.remove("working"), 500);
                }
                saveLocalState();
                render();
            }
            mineCycleStartedAt.set(mine.id, Date.now());
        }, mine.speed);
        mineTimers.set(mine.id, timer);
    }

    progressTimer = setInterval(() => {
        const mine = getActiveMine();
        const cycleStart = mineCycleStartedAt.get(mine.id);
        const elapsed = cycleStart ? Date.now() - cycleStart : 0;
        const progress = mineTimers.has(mine.id) ? Math.min(100, (elapsed / mine.speed) * 100) : 0;
        document.documentElement.style.setProperty("--mine-progress", `${progress}%`);
    }, 80);
}

function selectMine(id) {
    const mine = getMine(id);
    if (!mine) return;
    activeMineId = mine.id;
    saveLocalState();
    render();
    if (!isMineUnlocked(mine)) {
        const upgradeCost = tools[currentLevel + 1]?.cost;
        setMessage(`${mine.name} is locked. Upgrade to ${tools[mine.toolLevel].name}${upgradeCost ? ` for $${upgradeCost}` : ""} first.`);
    } else if (!hasMineFacilities(mine)) {
        setMessage(`${mine.name} needs a well and kitchen before its workers can start.`);
    } else if (!hasDeliveryRoute(mine)) {
        setMessage(`Build a connected road from ${mine.name} to the warehouse and from the warehouse to the market before mining.`);
    } else {
        setMessage(`${mine.name} selected. Its workers will work alongside every other unlocked, prepared mine; trucks share deliveries across them.`);
    }
}

function buildMineFacility(facility) {
    const mine = getActiveMine();
    if (!isMineUnlocked(mine)) {
        setMessage(`${mine.name} must be unlocked before you can build its facilities.`, true);
        return;
    }
    if (mineFacilities[mine.id][facility]) return;

    const cost = facilityPrice(mine);
    if (money < cost) {
        setMessage(`You need $${(cost - money).toLocaleString()} more to build the ${facility}.`, true);
        return;
    }

    mineFacilities[mine.id][facility] = true;
    money -= cost;
    saveLocalState();
    render();
    startMining();
    setMessage(`${facility === "well" ? "Well" : "Kitchen"} built at ${mine.name}${cost ? ` for $${cost}` : " for free"}.`);
}

function dispatchTruck(truck) {
    const mine = mines
        .map((_, index) => mines[(nextTruckMineIndex + index) % mines.length])
        .find(item => mineStock[item.id] >= truckCapacity && hasDeliveryRoute(item));
    if (truck.state !== "idle" || !mine) return false;

    const roadToWarehouse = findRoadTilePath(mineCell(mine), buildingCells.warehouse);
    const roadToMarket = findRoadTilePath(buildingCells.warehouse, buildingCells.market);
    if (!roadToWarehouse || !roadToMarket) return false;

    mineStock[mine.id] -= truckCapacity;
    truck.mineId = mine.id;
    truck.amount = truckCapacity;
    truck.warehouseAmount = 0;
    truck.state = "to-warehouse";
    truck.position = mine.position.slice();
    truck.roadToWarehouse = roadToWarehouse;
    truck.roadToMarket = roadToMarket;
    truck.path = [
        mine.position.slice(),
        ...roadToWarehouse.map(roadTilePosition),
        buildingPositions.warehouse.slice()
    ];
    truck.pathIndex = 1;
    truck.deadline = Date.now() + 220;
    nextTruckMineIndex = (mines.indexOf(mine) + 1) % mines.length;
    setMessage(`Truck loaded with ${truck.amount} ${mine.resource.toLowerCase()} and is heading to the warehouse.`);
    return true;
}

function processTruck() {
    if (paused || isGameComplete()) return;

    let changed = false;
    for (const truck of trucks) {
        if (truck.state === "idle") {
            changed = dispatchTruck(truck) || changed;
            continue;
        }
        if (Date.now() < truck.deadline) continue;

        if (truck.pathIndex < truck.path.length) {
            truck.position = truck.path[truck.pathIndex].slice();
            truck.pathIndex += 1;
            truck.deadline = Date.now() + 220;
            changed = true;
            continue;
        }

        if (truck.state === "to-warehouse") {
            const mine = getMine(truck.mineId);
            truck.warehouseAmount = truck.amount;
            warehouseStock[mine.id] += truck.warehouseAmount;
            truck.amount = 0;
            truck.state = "to-market";
            truck.position = buildingPositions.warehouse.slice();
            truck.path = [
                buildingPositions.warehouse.slice(),
                ...truck.roadToMarket.map(roadTilePosition),
                buildingPositions.market.slice()
            ];
            truck.pathIndex = 1;
            truck.deadline = Date.now() + 220;
            setMessage(`Warehouse received ${truck.warehouseAmount} ${mine.resource.toLowerCase()}. Truck is following the road to market.`);
        } else if (truck.state === "to-market") {
            const mine = getMine(truck.mineId);
            const delivered = Math.min(truck.warehouseAmount, warehouseStock[mine.id]);
            warehouseStock[mine.id] -= delivered;
            marketStock[mine.id] += delivered;
            truck.warehouseAmount = 0;
            truck.state = "returning";
            truck.position = buildingPositions.market.slice();
            truck.path = [
                buildingPositions.market.slice(),
                ...truck.roadToMarket.slice().reverse().map(roadTilePosition),
                buildingPositions.warehouse.slice(),
                ...truck.roadToWarehouse.slice().reverse().map(roadTilePosition),
                getMine(truck.mineId).position.slice()
            ];
            truck.pathIndex = 1;
            truck.deadline = Date.now() + 220;
            setMessage(`${delivered} ${mine.resource.toLowerCase()} delivered to market. Sell it when you're ready.`);
        } else {
            truck.state = "idle";
            truck.path = [];
            truck.pathIndex = 0;
            truck.roadToWarehouse = [];
            truck.roadToMarket = [];
            setMessage("A truck returned to the mine and is ready for another load.");
        }
        changed = true;
    }

    if (changed) {
        saveLocalState();
        render();
    }
}

function sellAll() {
    const total = getTotal(marketStock);
    if (!total) {
        setMessage("No ore has reached the market yet. Wait for the truck to deliver a load.");
        return;
    }

    let earnings = 0;
    for (const mine of mines) {
        const amount = marketStock[mine.id];
        if (!amount) continue;
        earnings += amount * mine.sellPrice;
        soldByMine[mine.id] += amount;
        marketStock[mine.id] = 0;
    }
    money += earnings;
    saveLocalState();
    render();
    setMessage(`Sold ${total} units for $${earnings.toLocaleString()}. Mine goals update when you sell.`);
}

function playAgain() {
    if (!isGameComplete() || transactionPending) return;

    clearMiningTimers();
    clearInterval(truckTimer);
    money = 0;
    currentLevel = 0;
    truckCount = 1;
    trucks = [createTruck("stone")];
    mineFacilities = createMineFacilities();
    nextTruckMineIndex = 0;
    activeMineId = "stone";
    miningCommandActive = false;
    roadBuilding = false;
    roadTiles = new Set();
    mineStock = Object.fromEntries(mines.map(mine => [mine.id, 0]));
    warehouseStock = Object.fromEntries(mines.map(mine => [mine.id, 0]));
    marketStock = Object.fromEntries(mines.map(mine => [mine.id, 0]));
    soldByMine = Object.fromEntries(mines.map(mine => [mine.id, 0]));
    paused = false;
    elements.pauseButton.textContent = "Ⅱ Pause";
    saveLocalState();
    render();
    startMining();
    truckTimer = setInterval(processTruck, 250);
    setMessage("A fresh round has started. Build your roads, then command the NPCs to mine.");
}

function formatError(error) {
    return error?.shortMessage
        || error?.reason
        || error?.info?.error?.message
        || error?.data?.message
        || error?.message
        || "Unknown wallet or network error";
}

async function connectWallet() {
    if (!window.ethereum) {
        setMessage("Install MetaMask to connect a wallet. You can play without a wallet.", true);
        return;
    }
    if (!window.ethers) {
        setMessage("The wallet library did not load. Refresh the page and try again.", true);
        return;
    }

    elements.walletButton.disabled = true;
    elements.walletButton.textContent = "Connecting…";
    try {
        provider = new window.ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        const networkInfo = await provider.getNetwork();
        const chainId = String(networkInfo.chainId);
        const deploymentsResponse = await fetch("./deployments.json", { cache: "no-store" });
        if (!deploymentsResponse.ok) {
            throw new Error(`Could not load deployments.json (HTTP ${deploymentsResponse.status}). Deploy MalMining to this network first.`);
        }
        const deployments = await deploymentsResponse.json();
        const contractAddress = deployments[chainId];
        if (!window.ethers.isAddress(contractAddress || "")) {
            throw new Error(`No MalMining deployment is configured for chain ${chainId}. Deploy MalMining to this network first.`);
        }
        const deployedCode = await provider.getCode(contractAddress);
        if (deployedCode === "0x") {
            throw new Error(`No MalMining contract is deployed at ${contractAddress} on chain ${chainId}. Run the local Hardhat node and deployment commands in README.md.`);
        }
        contract = new window.ethers.Contract(contractAddress, abi, signer);
        const address = await signer.getAddress();
        const savedData = await contract.loadGame(address);

        const hasSavedLocalProgress = hasLocalSave;
        if (!hasSavedLocalProgress) {
            money = Number(savedData[0]);
            currentLevel = Math.min(tools.length - 1, Math.max(0, Number(savedData[1]) || 0));
            truckCount = Math.min(maxTruckCount, Math.max(1, Number(savedData[2]) || 1));
        }
        trucks = trucks.slice(0, truckCount);
        while (trucks.length < truckCount) trucks.push(createTruck(activeMineId));
        elements.walletButton.textContent = `${address.slice(0, 6)}…${address.slice(-4)}`;
        elements.walletHint.textContent = "Connected · click to save";
        saveLocalState();
        render();
        startMining();
        setMessage(hasSavedLocalProgress
            ? "Wallet connected. Your current browser game progress is unchanged."
            : `Wallet connected. Loaded $${money.toLocaleString()} and your level ${currentLevel + 1} tool.`);
    } catch (error) {
        console.error("Wallet connection failed:", error);
        contract = undefined;
        elements.walletButton.textContent = "🦊 Connect wallet";
        setMessage(`Wallet connection failed: ${formatError(error)}`, true);
    } finally {
        elements.walletButton.disabled = false;
    }
}

async function submitGameSave(savedMoney, toolLevel, savedTruckCount) {
    if (!contract || !provider || !signer) {
        throw new Error("Connect a wallet to submit the transaction.");
    }

    const account = await signer.getAddress();
    const networkInfo = await provider.getNetwork();
    const nonceTag = networkInfo.chainId === 31337n ? "latest" : "pending";
    const nonceHex = await provider.send("eth_getTransactionCount", [account, nonceTag]);
    const nonce = Number(BigInt(nonceHex));
    return contract.saveGame(savedMoney, toolLevel, savedTruckCount, { nonce });
}

async function saveProgress() {
    if (!contract || transactionPending) return;

    transactionPending = true;
    render();
    setMessage("Confirm the progress-save transaction in your wallet.");
    try {
        const tx = await submitGameSave(money, currentLevel, truckCount);
        setMessage("Saving your coins and tool level to the blockchain…");
        await tx.wait();
        setMessage("Coins and tool level saved to the blockchain. Your full game is saved in this browser.");
    } catch (error) {
        console.error("Saving game failed:", error);
        setMessage(`Save failed: ${formatError(error)}`, true);
    } finally {
        transactionPending = false;
        render();
    }
}

async function buyTool() {
    if (transactionPending) return;
    transactionPending = true;
    render();
    let pausedForTransaction = false;
    try {
        if (!contract) await connectWallet();
        if (!contract) return;

        const nextTool = tools[currentLevel + 1];
        if (!nextTool) {
            setMessage("All tools are already unlocked.");
            return;
        }
        if (money < nextTool.cost) {
            setMessage(`You need $${(nextTool.cost - money).toLocaleString()} more in-game coins to upgrade.`);
            return;
        }

        if (!paused) {
            setPaused(true);
            pausedForTransaction = true;
        }
        setMessage("Confirm the upgrade in MetaMask. Review the network fee before approving.");
        const tx = await submitGameSave(money - nextTool.cost, currentLevel + 1, truckCount);
        setMessage("Waiting for the tool-upgrade transaction to confirm…");
        const receipt = await tx.wait();

        money -= nextTool.cost;
        currentLevel += 1;
        saveLocalState();
        render();
        const networkFee = receipt?.fee === undefined
            ? "MetaMask paid the network fee."
            : `Network fee: ${window.ethers.formatEther(receipt.fee)} ETH.`;
        setMessage(`${nextTool.name} unlocked. ${networkFee}`);
    } catch (error) {
        console.error("Tool upgrade failed:", error);
        setMessage(`Upgrade failed: ${formatError(error)}`, true);
    } finally {
        transactionPending = false;
        render();
        if (pausedForTransaction) setPaused(false);
    }
}

async function buyTruck(targetCount) {
    if (transactionPending) return;
    if (targetCount !== truckCount + 1 || targetCount > maxTruckCount) return;
    const cost = truckPrices[targetCount - 1];
    if (money < cost) {
        setMessage(`You need $${(cost - money).toLocaleString()} more to buy truck ${targetCount}.`, true);
        return;
    }

    transactionPending = true;
    render();
    let pausedForTransaction = false;
    try {
        if (contract) {
            if (!paused) {
                setPaused(true);
                pausedForTransaction = true;
            }
            setMessage(`Confirm the truck purchase in MetaMask. Review the network fee before approving.`);
            const tx = await submitGameSave(money - cost, currentLevel, targetCount);
            await tx.wait();
        }

        money -= cost;
        truckCount = targetCount;
        trucks.push(createTruck(activeMineId));
        saveLocalState();
        render();
        setMessage(`Truck ${targetCount} purchased for $${cost}. Your fleet can now deliver more loads in parallel.`);
    } catch (error) {
        console.error("Truck purchase failed:", error);
        setMessage(`Truck purchase failed: ${formatError(error)}`, true);
    } finally {
        transactionPending = false;
        render();
        if (pausedForTransaction) setPaused(false);
    }
}

function setPaused(value) {
    paused = value;
    elements.pauseButton.textContent = paused ? "▶ Resume" : "Ⅱ Pause";
    if (paused) {
        clearMiningTimers();
        clearInterval(truckTimer);
    } else {
        startMining();
        truckTimer = setInterval(processTruck, 250);
    }
    render();
}

for (const button of document.querySelectorAll(".mine-site")) {
    button.addEventListener("click", () => selectMine(button.dataset.mine));
}
elements.pauseButton.addEventListener("click", () => setPaused(!paused));
elements.winBanner.addEventListener("click", playAgain);
elements.buildRoadButton.addEventListener("click", () => setRoadBuilding(!roadBuilding));
elements.buildRoadAction.addEventListener("click", () => setRoadBuilding(!roadBuilding));
elements.sellButton.addEventListener("click", sellAll);
document.getElementById("sell-action").addEventListener("click", sellAll);
elements.buyTool.addEventListener("click", buyTool);
elements.upgradeAction.addEventListener("click", buyTool);
elements.buildWell.addEventListener("click", () => buildMineFacility("well"));
elements.buildKitchen.addEventListener("click", () => buildMineFacility("kitchen"));
elements.buyTruckTwo.addEventListener("click", () => buyTruck(2));
elements.buyTruckThree.addEventListener("click", () => buyTruck(3));
elements.walletButton.addEventListener("click", connectWallet);
document.getElementById("wallet-action").addEventListener("click", () => {
    if (contract) saveProgress();
    else connectWallet();
});
document.getElementById("mine-action").addEventListener("click", () => {
    document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
    const mine = getActiveMine();
    if (miningCommandActive) {
        miningCommandActive = false;
        saveLocalState();
        render();
        startMining();
        setMessage("Mining stopped at all mines. Trucks will finish deliveries already in progress.");
        return;
    }
    if (!isMineUnlocked(mine)) {
        setMessage(`${mine.name} needs a ${tools[mine.toolLevel].name}. Earn coins at the Stone Mine, then upgrade.`);
        return;
    }
    if (!hasMineFacilities(mine)) {
        document.getElementById("facilities-panel").scrollIntoView({ behavior: "smooth", block: "center" });
        setMessage(`Build a well and kitchen at ${mine.name} before starting its miners.`);
        return;
    }
    if (!hasDeliveryRoute(mine)) {
        if (!roadBuilding) setRoadBuilding(true);
        setMessage(`Build a road from ${mine.name} to the warehouse and connect the warehouse to the market first.`);
        return;
    }
    if (paused) setPaused(false);
    miningCommandActive = true;
    saveLocalState();
    render();
    startMining();
    setMessage("Mining command issued. Workers are active at every unlocked mine with a well, kitchen, and delivery route.");
});

const mapPlane = document.querySelector(".world-plane");
let mapZoom = 1;
const mapButtons = document.querySelectorAll(".map-controls button");
const zoomLabel = document.getElementById("zoom-label");
function setMapZoom(value) {
    mapZoom = value;
    mapPlane.style.scale = mapZoom;
    zoomLabel.textContent = `${Math.round(mapZoom * 100)}%`;
}
mapButtons[0].addEventListener("click", () => setMapZoom(1));
mapButtons[1].addEventListener("click", () => setMapZoom(Math.max(.75, mapZoom - .1)));
mapButtons[2].addEventListener("click", () => setMapZoom(Math.min(1.25, mapZoom + .1)));

loadLocalState();
render();
startMining();
truckTimer = setInterval(processTruck, 250);
