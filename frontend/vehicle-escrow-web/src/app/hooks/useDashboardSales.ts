"use client";

import { sleep } from "../utils/helpers";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseAbiItem, type Address, type GetLogsReturnType } from "viem";

import { publicClient } from "../lib/publicClient";
import { FACTORY_ADDRESS, ESCROW_ABI } from "../../constants/contract";

export type DashboardSale = {
    escrow: Address;
    vehicleNFT: Address;
    seller: Address;
    buyer: Address;
    intermediary: Address;
    vehicleTokenId: bigint;
    blockNumber: bigint;
    transactionHash: `0x${string}`;
    role: "seller" | "buyer" | "intermediary";
    state: number;
    createdAt: Date;
};

type CachedDashboardSale = {
    escrow: Address;
    vehicleNFT: Address;
    seller: Address;
    buyer: Address;
    intermediary: Address;
    vehicleTokenId: string;
    blockNumber: string;
    transactionHash: `0x${string}`;
    role: "seller" | "buyer" | "intermediary";
    state: number;
    createdAt: string;
};

const vehicleSaleCreatedEvent = parseAbiItem(
    "event VehicleSaleCreated(address escrow, address vehicleNFT, address indexed seller, address indexed buyer, address indexed intermediary, uint256 vehicleTokenId)"
);

function getSalesStorageKey(address: Address) {
    return `dashboard-sales-${FACTORY_ADDRESS.toLowerCase()}-${address.toLowerCase()}`;
}

function getLastBlockStorageKey(address: Address) {
    return `dashboard-last-block-${FACTORY_ADDRESS.toLowerCase()}-${address.toLowerCase()}`;
}

function saveSales(address: Address, sales: DashboardSale[]) {
    const cachedSales: CachedDashboardSale[] = sales.map((sale) => ({
        ...sale,
        vehicleTokenId: sale.vehicleTokenId.toString(),
        blockNumber: sale.blockNumber.toString(),
        createdAt: sale.createdAt.toISOString()
    }));

    localStorage.setItem(getSalesStorageKey(address), JSON.stringify(cachedSales));
}

function loadSales(address: Address) {
    const storedSales = localStorage.getItem(getSalesStorageKey(address));

    if (!storedSales) {
        return [];
    }

    try {
        const cachedSales = JSON.parse(storedSales) as CachedDashboardSale[];

        return cachedSales.map((sale): DashboardSale => ({
            ...sale,
            vehicleTokenId: BigInt(sale.vehicleTokenId),
            blockNumber: BigInt(sale.blockNumber),
            createdAt: new Date(sale.createdAt)
        }));
    } catch {
        localStorage.removeItem(getSalesStorageKey(address));
        return [];
    }
}

function getLastScannedBlock(address: Address) {
    const storedBlock = localStorage.getItem(getLastBlockStorageKey(address));

    if (!storedBlock) {
        return null;
    }

    try {
        return BigInt(storedBlock);
    } catch {
        localStorage.removeItem(getLastBlockStorageKey(address));
        return null;
    }
}

function saveLastScannedBlock(address: Address, blockNumber: bigint) {
    localStorage.setItem(getLastBlockStorageKey(address), blockNumber.toString());
}

async function getVehicleSaleLogsInChunks(
    args: {
        seller?: Address;
        buyer?: Address;
        intermediary?: Address;
    },
    fromBlock: bigint,
    latestBlock: bigint
) {
    const logs: GetLogsReturnType<typeof vehicleSaleCreatedEvent> = [];
    const maxBlockRange = 9_999n;

    if (fromBlock > latestBlock) {
        return logs;
    }

    for (let startBlock = fromBlock; startBlock <= latestBlock; startBlock += maxBlockRange + 1n) {
        const endBlock = startBlock + maxBlockRange > latestBlock ? latestBlock : startBlock + maxBlockRange;

        const chunkLogs = await publicClient.getLogs({
            address: FACTORY_ADDRESS,
            event: vehicleSaleCreatedEvent,
            args,
            fromBlock: startBlock,
            toBlock: endBlock
        });

        logs.push(...chunkLogs);

        //await sleep(1000);
    }

    return logs;
}

