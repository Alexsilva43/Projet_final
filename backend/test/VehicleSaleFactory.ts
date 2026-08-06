import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

async function setUpVehicleSaleFactoryContract() {
    const [owner, seller, buyer, intermediary, other] = await ethers.getSigners();

    const vehiclePrice = ethers.parseUnits("20000", 6);
    const depositFee = ethers.parseUnits("200", 6);
    const pickupFee = ethers.parseUnits("100", 6);
    const cancellationFee = ethers.parseUnits("500", 6);

    const mockTokenERC20 = await ethers.deployContract("MockTokenERC20", [], other);
    const vehicleNFT = await ethers.deployContract("VehicleNFT", [], owner);

    const vehicleSaleFactory = await ethers.deployContract("VehicleSaleFactory", [await vehicleNFT.getAddress()], owner);
    await vehicleNFT.connect(owner).setFactory(await vehicleSaleFactory.getAddress());

    return {
        vehicleSaleFactory,
        vehicleNFT,
        mockTokenERC20,
        owner,
        seller,
        buyer,
        intermediary,
        other,
        vehiclePrice,
        depositFee,
        pickupFee,
        cancellationFee
    };
}

describe("VehicleSaleFactory", function () {
    let vehicleSaleFactory: any;
    let vehicleNFT: any;
    let mockTokenERC20: any;

    let owner: any;
    let seller: any;
    let buyer: any;
    let intermediary: any;
    let other: any;

    let vehiclePrice: bigint;
    let depositFee: bigint;
    let pickupFee: bigint;
    let cancellationFee: bigint;

    beforeEach(async function () {
        ({
            vehicleSaleFactory,
            vehicleNFT,
            mockTokenERC20,
            owner,
            seller,
            buyer,
            intermediary,
            other,
            vehiclePrice,
            depositFee,
            pickupFee,
            cancellationFee
        } = await setUpVehicleSaleFactoryContract());
    });

    describe("Deployment", function () {
        it("Should deploy with the correct VehicleNFT contract", async function () {
            expect(await vehicleSaleFactory.vehicleNFT()).to.equal(await vehicleNFT.getAddress());
        });

        it("Should reject a zero VehicleNFT address", async function () {
            const vehicleSaleFactoryDeployer = await ethers.getContractFactory("VehicleSaleFactory", owner);
            await expect(vehicleSaleFactoryDeployer.deploy(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(vehicleSaleFactoryDeployer, "InvalidAddress");
        });

        it("Should reject a non-contract VehicleNFT address", async function () {
            const vehicleSaleFactoryDeployer = await ethers.getContractFactory("VehicleSaleFactory", owner);
            await expect(vehicleSaleFactoryDeployer.deploy(other.address))
                .to.be.revertedWithCustomError(vehicleSaleFactoryDeployer, "InvalidAddress");
        });
    });

    describe("Vehicle sale creation", function () {
        it("Should create a complete vehicle sale", async function () {
            await vehicleSaleFactory.createVehicleSale(
                seller.address,
                buyer.address,
                intermediary.address,
                await mockTokenERC20.getAddress(),
                vehiclePrice,
                depositFee,
                pickupFee,
                cancellationFee
            );
            expect(await vehicleNFT.ownerOf(0)).to.equal(seller.address);
            const escrowAddress = await vehicleNFT.getEscrow(0);
            expect(escrowAddress).to.not.equal(ethers.ZeroAddress);
            const vehicleSaleEscrow = await ethers.getContractAt("VehicleSaleEscrow", escrowAddress);
            expect(await vehicleSaleEscrow.getSeller()).to.equal(seller.address);
            expect(await vehicleSaleEscrow.getBuyer()).to.equal(buyer.address);
            expect(await vehicleSaleEscrow.getIntermediary()).to.equal(intermediary.address);
            expect(await vehicleSaleEscrow.getTokenERC20Contract()).to.equal(await mockTokenERC20.getAddress());
            expect(await vehicleSaleEscrow.getVehicleNFTContract()).to.equal(await vehicleNFT.getAddress());
            expect(await vehicleSaleEscrow.getVehicleTokenId()).to.equal(0n);
            expect(await vehicleSaleEscrow.getVehiclePrice()).to.equal(vehiclePrice);
            expect(await vehicleSaleEscrow.getDepositFee()).to.equal(depositFee);
            expect(await vehicleSaleEscrow.getPickupFee()).to.equal(pickupFee);
            expect(await vehicleSaleEscrow.getCancellationFee()).to.equal(cancellationFee);
        });

        it("Should emit the VehicleSaleCreated event", async function () {
            const tx = await vehicleSaleFactory.createVehicleSale(
                seller.address,
                buyer.address,
                intermediary.address,
                await mockTokenERC20.getAddress(),
                vehiclePrice,
                depositFee,
                pickupFee,
                cancellationFee
            );
            const receipt = await tx.wait();
            const event = receipt!.logs.find(
                (log: any) => log.fragment?.name === "VehicleSaleCreated"
            );
            expect(event).to.not.be.undefined;
            expect(event.args.vehicleNFT).to.equal(await vehicleNFT.getAddress());
            expect(event.args.seller).to.equal(seller.address);
            expect(event.args.buyer).to.equal(buyer.address);
            expect(event.args.intermediary).to.equal(intermediary.address);
            expect(event.args.vehicleTokenId).to.equal(0n);
        });

    });

    describe("Input validation", function () {
        it("Should reject a zero seller address", async function () {
            await expect(
                vehicleSaleFactory.createVehicleSale(
                    ethers.ZeroAddress,
                    buyer.address,
                    intermediary.address,
                    await mockTokenERC20.getAddress(),
                    vehiclePrice,
                    depositFee,
                    pickupFee,
                    cancellationFee
                )
            ).to.be.revertedWithCustomError(vehicleSaleFactory, "InvalidAddress");
        });

        it("Should reject a zero buyer address", async function () {
            await expect(
                vehicleSaleFactory.createVehicleSale(
                    seller.address,
                    ethers.ZeroAddress,
                    intermediary.address,
                    await mockTokenERC20.getAddress(),
                    vehiclePrice,
                    depositFee,
                    pickupFee,
                    cancellationFee
                )
            ).to.be.revertedWithCustomError(vehicleSaleFactory, "InvalidAddress");
        });

        it("Should reject a zero intermediary address", async function () {
            await expect(
                vehicleSaleFactory.createVehicleSale(
                    seller.address,
                    buyer.address,
                    ethers.ZeroAddress,
                    await mockTokenERC20.getAddress(),
                    vehiclePrice,
                    depositFee,
                    pickupFee,
                    cancellationFee
                )
            ).to.be.revertedWithCustomError(vehicleSaleFactory, "InvalidAddress");
        });

        it("Should reject a zero ERC20 token address", async function () {
            await expect(
                vehicleSaleFactory.createVehicleSale(
                    seller.address,
                    buyer.address,
                    intermediary.address,
                    ethers.ZeroAddress,
                    vehiclePrice,
                    depositFee,
                    pickupFee,
                    cancellationFee
                )
            ).to.be.revertedWithCustomError(vehicleSaleFactory, "InvalidAddress");
        });

        it("Should reject a zero vehicle price", async function () {
            await expect(
                vehicleSaleFactory.createVehicleSale(
                    seller.address,
                    buyer.address,
                    intermediary.address,
                    await mockTokenERC20.getAddress(),
                    0,
                    depositFee,
                    pickupFee,
                    cancellationFee
                )
            ).to.be.revertedWithCustomError(vehicleSaleFactory, "InvalidAmount");
        });
        it("Should reject a zero deposit fee", async function () {
            await expect(
                vehicleSaleFactory.createVehicleSale(
                    seller.address,
                    buyer.address,
                    intermediary.address,
                    await mockTokenERC20.getAddress(),
                    vehiclePrice,
                    0,
                    pickupFee,
                    cancellationFee
                )
            ).to.be.revertedWithCustomError(vehicleSaleFactory, "InvalidAmount");
        });

        it("Should reject a zero pickup fee", async function () {
            await expect(
                vehicleSaleFactory.createVehicleSale(
                    seller.address,
                    buyer.address,
                    intermediary.address,
                    await mockTokenERC20.getAddress(),
                    vehiclePrice,
                    depositFee,
                    0,
                    cancellationFee
                )
            ).to.be.revertedWithCustomError(vehicleSaleFactory, "InvalidAmount");
        });

        it("Should reject a zero cancellation fee", async function () {
            await expect(
                vehicleSaleFactory.createVehicleSale(
                    seller.address,
                    buyer.address,
                    intermediary.address,
                    await mockTokenERC20.getAddress(),
                    vehiclePrice,
                    depositFee,
                    pickupFee,
                    0
                )
            ).to.be.revertedWithCustomError(vehicleSaleFactory, "InvalidAmount");
        });
    });

    describe("Multiple vehicle sales", function () {
        it("Should create multiple independent vehicle sales", async function () {
            await vehicleSaleFactory.createVehicleSale(
                seller.address,
                buyer.address,
                intermediary.address,
                await mockTokenERC20.getAddress(),
                vehiclePrice,
                depositFee,
                pickupFee,
                cancellationFee
            );
            await vehicleSaleFactory.createVehicleSale(
                seller.address,
                buyer.address,
                intermediary.address,
                await mockTokenERC20.getAddress(),
                vehiclePrice,
                depositFee,
                pickupFee,
                cancellationFee
            );
            expect(await vehicleNFT.ownerOf(0)).to.equal(seller.address);
            expect(await vehicleNFT.ownerOf(1)).to.equal(seller.address);
            const escrow0 = await vehicleNFT.getEscrow(0);
            const escrow1 = await vehicleNFT.getEscrow(1);
            expect(escrow0).to.not.equal(escrow1);
        });
    });
});