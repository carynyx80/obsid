// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SealedBidSale} from "../../src/SealedBidSale.sol";
import {MilestoneEscrow} from "../../src/MilestoneEscrow.sol";

contract MockERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xdead), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract MockBABT {
    mapping(address => uint256) public balanceOf;

    function set(address a, uint256 b) external {
        balanceOf[a] = b;
    }
}

/// @dev Bidder that tries to re-enter settle() when it receives its BNB refund.
contract ReentrantBidder {
    SealedBidSale public sale;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    uint256 public received;

    constructor(SealedBidSale s) {
        sale = s;
    }

    function commit(bytes32 c) external payable {
        sale.commit{value: msg.value}(c);
    }

    function reveal(uint256 tick, uint256 amount, bytes32 salt) external {
        sale.reveal(tick, amount, salt);
    }

    receive() external payable {
        received += msg.value;
        if (!reentryAttempted) {
            reentryAttempted = true;
            try sale.settle(address(this)) {
                reentrySucceeded = true;
            } catch {}
        }
    }
}

/// @dev Refund claimer that tries to re-enter claimRefund().
contract ReentrantRefunder {
    MilestoneEscrow public escrow;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(MilestoneEscrow e) {
        escrow = e;
    }

    function claim() external {
        escrow.claimRefund();
    }

    function exec(address target, bytes calldata data) external payable {
        (bool ok, bytes memory ret) = target.call{value: msg.value}(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }

    receive() external payable {
        if (!reentryAttempted) {
            reentryAttempted = true;
            try escrow.claimRefund() {
                reentrySucceeded = true;
            } catch {}
        }
    }
}
