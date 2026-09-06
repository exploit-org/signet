// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract TestToken is ERC20Permit {
    uint8 private immutable precision;
    constructor(uint8 decimals_) ERC20("Treasury Token", "TT") ERC20Permit("Treasury Token") {
        precision = decimals_;
        _mint(msg.sender, 1_000_000 * 10 ** uint256(decimals_));
    }
    function decimals() public view override returns (uint8) { return precision; }
}

contract TestWrappedEther is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}
    function deposit() public payable { _mint(msg.sender, msg.value); }
    receive() external payable { deposit(); }
    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }
}

contract TestNFT is ERC721Enumerable {
    constructor() ERC721("Settlement Receipt", "RCP") {
        _mint(msg.sender, 1);
        _mint(msg.sender, 2);
    }
    function _baseURI() internal pure override returns (string memory) { return "https://example.test/receipt/"; }
}

contract TestMultiToken is ERC1155 {
    constructor() ERC1155("https://example.test/assets/{id}.json") {
        _mint(msg.sender, 1, 100, "");
        _mint(msg.sender, 2, 200, "");
    }
}

// Nonstandard return conventions encountered when integrating payment tokens.
contract FalseReturnToken {
    function transfer(address, uint256) external pure returns (bool) { return false; }
    function approve(address, uint256) external pure returns (bool) { return false; }
    function transferFrom(address, address, uint256) external pure returns (bool) { return false; }
}

contract MalformedReturnToken {
    fallback() external {
        assembly { mstore(0, 2) return(0, 32) }
    }
}

contract FanoutTestRecipient {
    bool public rejecting;
    function chainId() external view returns (uint256) { return block.chainid; }
    function setRejecting(bool value) external { rejecting = value; }
    receive() external payable { require(!rejecting, "payment rejected"); }
}

contract FanoutTestToken is TestToken {
    address public blocked;
    constructor() TestToken(6) {}
    function setBlocked(address value) external { blocked = value; }
    function _update(address from, address to, uint256 amount) internal override {
        require(to != blocked, "recipient blocked");
        super._update(from, to, amount);
    }
}
