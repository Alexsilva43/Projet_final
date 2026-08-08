import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

async function setUpVehicleSaleEscrowContract() {
    const [
        owner,
        factory,
        seller,
        buyer,
        intermediary,
        other
    ] = await ethers.getSigners();

    const vehiclePrice = ethers.parseUnits("20000", 6);
    const depositFee = ethers.parseUnits("200", 6);
    const pickupFee = ethers.parseUnits("100", 6);
    const cancellationFee = ethers.parseUnits("500", 6);

    const vehicleTokenId = 0n;
    const mockTokenERC20 = await ethers.deployContract("MockTokenERC20", [], other) as any;
    const mockFactory = await ethers.deployContract("MockFactory", [], owner) as any;
    const vehicleNFT = await ethers.deployContract("VehicleNFT", [], owner);
    await vehicleNFT.connect(owner).setFactory(await mockFactory.getAddress());
    await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller.address);

    const vehicleSaleEscrow = await ethers.deployContract(
        "VehicleSaleEscrow",
        [
            seller.address,
            buyer.address,
            intermediary.address,
            await mockTokenERC20.getAddress(),
            await vehicleNFT.getAddress(),
            vehicleTokenId,
            vehiclePrice,
            depositFee,
            pickupFee,
            cancellationFee
        ],
        factory
    );

    await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(),  vehicleTokenId, await vehicleSaleEscrow.getAddress());
    await vehicleNFT.connect(seller).approve(await vehicleSaleEscrow.getAddress(), vehicleTokenId);
    await mockTokenERC20.mint(buyer.address, vehiclePrice + cancellationFee + pickupFee);
    await mockTokenERC20.mint(seller.address, depositFee + cancellationFee);
    await mockTokenERC20.connect(buyer).approve(await vehicleSaleEscrow.getAddress(), vehiclePrice + cancellationFee + pickupFee);
    await mockTokenERC20.connect(seller).approve(await vehicleSaleEscrow.getAddress(), depositFee + cancellationFee);

    return {
        vehicleSaleEscrow,
        mockTokenERC20,
        vehicleNFT,
        seller,
        buyer,
        intermediary,
        other,
        vehicleTokenId,
        vehiclePrice,
        depositFee,
        pickupFee,
        cancellationFee
    };
}

