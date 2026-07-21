// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract VehicleNFT is ERC721URIStorage {
    address private immutable factory;
    address private vehicleEscrow;
    address private immutable seller;
    address private immutable buyer;

    error NFTTransferNotAllowed();
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

    constructor(address _seller, address _buyer) ERC721("Vehicle NFT", "VNFT") {
        require(_seller != address(0), InvalidAddress());
        require(_buyer != address(0), InvalidAddress());

        factory = msg.sender;
        seller = _seller;
        buyer = _buyer;
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

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Mint effectué par la factory.
        if (from == address(0)) {
            return super._update(to, tokenId, auth);
        }

        // Burn effectué par la fonction burn(), protégée par onlyEscrow.
        if (to == address(0)) {
            return super._update(to, tokenId, auth);
        }

        // Le seller peut seulement envoyer le NFT vers l'escrow.
        bool sellerDepositsToEscrow = from == seller &&
            to == vehicleEscrow &&
            auth == seller;

        // L'escrow peut seulement envoyer le NFT au seller ou au buyer.
        bool escrowReleasesNFT = from == vehicleEscrow &&
            auth == vehicleEscrow &&
            (to == seller || to == buyer);

        require(!sellerDepositsToEscrow && !escrowReleasesNFT, NFTTransferNotAllowed());

        return super._update(to, tokenId, auth);
    }
}
