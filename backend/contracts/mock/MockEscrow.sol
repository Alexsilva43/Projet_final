// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC721, IERC721Receiver} from "../../contracts/interfaces/IERC721.sol";


contract MockEscrow is IERC721Receiver {
    address private immutable seller;
    address private immutable buyer;

    constructor(address _seller, address _buyer) {
        seller = _seller;
        buyer = _buyer;
    }

    function getSeller() external view returns (address) {
        return seller;
    }

    function getBuyer() external view returns (address) {
        return buyer;
    }

    function transferNFT(
        address nft,
        address from,
        address to,
        uint256 tokenId
    ) external {
        IERC721(nft).safeTransferFrom(from, to, tokenId);
    }

    function burnNFT(address nft, uint256 tokenId) external {
        IERC721(nft).burn(tokenId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}