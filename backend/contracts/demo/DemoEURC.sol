// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DemoEURC is ERC20 {
    constructor(uint256 initialSupply) ERC20("Demo EURC", "EURC") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}