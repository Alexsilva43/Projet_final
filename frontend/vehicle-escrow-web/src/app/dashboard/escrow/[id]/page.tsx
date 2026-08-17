"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useAppKitAccount } from "@reown/appkit/react";
import { useWriteContract } from "wagmi";
import {
    formatUnits,
    hexToString,
    keccak256,
    parseAbi,
    stringToHex,
    type Address,
    type Hex
} from "viem";

import { useEscrowSale, type EscrowSaleDetails } from "../../../hooks/useEscrowSale";
import { publicClient } from "../../../lib/publicClient";

import { ESCROW_ABI } from "../../../../constants/contract";

const ERC20_ABI = parseAbi([
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
]);

const ERC721_ABI = parseAbi([
    "function approve(address to, uint256 tokenId) external",
    "function getApproved(uint256 tokenId) external view returns (address)"
]);

const stateLabels = [
    "Créée",
    "Financée",
    "NFT déposé",
    "Actifs déposés",
    "Prête",
    "Code soumis",
    "Vente confirmée",
    "Terminée",
    "Annulée",
    "Litige"
];

const roleLabels = {
    seller: "Vendeur",
    buyer: "Acheteur",
    intermediary: "Intermédiaire"
};

type EscrowRole =
    | "seller"
    | "buyer"
    | "intermediary";

type EscrowAction =
    | "depositNFT"
    | "fundVehiclePrice"
    | "requestVehicleDeposit"
    | "confirmVehicleDeposit"
    | "submitTransferCode"
    | "confirmTransferCode"
    | "rejectTransferCode"
    | "requestVerification"
    | "requestVehiclePickup"
    | "confirmVehiclePickup"
    | "cancelBeforeVehicleDeposit"
    | "cancelAfterTransferCodeDeadline"
    | "cancelAfterConfirmAndVerificationDeadline"
    | "cancelAfterVerificationRequestDeadline"
    | "requestVehicleRecovery"
    | "confirmVehicleRecovered"
    | "resolveOriginalCode"
    | "resolveCorrectedCode"
    | "resolveNoValidCode";

type ActionButton = {
    action: EscrowAction;
    label: string;
    variant?: "primary" | "secondary" | "danger";
};

type RequiredAction = {
    title: string;
    description: string;
    buttons?: ActionButton[];
    showTransferCode?: boolean;
    showTransferCodeInput?: boolean;
    showCorrectedCodeInput?: boolean;
    deadline?: bigint;
};

function shortenAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function waitForRpcBlock(blockNumber: bigint) {
    while (true) {
        const currentBlock = await publicClient.getBlockNumber();

        console.log(
            "RPC block:",
            currentBlock.toString(),
            "| Transaction block:",
            blockNumber.toString()
        );

        if (currentBlock >= blockNumber) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
    }
}

function prepareTransferCode(code: string) {
    const codeBytes = stringToHex(code);
    const codeHash = keccak256(codeBytes);

    return { codeBytes, codeHash };
}

