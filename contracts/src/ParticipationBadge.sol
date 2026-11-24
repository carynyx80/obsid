// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ISaleFactory} from "./interfaces/IObsid.sol";

/// @title ParticipationBadge
/// @notice Soulbound ERC721 minted by a sale when a bidder reveals. One per wallet per sale.
/// Metadata contains only the sale id - never bid prices or amounts.
contract ParticipationBadge is ERC721, Ownable2Step, Pausable {
    using Strings for uint256;

    address public factory;
    uint256 public totalMinted;
    mapping(uint256 tokenId => uint256) public saleIdOfToken;
    mapping(uint256 saleId => mapping(address => uint256)) public badgeOf; // tokenId, 0 = none (ids start at 1)

    error NotSale();
    error Soulbound();
    error FactoryAlreadySet();
    error ZeroAddress();

    event FactorySet(address indexed factory);
    event BadgeMinted(address indexed to, uint256 indexed saleId, uint256 indexed tokenId);

    constructor(address admin) ERC721("Obsid Participation", "OBSIDP") Ownable(admin) {}

    function setFactory(address factory_) external onlyOwner {
        if (factory != address(0)) revert FactoryAlreadySet();
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
        emit FactorySet(factory_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Mint the caller-sale's badge to `to`. Idempotent: returns the existing id if already minted.
    function mint(address to) external whenNotPaused returns (uint256 tokenId) {
        address f = factory;
        if (f == address(0) || !ISaleFactory(f).isSale(msg.sender)) revert NotSale();
        uint256 saleId = ISaleFactory(f).saleIdOf(msg.sender);
        tokenId = badgeOf[saleId][to];
        if (tokenId != 0) return tokenId;
        tokenId = ++totalMinted;
        badgeOf[saleId][to] = tokenId;
        saleIdOfToken[tokenId] = saleId;
        _mint(to, tokenId); // _mint (not _safeMint): no receiver callback
        emit BadgeMinted(to, saleId, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory sid = saleIdOfToken[tokenId].toString();
        string memory json = string.concat(
            '{"name":"Obsid Participation #',
            tokenId.toString(),
            '","description":"Soulbound proof of participation in Obsid sale ',
            sid,
            '.","attributes":[{"trait_type":"Sale ID","value":',
            sid,
            "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    // ---------------------------------------------------------------- soulbound

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }
}
