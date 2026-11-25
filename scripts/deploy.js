import { network } from "hardhat";
import { readFile, writeFile } from "node:fs/promises";

async function main() {
  const { ethers } = await network.connect();

  const MalMining = await ethers.getContractFactory("MalMining");
  const game = await MalMining.deploy();
  await game.waitForDeployment();

  const address = await game.getAddress();
  const chainId = String((await ethers.provider.getNetwork()).chainId);
  const deploymentsUrl = new URL("../deployments.json", import.meta.url);
  let deployments = {};

  try {
    deployments = JSON.parse(await readFile(deploymentsUrl, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  deployments[chainId] = address;
  await writeFile(deploymentsUrl, `${JSON.stringify(deployments, null, 2)}\n`);
  console.log(`MalMining deployed on chain ${chainId} to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});