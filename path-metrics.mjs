// Calculates the time it takes to travel based on distance
export function getTravelTime(startX, startY, endX, endY, speed = 2) {
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    return distance * (1000 / speed); // Returns milliseconds
}