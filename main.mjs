import { TransportSystem } from './transport.mjs';
import { EconomySystem } from './economy.mjs';
import { TOOLS } from './goods.mjs';

// --- WEB3 VARS ---
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Check this!
const abi = [
    "function saveGame(uint256 _money, uint256 _toolLevel, uint256 _truckCount) public",
    "function loadGame(address _player) public view returns (uint256, uint256, uint256)"
];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Generate the Grid Tiles
    const gridContainer = document.getElementById('grid-container');
    for (let i = 0; i < 100; i++) {
        const tile = document.createElement('div');
        tile.classList.add('grid-tile');
        gridContainer.appendChild(tile);
    }

    // 2. Setup Systems
    // We tell the truck system to go from Stone Mine (20, 20) to Warehouse (50, 50)
    const transport = new TransportSystem({top: 20, left: 20}, {top: 50, left: 50});
    const economy = new EconomySystem(transport);

    transport.addTruck(); // Spawn first truck

    // 3. Mining Loop (Mines Stone)
    let miningInterval;
    function startMining() {
        clearInterval(miningInterval);
        miningInterval = setInterval(() => {
            transport.addMinedResource(1); 
            document.getElementById('inv-stone').innerText = transport.mineStorage;
        }, TOOLS[economy.currentLevel].speed);
    }

    // 4. Web3 Connect
    document.getElementById('connect-btn').onclick = async () => {
        if (window.ethereum) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            window.signer = await provider.getSigner();
            window.contract = new ethers.Contract(contractAddress, abi, window.signer);
            
            const address = await window.signer.getAddress();
            const data = await window.contract.loadGame(address);
            
            economy.money = Number(data[0]);
            economy.currentLevel = Number(data[1]);
            economy.truckCount = Number(data[2]);
            
            for (let i = 1; i < economy.truckCount; i++) transport.addTruck();
            
            economy.updateUI();
            startMining();
            alert("Wallet Connected!");
        }
    };

    startMining();
});