// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IVehicleSaleEscrow} from "../interfaces/IVehicleSaleEscrow.sol";

/// @title VehicleNFT
/// @notice ERC721 token representing a vehicle temporarily during a Vehicle Escrow sale.
/// @dev Restricts NFT creation, association, transfers and destruction to the workflow defined by the Vehicle Escrow protocol.
contract VehicleNFT is ERC721 {
    using Strings for uint256;

    address private owner;
    address private factory;

    mapping(uint256 => address) private vehicleEscrow;

    uint256 private nextTokenId;

    /// @notice Reverts when an NFT transfer is not allowed by the sale workflow.
      error NFTTransferNotAllowed();

    /// @notice Reverts when an operation restricted to the configured factory is called by another address.
    error NotTheFactory();

    /// @notice Reverts when an operation restricted to the NFT's associated escrow is called by another address.
    error NotTheEscrow();

    /// @notice Reverts when an operation restricted to the contract owner is called by another address.
    error NotTheOwner();

    /// @notice Reverts when an invalid address is provided.
    error InvalidAddress();

    /// @notice Reverts when attempting to configure the factory more than once.
    error FactoryAlreadyConfigured();

    /// @notice Reverts when attempting to associate a token with a second escrow.
    error TokenAlreadyLinkedToEscrow();

    /// @notice Restricts access to the configured VehicleSaleFactory.
    modifier onlyFactory() {
        require(msg.sender == factory, NotTheFactory());
        _;
    }

    /// @notice Restricts access to the escrow associated with a specific NFT.
    /// @param tokenId Identifier of the NFT whose escrow authorization is checked.
    modifier onlyEscrow(uint256 tokenId) {
        require(msg.sender == vehicleEscrow[tokenId], NotTheEscrow());
        _;
    }

    /// @notice Restricts access to the owner that deployed the VehicleNFT contract.
      modifier onlyOwner() {
        require(msg.sender == owner, NotTheOwner());
        _;
    }

    /// @notice Initializes the Vehicle NFT ERC721 collection.
    /// @dev The deployer becomes the owner authorized to configure the factory.
    constructor() ERC721("Vehicle NFT", "VNFT") {
        owner = msg.sender;
    }

    /// @notice Creates a new vehicle NFT for the specified address.
    /// @dev Only the configured factory can mint new tokens. Token identifiers are assigned sequentially.
    /// @param to Address that will initially own the NFT.
    /// @return tokenId Identifier of the newly minted NFT.
    function mint(address to) external onlyFactory returns (uint256) {
        require(to != address(0), InvalidAddress());
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        _mint(to, tokenId);
        return tokenId;
    }

    /// @notice Permanently destroys a vehicle NFT.
    /// @dev Only the escrow associated with the NFT can burn it. The escrow association is removed after destruction.
    /// @param tokenId Identifier of the NFT to destroy.
    function burn(uint256 tokenId) external onlyEscrow(tokenId) {
        _requireOwned(tokenId);
        _burn(tokenId);
        delete vehicleEscrow[tokenId];
    }

    /// @notice Returns the metadata URI of a vehicle NFT.
    /// @dev The metadata and SVG image are generated entirely on-chain and encoded in Base64.
    /// @param tokenId Identifier of the NFT.
    /// @return The Base64-encoded JSON metadata URI.
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory svg = _generateSVG(tokenId);
        string memory imageURI = string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                Base64.encode(bytes(svg))
            )
        );
        bytes memory metadata = abi.encodePacked(
            '{"name":"Vehicle NFT: ',
            tokenId.toString(),
            '",',
            '"image":"',
            imageURI,
            '"}'
        );
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(metadata)
                )
            );
    }

    /// @dev Applies the transfer restrictions required by the Vehicle Escrow workflow.
    /// @param to Destination address of the NFT transfer.
    /// @param tokenId Identifier of the NFT being transferred.
    /// @param auth Address authorizing or executing the transfer.
    /// @return Previous owner of the NFT.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from == address(0)) return super._update(to, tokenId, auth); // Mint
        if (to == address(0)) return super._update(to, tokenId, auth); // Burn
        address escrowAddress = vehicleEscrow[tokenId];
        require(escrowAddress != address(0), NFTTransferNotAllowed());
        IVehicleSaleEscrow escrow = IVehicleSaleEscrow(escrowAddress);
        address seller = escrow.getSeller();
        address buyer = escrow.getBuyer();
        bool sellerDepositsToEscrow = from == seller &&
            to == escrowAddress &&
            auth == escrowAddress;
        bool escrowReleasesNFT = from == escrowAddress &&
            auth == escrowAddress &&
            (to == seller || to == buyer);
        require(
            sellerDepositsToEscrow || escrowReleasesNFT,
            NFTTransferNotAllowed()
        );
        return super._update(to, tokenId, auth);
    }

    /// @notice Configures the VehicleSaleFactory authorized to manage VehicleNFT creation and escrow association.
    /// @dev Can only be called once by the contract owner. The supplied address must contain deployed contract code.
    /// @param factoryAddress Address of the VehicleSaleFactory contract.
    function setFactory(address factoryAddress) external onlyOwner {
        require(factory == address(0), FactoryAlreadyConfigured());
        require(factoryAddress != address(0), InvalidAddress());
        require(factoryAddress.code.length > 0, InvalidAddress());

        factory = factoryAddress;
    }

    /// @notice Associates a vehicle NFT with the escrow created for its sale.
    /// @dev Each NFT can be associated with only one escrow and only the factory can configure the association.
    /// @param tokenId Identifier of the NFT.
    /// @param escrowAddress Address of the VehicleSaleEscrow associated with the NFT.
    function setEscrow(
        uint256 tokenId,
        address escrowAddress
    ) external onlyFactory {
        _requireOwned(tokenId);
        require(escrowAddress != address(0), InvalidAddress());
        require(
            vehicleEscrow[tokenId] == address(0),
            TokenAlreadyLinkedToEscrow()
        );
        vehicleEscrow[tokenId] = escrowAddress;
    }

    /// @notice Returns the escrow associated with a vehicle NFT.
    /// @param tokenId Identifier of the NFT.
    /// @return Address of the associated VehicleSaleEscrow.
    function getEscrow(uint256 tokenId) external view returns (address) {
        return vehicleEscrow[tokenId];
    }

    /// @dev Generates the SVG image embedded in the NFT metadata.
    /// @param tokenId Identifier displayed in the generated SVG.
    /// @return The SVG image as a string.
    function _generateSVG(
        uint256 tokenId
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">',
                    "<defs>",
                    '<linearGradient id="gold" x1="80" y1="60" x2="920" y2="940" gradientUnits="userSpaceOnUse">',
                    '<stop stop-color="#FFF3B0"/><stop offset=".3" stop-color="#E5B83E"/><stop offset=".68" stop-color="#B27A12"/>'
                    '<stop offset="1" stop-color="#F2D165"/>',
                    "</linearGradient>",
                    '<radialGradient id="light" cx="50%" cy="38%" r="60%">',
                    '<stop stop-color="#FFF8CE" stop-opacity=".55"/><stop offset="1" stop-color="#8A5700" stop-opacity="0"/>',
                    "</radialGradient>",
                    '<filter id="shadow" x="-20%" y="-30%" width="140%" height="170%"><feGaussianBlur stdDeviation="16"/></filter>',
                    "</defs>",
                    '<rect width="1000" height="1000" rx="88" fill="url(#gold)"/>',
                    '<rect width="1000" height="1000" rx="88" fill="url(#light)"/>',
                    '<rect x="35" y="35" width="930" height="930" rx="64" fill="none" stroke="#FFF3AF" stroke-width="7"/>',
                    '<rect x="54" y="54" width="892" height="892" rx="51" fill="none" stroke="#7D5108" stroke-width="3" opacity=".58"/>',
                    '<circle cx="500" cy="500" r="352" fill="none" stroke="#FFF0A0" stroke-width="3" opacity=".38"/>',
                    '<ellipse cx="500" cy="725" rx="285" ry="26" fill="#4C2D00" opacity=".32" filter="url(#shadow)"/>',
                    '<g transform="translate(0 -65)" fill="none" stroke="#1F2A33" '
                    'stroke-width="18" stroke-linecap="round" stroke-linejoin="round">',
                    '<path d="'
                    "M286 504 349 345 Q365 305 411 305 H589 Q635 305 651 345 L714 504 "
                    "Q774 510 802 554 Q814 573 814 598 V704 Q814 729 789 729 H736 V769 "
                    "Q736 810 695 810 Q654 810 654 769 V729 H346 V769 "
                    "Q346 810 305 810 Q264 810 264 769 V729 H211 "
                    'Q186 729 186 704 V598 Q186 573 198 554 Q226 510 286 504Z"/>',
                    '<path d="'
                    "M323 504 377 369 Q387 345 415 345 H585 "
                    'Q613 345 623 369 L677 504Z"/>',
                    '<circle cx="274" cy="597" r="43"/>',
                    '<circle cx="726" cy="597" r="43"/>',
                    '<path d="M395 614H605"/>',
                    '<path d="M414 648H586"/>',
                    '<path d="M440 682H560"/>',
                    "</g>",
                    '<text x="500" y="835" text-anchor="middle" '
                    'font-family="Arial,sans-serif" font-size="42" '
                    'font-weight="bold" fill="#1F2A33">',
                    "TOKEN: ",
                    tokenId.toString(),
                    "</text></svg>"
                )
            );
    }
}