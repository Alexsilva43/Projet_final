// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract VehicleNFT is ERC721URIStorage {
    address private immutable factory;
    address private vehicleEscrow;

    error NotTheFactory();
    error NotTheEscrow();
    error InvalidAddress();
    error EscrowAlreadyConfigured();

    modifier onlyFactory() {
        require(msg.sender == factory, NotTheFactory());
        _;
    }

    modifier onlyEscrow() {
        require(msg.sender == vehicleEscrow, NotTheEscrow());
        _;
    }

    constructor() ERC721("Vehicle NFT", "VNFT") {
        factory = msg.sender;
    }

    function setEscrow(address _vehicleEscrow) external onlyFactory {
        require(_vehicleEscrow != address(0), InvalidAddress());
        require(vehicleEscrow == address(0), EscrowAlreadyConfigured());

        vehicleEscrow = _vehicleEscrow;
    }

    function mint(
        address to,
        uint256 tokenId,
        string calldata _tokenURI
    ) external onlyFactory {
        require(to != address(0), InvalidAddress());

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
    }

    function burn(uint256 tokenId) external onlyEscrow {
        _burn(tokenId);
    }
}