function normalizeTransferCode(code: string) {
    return code
        .trim()
        .replace(/^["']+|["']+$/g, "")
        .trim();
}

function getWorkflowProgressStorageKey(
    escrowAddress: Address
) {
    return `escrow-workflow-progress-${escrowAddress.toLowerCase()}`;
}

function normalizeWorkflowProgressState(
    state: number
) {
    if (state >= 0 && state <= 7) {
        return state;
    }

    if (state === 9) {
        return 5;
    }

    return 0;
}

function inferCancelledWorkflowProgress(
    details: EscrowSaleDetails
) {
    if (
        details.encryptedTransferCode ||
        details.transferCodeHash ||
        details.confirmCodeDeadline > 0n ||
        details.verificationRequestDeadline > 0n ||
        details.noBuyerResponseVerificationDeadline > 0n
    ) {
        return 5;
    }

    if (details.transferCodeDeadline > 0n) {
        return 4;
    }

    return 0;
}

function saveWorkflowProgress(
    escrowAddress: Address,
    state: number
) {
    const normalizedState =
        normalizeWorkflowProgressState(state);

    const storageKey =
        getWorkflowProgressStorageKey(
            escrowAddress
        );

    const storedValue =
        localStorage.getItem(storageKey);

    const storedState =
        storedValue !== null &&
        /^\d+$/.test(storedValue)
            ? Number(storedValue)
            : -1;

    if (normalizedState > storedState) {
        localStorage.setItem(
            storageKey,
            normalizedState.toString()
        );
    }
}

function isUserRejectedError(err: unknown): boolean {
    if (!err || typeof err !== "object") {
        return false;
    }

    const error = err as {
        code?: number;
        name?: string;
        message?: string;
        shortMessage?: string;
        cause?: unknown;
    };

    const message = [
        error.name,
        error.message,
        error.shortMessage
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    if (
        error.code === 4001 ||
        message.includes("user rejected") ||
        message.includes("user denied") ||
        message.includes("rejected the request")
    ) {
        return true;
    }

    return error.cause
        ? isUserRejectedError(error.cause)
        : false;
}

function getRole(
    address: Address | undefined,
    details: EscrowSaleDetails
): EscrowRole | null {
    if (!address) return null;

    const currentAddress = address.toLowerCase();

    if (details.seller.toLowerCase() === currentAddress) return "seller";
    if (details.buyer.toLowerCase() === currentAddress) return "buyer";
    if (details.intermediary.toLowerCase() === currentAddress) return "intermediary";

    return null;
}

function isDeadlineActive(
    deadline: bigint,
    currentBlockchainTime: number | null,
    fallbackActive: boolean
) {
    if (deadline === 0n) {
        return false;
    }

    if (currentBlockchainTime === null) {
        return fallbackActive;
    }

    return BigInt(currentBlockchainTime) <= deadline;
}

function isDeadlineExpired(
    deadline: bigint,
    currentBlockchainTime: number | null
) {
    if (
        deadline === 0n ||
        currentBlockchainTime === null
    ) {
        return false;
    }

    return BigInt(currentBlockchainTime) > deadline;
}

function getSellerAction(
    details: EscrowSaleDetails,
    currentBlockchainTime: number | null
): RequiredAction {
    const state = details.state;

    if (state === 0 || state === 1) {
        return {
            title: "Déposer le NFT",
            description: `Déposez le NFT du véhicule dans l'escrow. Une garantie de ${formatUnits(details.cancellationFee, 6)} EURC sera également déposée.`,
            buttons: [
                { action: "depositNFT", label: "Déposer le NFT" },
                { action: "cancelBeforeVehicleDeposit", label: "Annuler la vente", variant: "danger" }
            ]
        };
    }

    if (state === 2) {
        return {
            title: "En attente de l'acheteur",
            description: "Le NFT est déposé. L'acheteur doit maintenant financer la vente.",
            buttons: [
                { action: "cancelBeforeVehicleDeposit", label: "Annuler la vente", variant: "danger" }
            ]
        };
    }

    if (state === 3) {
        if (!details.depositRequested) {
            return {
                title: "Demander le dépôt du véhicule",
                description: `Le NFT et le prix sont déposés. Vous pouvez maintenant demander le dépôt physique du véhicule auprès de l'intermédiaire. Cette demande entraîne le paiement de ${formatUnits(details.depositFee, 6)} EURC de frais de dépôt.`,
                buttons: [
                    { action: "requestVehicleDeposit", label: "Demander le dépôt du véhicule" },
                    { action: "cancelBeforeVehicleDeposit", label: "Annuler la vente", variant: "danger" }
                ]
            };
        }

        return {
            title: "En attente de l'intermédiaire",
            description: "Vous avez demandé le dépôt du véhicule. L'intermédiaire doit maintenant confirmer sa réception.",
            buttons: [
                { action: "cancelBeforeVehicleDeposit", label: "Annuler la vente", variant: "danger" }
            ]
        };
    }

    if (state === 4) {
        const transferDeadlineExpired =
            isDeadlineExpired(
                details.transferCodeDeadline,
                currentBlockchainTime
            );

        if (transferDeadlineExpired) {
            return {
                title: "Délai de soumission expiré",
                description: "Le délai de soumission du code est expiré. Le vendeur ou l'acheteur peut annuler la vente.",
                buttons: [
                    { action: "cancelAfterTransferCodeDeadline", label: "Annuler la vente", variant: "danger" }
                ]
            };
        }

        return {
            title: "Soumettre le code de transfert",
            description: "Saisissez le code de transfert. Il sera envoyé en clair pour cette version de démonstration.",
            deadline: details.transferCodeDeadline,
            showTransferCodeInput: true,
            buttons: [
                { action: "submitTransferCode", label: "Soumettre le code" }
            ]
        };
    }

    if (state === 5) {
        const confirmDeadlineActive =
            isDeadlineActive(
                details.confirmCodeDeadline,
                currentBlockchainTime,
                details.confirmCodeDeadlineActive
            );

        const verificationWindowExpired =
            isDeadlineExpired(
                details.noBuyerResponseVerificationDeadline,
                currentBlockchainTime
            );

        if (confirmDeadlineActive) {
            return {
                title: "En attente de l'acheteur",
                description: "Vous avez soumis le code. L'acheteur doit maintenant le confirmer ou le rejeter.",
                deadline: details.confirmCodeDeadline,
                showTransferCode: true
            };
        }

        if (verificationWindowExpired) {
            return {
                title: "Délai de vérification expiré",
                description: "L'acheteur n'a pas répondu et aucune vérification n'a été demandée dans le délai prévu. Le vendeur ou l'acheteur peut annuler la vente.",
                buttons: [
                    {
                        action: "cancelAfterConfirmAndVerificationDeadline",
                        label: "Annuler la vente",
                        variant: "danger"
                    }
                ]
            };
        }

        return {
            title: "Demander la vérification du code",
            description: "L'acheteur n'a pas répondu. Vous pouvez demander une vérification par l'intermédiaire.",
            deadline: details.noBuyerResponseVerificationDeadline,
            showTransferCode: true,
            buttons: [
                { action: "requestVerification", label: "Demander la vérification" }
            ]
        };
    }

    if (state === 6) {
        return {
            title: "En attente du retrait",
            description: "La vente est confirmée. L'acheteur doit maintenant demander le retrait du véhicule."
        };
    }

    if (state === 7) {
        return {
            title: "Vente terminée",
            description: "La vente est terminée et le véhicule a été remis à l'acheteur."
        };
    }

    if (state === 8) {
        if (details.recoveryRequired && !details.recoveryRequested) {
            return {
                title: "Récupérer le véhicule",
                description: "La vente est annulée. Vous devez demander la récupération du véhicule.",
                buttons: [
                    { action: "requestVehicleRecovery", label: "Demander la récupération" }
                ]
            };
        }

        if (details.recoveryRequired && details.recoveryRequested) {
            return {
                title: "En attente de l'intermédiaire",
                description: "L'intermédiaire doit confirmer la restitution du véhicule."
            };
        }

        return {
            title: "Vente annulée",
            description: "La vente a été annulée."
        };
    }

    if (state === 9) {
        if (details.verificationRequested) {
            return {
                title: "En attente de l'intermédiaire",
                description: "L'intermédiaire doit maintenant résoudre le litige.",
                showTransferCode: true
            };
        }

        if (details.disputeReason === 1) {
            const verificationDeadlineExpired =
                isDeadlineExpired(
                    details.verificationRequestDeadline,
                    currentBlockchainTime
                );

            if (verificationDeadlineExpired) {
                return {
                    title: "Délai de vérification expiré",
                    description: "Le vendeur n'a pas demandé la vérification dans le délai prévu. Le vendeur ou l'acheteur peut annuler la vente.",
                    buttons: [
                        {
                            action: "cancelAfterVerificationRequestDeadline",
                            label: "Annuler la vente",
                            variant: "danger"
                        }
                    ]
                };
            }

            return {
                title: "Demander la vérification du code",
                description: "L'acheteur a rejeté le code. Vous pouvez demander sa vérification.",
                deadline: details.verificationRequestDeadline,
                showTransferCode: true,
                buttons: [
                    { action: "requestVerification", label: "Demander la vérification" }
                ]
            };
        }

        return {
            title: "Litige en cours",
            description: "La vente est actuellement en litige."
        };
    }

    return {
        title: "Aucune action disponible",
        description: "Aucune action n'est actuellement disponible."
    };
}

function getBuyerAction(
    details: EscrowSaleDetails,
    currentBlockchainTime: number | null
): RequiredAction {
    const state = details.state;

    if (state === 0 || state === 2) {
        return {
            title: "Financer la vente",
            description: `Vous allez déposer ${formatUnits(details.vehiclePrice, 6)} EURC pour le véhicule et ${formatUnits(details.cancellationFee, 6)} EURC de garantie, soit ${formatUnits(details.vehiclePrice + details.cancellationFee, 6)} EURC au total.`,
            buttons: [
                { action: "fundVehiclePrice", label: "Financer la vente" },
                { action: "cancelBeforeVehicleDeposit", label: "Annuler la vente", variant: "danger" }
            ]
        };
    }

    if (state === 1) {
        return {
            title: "En attente du vendeur",
            description: "Vous avez financé la vente. Le vendeur doit maintenant déposer le NFT.",
            buttons: [
                { action: "cancelBeforeVehicleDeposit", label: "Annuler la vente", variant: "danger" }
            ]
        };
    }

    if (state === 3) {
        return {
            title: details.depositRequested
                ? "En attente de l'intermédiaire"
                : "En attente du vendeur",
            description: details.depositRequested
                ? "L'intermédiaire doit confirmer la réception physique du véhicule."
                : "Le vendeur doit demander le dépôt physique du véhicule.",
            buttons: [
                { action: "cancelBeforeVehicleDeposit", label: "Annuler la vente", variant: "danger" }
            ]
        };
    }

    if (state === 4) {
        const transferDeadlineExpired =
            isDeadlineExpired(
                details.transferCodeDeadline,
                currentBlockchainTime
            );

        if (transferDeadlineExpired) {
            return {
                title: "Délai du vendeur expiré",
                description: "Le vendeur n'a pas soumis le code dans le délai prévu. Vous pouvez annuler la vente.",
                buttons: [
                    { action: "cancelAfterTransferCodeDeadline", label: "Annuler la vente", variant: "danger" }
                ]
            };
        }

        return {
            title: "En attente du vendeur",
            description: "Le vendeur doit soumettre le code de transfert.",
            deadline: details.transferCodeDeadline
        };
    }

    if (state === 5) {
        const confirmDeadlineActive =
            isDeadlineActive(
                details.confirmCodeDeadline,
                currentBlockchainTime,
                details.confirmCodeDeadlineActive
            );

        const verificationWindowExpired =
            isDeadlineExpired(
                details.noBuyerResponseVerificationDeadline,
                currentBlockchainTime
            );

        if (confirmDeadlineActive) {
            return {
                title: "Vérifier le code de transfert",
                description: "Vérifiez le code communiqué par le vendeur puis confirmez-le ou rejetez-le.",
                deadline: details.confirmCodeDeadline,
                showTransferCode: true,
                buttons: [
                    { action: "confirmTransferCode", label: "Confirmer le code" },
                    { action: "rejectTransferCode", label: "Rejeter le code", variant: "danger" }
                ]
            };
        }

        if (verificationWindowExpired) {
            return {
                title: "Délai de vérification expiré",
                description: "Vous n'avez pas répondu et le vendeur n'a pas demandé de vérification dans le délai prévu. Vous pouvez annuler la vente.",
                buttons: [
                    {
                        action: "cancelAfterConfirmAndVerificationDeadline",
                        label: "Annuler la vente",
                        variant: "danger"
                    }
                ]
            };
        }

        return {
            title: "Délai de confirmation expiré",
            description: "Le délai de confirmation est expiré. Le vendeur peut encore demander une vérification par l'intermédiaire.",
            deadline: details.noBuyerResponseVerificationDeadline
        };
    }

    if (state === 6) {
        if (!details.pickupRequested) {
            return {
                title: "Récupérer le véhicule",
                description: `La vente est confirmée. Demandez maintenant le retrait physique du véhicule. Cette demande entraîne le paiement de ${formatUnits(details.pickupFee, 6)} EURC de frais de retrait.`,
                showTransferCode: true,
                buttons: [
                    { action: "requestVehiclePickup", label: "Demander le retrait" }
                ]
            };
        }

        return {
            title: "En attente de l'intermédiaire",
            description: "Votre demande de retrait a été envoyée. L'intermédiaire doit confirmer la remise.",
            showTransferCode: true
        };
    }

    if (state === 7) {
        return {
            title: "Vente terminée",
            description: "Le véhicule vous a été remis et la vente est terminée."
        };
    }

    if (state === 8) {
        return {
            title: "Vente annulée",
            description: "Cette vente a été annulée."
        };
    }

    if (state === 9) {
        if (details.verificationRequested) {
            return {
                title: "En attente de l'intermédiaire",
                description: "Une vérification a été demandée. L'intermédiaire doit résoudre le litige."
            };
        }

        if (details.disputeReason === 1) {
            const verificationDeadlineExpired =
                isDeadlineExpired(
                    details.verificationRequestDeadline,
                    currentBlockchainTime
                );

            if (verificationDeadlineExpired) {
                return {
                    title: "Délai de vérification expiré",
                    description: "Le vendeur n'a pas demandé de vérification dans le délai prévu. Vous pouvez annuler la vente.",
                    buttons: [
                        {
                            action: "cancelAfterVerificationRequestDeadline",
                            label: "Annuler la vente",
                            variant: "danger"
                        }
                    ]
                };
            }

            return {
                title: "En attente du vendeur",
                description: "Vous avez rejeté le code. Le vendeur peut encore demander sa vérification.",
                deadline: details.verificationRequestDeadline
            };
        }

        return {
            title: "Litige en cours",
            description: "La vente est actuellement en litige."
        };
    }

    return {
        title: "Aucune action disponible",
        description: "Aucune action n'est actuellement disponible."
    };
}

function getIntermediaryAction(
    details: EscrowSaleDetails,
    currentBlockchainTime: number | null
): RequiredAction {
    const state = details.state;

    if (state === 0 || state === 1 || state === 2) {
        return {
            title: "En attente des participants",
            description: "Le vendeur et l'acheteur doivent d'abord déposer leurs actifs."
        };
    }

    if (state === 3) {
        if (details.depositRequested) {
            return {
                title: "Confirmer le dépôt du véhicule",
                description: "Confirmez uniquement après avoir effectivement reçu le véhicule.",
                buttons: [
                    { action: "confirmVehicleDeposit", label: "Confirmer la réception" }
                ]
            };
        }

        return {
            title: "En attente du vendeur",
            description: "Le vendeur doit demander le dépôt physique du véhicule."
        };
    }

    if (state === 4) {
        const transferDeadlineExpired =
            isDeadlineExpired(
                details.transferCodeDeadline,
                currentBlockchainTime
            );

        return transferDeadlineExpired
            ? {
                title: "Délai de soumission expiré",
                description: "Le vendeur n'a pas soumis le code dans le délai prévu. Le vendeur ou l'acheteur peut maintenant annuler la vente."
            }
            : {
                title: "En attente du vendeur",
                description: "Le vendeur doit soumettre le code de transfert.",
                deadline: details.transferCodeDeadline
            };
    }

    if (state === 5) {
        const confirmDeadlineActive =
            isDeadlineActive(
                details.confirmCodeDeadline,
                currentBlockchainTime,
                details.confirmCodeDeadlineActive
            );

        const verificationWindowExpired =
            isDeadlineExpired(
                details.noBuyerResponseVerificationDeadline,
                currentBlockchainTime
            );

        if (confirmDeadlineActive) {
            return {
                title: "En attente de l'acheteur",
                description: "Le code a été soumis. L'acheteur doit le confirmer ou le rejeter.",
                deadline: details.confirmCodeDeadline
            };
        }

        if (verificationWindowExpired) {
            return {
                title: "Délai de vérification expiré",
                description: "Aucune vérification n'a été demandée dans le délai prévu. Le vendeur ou l'acheteur peut maintenant annuler la vente."
            };
        }

        return {
            title: "En attente du vendeur",
            description: "Le délai de confirmation de l'acheteur est expiré. Le vendeur peut encore demander une vérification.",
            deadline: details.noBuyerResponseVerificationDeadline
        };
    }

    if (state === 6) {
        if (details.pickupRequested) {
            return {
                title: "Confirmer la remise du véhicule",
                description: "Confirmez uniquement après avoir effectivement remis le véhicule à l'acheteur.",
                buttons: [
                    { action: "confirmVehiclePickup", label: "Confirmer la remise" }
                ]
            };
        }

        return {
            title: "En attente de l'acheteur",
            description: "L'acheteur doit demander le retrait du véhicule."
        };
    }

    if (state === 7) {
        return {
            title: "Vente terminée",
            description: "La vente est terminée."
        };
    }

    if (state === 8) {
        if (
            details.recoveryRequired &&
            details.recoveryRequested
        ) {
            return {
                title: "Confirmer la récupération du véhicule",
                description: "Confirmez uniquement après avoir restitué le véhicule au vendeur.",
                buttons: [
                    { action: "confirmVehicleRecovered", label: "Confirmer la restitution" }
                ]
            };
        }

        if (details.recoveryRequired) {
            return {
                title: "En attente du vendeur",
                description: "Le vendeur doit demander la récupération du véhicule."
            };
        }

        return {
            title: "Vente annulée",
            description: "Cette vente a été annulée."
        };
    }

    if (state === 9) {
        if (details.verificationRequested) {
            return {
                title: "Résoudre le litige",
                description: "Vérifiez le code. Vous pouvez valider le code original, saisir un code corrigé ou constater qu'aucun code valide n'existe.",
                showTransferCode: true,
                showCorrectedCodeInput: true,
                buttons: [
                    { action: "resolveOriginalCode", label: "Code original valide" },
                    { action: "resolveCorrectedCode", label: "Valider le code corrigé", variant: "secondary" },
                    { action: "resolveNoValidCode", label: "Aucun code valide", variant: "danger" }
                ]
            };
        }

        if (details.disputeReason === 1) {
            const verificationDeadlineExpired =
                isDeadlineExpired(
                    details.verificationRequestDeadline,
                    currentBlockchainTime
                );

            return verificationDeadlineExpired
                ? {
                    title: "Délai de vérification expiré",
                    description: "Le vendeur n'a pas demandé de vérification dans le délai prévu. Le vendeur ou l'acheteur peut maintenant annuler la vente."
                }
                : {
                    title: "En attente du vendeur",
                    description: "Le vendeur doit demander la vérification avant que vous puissiez intervenir.",
                    deadline: details.verificationRequestDeadline,
                    showTransferCode: true
                };
        }

        return {
            title: "Litige en cours",
            description: "La vente est actuellement en litige.",
            showTransferCode: true
        };
    }

    return {
        title: "Aucune action disponible",
        description: "Aucune action n'est actuellement disponible."
    };
}

function getRequiredAction(
    role: EscrowRole,
    details: EscrowSaleDetails,
    currentBlockchainTime: number | null
) {
    if (role === "seller") {
        return getSellerAction(
            details,
            currentBlockchainTime
        );
    }

    if (role === "buyer") {
        return getBuyerAction(
            details,
            currentBlockchainTime
        );
    }

    return getIntermediaryAction(
        details,
        currentBlockchainTime
    );
}

function getWorkflowStatus(
    step: number,
    details: EscrowSaleDetails,
    cancelledWorkflowProgress: number
): "completed" | "current" | "future" {
    const state = details.state;

    if (state === 8) {
        if (step === 0) {
            return "completed";
        }

        if (step === 1) {
            return cancelledWorkflowProgress === 1 ||
                cancelledWorkflowProgress >= 3
                ? "completed"
                : "future";
        }

        if (step === 2) {
            return cancelledWorkflowProgress === 2 ||
                cancelledWorkflowProgress >= 3
                ? "completed"
                : "future";
        }

        if (step === 3) {
            return cancelledWorkflowProgress >= 3
                ? "completed"
                : "future";
        }

        if (step === 4) {
            return cancelledWorkflowProgress >= 4
                ? "completed"
                : "future";
        }

        if (step === 5) {
            return cancelledWorkflowProgress >= 5
                ? "completed"
                : "future";
        }

        if (step === 6) {
            return cancelledWorkflowProgress >= 6
                ? "completed"
                : "future";
        }

        if (step === 7) {
            return cancelledWorkflowProgress >= 7
                ? "completed"
                : "future";
        }

        return "future";
    }

    if (step === 0) {
        if (state === 0) return "current";

        return "completed";
    }

    if (step === 1) {
        if (state === 1) return "current";
        if (state === 2 && !details.vehiclePriceFunded) return "future";
        if ((state >= 3 && state <= 7) || details.vehiclePriceFunded) return "completed";

        return "future";
    }

    if (step === 2) {
        if (state === 2) return "current";
        if (state === 1 && !details.nftDeposited) return "future";
        if ((state >= 3 && state <= 7) || details.nftDeposited) return "completed";

        return "future";
    }

    if (step === 3) {
        if (state === 3) return "current";
        if ((state >= 4 && state <= 7) || state === 9) return "completed";

        return "future";
    }

    if (step === 4) {
        if (state === 4) return "current";
        if ((state >= 5 && state <= 7) || state === 9) return "completed";

        return "future";
    }

    if (step === 5) {
        if (state === 5) return "current";
        if (state === 6 || state === 7 || state === 9) return "completed";

        return "future";
    }

    if (step === 6) {
        if (state === 6) return "current";
        if (state === 7) return "completed";

        return "future";
    }

    if (step === 7) {
        return state === 7
            ? "current"
            : "future";
    }

    return "future";
}

export default function EscrowPage() {
    const params = useParams<{ id: string }>();
    const vehicleTokenId = BigInt(params.id);

    const { address, isConnected } = useAppKitAccount();
    const { mutateAsync } = useWriteContract();

    const [escrowAddress, setEscrowAddress] = useState<Address>();
    const [escrowAddressLoading, setEscrowAddressLoading] = useState(true);
    const [escrowAddressError, setEscrowAddressError] = useState<string | null>(null);

    const [pending, setPending] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [transactionError, setTransactionError] = useState<string | null>(null);
    const [transactionStatus, setTransactionStatus] = useState<string | null>(null);

    const [transferCode, setTransferCode] = useState("");
    const [correctedTransferCode, setCorrectedTransferCode] = useState("");

    const [blockchainTimeReference, setBlockchainTimeReference] = useState<{
        blockTimestamp: number;
        localTimestamp: number;
    } | null>(null);

    const [clockTick, setClockTick] = useState(0);

    const [
        cancelledWorkflowProgress,
        setCancelledWorkflowProgress
    ] = useState(0);

    useEffect(() => {
        let cancelled = false;

        async function initializeBlockchainClock() {
            try {
                const block = await publicClient.getBlock();

                if (cancelled) {
                    return;
                }

                setBlockchainTimeReference({
                    blockTimestamp: Number(block.timestamp),
                    localTimestamp: Date.now()
                });
            } catch (err) {
                console.error(
                    "Impossible de récupérer le timestamp blockchain :",
                    err
                );
            }
        }

        initializeBlockchainClock();

        const interval = window.setInterval(() => {
            setClockTick((value) => value + 1);
        }, 1000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        setEscrowAddressLoading(true);
        setEscrowAddressError(null);

        const storedEscrow = sessionStorage.getItem(`escrow-${vehicleTokenId.toString()}`);

        if (!storedEscrow || !/^0x[a-fA-F0-9]{40}$/.test(storedEscrow)) {
            setEscrowAddress(undefined);
            setEscrowAddressError("Impossible de trouver l'escrow associé à cette vente.");
            setEscrowAddressLoading(false);
            return;
        }

        setEscrowAddress(storedEscrow as Address);
        setEscrowAddressLoading(false);
    }, [vehicleTokenId]);

    const {
        details,
        loading: detailsLoading,
        error: detailsError,
        refetch
    } = useEscrowSale(escrowAddress);

    useEffect(() => {
        if (
            !escrowAddress ||
            !details
        ) {
            return;
        }

        const storageKey =
            getWorkflowProgressStorageKey(
                escrowAddress
            );

        if (details.state !== 8) {
            const currentProgress =
                normalizeWorkflowProgressState(
                    details.state
                );

            saveWorkflowProgress(
                escrowAddress,
                currentProgress
            );

            setCancelledWorkflowProgress(
                currentProgress
            );

            return;
        }

        const storedValue =
            localStorage.getItem(
                storageKey
            );

        if (
            storedValue !== null &&
            /^\d+$/.test(storedValue)
        ) {
            setCancelledWorkflowProgress(
                Math.min(
                    7,
                    Number(storedValue)
                )
            );

            return;
        }

        const inferredProgress =
            inferCancelledWorkflowProgress(
                details
            );

        setCancelledWorkflowProgress(
            inferredProgress
        );

        localStorage.setItem(
            storageKey,
            inferredProgress.toString()
        );
    }, [
        escrowAddress,
        details
    ]);

    async function waitTransaction(
        hash: Hex,
        message: string
    ) {
        setTransactionStatus(message);

        const receipt =
            await publicClient.waitForTransactionReceipt({
                hash
            });

        if (receipt.status !== "success") {
            throw new Error(
                "La transaction a échoué sur la blockchain."
            );
        }

        await waitForRpcBlock(receipt.blockNumber);

        return receipt;
    }

    async function ensureERC20Allowance(
        requiredAllowance: bigint
    ) {
        if (
            !address ||
            !escrowAddress ||
            !details
        ) {
            throw new Error(
                "Informations de la vente indisponibles."
            );
        }

        const allowance =
            await publicClient.readContract({
                address: details.tokenERC20,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [
                    address as Address,
                    escrowAddress
                ]
            });

        if (allowance >= requiredAllowance) {
            return;
        }

        const approveHash =
            await mutateAsync({
                address: details.tokenERC20,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [
                    escrowAddress,
                    requiredAllowance
                ]
            });

        await waitTransaction(
            approveHash,
            "Autorisation du token EURC..."
        );
    }

    async function ensureNFTApproval() {
        if (!escrowAddress || !details) {
            throw new Error(
                "Informations de la vente indisponibles."
            );
        }

        const approvedAddress =
            await publicClient.readContract({
                address: details.vehicleNFT,
                abi: ERC721_ABI,
                functionName: "getApproved",
                args: [details.vehicleTokenId]
            });

        if (
            approvedAddress.toLowerCase() ===
            escrowAddress.toLowerCase()
        ) {
            return;
        }

        const approveHash =
            await mutateAsync({
                address: details.vehicleNFT,
                abi: ERC721_ABI,
                functionName: "approve",
                args: [
                    escrowAddress,
                    details.vehicleTokenId
                ]
            });

        await waitTransaction(
            approveHash,
            "Autorisation du NFT..."
        );
    }

    async function sendContractTransaction(
        functionName: string,
        args?: readonly unknown[]
    ) {
        if (!escrowAddress) {
            throw new Error(
                "Escrow introuvable."
            );
        }

        return await mutateAsync({
            address: escrowAddress,
            abi: ESCROW_ABI,
            functionName,
            ...(args ? { args } : {})
        } as Parameters<typeof mutateAsync>[0]);
    }

    async function handleAction(
        action: EscrowAction
    ) {
        if (
            !escrowAddress ||
            !details ||
            !address
        ) {
            return;
        }

        try {
            setPending(true);
            setTransactionError(null);
            setTransactionStatus(null);

            if (action === "depositNFT") {
                const sellerTotalAllowance =
                    details.cancellationFee +
                    details.depositFee;

                await ensureERC20Allowance(
                    sellerTotalAllowance
                );

                await ensureNFTApproval();

                const hash =
                    await sendContractTransaction(
                        "depositVehicleNFT"
                    );
                await waitTransaction(hash, "Dépôt du NFT dans l'escrow...");
            }

            if (action === "fundVehiclePrice") {
                const buyerTotalAllowance =
                    details.vehiclePrice +
                    details.cancellationFee +
                    details.pickupFee;

                await ensureERC20Allowance(
                    buyerTotalAllowance
                );

                const hash =
                    await sendContractTransaction(
                        "fundVehiclePrice"
                    );
                await waitTransaction(hash, "Financement de la vente...");
            }

            if (action === "requestVehicleDeposit") {
                await ensureERC20Allowance(
                    details.depositFee
                );

                const hash =
                    await sendContractTransaction(
                        "requestVehicleDeposit"
                    );
                await waitTransaction(hash, "Demande de dépôt du véhicule...");
            }

            if (action === "confirmVehicleDeposit") {
                const hash =
                    await sendContractTransaction(
                        "confirmVehicleDeposit"
                    );
                await waitTransaction(hash, "Confirmation du dépôt du véhicule...");
            }

            if (action === "submitTransferCode") {
                const normalizedCode =
                    normalizeTransferCode(
                        transferCode
                    );

                if (!normalizedCode) {
                    setValidationError(
                        "Veuillez saisir un code de transfert valide."
                    );
                    return;
                }

                setValidationError(null);

                const {
                    codeBytes,
                    codeHash
                } = prepareTransferCode(
                    normalizedCode
                );

                const hash =
                    await sendContractTransaction(
                        "submitEncryptedTransferCode",
                        [
                            codeBytes,
                            codeHash
                        ]
                    );

                await waitTransaction(
                    hash,
                    "Soumission du code de transfert..."
                );

                setTransferCode("");
            }

            if (action === "confirmTransferCode") {
                const hash =
                    await sendContractTransaction(
                        "confirmTransferCode"
                    );
                await waitTransaction(hash, "Confirmation du code de transfert...");
            }

            if (action === "rejectTransferCode") {
                const hash =
                    await sendContractTransaction(
                        "rejectTransferCode"
                    );
                await waitTransaction(hash, "Rejet du code de transfert...");
            }

            if (action === "requestVerification") {
                const hash =
                    await sendContractTransaction(
                        "requestTransferCodeVerification"
                    );
                await waitTransaction(hash, "Demande de vérification du code...");
            }

            if (action === "requestVehiclePickup") {
                await ensureERC20Allowance(
                    details.pickupFee
                );

                const hash =
                    await sendContractTransaction(
                        "requestVehiclePickup"
                    );
                await waitTransaction(hash, "Demande de retrait du véhicule...");
            }

            if (action === "confirmVehiclePickup") {
                const hash =
                    await sendContractTransaction(
                        "confirmVehiclePickup"
                    );
                await waitTransaction(hash, "Confirmation de la remise du véhicule...");
            }

            if (action === "requestVehicleRecovery") {
                const hash =
                    await sendContractTransaction(
                        "requestVehicleRecovery"
                    );
                await waitTransaction(hash, "Demande de récupération du véhicule...");
            }

            if (action === "confirmVehicleRecovered") {
                const hash =
                    await sendContractTransaction(
                        "confirmVehicleRecovered"
                    );
                await waitTransaction(hash, "Confirmation de la restitution du véhicule...");
            }

            if (action === "resolveOriginalCode") {
                if (!details.transferCodeHash) {
                    throw new Error(
                        "Hash du code introuvable."
                    );
                }

                const hash =
                    await sendContractTransaction(
                        "resolveWithOriginalCode",
                        [
                            details.transferCodeHash
                        ]
                    );
                await waitTransaction(hash, "Validation du code original...");
            }

            if (action === "resolveCorrectedCode") {
                const normalizedCorrectedCode =
                    normalizeTransferCode(
                        correctedTransferCode
                    );

                if (!normalizedCorrectedCode) {
                    setValidationError(
                        "Veuillez saisir un code corrigé valide."
                    );
                    return;
                }

                setValidationError(null);

                const {
                    codeBytes,
                    codeHash
                } = prepareTransferCode(
                    normalizedCorrectedCode
                );

                const hash =
                    await sendContractTransaction(
                        "resolveWithCorrectedCode",
                        [
                            codeBytes,
                            codeHash
                        ]
                    );

                await waitTransaction(
                    hash,
                    "Validation du code corrigé..."
                );

                setCorrectedTransferCode("");
            }

            if (action === "resolveNoValidCode") {
                const hash =
                    await sendContractTransaction(
                        "resolveWithNoValidCode"
                    );
                await waitTransaction(hash, "Résolution du litige...");
            }

            if (
                action === "cancelBeforeVehicleDeposit" ||
                action === "cancelAfterTransferCodeDeadline" ||
                action === "cancelAfterConfirmAndVerificationDeadline" ||
                action === "cancelAfterVerificationRequestDeadline" ||
                action === "resolveNoValidCode"
            ) {
                saveWorkflowProgress(
                    escrowAddress,
                    details.state
                );
            }

            if (action === "cancelBeforeVehicleDeposit") {
                const hash =
                    await sendContractTransaction(
                        "cancelBeforeVehicleDeposit"
                    );
                await waitTransaction(hash, "Annulation de la vente...");
            }

            if (action === "cancelAfterTransferCodeDeadline") {
                const hash =
                    await sendContractTransaction(
                        "cancelAfterTransferCodeDeadline"
                    );
                await waitTransaction(hash, "Annulation de la vente...");
            }

            if (
                action ===
                "cancelAfterConfirmAndVerificationDeadline"
            ) {
                const hash =
                    await sendContractTransaction(
                        "cancelAfterConfirmAndVerificationCodeDeadline"
                    );
                await waitTransaction(hash, "Annulation de la vente...");
            }

            if (
                action ===
                "cancelAfterVerificationRequestDeadline"
            ) {
                const hash =
                    await sendContractTransaction(
                        "cancelAfterVerificationRequestDeadline"
                    );
                await waitTransaction(hash, "Annulation de la vente...");
            }

            await refetch();

            setTransactionStatus(null);
        } catch (err) {
            if (isUserRejectedError(err)) {
                setTransactionError(
                    "La transaction a été refusée ou n’a pas pu être envoyée."
                );
                setTransactionStatus(null);
                return;
            }

            console.error(
                "Erreur lors de la transaction :",
                err
            );

            setTransactionError(
                err instanceof Error
                    ? err.message
                    : "La transaction a échoué."
            );

            setTransactionStatus(null);
        } finally {
            setPending(false);
        }
    }

    if (!isConnected) {
        return null;
    }

    if (
        escrowAddressLoading ||
        detailsLoading
    ) {
        return (
            <PageMessage>
                Chargement de la vente...
            </PageMessage>
        );
    }

    if (
        escrowAddressError ||
        detailsError
    ) {
        return (
            <PageMessage>
                {escrowAddressError ??
                    detailsError}
            </PageMessage>
        );
    }

    if (
        !escrowAddress ||
        !details
    ) {
        return (
            <PageMessage>
                Vente introuvable.
            </PageMessage>
        );
    }

    const role =
        getRole(
            address as Address | undefined,
            details
        );

    if (!role) {
        return (
            <PageMessage>
                Cette adresse ne participe pas à cette vente.
            </PageMessage>
        );
    }

    const currentBlockchainTime =
        blockchainTimeReference
            ? blockchainTimeReference.blockTimestamp +
            Math.floor(
                (Date.now() -
                    blockchainTimeReference.localTimestamp) /
                1000
            )
            : null;

    const requiredAction =
        getRequiredAction(
            role,
            details,
            currentBlockchainTime
        );

    const buyerCanSeeTransferCode =
        role !== "buyer" ||
        details.state === 6 ||
        (
            details.state === 5 &&
            isDeadlineActive(
                details.confirmCodeDeadline,
                currentBlockchainTime,
                details.confirmCodeDeadlineActive
            )
        );

    void clockTick;

    let displayedTransferCode = "";

    if (details.encryptedTransferCode) {
        try {
            displayedTransferCode =
                hexToString(
                    details.encryptedTransferCode
                );
        } catch {
            displayedTransferCode =
                "Code illisible";
        }
    }

    const normalizedCorrectedCode =
        normalizeTransferCode(
            correctedTransferCode
        );

    let correctedCodeDiffersFromOriginal = false;

    if (
        normalizedCorrectedCode &&
        details.transferCodeHash
    ) {
        const {
            codeHash: correctedCodeHash
        } = prepareTransferCode(
            normalizedCorrectedCode
        );

        correctedCodeDiffersFromOriginal =
            correctedCodeHash.toLowerCase() !==
            details.transferCodeHash.toLowerCase();
    }

    return (
        <main className="min-h-screen bg-[#080b0e] px-6 py-14 text-white">
            <div className="mx-auto w-full max-w-6xl">

                <Link
                    href="/dashboard"
                    className="text-sm text-[#9eabbc] transition hover:text-white"
                >
                    ← Retour au tableau de bord
                </Link>

                <section className="mt-8">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#ef4444]">
                        Gestion de la vente
                    </p>

                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                        <div>
                            <h1 className="text-4xl font-bold">
                                Vente #{details.vehicleTokenId.toString()}
                            </h1>

                            <p className="mt-3 font-mono text-sm text-[#9eabbc]">
                                Escrow {shortenAddress(escrowAddress)}
                            </p>
                        </div>

                        <div className="w-fit rounded-xl border border-[#3d454f] bg-[#171c21] px-4 py-2">
                            <p className="text-xs uppercase tracking-wide text-[#7f8b99]">
                                Statut
                            </p>

                            <p className="mt-1 font-semibold">
                                {stateLabels[details.state] ?? "Inconnu"}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="mt-10 grid gap-4 md:grid-cols-3">
                    <InfoCard
                        label="Prix du véhicule"
                        value={`${formatUnits(details.vehiclePrice, 6)} EURC`}
                    />

                    <InfoCard
                        label="NFT"
                        value={`Vehicle NFT #${details.vehicleTokenId.toString()}`}
                    />

                    <InfoCard
                        label="Votre rôle"
                        value={roleLabels[role]}
                    />
                </section>

                <section className="mt-8 rounded-2xl border border-[#2a3037] bg-[#11161b] p-6">
                    <h2 className="text-xl font-bold">
                        Progression de la vente
                    </h2>

                    <p className="mt-2 text-sm text-[#9eabbc]">
                        Suivez l'état actuel du contrat d'escrow.
                    </p>

                    <div className="mt-8 grid gap-3 md:grid-cols-4">
                        <WorkflowStep
                            number="1"
                            label="Créée"
                            status={getWorkflowStatus(0, details, cancelledWorkflowProgress)}
                        />

                        <WorkflowStep
                            number="2"
                            label="Financée"
                            status={getWorkflowStatus(1, details, cancelledWorkflowProgress)}
                        />

                        <WorkflowStep
                            number="3"
                            label="NFT déposé"
                            status={getWorkflowStatus(2, details, cancelledWorkflowProgress)}
                        />

                        <WorkflowStep
                            number="4"
                            label="Actifs déposés"
                            status={getWorkflowStatus(3, details, cancelledWorkflowProgress)}
                        />

                        <WorkflowStep
                            number="5"
                            label="Prête"
                            status={getWorkflowStatus(4, details, cancelledWorkflowProgress)}
                        />

                        <WorkflowStep
                            number="6"
                            label="Code soumis"
                            status={getWorkflowStatus(5, details, cancelledWorkflowProgress)}
                        />

                        <WorkflowStep
                            number="7"
                            label="Vente confirmée"
                            status={getWorkflowStatus(6, details, cancelledWorkflowProgress)}
                        />

                        <WorkflowStep
                            number="8"
                            label="Terminée"
                            status={getWorkflowStatus(7, details, cancelledWorkflowProgress)}
                        />
                    </div>

                    <div className="mt-6 border-t border-[#2a3037] pt-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7f8b99]">
                            États alternatifs
                        </p>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <AlternativeState
                                label="Annulée"
                                active={details.state === 8}
                                variant="cancelled"
                            />

                            <AlternativeState
                                label="Litige"
                                active={details.state === 9}
                                variant="dispute"
                            />
                        </div>
                    </div>
                </section>

                <section
                    onClick={() => {
                        setTransactionError(null);
                        setTransactionStatus(null);
                    }}
                    className="mt-8 rounded-2xl border border-[#4b3033] bg-[#171113] p-6"
                >
                    <div className="flex items-start justify-between gap-8">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                                {requiredAction.buttons?.length
                                    ? "Action requise"
                                    : "Situation actuelle"}
                            </p>

                            <h2 className="mt-3 text-2xl font-bold">
                                {requiredAction.title}
                            </h2>

                            <p className="mt-3 max-w-2xl text-[#aeb7c3]">
                                {requiredAction.description}
                            </p>
                        </div>

                        {requiredAction.deadline !== undefined &&
                            requiredAction.deadline > 0n &&
                            currentBlockchainTime !== null && (
                                <div className="shrink-0">
                                    <DeadlineCountdown
                                        deadline={requiredAction.deadline}
                                        currentTime={currentBlockchainTime}
                                    />
                                </div>
                            )}
                    </div>

                    {requiredAction.showTransferCode &&
                        buyerCanSeeTransferCode && (
                        <div className="mt-6 max-w-2xl rounded-xl border border-[#343b44] bg-[#0d1115] p-4">
                            <p className="text-sm text-[#9eabbc]">
                                Code de transfert
                            </p>

                            <p className="mt-2 font-mono text-lg">
                                {displayedTransferCode ||
                                    "Code indisponible"}
                            </p>
                        </div>
                    )}

                    {requiredAction.showTransferCodeInput && (
                        <div className="mt-6 max-w-2xl">
                            <label className="mb-2 block text-sm text-[#aeb7c3]">
                                Code de transfert
                            </label>

                            <input
                                type="text"
                                value={transferCode}
                                onFocus={() =>
                                    setValidationError(null)
                                }
                                onChange={(event) =>
                                    setTransferCode(
                                        event.target.value
                                    )
                                }
                                placeholder="Ex. ABC123XYZ"
                                className="w-full rounded-xl border border-[#343b44] bg-[#0d1115] px-4 py-3 outline-none transition focus:border-[#ef4444]"
                            />
                        </div>
                    )}

                    {requiredAction.showCorrectedCodeInput && (
                        <div className="mt-6 max-w-2xl">
                            <label className="mb-2 block text-sm text-[#aeb7c3]">
                                Code corrigé
                            </label>

                            <input
                                type="text"
                                value={correctedTransferCode}
                                onFocus={() =>
                                    setValidationError(null)
                                }
                                onChange={(event) =>
                                    setCorrectedTransferCode(
                                        event.target.value
                                    )
                                }
                                placeholder="Saisir uniquement si le code original est incorrect"
                                className="w-full rounded-xl border border-[#343b44] bg-[#0d1115] px-4 py-3 outline-none transition focus:border-[#ef4444]"
                            />
                        </div>
                    )}

                    {validationError && (
                        <p className="mt-5 text-sm text-[#ff6268]">
                            {validationError}
                        </p>
                    )}

                    {transactionStatus && (
                        <p className="mt-5 text-sm text-[#d7dde5]">
                            {transactionStatus}
                        </p>
                    )}

                    {transactionError && (
                        <p className="mt-5 text-sm text-[#ff6268]">
                            {transactionError}
                        </p>
                    )}

                    {requiredAction.buttons &&
                        requiredAction.buttons.length > 0 && (
                            <div className="mt-6 flex flex-wrap gap-3">
                                {requiredAction.buttons.map(
                                    (button) => {
                                        const originalCodeDisabled =
                                            button.action ===
                                                "resolveOriginalCode" &&
                                            correctedCodeDiffersFromOriginal;

                                        return (
                                            <button
                                                key={button.action}
                                                type="button"
                                                disabled={
                                                    pending ||
                                                    originalCodeDisabled
                                                }
                                                onClick={() =>
                                                    handleAction(
                                                        button.action
                                                    )
                                                }
                                                className={getButtonClass(
                                                    button.variant
                                                )}
                                            >
                                                {pending
                                                    ? "Transaction en cours..."
                                                    : button.label}
                                            </button>
                                        );
                                    }
                                )}
                            </div>
                        )}
                </section>

                <section className="mt-8 rounded-2xl border border-[#2a3037] bg-[#11161b] p-6">
                    <h2 className="text-xl font-bold">
                        Participants
                    </h2>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <Participant
                            role="Vendeur"
                            address={shortenAddress(details.seller)}
                            current={role === "seller"}
                        />

                        <Participant
                            role="Acheteur"
                            address={shortenAddress(details.buyer)}
                            current={role === "buyer"}
                        />

                        <Participant
                            role="Intermédiaire"
                            address={shortenAddress(details.intermediary)}
                            current={role === "intermediary"}
                        />
                    </div>
                </section>

            </div>
        </main>
    );
}

function getButtonClass(
    variant?: "primary" | "secondary" | "danger"
) {
    const common =
        "rounded-xl px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

    if (variant === "danger") {
        return `${common} border border-[#ef4444] text-[#ff6268] hover:bg-[#2a171a]`;
    }

    if (variant === "secondary") {
        return `${common} border border-[#555f6b] hover:bg-[#20262c]`;
    }

    return `${common} bg-[#cf2f37] hover:bg-[#e33a42]`;
}

function WorkflowStep({
    number,
    label,
    status
}: {
    number: string;
    label: string;
    status: "completed" | "current" | "future";
}) {
    const styles = {
        completed:
            "border-[#3d454f] bg-[#171c21] text-white",
        current:
            "border-[#315442] bg-[#141d18] text-[#83b596]",
        future:
            "border-[#252b31] bg-[#0d1115] text-[#66717e]"
    };

    return (
        <div
            className={`rounded-xl border p-4 ${styles[status]}`}
        >
            <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current text-sm font-bold">
                    {status === "completed"
                        ? "✓"
                        : number}
                </div>

                <p className="text-sm font-semibold">
                    {label}
                </p>
            </div>
        </div>
    );
}

function AlternativeState({
    label,
    active,
    variant
}: {
    label: string;
    active: boolean;
    variant: "cancelled" | "dispute";

}) {
    const activeStyle =
        variant === "cancelled"
            ? "border-[#654040] bg-[#211617] text-[#c98b8b]"
            : "border-[#66563a] bg-[#211d15] text-[#c7aa72]"

    return (
        <div
            className={
                active
                    ? `rounded-xl border p-4 ${activeStyle}`
                    : "rounded-xl border border-[#252b31] bg-[#0d1115] p-4 text-[#66717e]"
            }
        >
            {active ? "●" : "○"} {label}
        </div>
    );
}

function DeadlineCountdown({
    deadline,
    currentTime
}: {
    deadline: bigint;
    currentTime: number;
}) {
    const now = BigInt(currentTime);

    if (now > deadline) {
        return (
            <div className="mt-5 w-fit rounded-xl border border-[#654040] bg-[#211617] px-4 py-3">
                <p className="text-sm font-semibold text-[#c98b8b]">
                    Délai expiré
                </p>
            </div>
        );
    }

    const remaining = deadline - now;

    const days = remaining / 86400n;
    const hours = (remaining % 86400n) / 3600n;
    const minutes = (remaining % 3600n) / 60n;
    const seconds = remaining % 60n;

    const parts: string[] = [];

    if (days > 0n) {
        parts.push(`${days} j`);
    }

    if (hours > 0n || days > 0n) {
        parts.push(`${hours.toString().padStart(2, "0")} h`);
    }

    if (
        minutes > 0n ||
        hours > 0n ||
        days > 0n
    ) {
        parts.push(`${minutes.toString().padStart(2, "0")} min`);
    }

    parts.push(`${seconds.toString().padStart(2, "0")} s`);

    return (
        <div className="w-fit rounded-lg border border-[#26352e] bg-[#101512] px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.12em] text-[#52675c]">
                Temps restant
            </p>

            <p className="mt-1 font-mono text-sm font-medium text-[#668b76]">
                {parts.join(" ")}
            </p>
        </div>
    );
}

function InfoCard({
    label,
    value
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-[#2a3037] bg-[#11161b] p-6">
            <p className="text-sm text-[#9eabbc]">
                {label}
            </p>

            <p className="mt-2 text-xl font-bold">
                {value}
            </p>
        </div>
    );
}

function Participant({
    role,
    address,
    current = false
}: {
    role: string;
    address: string;
    current?: boolean;
}) {
    return (
        <div className="rounded-xl border border-[#2a3037] bg-[#171c21] p-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-[#9eabbc]">
                    {role}
                </p>

                {current && (
                    <span className="rounded-md bg-[#2a171a] px-2 py-1 text-xs text-[#ff6268]">
                        Vous
                    </span>
                )}
            </div>

            <p className="mt-2 font-mono text-sm">
                {address}
            </p>
        </div>
    );
}

function PageMessage({
    children
}: {
    children: ReactNode;
}) {
    return (
        <main className="min-h-screen bg-[#080b0e] px-6 py-14 text-white">
            <div className="mx-auto w-full max-w-6xl">
                <Link
                    href="/dashboard"
                    className="text-sm text-[#9eabbc] transition hover:text-white"
                >
                    ← Retour au tableau de bord
                </Link>

                <p className="mt-8 text-[#9eabbc]">
                    {children}
                </p>
            </div>
        </main>
    );
}