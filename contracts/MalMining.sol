// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MalMining {
    struct Player {
        uint256 money;
        uint256 toolLevel;
        uint256 truckCount;
    }

    mapping(address => Player) public players;

    event GameSaved(address indexed player, uint256 money, uint256 toolLevel, uint256 truckCount);

    function saveGame(uint256 _money, uint256 _toolLevel, uint256 _truckCount) public {
        players[msg.sender].money = _money;
        players[msg.sender].toolLevel = _toolLevel;
        players[msg.sender].truckCount = _truckCount;
        
        emit GameSaved(msg.sender, _money, _toolLevel, _truckCount);
    }

    function loadGame(address _player) public view returns (uint256, uint256, uint256) {
        return (players[_player].money, players[_player].toolLevel, players[_player].truckCount);
    }
}