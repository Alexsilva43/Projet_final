"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";

import { publicClient } from "../lib/publicClient";
import { ESCROW_ABI } from "../../constants/contract";

export type EscrowSaleDetails = {
    state: number;

    seller: Address;
    buyer: Address;
    intermediary: Address;

    tokenERC20: Address;
    vehicleNFT: Address;
    vehicleTokenId: bigint;

    vehiclePrice: bigint;
    depositFee: bigint;
    pickupFee: bigint;
    cancellationFee: bigint;

    vehiclePriceFunded: boolean;
    nftDeposited: boolean;

    depositRequested: boolean;
    pickupRequested: boolean;

    verificationRequested: boolean;

    recoveryRequested: boolean;
    recoveryRequired: boolean;

    transferCodeDeadlineActive: boolean;
    confirmCodeDeadlineActive: boolean;
    verificationRequestDeadlineActive: boolean;
    buyerTimeoutVerificationActive: boolean;

    transferCodeDeadline: bigint;
    confirmCodeDeadline: bigint;
    verificationRequestDeadline: bigint;
    noBuyerResponseVerificationDeadline: bigint;

    disputeReason: number;

    encryptedTransferCode?: Hex;
    transferCodeHash?: Hex;
};

export function useEscrowSale(escrowAddress?: Address) {
    const [details, setDetails] = useState<EscrowSaleDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEscrowSale = useCallback(async (showLoading = true) => {
        if (!escrowAddress) {
            setDetails(null);
            setLoading(false);
            setError(null);
            return;
        }

        try {
            if (showLoading) {
                setLoading(true);
            }

            setError(null);

            const [
                state,
                seller,
                buyer,
                intermediary,
                tokenERC20,
                vehicleNFT,
                vehicleTokenId,
                vehiclePrice,
                depositFee,
                pickupFee,
                cancellationFee,
                vehiclePriceFunded,
                nftDeposited,
                depositRequested,
                pickupRequested,
                verificationRequested,
                recoveryRequested,
                recoveryRequired,
                transferCodeDeadlineActive,
                confirmCodeDeadlineActive,
                verificationRequestDeadlineActive,
                buyerTimeoutVerificationActive,
                transferCodeDeadline,
                confirmCodeDeadline,
                verificationRequestDeadline,
                noBuyerResponseVerificationDeadline,
                disputeReason
            ] = await publicClient.multicall({
                contracts: [
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getSaleState" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getSeller" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getBuyer" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getIntermediary" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getTokenERC20Contract" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getVehicleNFTContract" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getVehicleTokenId" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getVehiclePrice" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getDepositFee" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getPickupFee" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getCancellationFee" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "hasVehiclePriceFunded" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "hasNFTBeenDeposited" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "isDepositRequested" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "isPickupRequested" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "isTransferCodeVerificationRequested" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "isVehicleRecoveryRequested" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "isVehicleRecoveryRequired" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "isTransferCodeDeadlineActive" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "isConfirmCodeDeadlineActive" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "isVerificationRequestDeadlineActive" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "isVerificationRequestPeriodAfterBuyerTimeoutActive" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getTransferCodeDeadline" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getConfirmCodeDeadline" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getVerificationRequestDeadline" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getNoBuyerResponseVerificationDeadline" },
                    { address: escrowAddress, abi: ESCROW_ABI, functionName: "getDisputeReason" }
                ],
                allowFailure: false
            });

            let encryptedTransferCode: Hex | undefined;
            let transferCodeHash: Hex | undefined;

            if (Number(state) === 5 || Number(state) === 9) {
                const [code, hash] = await publicClient.multicall({
                    contracts: [
                        { address: escrowAddress, abi: ESCROW_ABI, functionName: "getEncryptedTransferCode" },
                        { address: escrowAddress, abi: ESCROW_ABI, functionName: "getTransferCodeHash" }
                    ],
                    allowFailure: false
                });

                encryptedTransferCode = code;
                transferCodeHash = hash;
            }

            setDetails({
                state: Number(state),
                seller,
                buyer,
                intermediary,
                tokenERC20,
                vehicleNFT,
                vehicleTokenId,
                vehiclePrice,
                depositFee,
                pickupFee,
                cancellationFee,
                vehiclePriceFunded,
                nftDeposited,
                depositRequested,
                pickupRequested,
                verificationRequested,
                recoveryRequested,
                recoveryRequired,
                transferCodeDeadlineActive,
                confirmCodeDeadlineActive,
                verificationRequestDeadlineActive,
                buyerTimeoutVerificationActive,
                transferCodeDeadline,
                confirmCodeDeadline,
                verificationRequestDeadline,
                noBuyerResponseVerificationDeadline,
                disputeReason: Number(disputeReason),
                encryptedTransferCode,
                transferCodeHash
            });
        } catch (err) {
            console.error("Erreur lors du chargement de l'escrow :", err);

            setError("Impossible de charger les informations de l'escrow.");
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [escrowAddress]);

    useEffect(() => {
        fetchEscrowSale();
    }, [fetchEscrowSale]);

    async function refetch() {
        await fetchEscrowSale(false);
    }

    return {
        details,
        loading,
        error,
        refetch
    };
}