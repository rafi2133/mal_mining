export class TransportSystem {
    constructor(minePos, warehousePos) {
        this.minePos = minePos;
        this.warehousePos = warehousePos;
        this.trucks = [];
        this.mineStorage = 0;
        this.truckCapacity = 10;
        
        this.container = document.getElementById('truck-container');
    }

    addMinedResource(amount) {
        this.mineStorage += amount;
        document.getElementById('inv-stone').innerText = this.mineStorage;
    }

    addTruck() {
        const truckEl = document.createElement('div');
        truckEl.className = 'truck';
        truckEl.innerText = '🚚';
        // Start at the mine
        truckEl.style.top = `${this.minePos.top}%`;
        truckEl.style.left = `${this.minePos.left}%`;
        this.container.appendChild(truckEl);

        const truckObj = { el: truckEl, state: 'WAITING' };
        this.trucks.push(truckObj);
        
        this.runTruck(truckObj); 
    }

    runTruck(truck) {
        if (truck.state === 'WAITING') {
            setTimeout(() => {
                if (this.mineStorage > 0) {
                    let load = Math.min(this.mineStorage, this.truckCapacity);
                    this.mineStorage -= load;
                    document.getElementById('inv-stone').innerText = this.mineStorage;
                    
                    truck.state = 'DELIVERING';
                    // Move to warehouse
                    truck.el.style.top = `${this.warehousePos.top}%`;
                    truck.el.style.left = `${this.warehousePos.left}%`;
                    
                    setTimeout(() => {
                        // Unload
                        const event = new CustomEvent('cargoUnloaded', { detail: { amount: load } });
                        document.dispatchEvent(event);
                        
                        truck.state = 'RETURNING';
                        // Move back to mine
                        truck.el.style.top = `${this.minePos.top}%`;
                        truck.el.style.left = `${this.minePos.left}%`;
                        
                        setTimeout(() => {
                            truck.state = 'WAITING';
                            this.runTruck(truck); 
                        }, 2000); // 2s travel time
                    }, 2000);
                } else {
                    this.runTruck(truck); 
                }
            }, 1000);
        }
    }
}