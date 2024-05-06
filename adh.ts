// Flat file examples:
// Discord: https://prod-flat-files-min.wormhole.com/468526016151814164_14443.json
// Solana: https://prod-flat-files-min.wormhole.com/9UuMq6FkcZLbCX84sw6L4sVzkNc6VBhTmASRVQoX6HLV_1.json
// EVM: https://prod-flat-files-min.wormhole.com/0x000000000000a25d11d75bdd1ebf1397db20bbc1_2.json
// Sui: https://prod-flat-files-min.wormhole.com/0x83ff02bcf7990804885926b199a63eb43481b85ac400e96136fa9126558ab6fd_21.json
// Aptos: https://prod-flat-files-min.wormhole.com/0x34718c95e4f204739ebe79f01fd51825baaab6db96c89a4e28cd43dad19e3aaa_22.json
// Osmosis: https://prod-flat-files-min.wormhole.com/osmo1273g3uh6fwpmpu8fl8zla7tgue62a2dvq3gdx5_20.json
// Terra: https://prod-flat-files-min.wormhole.com/terra12fxvvhvjlnwsxtnpaae6a9dg6gfy5kszkug4js_3.json
// Injective: https://prod-flat-files-min.wormhole.com/inj1fsf3ez4clt5s3v2gmtpsllwekqrumlffe49sjk_19.json
// Algorand: https://prod-flat-files-min.wormhole.com/WV6AGN7MGGQ7ZBDTXRNGQ2LMWYXS2I4LTPLWA4M2RXFLAYGRIQSJVNOD2M_8.json

import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { encoding } from "@wormhole-foundation/sdk-base";
import { keccak256 } from "@wormhole-foundation/sdk-definitions";
import fetch from "node-fetch";

const grantProgramId = new PublicKey("Wapq3Hpv2aSKjWrh4pM8eweh8jVJB7D1nLBw9ikjVYx");
const wMint = new PublicKey("85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ");

const ecosystems = {
  Discord: 0,
  Solana: 1,
  Ethereum: 2,
  Sui: 3,
  Aptos: 4,
  Osmosis: 5,
  Terra: 5,
  Injective: 6,
  Algorand: 7,
} as const;

type Ecosystem = keyof typeof ecosystems;

function toEcoAddress(
  addr: string,
  eco?: string,
): [string, Ecosystem] {
  if (addr.startsWith("osmo1"))
    return [addr, "Osmosis"];
  if (addr.startsWith("terra1"))
    return [addr, "Terra"];
  if (addr.startsWith("inj1"))
    return [addr, "Injective"];
  if (addr.startsWith("0x")) {
    if (addr.length === 42)
      return [addr.toLowerCase(), "Ethereum"];
    else if (addr.length === 66) {
      if (eco && "sui".startsWith(eco.toLocaleLowerCase()))
        return [addr, "Sui"];
      if (eco && "aptos".startsWith(eco.toLocaleLowerCase()))
        return [addr, "Aptos"];

      throw new Error(
        `Can't automatically distinguish Sui and Aptos addresses.\n` +
        `specify via '<addr> s' or '<addr> a' argument`
      );
    }
    else
      throw new Error(`Invalid hex address: ${addr}`);
  }
  if (addr.match(/^[0-9]{5,20}$/))
    return [addr, "Discord"];
  if (addr.match(/^[A-Z2-7]{58}$/))
    return [addr, "Algorand"];
  //check if addr is a base58 solana address
  try {
    new PublicKey(addr);
    return [addr, "Solana"];
  } catch (e) {
    throw new Error(`Invalid address: '${addr}'`);
  }
}

async function getFlatFile(identity: string, ecosystem: Ecosystem) {
  const chain = {
    Discord: 14443,
    Solana: 1,
    Ethereum: 2,
    Sui: 21,
    Aptos: 22,
    Osmosis: 20,
    Terra: 3,
    Injective: 19,
    Algorand: 8,
  };
  const baseUrl = "https://prod-flat-files-min.wormhole.com/";
  const response = await fetch(baseUrl + identity + "_" + chain[ecosystem] + ".json");
  if (!response.ok)
    throw new Error(`Fetching flatfile failed with status: ${response.status}`);
  const json = await response.json();
  return json;
}

function calcReplayAddress(preimage: string) {
  const leaf = encoding.hex.decode("00" + preimage);
  //console.log("leaf:", encoding.hex.encode(leaf));
  const leafHash = keccak256(leaf).slice(0, 20);
  //console.log("hash:", encoding.hex.encode(leafHash));
  return PublicKey.findProgramAddressSync(
    [encoding.bytes.encode("receipt"), leafHash],
    grantProgramId
  )[0];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0)
    console.log(
`Usage:
tsx adh.ts <identity> [ecosystem]
  prints the replay address for the given identity
  - ecosystem must be a or s for Aptos or Sui, otherwise ignored

tsx adh.ts <ata> <wallet>
  prints the associated W token address for the given wallet
`
  )
  else if (args.length === 2 && args[0] === "ata") {
    const calcAta = (owner: PublicKey) =>
      PublicKey.findProgramAddressSync(
        [
          owner.toBytes(),
          TOKEN_PROGRAM_ID.toBytes(),
          wMint.toBytes(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      )[0];

    console.log(`ATA: ${calcAta(new PublicKey(args[1])).toBase58()}`);
  }
  else {
    const [addr, eco] = toEcoAddress(args[0], args[1]);
    //console.log(`Address: ${addr} (${eco})`);
    const {preimage} = await getFlatFile(addr, eco) as {preimage: string};
    //console.log(`Preimage: ${preimage}`);
    console.log(`ReplayAddress: ${calcReplayAddress(preimage).toBase58()}`);
  }
}

main().then(
  () => {
    process.exit();
  },
  err => {
    console.error("failed with error:")
    console.error(err.message);
    process.exit(-1);
  },
);