export function useDashboardSales(address?: Address, fromBlock?: bigint | null) {
    const [sales, setSales] = useState<DashboardSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestRef = useRef<string | null>(null);

    const fetchSales = useCallback(async () => {
        if (!address) {
            setSales([]);
            setLoading(false);
            setRefreshing(false);
            setError(null);
            return;
        }

        if (fromBlock === null || fromBlock === undefined) {
            setSales([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        const requestKey = `${address.toLowerCase()}-${fromBlock.toString()}`;

        if (requestRef.current === requestKey) {
            return;
        }

        requestRef.current = requestKey;

        setRefreshing(true);

        const cachedSales = loadSales(address);

        if (cachedSales.length > 0) {
            setSales(cachedSales);
            setLoading(false);
        } else {
            setLoading(true);
        }

        try {
            setError(null);

            const lastScannedBlock = getLastScannedBlock(address);
            const latestBlock = await publicClient.getBlockNumber();

            const scanFromBlock = lastScannedBlock !== null ? lastScannedBlock - 1n : fromBlock;

            const eventsWhereIAmSeller = await getVehicleSaleLogsInChunks(
                { seller: address },
                scanFromBlock,
                latestBlock
            );

            const eventsWhereIAmBuyer = await getVehicleSaleLogsInChunks(
                { buyer: address },
                scanFromBlock,
                latestBlock
            );

            const eventsWhereIAmIntermediary = await getVehicleSaleLogsInChunks(
                { intermediary: address },
                scanFromBlock,
                latestBlock
            );

            const allLogs = [
                ...eventsWhereIAmSeller,
                ...eventsWhereIAmBuyer,
                ...eventsWhereIAmIntermediary
            ];

            const salesMap = new Map<string, Omit<DashboardSale, "state" | "createdAt">>();

            for (const sale of cachedSales) {
                salesMap.set(sale.escrow.toLowerCase(), {
                    escrow: sale.escrow,
                    vehicleNFT: sale.vehicleNFT,
                    seller: sale.seller,
                    buyer: sale.buyer,
                    intermediary: sale.intermediary,
                    vehicleTokenId: sale.vehicleTokenId,
                    blockNumber: sale.blockNumber,
                    transactionHash: sale.transactionHash,
                    role: sale.role
                });
            }

            const currentAddress = address.toLowerCase();

            for (const log of allLogs) {
                const escrow = log.args.escrow;
                const vehicleNFT = log.args.vehicleNFT;
                const seller = log.args.seller;
                const buyer = log.args.buyer;
                const intermediary = log.args.intermediary;
                const vehicleTokenId = log.args.vehicleTokenId;

                if (!escrow || !vehicleNFT || !seller || !buyer || !intermediary || vehicleTokenId === undefined) {
                    continue;
                }

                let role: "seller" | "buyer" | "intermediary";

                if (seller.toLowerCase() === currentAddress) {
                    role = "seller";
                } else if (buyer.toLowerCase() === currentAddress) {
                    role = "buyer";
                } else {
                    role = "intermediary";
                }

                salesMap.set(escrow.toLowerCase(), {
                    escrow,
                    vehicleNFT,
                    seller,
                    buyer,
                    intermediary,
                    vehicleTokenId,
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash,
                    role
                });
            }

            const salesWithoutState = Array.from(salesMap.values());
            const salesWithState: DashboardSale[] = [];

            for (const sale of salesWithoutState) {
                const state = await publicClient.readContract({
                    address: sale.escrow,
                    abi: ESCROW_ABI,
                    functionName: "getSaleState"
                });

                const cachedSale = cachedSales.find(
                    (cached) => cached.escrow.toLowerCase() === sale.escrow.toLowerCase()
                );

                let createdAt: Date;

                if (cachedSale) {
                    createdAt = cachedSale.createdAt;
                } else {
                    const block = await publicClient.getBlock({
                        blockNumber: sale.blockNumber
                    });

                    createdAt = new Date(Number(block.timestamp) * 1000);
                }

                salesWithState.push({
                    ...sale,
                    state: Number(state),
                    createdAt
                });
            }

            salesWithState.sort((a, b) => Number(b.blockNumber - a.blockNumber));

            setSales(salesWithState);
            saveSales(address, salesWithState);
            saveLastScannedBlock(address, latestBlock);
        } catch (err) {
            console.error("Erreur lors du chargement des ventes :", err);

            setError("Impossible de mettre à jour les ventes.");
            requestRef.current = null;
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [address, fromBlock]);

    useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    async function refetch() {
        requestRef.current = null;
        await fetchSales();
    }

    return {
        sales,
        loading,
        refreshing,
        error,
        refetch
    };
}