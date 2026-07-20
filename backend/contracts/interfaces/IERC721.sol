// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC721 {
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function mint(address to, uint256 tokenId, string calldata _tokenURI) external;
    function burn (uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address owner);
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);

}
