export const RESOURCES = {
    STONE: { name: 'Stone', icon: '🪨', sellValue: 1 },
    COPPER: { name: 'Copper', icon: '🟠', sellValue: 5 }
};

export const TOOLS = [
    { id: 0, name: 'Wooden Pickaxe', speed: 3000, cost: 0, resource: RESOURCES.STONE },
    { id: 1, name: 'Stone Pickaxe', speed: 2000, cost: 20, resource: RESOURCES.COPPER },
    { id: 2, name: 'Iron Pickaxe', speed: 1000, cost: 100, resource: RESOURCES.COPPER }
];