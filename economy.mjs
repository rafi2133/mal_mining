import { TOOLS } from './goods.mjs';

export class EconomySystem {
    constructor(transport) {
        this.transport = transport;
        this.money = 0;
        this.currentLevel = 0;
        this.truckCount = 1;
        this.truckCost = 50;
        
        this.inventory = { stone: 0, copper: 0, iron: 0, gold: 0, diamond: 0 };
        
        document.addEventListener('cargoUnloaded', (e) => {
            // For now, the truck only hauls stone
            this.inventory.stone += e.detail.amount;
            this.updateUI();
        });

        document.getElementById('sell-btn').onclick = () => this.sellAll();
        document.getElementById('buy-tool-btn').onclick = () => this.buyTool();
        document.getElementById('buy-truck-btn').onclick = () => this.buyTruck();
    }

    updateUI() {
        document.getElementById('money').innerText = `$${this.money}`;
        document.getElementById('ui-stone').innerText = this.inventory.stone;
        document.getElementById('ui-copper').innerText = this.inventory.copper;
        document.getElementById('ui-iron').innerText = this.inventory.iron;
        document.getElementById('ui-gold').innerText = this.inventory.gold;
        document.getElementById('ui-diamond').innerText = this.inventory.diamond;
        
        document.getElementById('current-tool').innerText = TOOLS[this.currentLevel].name;
        
        const nextLevel = TOOLS[this.currentLevel + 1];
        const btn = document.getElementById('buy-tool-btn');
        if (nextLevel) {
            btn.innerText = `Buy ${nextLevel.name} ($${nextLevel.cost})`;
            btn.disabled = this.money < nextLevel.cost;
        } else {
            btn.innerText = "Max Level Reached";
            btn.disabled = true;
        }

        const truckBtn = document.getElementById('buy-truck-btn');
        document.getElementById('truck-cost').innerText = `$${this.truckCost}`;
        truckBtn.disabled = this.money < this.truckCost;
    }

    sellAll() {
        // Calculate total money from all resources based on their prices
        let totalEarned = (this.inventory.stone * 1) + 
                          (this.inventory.copper * 5) + 
                          (this.inventory.iron * 10) + 
                          (this.inventory.gold * 50) + 
                          (this.inventory.diamond * 200);
        
        this.money += totalEarned;
        this.inventory = { stone: 0, copper: 0, iron: 0, gold: 0, diamond: 0 };
        this.updateUI();
    }

    async buyTruck() {
        if (this.money >= this.truckCost) {
            this.money -= this.truckCost;
            this.truckCost = Math.floor(this.truckCost * 1.5); 
            this.truckCount++;
            this.transport.addTruck(); 
            this.updateUI();
            
            if (window.contract) {
                const nonce = await window.signer.getNonce();
                await window.contract.saveGame(this.money, this.currentLevel, this.truckCount, { nonce });
            }
        }
    }

    async buyTool() {
        const nextLevel = TOOLS[this.currentLevel + 1];
        if (nextLevel && this.money >= nextLevel.cost) {
            if (window.contract) {
                try {
                    const btn = document.getElementById('buy-tool-btn');
                    btn.innerText = "Saving...";
                    
                    let newMoney = this.money - nextLevel.cost;
                    let newLevel = this.currentLevel + 1;
                    
                    const nonce = await window.signer.getNonce();
                    const tx = await window.contract.saveGame(newMoney, newLevel, this.truckCount, { nonce });
                    await tx.wait();
                    
                    alert("Upgrade saved to blockchain!");
                    this.money = newMoney;
                    this.currentLevel = newLevel;
                    this.updateUI();
                } catch (error) {
                    console.error(error);
                    this.updateUI();
                }
            }
        }
    }
}