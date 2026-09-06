// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract Fanout {
    error EmptyBatch();
    error LengthMismatch();
    error InvalidRecipient(uint256 index);
    error InvalidAmount(uint256 index);
    error InvalidToken();
    error NativeValueMismatch();
    error NativeTransferFailed(uint256 index);
    error TokenTransferFromFailed();
    error TokenTransferFailed(uint256 index);
    error TokenBalanceQueryFailed();
    error TokenInboundAmountMismatch();
    error TokenFinalBalanceMismatch();
    error InvalidAuthorization();
    error TokenAuthorizationFailed();

    function transferNative(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable {
        uint256 length = recipients.length;
        uint256 total = _validateAndSum(recipients, amounts);

        if (total != msg.value) {
            revert NativeValueMismatch();
        }

        for (uint256 i; i < length;) {
            bool success;

            assembly ("memory-safe") {
                success := call(
                    gas(),
                    calldataload(add(recipients.offset, shl(5, i))),
                    calldataload(add(amounts.offset, shl(5, i))),
                    0,
                    0,
                    0,
                    0
                )
            }

            if (!success) {
                revert NativeTransferFailed(i);
            }

            unchecked {
                ++i;
            }
        }
    }

    function transferToken(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        uint256 total = _validateAndSum(recipients, amounts);
        uint256 balanceBefore = _tokenBalanceBefore(token);
        _transferFrom(token, total);
        _distributeToken(token, recipients, amounts, total, balanceBefore);
    }

    /// @dev The authorizer must submit the outer transaction, binding the distribution to their transaction signature.
    function transferTokenWithAuthorization(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes calldata authorization
    ) external {
        uint256 total = _validateAndSum(recipients, amounts);
        uint256 balanceBefore = _tokenBalanceBefore(token);
        _receiveWithAuthorization(token, total, authorization);
        _distributeToken(token, recipients, amounts, total, balanceBefore);
    }

    function _receiveWithAuthorization(address token, uint256 total, bytes calldata authorization) private {
        if (authorization.length != 292 || bytes4(authorization[:4]) != 0xef55bec6) {
            revert InvalidAuthorization();
        }

        (address from, address to, uint256 value) = abi.decode(authorization[4:], (address, address, uint256));
        if (from != msg.sender || to != address(this) || value != total) {
            revert InvalidAuthorization();
        }

        (bool success,) = token.call(authorization);
        if (!success) {
            revert TokenAuthorizationFailed();
        }
    }

    function _tokenBalanceBefore(address token) private view returns (uint256) {
        if (token == address(this) || token.code.length == 0) {
            revert InvalidToken();
        }
        return _balanceOf(token);
    }

    function _distributeToken(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256 total,
        uint256 balanceBefore
    ) private {
        uint256 balanceAfterPull = _balanceOf(token);

        if (
            balanceAfterPull < balanceBefore ||
            balanceAfterPull - balanceBefore != total
        ) {
            revert TokenInboundAmountMismatch();
        }

        for (uint256 i; i < recipients.length;) {
            _transfer(
                token,
                recipients[i],
                amounts[i],
                i
            );

            unchecked {
                ++i;
            }
        }

        if (_balanceOf(token) != balanceBefore) {
            revert TokenFinalBalanceMismatch();
        }
    }

    function _validateAndSum(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) private view returns (uint256 total) {
        uint256 length = recipients.length;

        if (length == 0) {
            revert EmptyBatch();
        }

        if (length != amounts.length) {
            revert LengthMismatch();
        }

        for (uint256 i; i < length;) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];

            if (
                recipient == address(0) ||
                recipient == address(this)
            ) {
                revert InvalidRecipient(i);
            }

            if (amount == 0) {
                revert InvalidAmount(i);
            }

            total += amount;

            unchecked {
                ++i;
            }
        }
    }

    function _balanceOf(
        address token
    ) private view returns (uint256 tokenBalance) {
        bool valid;

        assembly ("memory-safe") {
            let ptr := mload(0x40)

            mstore(ptr, shl(224, 0x70a08231))
            mstore(add(ptr, 4), address())

            let success := staticcall(
                gas(),
                token,
                ptr,
                36,
                ptr,
                32
            )

            valid := and(success, eq(returndatasize(), 32))

            if valid {
                tokenBalance := mload(ptr)
            }
        }

        if (!valid) {
            revert TokenBalanceQueryFailed();
        }
    }

    function _transferFrom(
        address token,
        uint256 amount
    ) private {
        bool success;

        assembly ("memory-safe") {
            let ptr := mload(0x40)

            mstore(ptr, shl(224, 0x23b872dd))
            mstore(add(ptr, 4), caller())
            mstore(add(ptr, 36), address())
            mstore(add(ptr, 68), amount)

            success := call(
                gas(),
                token,
                0,
                ptr,
                100,
                ptr,
                32
            )

            if success {
                switch returndatasize()
                case 0 {
                    success := 1
                }
                case 32 {
                    success := eq(mload(ptr), 1)
                }
                default {
                    success := 0
                }
            }
        }

        if (!success) {
            revert TokenTransferFromFailed();
        }
    }

    function _transfer(
        address token,
        address recipient,
        uint256 amount,
        uint256 index
    ) private {
        bool success;

        assembly ("memory-safe") {
            let ptr := mload(0x40)

            mstore(ptr, shl(224, 0xa9059cbb))
            mstore(add(ptr, 4), recipient)
            mstore(add(ptr, 36), amount)

            success := call(
                gas(),
                token,
                0,
                ptr,
                68,
                ptr,
                32
            )

            if success {
                switch returndatasize()
                case 0 {
                    success := 1
                }
                case 32 {
                    success := eq(mload(ptr), 1)
                }
                default {
                    success := 0
                }
            }
        }

        if (!success) {
            revert TokenTransferFailed(index);
        }
    }
}
