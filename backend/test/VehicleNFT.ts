import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

async function setUpVehicleNFTContract() {
    const [
        owner,
        factory,
        seller1,
        buyer1,
        seller2,
        buyer2,
        other
    ] = await ethers.getSigners();

    const vehicleNFT = await ethers.deployContract("VehicleNFT", [], owner);
    const mockFactory = await ethers.deployContract("MockFactory", [], owner);
    const mockEscrow1 = await ethers.deployContract("MockEscrow", [seller1.address, buyer1.address], factory);
    const mockEscrow2 = await ethers.deployContract("MockEscrow", [seller2.address, buyer2.address], factory);

    await vehicleNFT.connect(owner).setFactory(await mockFactory.getAddress());

    return {
        vehicleNFT,
        mockEscrow1,
        mockEscrow2,
        mockFactory,
        factory,
        seller1,
        buyer1,
        seller2,
        buyer2,
        other
    };
}

describe("VehicleNFT Contract", function () {
    let vehicleNFT: any;
    let mockEscrow1: any;
    let mockEscrow2: any;
    let mockFactory: any;
    let factory: any;
    let seller1: any;
    let buyer1: any;
    let seller2: any;
    let buyer2: any;
    let other: any;

    beforeEach(async function () {
        ({
            vehicleNFT,
            mockEscrow1,
            mockEscrow2,
            mockFactory,
            factory,
            seller1,
            buyer1,
            seller2,
            buyer2,
            other
        } = await setUpVehicleNFTContract());
    });

    describe("Deployment", function () {
        it("Should have the correct name", async function () {
            expect(await vehicleNFT.name()).to.equal("Vehicle NFT");
        });

        it("Should have the correct symbol", async function () {
            expect(await vehicleNFT.symbol()).to.equal("VNFT");
        });

        it("Should start with no existing tokens", async function () {
            await expect(vehicleNFT.ownerOf(0))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(0);
        });
    });

    describe("Mint", function () {
        it("Should prevent a non-factory from minting", async function () {
            await expect(vehicleNFT.connect(other).mint(seller1.address))
                .to.be.revertedWithCustomError(vehicleNFT, "NotTheFactory");
        });

        it("Should mint token 0 to the requested address", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            expect(await vehicleNFT.ownerOf(0)).to.equal(seller1.address);
        });

        it("Should increment the token ID", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller2.address);
            expect(await vehicleNFT.ownerOf(0)).to.equal(seller1.address);
            expect(await vehicleNFT.ownerOf(1)).to.equal(seller2.address);
            await expect(vehicleNFT.ownerOf(2))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(2);
        });

        it("Should emit a Transfer event", async function () {
            await expect(mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address))
                .to.emit(vehicleNFT, "Transfer")
                .withArgs(ethers.ZeroAddress, seller1.address, 0);
        });

        it("Should reject minting to the zero address", async function () {
            await expect(mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), ethers.ZeroAddress))
                .to.be.revertedWithCustomError(vehicleNFT, "InvalidAddress");
        });
    });

    describe("Escrow configuration", function () {
        it("Should allow the factory to configure the escrow", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            expect(await vehicleNFT.getEscrow(0)).to.equal(escrowAddress);
        });

        it("Should prevent a non-factory from configuring the escrow", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const escrowAddress = await mockEscrow1.getAddress();
            await expect(vehicleNFT.connect(other).setEscrow(0, escrowAddress))
                .to.be.revertedWithCustomError(vehicleNFT, "NotTheFactory");
            expect(await vehicleNFT.getEscrow(0)).to.equal(ethers.ZeroAddress);
        });

        it("Should reject the zero escrow address", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            await expect(mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, ethers.ZeroAddress))
                .to.be.revertedWithCustomError(vehicleNFT, "InvalidAddress");
        });

        it("Should reject configuring a nonexistent token", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const escrowAddress = await mockEscrow1.getAddress();
            await expect(mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 1, escrowAddress))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(1);
        });

        it("Should reject assigning a second escrow to the same token", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const escrowAddress1 = await mockEscrow1.getAddress();
            const escrowAddress2 = await mockEscrow2.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress1);
            await expect(mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress2))
                .to.be.revertedWithCustomError(vehicleNFT, "TokenAlreadyLinkedToEscrow");
            expect(await vehicleNFT.getEscrow(0)).to.equal(escrowAddress1);
        });
    });

    describe("Metadata", function () {
        it("Should return a Base64 JSON token URI", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const tokenURI = await vehicleNFT.tokenURI(0);
            expect(tokenURI).to.be.a("string");
            expect(tokenURI).to.match(/^data:application\/json;base64,[A-Za-z0-9+/=]+$/);
            const encoded = tokenURI.replace("data:application/json;base64,", "");
            const decoded = Buffer.from(encoded, "base64").toString("utf8");
            expect(() => JSON.parse(decoded)).to.not.throw();
        });

        it("Should contain the correct NFT name", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const tokenURI = await vehicleNFT.tokenURI(0);
            const encoded = tokenURI.replace("data:application/json;base64,", "");
            const decoded = Buffer.from(encoded, "base64").toString("utf8");
            const metadata = JSON.parse(decoded);
            expect(metadata.name).to.equal("Vehicle NFT: 0");
        });

        it("Should contain a Base64 SVG image", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const tokenURI = await vehicleNFT.tokenURI(0);
            const encoded = tokenURI.replace("data:application/json;base64,", "");
            const metadata = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
            expect(metadata.image).to.match(/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
        });

        it("Should display the correct token ID in the SVG", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const tokenURI = await vehicleNFT.tokenURI(0);
            const encodedMetadata = tokenURI.replace("data:application/json;base64,", "");
            const metadata = JSON.parse(Buffer.from(encodedMetadata, "base64").toString("utf8"));
            const encodedSVG = metadata.image.replace("data:image/svg+xml;base64,", "");
            const decodedSVG = Buffer.from(encodedSVG, "base64").toString("utf8");
            expect(decodedSVG).to.include("TOKEN: 0");
        });

        it("Should generate different metadata for different token IDs", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller2.address);
            const tokenURI0 = await vehicleNFT.tokenURI(0);
            const tokenURI1 = await vehicleNFT.tokenURI(1);
            const encodedMetadata0 = tokenURI0.replace("data:application/json;base64,", "");
            const encodedMetadata1 = tokenURI1.replace("data:application/json;base64,", "");
            const metadata0 = JSON.parse(Buffer.from(encodedMetadata0, "base64").toString("utf8"));
            const metadata1 = JSON.parse(Buffer.from(encodedMetadata1, "base64").toString("utf8"));
            expect(metadata0.name).to.equal("Vehicle NFT: 0");
            expect(metadata1.name).to.equal("Vehicle NFT: 1");
            expect(metadata0.image).to.not.equal(metadata1.image);
        });

        it("Should reject tokenURI for a nonexistent token", async function () {
            await expect(vehicleNFT.tokenURI(0))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(0);
        });
    });

    describe("Seller transfers", function () {
        it("Should reject a transfer before escrow configuration", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            await expect(vehicleNFT.connect(seller1).transferFrom(seller1.address, await mockEscrow1.getAddress(), 0))
                .to.be.revertedWithCustomError(vehicleNFT, "NFTTransferNotAllowed");
        });

        it("Should reject a direct transfer from the seller to the escrow", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await expect(vehicleNFT.connect(seller1)["safeTransferFrom(address,address,uint256)"](seller1.address, escrowAddress, 0))
                .to.be.revertedWithCustomError(vehicleNFT, "NFTTransferNotAllowed");
            expect(await vehicleNFT.ownerOf(0)).to.equal(seller1.address);
        });

        it("Should allow the escrow to pull an approved NFT from the seller", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await vehicleNFT.connect(seller1).approve(escrowAddress, 0);
            await mockEscrow1.transferNFT(await vehicleNFT.getAddress(), seller1.address, escrowAddress, 0);
            expect(await vehicleNFT.ownerOf(0)).to.equal(escrowAddress);
        });

        it("Should reject a seller transfer to another address", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await expect(vehicleNFT.connect(seller1).transferFrom(seller1.address, buyer1.address, 0))
                .to.be.revertedWithCustomError(vehicleNFT, "NFTTransferNotAllowed");
        });
    });

    describe("Escrow transfers", function () {
        it("Should allow the escrow to transfer the NFT to the seller", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await vehicleNFT.connect(seller1).approve(escrowAddress, 0);
            await mockEscrow1.transferNFT(await vehicleNFT.getAddress(), seller1.address, escrowAddress, 0);
            expect(await vehicleNFT.ownerOf(0)).to.equal(escrowAddress);
            await mockEscrow1.transferNFT(await vehicleNFT.getAddress(), escrowAddress, seller1.address, 0);
            expect(await vehicleNFT.ownerOf(0)).to.equal(seller1.address);
        });

        it("Should allow the escrow to transfer the NFT to the buyer", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await vehicleNFT.connect(seller1).approve(escrowAddress, 0);
            await mockEscrow1.transferNFT(vehicleNFTAddress, seller1.address, escrowAddress, 0);
            expect(await vehicleNFT.ownerOf(0)).to.equal(escrowAddress);
            await expect(mockEscrow1.transferNFT(vehicleNFTAddress, escrowAddress, buyer1.address, 0))
                .to.emit(vehicleNFT, "Transfer")
                .withArgs(escrowAddress, buyer1.address, 0);
            expect(await vehicleNFT.ownerOf(0)).to.equal(buyer1.address);
        });

        it("Should reject an escrow transfer to another address", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await vehicleNFT.connect(seller1).approve(escrowAddress, 0);
            await mockEscrow1.transferNFT(vehicleNFTAddress, seller1.address, escrowAddress, 0);
            expect(await vehicleNFT.ownerOf(0)).to.equal(escrowAddress);
            await expect(mockEscrow1.transferNFT(vehicleNFTAddress, escrowAddress, other.address, 0))
                .to.be.revertedWithCustomError(vehicleNFT, "NFTTransferNotAllowed");
            expect(await vehicleNFT.ownerOf(0)).to.equal(escrowAddress);
        });
    });

    describe("Buyer transfers", function () {
        it("Should reject every transfer from the buyer", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await vehicleNFT.connect(seller1).approve(escrowAddress, 0);
            await mockEscrow1.transferNFT(vehicleNFTAddress, seller1.address, escrowAddress, 0);
            expect(await vehicleNFT.ownerOf(0)).to.equal(escrowAddress);
            await mockEscrow1.transferNFT(vehicleNFTAddress, escrowAddress, buyer1.address, 0);
            await expect(vehicleNFT.connect(buyer1).transferFrom(buyer1.address, other.address, 0))
                .to.be.revertedWithCustomError(vehicleNFT, "NFTTransferNotAllowed");
            await expect(vehicleNFT.connect(buyer1).transferFrom(buyer1.address, escrowAddress, 0))
                .to.be.revertedWithCustomError(vehicleNFT, "NFTTransferNotAllowed");
            await expect(vehicleNFT.connect(buyer1).transferFrom(buyer1.address, seller1.address, 0))
                .to.be.revertedWithCustomError(vehicleNFT, "NFTTransferNotAllowed");
            expect(await vehicleNFT.ownerOf(0)).to.equal(buyer1.address);
        });

    });

    describe("Burn", function () {
        it("Should allow the associated escrow to burn the NFT", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await expect(mockEscrow1.burnNFT(vehicleNFTAddress, 0))
                .to.emit(vehicleNFT, "Transfer")
                .withArgs(seller1.address, ethers.ZeroAddress, 0);
            await expect(vehicleNFT.ownerOf(0))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(0);
        });

        it("Should reject a burn by the seller", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await expect(vehicleNFT.connect(seller1).burn(0))
                .to.be.revertedWithCustomError(vehicleNFT, "NotTheEscrow");
            expect(await vehicleNFT.ownerOf(0)).to.equal(seller1.address);
        });

        it("Should reject a burn by the buyer", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await vehicleNFT.connect(seller1).approve(escrowAddress, 0);
            await mockEscrow1.transferNFT(vehicleNFTAddress, seller1.address, escrowAddress, 0);
            await mockEscrow1.transferNFT(vehicleNFTAddress, escrowAddress, buyer1.address, 0);
            expect(await vehicleNFT.ownerOf(0)).to.equal(buyer1.address);
            await expect(vehicleNFT.connect(buyer1).burn(0))
                .to.be.revertedWithCustomError(vehicleNFT, "NotTheEscrow");
            expect(await vehicleNFT.ownerOf(0)).to.equal(buyer1.address);
        });

        it("Should reject a burn by another escrow", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrow1Address = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrow1Address);
            await expect(mockEscrow2.burnNFT(vehicleNFTAddress, 0))
                .to.be.revertedWithCustomError(vehicleNFT, "NotTheEscrow");
            expect(await vehicleNFT.ownerOf(0)).to.equal(seller1.address);
        });

        it("Should clear the associated escrow after the burn", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await mockEscrow1.burnNFT(vehicleNFTAddress, 0);
            expect(await vehicleNFT.getEscrow(0)).to.equal(ethers.ZeroAddress);
        });

        it("Should not reuse a burned token ID", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrowAddress = await mockEscrow1.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrowAddress);
            await mockEscrow1.burnNFT(vehicleNFTAddress, 0);
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller2.address);
            expect(await vehicleNFT.ownerOf(1)).to.equal(seller2.address);
            await expect(vehicleNFT.ownerOf(0))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(0);
        });
    });

    describe("Multiple escrows", function () {
        it("Should associate each token with its own escrow", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller2.address);
            const escrow1Address = await mockEscrow1.getAddress();
            const escrow2Address = await mockEscrow2.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrow1Address);
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 1, escrow2Address);
            expect(await vehicleNFT.getEscrow(0)).to.equal(escrow1Address);
            expect(await vehicleNFT.getEscrow(1)).to.equal(escrow2Address);
        });

        it("Should reject an escrow acting on another escrow's token", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller2.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrow1Address = await mockEscrow1.getAddress();
            const escrow2Address = await mockEscrow2.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrow1Address);
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 1, escrow2Address);
            await expect(mockEscrow1.burnNFT(vehicleNFTAddress, 1))
                .to.be.revertedWithCustomError(vehicleNFT, "NotTheEscrow");
            expect(await vehicleNFT.ownerOf(1)).to.equal(seller2.address);
        });

        it("Should not affect token 1 when token 0 is burned", async function () {
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller1.address);
            await mockFactory.mintVehicleNFT(await vehicleNFT.getAddress(), seller2.address);
            const vehicleNFTAddress = await vehicleNFT.getAddress();
            const escrow1Address = await mockEscrow1.getAddress();
            const escrow2Address = await mockEscrow2.getAddress();
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 0, escrow1Address);
            await mockFactory.setVehicleEscrow(await vehicleNFT.getAddress(), 1, escrow2Address);
            await mockEscrow1.burnNFT(vehicleNFTAddress, 0);
            expect(await vehicleNFT.ownerOf(1)).to.equal(seller2.address);
            expect(await vehicleNFT.getEscrow(1)).to.equal(escrow2Address);
            await expect(vehicleNFT.ownerOf(0))
                .to.be.revertedWithCustomError(vehicleNFT, "ERC721NonexistentToken")
                .withArgs(0);
        });
    });
});