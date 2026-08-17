import { createPublicClient, http } from "viem";
import { sepolia, baseSepolia } from "viem/chains";


export const publicClient = createPublicClient({
  chain: baseSepolia,
  //transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
  //transport: http("https://sepolia.base.org"),
  transport: http("https://base-sepolia-rpc.publicnode.com"),
});