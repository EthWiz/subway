// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolAdapter} from "../src/interfaces/IPoolAdapter.sol";
import {IPriceFeed} from "../src/interfaces/IPriceFeed.sol";
import {IZkLighter} from "../src/interfaces/IZkLighter.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockFeed is IPriceFeed {
    int256 public answer;
    uint256 public updatedAt;
    bool public paused;
    uint256 public multiplier = 1e18;
    uint8 private _dec = 8;

    constructor(int256 answer_) {
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function set(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
    }

    function setPaused(bool p) external {
        paused = p;
    }

    function setMultiplier(uint256 m) external {
        multiplier = m;
    }

    function decimals() external view returns (uint8) {
        return _dec;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }

    function oraclePaused() external view returns (bool) {
        return paused;
    }

    function uiMultiplier() external view returns (uint256) {
        return multiplier;
    }
}

/// @dev Stands in for the rollup. The point of these tests is that the vault
/// is safe WITHOUT trusting what happens in here, so this mock is deliberately
/// dumb: it takes custody on deposit and pays back whatever is asked, which is
/// the most generous possible counterparty. If an invariant holds against it,
/// it holds against a real one that can also lose money.
contract MockLighter is IZkLighter {
    IERC20 public immutable collateral;
    uint256 public credited;
    bool public cancelled;
    bytes public lastKey;

    constructor(address collateral_) {
        collateral = IERC20(collateral_);
    }

    function deposit(address, uint256 amount) external {
        collateral.transferFrom(msg.sender, address(this), amount);
        credited += amount;
    }

    /// @dev Secure withdrawal: funds go to the CALLER, which is the account's
    /// L1 owner. There is deliberately no recipient parameter to abuse.
    function withdraw(uint256 amount) external {
        credited -= amount;
        collateral.transfer(msg.sender, amount);
    }

    function changePubKey(bytes calldata pubKey) external {
        lastKey = pubKey;
    }

    function cancelAllOrders() external {
        cancelled = true;
    }
}

/// @dev A pool that holds both tokens and reports them back. Enough to test
/// the vault's accounting and money-movement rules without a real AMM.
contract MockPool is IPoolAdapter {
    IERC20 public immutable stock;
    IERC20 public immutable usdg;
    address public immutable vault;

    uint256 public stockHeld;
    uint256 public usdgHeld;
    bool public open;
    bool public rangeInside = true;

    constructor(address stock_, address usdg_, address vault_) {
        stock = IERC20(stock_);
        usdg = IERC20(usdg_);
        vault = vault_;
    }

    function positionAmounts() external view returns (uint256, uint256) {
        return (stockHeld, usdgHeld);
    }

    function inRange() external view returns (bool) {
        return rangeInside;
    }

    function hasPosition() external view returns (bool) {
        return open;
    }

    function setInRange(bool v) external {
        rangeInside = v;
    }

    /// @dev Simulates fees arriving by crediting the position directly.
    function accrue(uint256 stockAmount, uint256 usdgAmount) external {
        stockHeld += stockAmount;
        usdgHeld += usdgAmount;
    }

    function openRange(uint256, uint256, uint256 stockAmount, uint256 usdgAmount)
        external
        returns (uint256, uint256)
    {
        if (stockAmount > 0) stock.transferFrom(msg.sender, address(this), stockAmount);
        if (usdgAmount > 0) usdg.transferFrom(msg.sender, address(this), usdgAmount);
        stockHeld += stockAmount;
        usdgHeld += usdgAmount;
        open = true;
        return (stockAmount, usdgAmount);
    }

    function closeRange() external returns (uint256 stockOut, uint256 usdgOut) {
        stockOut = stockHeld;
        usdgOut = usdgHeld;
        stockHeld = 0;
        usdgHeld = 0;
        open = false;
        if (stockOut > 0) stock.transfer(vault, stockOut);
        if (usdgOut > 0) usdg.transfer(vault, usdgOut);
    }

    function collectFees() external pure returns (uint256, uint256) {
        return (0, 0);
    }

    /// @dev The mock measures "liquidity" as the USDG leg, which is enough for
    /// the vault's pro-rata arithmetic and says nothing about real AMM units.
    function positionLiquidity() external view returns (uint128) {
        return open ? uint128(usdgHeld) : 0;
    }

    function decreaseLiquidity(uint128 liquidity) external returns (uint256 stockOut, uint256 usdgOut) {
        uint256 total = usdgHeld;
        require(total > 0 && liquidity <= total, "MockPool: bad liquidity");
        stockOut = stockHeld * liquidity / total;
        usdgOut = liquidity;
        stockHeld -= stockOut;
        usdgHeld -= usdgOut;
        if (usdgHeld == 0) open = false;
        if (stockOut > 0) stock.transfer(vault, stockOut);
        if (usdgOut > 0) usdg.transfer(vault, usdgOut);
    }
}