describe("VehicleSaleEscrow", function () {
    let vehicleSaleEscrow: any;
    let mockTokenERC20: any;
    let vehicleNFT: any;
    let seller: any;
    let buyer: any;
    let intermediary: any;
    let other: any;
    let vehicleTokenId: bigint;
    let vehiclePrice: bigint;
    let depositFee: bigint;
    let pickupFee: bigint;
    let cancellationFee: bigint;

    beforeEach(async function () {
        ({
            vehicleSaleEscrow,
            mockTokenERC20,
            vehicleNFT,
            seller,
            buyer,
            intermediary,
            other,
            vehicleTokenId,
            vehiclePrice,
            depositFee,
            pickupFee,
            cancellationFee
        } = await setUpVehicleSaleEscrowContract());
    });

    async function reachAssetsDepositedState() {
        await vehicleSaleEscrow.connect(buyer).fundVehiclePrice();
        await vehicleSaleEscrow.connect(seller).depositVehicleNFT();
    }

    async function reachReadyState() {
        await reachAssetsDepositedState();
        await vehicleSaleEscrow.connect(seller).requestVehicleDeposit();
        await vehicleSaleEscrow.connect(intermediary).confirmVehicleDeposit();
    }

    async function reachSubmittedState() {
        await reachReadyState();
        const encryptedCode = ethers.hexlify(ethers.toUtf8Bytes("encrypted-transfer-code"));
        const transferCodeHash = ethers.keccak256(ethers.toUtf8Bytes("transfer-code"));
        await vehicleSaleEscrow.connect(seller).submitEncryptedTransferCode(encryptedCode, transferCodeHash);
    }

    async function reachSaleConfirmedState() {
        await reachSubmittedState();
        await vehicleSaleEscrow.connect(buyer).confirmTransferCode();
    }

    async function reachCodeRejectedState() {
        await reachSubmittedState();
        await vehicleSaleEscrow.connect(buyer).rejectTransferCode();
    }

    async function reachVerificationRequestedAfterRejection() {
        await reachCodeRejectedState();
        await vehicleSaleEscrow.connect(seller).requestTransferCodeVerification();
    }

    async function reachVerificationRequestedAfterBuyerTimeout() {
        await reachSubmittedState();
        const deadline = await vehicleSaleEscrow.getConfirmCodeDeadline();
        await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
        await vehicleSaleEscrow.connect(seller).requestTransferCodeVerification();
    }

    describe("Deployment", function () {
        it("Should deploy with the correct configuration", async function () {
            expect(await vehicleSaleEscrow.getSeller()).to.equal(seller.address);
            expect(await vehicleSaleEscrow.getBuyer()).to.equal(buyer.address);
            expect(await vehicleSaleEscrow.getIntermediary()).to.equal(intermediary.address);
            expect(await vehicleSaleEscrow.connect(seller).getTokenERC20Contract()).to.equal(await mockTokenERC20.getAddress());
            expect(await vehicleSaleEscrow.connect(seller).getVehicleNFTContract()).to.equal(await vehicleNFT.getAddress());
            expect(await vehicleSaleEscrow.connect(seller).getVehicleTokenId()).to.equal(vehicleTokenId);
            expect(await vehicleSaleEscrow.connect(seller).getVehiclePrice()).to.equal(vehiclePrice);
            expect(await vehicleSaleEscrow.connect(seller).getDepositFee()).to.equal(depositFee);
            expect(await vehicleSaleEscrow.connect(seller).getPickupFee()).to.equal(pickupFee);
            expect(await vehicleSaleEscrow.connect(seller).getCancellationFee()).to.equal(cancellationFee);
            expect(await vehicleSaleEscrow.connect(seller).getSaleState()).to.equal(0n);
            expect(await vehicleSaleEscrow.connect(seller).getDisputeReason()).to.equal(0n);
            expect(await vehicleSaleEscrow.connect(seller).isDepositRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).isPickupRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).hasNFTBeenDeposited()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).hasVehiclePriceFunded()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).isTransferCodeVerificationRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).isVehicleRecoveryRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).isVehicleRecoveryRequired()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).isTransferCodeDeadlineActive()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).isConfirmCodeDeadlineActive()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).isVerificationRequestDeadlineActive()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).isVerificationRequestPeriodAfterBuyerTimeoutActive()).to.equal(false);
            expect(await vehicleSaleEscrow.connect(seller).getTransferCodeDeadline()).to.equal(0n);
            expect(await vehicleSaleEscrow.connect(seller).getConfirmCodeDeadline()).to.equal(0n);
            expect(await vehicleSaleEscrow.connect(seller).getVerificationRequestDeadline()).to.equal(0n);
            expect(await vehicleSaleEscrow.connect(seller).getNoBuyerResponseVerificationDeadline()).to.equal(0n);
        });

    });

    describe("Asset deposits", function () {
        it("Should allow the buyer to fund the escrow", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await expect(vehicleSaleEscrow.connect(buyer).fundVehiclePrice())
                .to.emit(vehicleSaleEscrow, "VehiclePriceDeposited")
                .withArgs(buyer.address, escrowAddress, vehiclePrice, cancellationFee);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(pickupFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(vehiclePrice + cancellationFee);
            expect(await vehicleSaleEscrow.hasVehiclePriceFunded()).to.equal(true);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(1n);
        });

        it("Should allow the seller to deposit the NFT and cancellation fee", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await expect(vehicleSaleEscrow.connect(seller).depositVehicleNFT())
                .to.emit(vehicleSaleEscrow, "VehicleNFTDeposited")
                .withArgs(seller.address, escrowAddress, await vehicleNFT.getAddress(), vehicleTokenId);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(depositFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(cancellationFee);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(escrowAddress);
            expect(await vehicleSaleEscrow.hasNFTBeenDeposited()).to.equal(true);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(2n);
        });

        it("Should reach AssetsDeposited when both assets are deposited", async function () {
            await reachAssetsDepositedState();
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(3n);
            expect(await mockTokenERC20.balanceOf(await vehicleSaleEscrow.getAddress())).to.equal(vehiclePrice + cancellationFee * 2n);
        });

        it("Should reject asset deposits from unauthorized accounts", async function () {
            await expect(vehicleSaleEscrow.connect(other).fundVehiclePrice())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "Unauthorized");
            await expect(vehicleSaleEscrow.connect(other).depositVehicleNFT())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "Unauthorized");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(0n);
            expect(await mockTokenERC20.balanceOf(await vehicleSaleEscrow.getAddress())).to.equal(0n);
        });

        it("Should reject asset deposits in invalid states", async function () {
            await reachAssetsDepositedState();
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(3n);
            await expect(vehicleSaleEscrow.connect(buyer).fundVehiclePrice())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "InvalidState");
            await expect(vehicleSaleEscrow.connect(seller).depositVehicleNFT())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "InvalidState");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(3n);
        });
    });

    describe("Physical vehicle deposit", function () {
        it("Should request and confirm the vehicle deposit", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await reachAssetsDepositedState();
            await expect(vehicleSaleEscrow.connect(seller).requestVehicleDeposit())
                .to.emit(vehicleSaleEscrow, "DepositRequested")
                .withArgs(seller.address);
            expect(await vehicleSaleEscrow.isDepositRequested()).to.equal(true);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(0n);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(vehiclePrice + cancellationFee * 2n + depositFee);
            await expect(vehicleSaleEscrow.connect(intermediary).confirmVehicleDeposit())
                .to.emit(vehicleSaleEscrow, "VehicleDepositConfirmed")
                .withArgs(intermediary.address);
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(vehiclePrice + cancellationFee * 2n);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(4n);
            expect(await vehicleSaleEscrow.isDepositRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.isTransferCodeDeadlineActive()).to.equal(true);
            expect(await vehicleSaleEscrow.getTransferCodeDeadline()).to.be.greaterThan(0n);
        });

        it("Should reject invalid deposit requests and confirmations", async function () {
            await expect(vehicleSaleEscrow.connect(seller).requestVehicleDeposit())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "InvalidState");
            await reachAssetsDepositedState();
            await expect(vehicleSaleEscrow.connect(intermediary).confirmVehicleDeposit())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "RequestNotMade");
            await vehicleSaleEscrow.connect(seller).requestVehicleDeposit();
            await expect(vehicleSaleEscrow.connect(seller).requestVehicleDeposit())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "RequestAlreadyMade");
        });
    });

    describe("Transfer code submission", function () {
        it("Should submit the encrypted code and start the confirmation deadline", async function () {
            const encryptedCode = ethers.toUtf8Bytes("encrypted-transfer-code");
            const transferCodeHash = ethers.keccak256(ethers.toUtf8Bytes("transfer-code"));
            await reachReadyState();
            await expect(vehicleSaleEscrow.connect(seller).submitEncryptedTransferCode(encryptedCode, transferCodeHash))
                .to.emit(vehicleSaleEscrow, "EncryptedTransferCodeSubmitted")
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(4n, 5n); // Ready vers Submitted
            expect(await vehicleSaleEscrow.getEncryptedTransferCode()).to.equal(ethers.hexlify(encryptedCode));
            expect(await vehicleSaleEscrow.getTransferCodeHash()).to.equal(transferCodeHash);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(5n); // Submitted
            expect(await vehicleSaleEscrow.getTransferCodeDeadline()).to.equal(0n);
            expect(await vehicleSaleEscrow.getConfirmCodeDeadline()).to.be.greaterThan(0n);
            expect(await vehicleSaleEscrow.isConfirmCodeDeadlineActive()).to.equal(true);
        });

        it("Should reject an invalid or duplicate transfer code", async function () {
            const encryptedCode = ethers.hexlify(ethers.toUtf8Bytes("encrypted-transfer-code"));
            const transferCodeHash = ethers.keccak256(ethers.toUtf8Bytes("transfer-code"));
            await reachReadyState();
            await expect(vehicleSaleEscrow.connect(seller).submitEncryptedTransferCode("0x", transferCodeHash))
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "InvalidTransferCode");
            await expect(vehicleSaleEscrow.connect(seller).submitEncryptedTransferCode(encryptedCode, ethers.ZeroHash))
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "InvalidTransferCode");
            await vehicleSaleEscrow.connect(seller).submitEncryptedTransferCode(encryptedCode, transferCodeHash);
            await expect(vehicleSaleEscrow.connect(seller).submitEncryptedTransferCode(encryptedCode, transferCodeHash))
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "InvalidState");
        });

        it("Should reject submission after the deadline", async function () {
            const encryptedCode = ethers.hexlify(ethers.toUtf8Bytes("encrypted-transfer-code"));
            const transferCodeHash = ethers.keccak256(ethers.toUtf8Bytes("transfer-code"));
            await reachReadyState();
            const deadline = await vehicleSaleEscrow.getTransferCodeDeadline();
            expect(deadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(seller).submitEncryptedTransferCode(encryptedCode, transferCodeHash))
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "DeadlineExpired");
        });
    });

    describe("Normal sale completion", function () {
        it("Should complete the sale when the buyer confirms the code", async function () {
            await reachSubmittedState();
            await expect(vehicleSaleEscrow.connect(buyer).confirmTransferCode())
                .to.emit(vehicleSaleEscrow, "SaleConfirmed")
                .withArgs(seller.address, buyer.address, vehiclePrice, vehicleTokenId)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(5n, 6n); // Submitted vers SaleConfirmed
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(6n);
            expect(await vehicleSaleEscrow.getConfirmCodeDeadline()).to.equal(0n);
            expect(await vehicleSaleEscrow.isConfirmCodeDeadlineActive()).to.equal(false);
            expect(await vehicleSaleEscrow.hasVehiclePriceFunded()).to.equal(false);
            expect(await vehicleSaleEscrow.hasNFTBeenDeposited()).to.equal(false);
        });

        it("Should transfer the price to the seller and the NFT to the buyer", async function () {
            await reachSubmittedState();
            await vehicleSaleEscrow.connect(buyer).confirmTransferCode();
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(vehiclePrice + cancellationFee);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(buyer.address);
        });

        it("Should refund both cancellation fees", async function () {
            await reachSubmittedState();
            await vehicleSaleEscrow.connect(buyer).confirmTransferCode();
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(vehiclePrice + cancellationFee);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(pickupFee + cancellationFee);
            expect(await mockTokenERC20.balanceOf(await vehicleSaleEscrow.getAddress())).to.equal(0n);
        });

        it("Should reject confirmation after the deadline", async function () {
            await reachSubmittedState();
            const deadline = await vehicleSaleEscrow.getConfirmCodeDeadline();
            expect(deadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(buyer).confirmTransferCode())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "DeadlineExpired");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(5n);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(await vehicleSaleEscrow.getAddress());
        });
    });

    describe("Vehicle pickup", function () {
        it("Should request and confirm vehicle pickup", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await reachSaleConfirmedState();
            await expect(vehicleSaleEscrow.connect(buyer).requestVehiclePickup())
                .to.emit(vehicleSaleEscrow, "PickupRequested")
                .withArgs(buyer.address);
            expect(await vehicleSaleEscrow.isPickupRequested()).to.equal(true);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(cancellationFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(pickupFee);
            await expect(vehicleSaleEscrow.connect(intermediary).confirmVehiclePickup())
                .to.emit(vehicleSaleEscrow, "VehicleReleased")
                .withArgs(intermediary.address, buyer.address, vehicleTokenId)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(6n, 7n); // SaleConfirmed vers Completed
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee + pickupFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(0n);
            expect(await vehicleSaleEscrow.isPickupRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(7n);
            await expect(vehicleNFT.ownerOf(vehicleTokenId))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(vehicleTokenId);
        });

        it("Should reject invalid pickup actions", async function () {
            await expect(vehicleSaleEscrow.connect(buyer).requestVehiclePickup())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "InvalidState");
            await reachSaleConfirmedState();
            await expect(vehicleSaleEscrow.connect(other).requestVehiclePickup())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "Unauthorized");
            await expect(vehicleSaleEscrow.connect(intermediary).confirmVehiclePickup())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "RequestNotMade");
            await vehicleSaleEscrow.connect(buyer).requestVehiclePickup();
            await expect(vehicleSaleEscrow.connect(buyer).requestVehiclePickup())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "RequestAlreadyMade");
            await expect(vehicleSaleEscrow.connect(seller).confirmVehiclePickup())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "Unauthorized");
        });
    });

    describe("Code rejection", function () {
        it("Should reject the code and create a CodeRejected dispute", async function () {
            await reachSubmittedState();
            await expect(vehicleSaleEscrow.connect(buyer).rejectTransferCode())
                .to.emit(vehicleSaleEscrow, "TransferCodeRejected")
                .withArgs(buyer.address)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(5n, 9n); // Submitted vers Disputed
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(9n); // Disputed
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(1n); // CodeRejected
            expect(await vehicleSaleEscrow.getConfirmCodeDeadline()).to.equal(0n);
            expect(await vehicleSaleEscrow.getVerificationRequestDeadline()).to.be.greaterThan(0n);
            expect(await vehicleSaleEscrow.isVerificationRequestDeadlineActive()).to.equal(true);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(await vehicleSaleEscrow.getAddress());
        });

        it("Should reject code rejection after the buyer deadline", async function () {
            await reachSubmittedState();
            const deadline = await vehicleSaleEscrow.getConfirmCodeDeadline();
            expect(deadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(buyer).rejectTransferCode())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "DeadlineExpired");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(5n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(0n);
        });
    });

    describe("Verification after code rejection", function () {
        it("Should reject an incorrect original transfer-code hash", async function () {
            const incorrectHash = ethers.keccak256(ethers.toUtf8Bytes("incorrect-transfer-code"));
            await reachVerificationRequestedAfterRejection();
            await expect(vehicleSaleEscrow.connect(intermediary).resolveWithOriginalCode(incorrectHash))
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "InvalidTransferCode");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(9n);
            expect(await vehicleSaleEscrow.isTransferCodeVerificationRequested()).to.equal(true);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(await vehicleSaleEscrow.getAddress());
        });

        it("Should reject verification request after the CodeRejected deadline", async function () {
            await reachCodeRejectedState();
            const verificationDeadline = await vehicleSaleEscrow.getVerificationRequestDeadline();
            expect(verificationDeadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(verificationDeadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(seller).requestTransferCodeVerification())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "DeadlineExpired");
            expect(await vehicleSaleEscrow.isTransferCodeVerificationRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(9n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(1n);
        });

        it("Should allow the seller to request verification", async function () {
            await reachCodeRejectedState();
            await expect(vehicleSaleEscrow.connect(seller).requestTransferCodeVerification())
                .to.emit(vehicleSaleEscrow, "TransferCodeVerificationRequested")
                .withArgs(seller.address);
            expect(await vehicleSaleEscrow.isTransferCodeVerificationRequested()).to.equal(true);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(9n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(1n);
            expect(await vehicleSaleEscrow.getVerificationRequestDeadline()).to.equal(0n);
        });

        it("Should complete the sale when the original code is valid", async function () {
            const transferCodeHash = ethers.keccak256(ethers.toUtf8Bytes("transfer-code"));
            await reachVerificationRequestedAfterRejection();
            await expect(vehicleSaleEscrow.connect(intermediary).resolveWithOriginalCode(transferCodeHash))
                .to.emit(vehicleSaleEscrow, "DisputeResolved")
                .withArgs(1n, 0n)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(9n, 6n); // Disputed vers SaleConfirmed
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(6n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(0n);
            expect(await vehicleSaleEscrow.isTransferCodeVerificationRequested()).to.equal(false);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(buyer.address);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(pickupFee);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(vehiclePrice + cancellationFee);
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee + cancellationFee);
        });

        it("Should complete the sale when a corrected code is valid", async function () {
            const originalHash = ethers.keccak256(ethers.toUtf8Bytes("transfer-code"));
            const correctedEncryptedCode = ethers.hexlify(ethers.toUtf8Bytes("corrected-encrypted-transfer-code"));
            const correctedHash = ethers.keccak256(ethers.toUtf8Bytes("corrected-transfer-code"));
            await reachVerificationRequestedAfterRejection();
            await expect(vehicleSaleEscrow.connect(intermediary).resolveWithCorrectedCode(correctedEncryptedCode, correctedHash))
                .to.emit(vehicleSaleEscrow, "TransferCodeCorrected")
                .withArgs(originalHash, correctedHash)
                .and.to.emit(vehicleSaleEscrow, "DisputeResolved")
                .withArgs(1n, 1n)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(9n, 6n); // Disputed vers SaleConfirmed
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(6n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(0n);
            expect(await vehicleSaleEscrow.getEncryptedTransferCode()).to.equal(correctedEncryptedCode);
            expect(await vehicleSaleEscrow.getTransferCodeHash()).to.equal(correctedHash);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(buyer.address);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(vehiclePrice);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(pickupFee + cancellationFee);
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee + cancellationFee);
        });

        it("Should cancel the sale when no valid code exists", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await reachVerificationRequestedAfterRejection();
            await expect(vehicleSaleEscrow.connect(intermediary).resolveWithNoValidCode())
                .to.emit(vehicleSaleEscrow, "DisputeResolved")
                .withArgs(1n, 2n)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(9n, 8n) // Disputed vers Cancelled
                .and.to.emit(vehicleSaleEscrow, "EscrowSaleCancelled")
                .withArgs(intermediary.address);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(8n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(0n);
            expect(await vehicleSaleEscrow.isTransferCodeVerificationRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(true);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(seller.address);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(vehiclePrice + cancellationFee + pickupFee);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(0n);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(cancellationFee);
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee);
        });

        it("Should reject dispute resolution before verification is requested", async function () {
            const transferCodeHash = ethers.keccak256(ethers.toUtf8Bytes("transfer-code"));
            await reachCodeRejectedState();
            await expect(vehicleSaleEscrow.connect(intermediary).resolveWithOriginalCode(transferCodeHash))
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "RequestNotMade");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(9n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(1n);
            expect(await vehicleSaleEscrow.isTransferCodeVerificationRequested()).to.equal(false);
        });
    });

    describe("Buyer timeout", function () {
        it("Should allow the seller to request verification after buyer timeout", async function () {
            await reachSubmittedState();
            const deadline = await vehicleSaleEscrow.getConfirmCodeDeadline();
            expect(deadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(seller).requestTransferCodeVerification())
                .to.emit(vehicleSaleEscrow, "TransferCodeVerificationRequested")
                .withArgs(seller.address)
                .and.to.emit(vehicleSaleEscrow, "BuyerDidNotConfirm")
                .withArgs(buyer.address)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(5n, 9n); // Submitted vers Disputed
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(9n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(2n);
            expect(await vehicleSaleEscrow.isTransferCodeVerificationRequested()).to.equal(true);
            expect(await vehicleSaleEscrow.getConfirmCodeDeadline()).to.equal(0n);
        });

        it("Should reject verification requests too early or too late", async function () {
            await reachSubmittedState();
            await expect(vehicleSaleEscrow.connect(seller).requestTransferCodeVerification())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "DeadlineNotExpired");
            const verificationPeriodDeadline = await vehicleSaleEscrow.getNoBuyerResponseVerificationDeadline();
            expect(verificationPeriodDeadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(verificationPeriodDeadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(seller).requestTransferCodeVerification())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "DeadlineExpired");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(5n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(0n);
        });

        it("Should split the remaining cancellation fee correctly after buyer timeout", async function () {
            const correctedEncryptedCode = ethers.hexlify(ethers.toUtf8Bytes("corrected-encrypted-transfer-code"));
            const correctedHash = ethers.keccak256(ethers.toUtf8Bytes("corrected-transfer-code"));
            const sellerRefund = cancellationFee / 2n;
            const buyerRefund = cancellationFee - sellerRefund;
            await reachVerificationRequestedAfterBuyerTimeout();
            await expect(vehicleSaleEscrow.connect(intermediary).resolveWithCorrectedCode(correctedEncryptedCode, correctedHash))
                .to.emit(vehicleSaleEscrow, "DisputeResolved")
                .withArgs(2n, 1n);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(vehiclePrice + sellerRefund);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(pickupFee + buyerRefund);
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee + cancellationFee);
            expect(await mockTokenERC20.balanceOf(await vehicleSaleEscrow.getAddress())).to.equal(0n);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(6n); // SaleConfirmed
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(buyer.address);
        });
    });

    describe("Cancellation", function () {
        it("Should allow the buyer to cancel before the physical vehicle deposit is requested", async function () {
            await reachAssetsDepositedState();
            await expect(vehicleSaleEscrow.connect(buyer).cancelBeforeVehicleDeposit())
                .to.emit(vehicleSaleEscrow, "EscrowSaleCancelled")
                .withArgs(buyer.address)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(3n, 8n);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(8n);
        });

        it("Should allow the seller to cancel before the physical vehicle deposit is requested", async function () {
            await reachAssetsDepositedState();
            await expect(vehicleSaleEscrow.connect(seller).cancelBeforeVehicleDeposit())
                .to.emit(vehicleSaleEscrow, "EscrowSaleCancelled")
                .withArgs(seller.address)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(3n, 8n);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(8n);
        });

        it("Should refund deposited funds and burn the NFT during early cancellation", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await reachAssetsDepositedState();
            await vehicleSaleEscrow.connect(seller).cancelBeforeVehicleDeposit();
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(vehiclePrice + cancellationFee + pickupFee);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(depositFee + cancellationFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(0n);
            expect(await vehicleSaleEscrow.hasVehiclePriceFunded()).to.equal(false);
            expect(await vehicleSaleEscrow.hasNFTBeenDeposited()).to.equal(false);
            await expect(vehicleNFT.ownerOf(vehicleTokenId))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(vehicleTokenId);
        });

        it("Should burn the NFT from the seller wallet when cancelled before NFT deposit", async function () {
            await vehicleSaleEscrow.connect(buyer).fundVehiclePrice();
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(seller.address);
            await vehicleSaleEscrow.connect(buyer).cancelBeforeVehicleDeposit();
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(8n);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(vehiclePrice + cancellationFee + pickupFee);
            await expect(vehicleNFT.ownerOf(vehicleTokenId))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(vehicleTokenId);
        });

        it("Should reject cancellation before the transfer code deadline expires", async function () {
            await reachReadyState();
            const deadline = await vehicleSaleEscrow.getTransferCodeDeadline();
            expect(deadline).to.be.greaterThan(0n);
            await expect(vehicleSaleEscrow.connect(buyer).cancelAfterTransferCodeDeadline())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "DeadlineNotExpired");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(4n);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(false);
        });

        it("Should cancel after the transfer code deadline", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await reachReadyState();
            const deadline = await vehicleSaleEscrow.getTransferCodeDeadline();
            expect(deadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(buyer).cancelAfterTransferCodeDeadline())
                .to.emit(vehicleSaleEscrow, "EscrowSaleCancelled")
                .withArgs(buyer.address)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(4n, 8n); // Ready vers Cancelled
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(8n);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(true);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(seller.address);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(0n);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(vehiclePrice + cancellationFee + pickupFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(cancellationFee);
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee);
        });

        it("Should reject cancellation during the verification-request period after buyer timeout", async function () {
            await reachSubmittedState();
            const confirmDeadline = await vehicleSaleEscrow.getConfirmCodeDeadline();
            expect(confirmDeadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(confirmDeadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(seller).cancelAfterConfirmAndVerificationCodeDeadline())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "DeadlineNotExpired");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(5n);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(false);
        });

        it("Should cancel when the buyer and verification deadlines expire", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await reachSubmittedState();
            const deadline = await vehicleSaleEscrow.getNoBuyerResponseVerificationDeadline();
            expect(deadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(seller).cancelAfterConfirmAndVerificationCodeDeadline())
                .to.emit(vehicleSaleEscrow, "EscrowSaleCancelled")
                .withArgs(seller.address)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(5n, 8n); // Submitted vers Cancelled
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(8n);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(true);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(seller.address);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(vehiclePrice + pickupFee);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(cancellationFee);
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(cancellationFee);
        });

        it("Should reject cancellation during the verification-request period after code rejection", async function () {
            await reachCodeRejectedState();
            const verificationDeadline = await vehicleSaleEscrow.getVerificationRequestDeadline();
            expect(verificationDeadline).to.be.greaterThan(0n);
            await expect(vehicleSaleEscrow.connect(buyer).cancelAfterVerificationRequestDeadline())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "DeadlineNotExpired");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(9n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(1n);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(false);
        });

        it("Should cancel when verification is not requested after code rejection", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await reachCodeRejectedState();
            const deadline = await vehicleSaleEscrow.getVerificationRequestDeadline();
            expect(deadline).to.be.greaterThan(0n);
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
            await expect(vehicleSaleEscrow.connect(buyer).cancelAfterVerificationRequestDeadline())
                .to.emit(vehicleSaleEscrow, "EscrowSaleCancelled")
                .withArgs(buyer.address)
                .and.to.emit(vehicleSaleEscrow, "WorkflowStateChanged")
                .withArgs(9n, 8n); // Disputed vers Cancelled
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(8n);
            expect(await vehicleSaleEscrow.getDisputeReason()).to.equal(0n);
            expect(await vehicleSaleEscrow.isTransferCodeVerificationRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(true);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(seller.address);
            expect(await mockTokenERC20.balanceOf(buyer.address)).to.equal(vehiclePrice + cancellationFee + pickupFee);
            expect(await mockTokenERC20.balanceOf(seller.address)).to.equal(0n);
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(cancellationFee);
        });

        it("Should reject cancellation from unauthorized accounts or invalid states", async function () {
            await expect(vehicleSaleEscrow.connect(other).cancelBeforeVehicleDeposit())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "Unauthorized");
            await reachReadyState();
            await expect(vehicleSaleEscrow.connect(seller).cancelBeforeVehicleDeposit())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "InvalidState");
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(4n);
        });
    });

    describe("Vehicle recovery", function () {
        it("Should request and confirm vehicle recovery after cancellation", async function () {
            const escrowAddress = await vehicleSaleEscrow.getAddress();
            await reachReadyState();
            const deadline = await vehicleSaleEscrow.getTransferCodeDeadline();
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
            await vehicleSaleEscrow.connect(buyer).cancelAfterTransferCodeDeadline();
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(true);
            expect(await vehicleNFT.ownerOf(vehicleTokenId)).to.equal(seller.address);
            await expect(vehicleSaleEscrow.connect(seller).requestVehicleRecovery())
                .to.emit(vehicleSaleEscrow, "VehicleRecoveryRequested")
                .withArgs(seller.address);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequested()).to.equal(true);
            await expect(vehicleSaleEscrow.connect(intermediary).confirmVehicleRecovered())
                .to.emit(vehicleSaleEscrow, "VehicleRecovered")
                .withArgs(intermediary.address, seller.address, vehicleTokenId);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(false);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequested()).to.equal(false);
            expect(await vehicleSaleEscrow.getSaleState()).to.equal(8n);
            expect(await mockTokenERC20.balanceOf(intermediary.address)).to.equal(depositFee + cancellationFee);
            expect(await mockTokenERC20.balanceOf(escrowAddress)).to.equal(0n);
            await expect(vehicleNFT.ownerOf(vehicleTokenId))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(vehicleTokenId);
        });

        it("Should reject recovery confirmation when recovery was not requested", async function () {
            await reachReadyState();
            const deadline = await vehicleSaleEscrow.getTransferCodeDeadline();
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(deadline + 1n)]);
            await vehicleSaleEscrow.connect(buyer).cancelAfterTransferCodeDeadline();
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequired()).to.equal(true);
            expect(await vehicleSaleEscrow.isVehicleRecoveryRequested()).to.equal(false);
            await expect(vehicleSaleEscrow.connect(intermediary).confirmVehicleRecovered())
                .to.be.revertedWithCustomError(vehicleSaleEscrow, "RequestNotMade");
        });
    });
});