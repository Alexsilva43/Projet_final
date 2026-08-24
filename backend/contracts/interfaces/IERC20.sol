// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IERC20
/// @notice Interface exposing the ERC20 operations required by VehicleSaleEscrow.
interface IERC20 {
    /// @notice Transfers tokens to another address.
    /// @param to Address receiving the tokens.
    /// @param amount Amount of tokens to transfer.
    /// @return True if the transfer succeeds.
    function transfer(address to, uint256 amount)  external returns (bool);

    /// @notice Transfers tokens from one address to another.
    /// @param from Address providing the tokens.
    /// @param to Address receiving the tokens.
    /// @param amount Amount of tokens to transfer.
    /// @return True if the transfer succeeds.
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /// @notice Returns the token balance of an account.
    /// @param account Address whose balance is queried.
    /// @return Token balance of the account.
    function balanceOf(address account) external view returns (uint256);
}