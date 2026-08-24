// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DemoEURC
/// @notice ERC20 token used to simulate EURC for the Vehicle Escrow demonstration.
/// @dev Uses 6 decimals to reproduce the decimal precision of EURC.
contract DemoEURC is ERC20 {
    /// @notice Deploys the Demo EURC token and mints the initial supply to the deployer.
    /// @param initialSupply Initial number of EURC tokens to mint, expressed without decimals.
    constructor(uint256 initialSupply) ERC20("Demo EURC", "EURC") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    /// @notice Returns the number of decimals used by the token.
    /// @return The token decimal precision, fixed at 6.
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}