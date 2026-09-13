// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract GasPriceProbe {
    uint256 public price;

    function record() external {
        require(tx.gasprice > 0, "zero gas price");
        price = tx.gasprice;
    }
}
