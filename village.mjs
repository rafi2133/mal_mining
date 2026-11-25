const GRID_SIZE = 10;

export function initVillage() {
    const gridContainer = document.getElementById('grid-container');
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const tile = document.createElement('div');
        tile.classList.add('grid-tile');
        gridContainer.appendChild(tile);
    }
}