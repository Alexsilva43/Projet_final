// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IERC721
/// @notice Interface exposing the ERC721 operations required by VehicleSaleEscrow.
interface IERC721 {
    /// @notice Safely transfers an NFT from one address to another.
    /// @param from Current owner of the NFT.
    /// @param to Address receiving the NFT.
    /// @param tokenId Identifier of the NFT.
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    /// @notice Transfers an NFT from one address to another.
    /// @param from Current owner of the NFT.
    /// @param to Address receiving the NFT.
    /// @param tokenId Identifier of the NFT.
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    /// @notice Mints an NFT to the specified address.
    /// @param to Address receiving the NFT.
    /// @param tokenId Identifier of the NFT.
    /// @param _tokenURI Metadata URI associated with the NFT.
    function mint(address to, uint256 tokenId, string calldata _tokenURI) external;

    /// @notice Burns an existing NFT.
    /// @param tokenId Identifier of the NFT to burn.
    function burn (uint256 tokenId) external;

    /// @notice Returns the owner of an NFT.
    /// @param tokenId Identifier of the NFT.
    /// @return owner Address of the NFT owner.
    function ownerOf(uint256 tokenId) external view returns (address owner);
}

/// @title IERC721Receiver
/// @notice Interface required for contracts receiving ERC721 tokens through safe transfers.
interface IERC721Receiver {
    /// @notice Handles the receipt of an ERC721 token.
    /// @param operator Address that initiated the transfer.
    /// @param from Previous owner of the NFT.
    /// @param tokenId Identifier of the received NFT.
    /// @param data Additional transfer data.
    /// @return The selector confirming that the NFT was received.
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);

}