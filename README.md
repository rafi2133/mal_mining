# MalMining

## Run the local blockchain

The game stores upgrades in a contract on the connected network. For local testing, keep a Hardhat node running and deploy the contract to it:

1. Start the node: `npx hardhat node`
2. In another terminal, deploy: `npx hardhat run scripts/deploy.js --network localhost`
3. In MetaMask, select the local Hardhat network at `http://127.0.0.1:8545` (chain ID `31337`) and connect.
4. Serve the project folder over HTTP and open the game.

The deployment command writes the contract address to `deployments.json`, which the game uses for the connected chain. If the Hardhat node is restarted, redeploy the contract. Use Hardhat test accounts only on the local network; never use their keys on a public network.

If MetaMask reports `nonce too high` on the local Hardhat network after its node has been restarted, open MetaMask's **Settings → Advanced → Clear activity tab data** for the local account, then reconnect. This clears MetaMask's stale local transaction history; it does not reset the blockchain.

## Mine setup and trucks

Build a well and kitchen at each unlocked mine before starting its workers. Both facilities are free at the first mine; each costs $25 at later mines. Once mining starts, workers continue at every unlocked, prepared mine with a complete road route, including previously selected mines. The well and kitchen appear beside each mine once built. The first truck is free, and the next two can be purchased for $100 and $200. Up to three trucks deliver loads independently, rotating across mines that have stock and a complete road route. Game progress is saved in the current browser.
