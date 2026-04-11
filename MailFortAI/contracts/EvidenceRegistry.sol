// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EvidenceRegistry {
    struct AnalysisRecord {
        string evidenceHash;  // SHA256 of the email content + verdict
        string verdict;       // Safe, Suspicious, Malicious
        uint256 timestamp;
        string analyzerVersion;
    }

    mapping(string => AnalysisRecord) public records;
    string[] public allHashes;

    event EvidenceRecorded(string indexed evidenceHash, string verdict, uint256 timestamp);

    function recordEvidence(
        string memory _evidenceHash, 
        string memory _verdict, 
        string memory _analyzerVersion
    ) public {
        // Ensure we don't overwrite evidence (immutability)
        require(records[_evidenceHash].timestamp == 0, "Evidence already recorded");

        records[_evidenceHash] = AnalysisRecord({
            evidenceHash: _evidenceHash,
            verdict: _verdict,
            timestamp: block.timestamp,
            analyzerVersion: _analyzerVersion
        });

        allHashes.push(_evidenceHash);
        emit EvidenceRecorded(_evidenceHash, _verdict, block.timestamp);
    }

    function getEvidence(string memory _evidenceHash) public view returns (
        string memory evidenceHash, 
        string memory verdict, 
        uint256 timestamp, 
        string memory analyzerVersion
    ) {
        AnalysisRecord memory record = records[_evidenceHash];
        return (record.evidenceHash, record.verdict, record.timestamp, record.analyzerVersion);
    }

    function getRecordCount() public view returns (uint256) {
        return allHashes.length;
    }
}
