// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PublicModeSimulator {
    enum CompetitorSignal {
        NoBaseline,
        Stable,
        StrongDay,
        WeakDay
    }

    struct PublicSalesReport {
        uint256 merchantId;
        uint256 dayIndex;
        uint256 grossSales;
        uint16 repaymentBps;
        uint256 projectedRepayment;
        CompetitorSignal competitorSignal;
        bool exists;
    }

    error InvalidMerchantId();
    error InvalidRepaymentRate();
    error ReportAlreadyPublished();
    error ReportNotPublished();

    event PublicSalesReported(
        uint256 indexed merchantId,
        uint256 indexed dayIndex,
        uint256 grossSales,
        uint16 repaymentBps,
        uint256 projectedRepayment,
        CompetitorSignal competitorSignal
    );

    mapping(uint256 => mapping(uint256 => PublicSalesReport)) public reports;
    mapping(uint256 => uint256) public totalPublishedSales;
    mapping(uint256 => uint256) public publishedDayCount;

    function reportPublicSales(uint256 merchantId, uint256 dayIndex, uint256 grossSales, uint16 repaymentBps)
        external
        returns (uint256 projectedRepayment, CompetitorSignal competitorSignal)
    {
        if (merchantId == 0) {
            revert InvalidMerchantId();
        }

        if (repaymentBps == 0 || repaymentBps > 10_000) {
            revert InvalidRepaymentRate();
        }

        if (reports[merchantId][dayIndex].exists) {
            revert ReportAlreadyPublished();
        }

        projectedRepayment = (grossSales * repaymentBps) / 10_000;
        competitorSignal = previewCompetitorSignal(merchantId, grossSales);

        reports[merchantId][dayIndex] = PublicSalesReport({
            merchantId: merchantId,
            dayIndex: dayIndex,
            grossSales: grossSales,
            repaymentBps: repaymentBps,
            projectedRepayment: projectedRepayment,
            competitorSignal: competitorSignal,
            exists: true
        });

        totalPublishedSales[merchantId] += grossSales;
        publishedDayCount[merchantId] += 1;

        emit PublicSalesReported(
            merchantId,
            dayIndex,
            grossSales,
            repaymentBps,
            projectedRepayment,
            competitorSignal
        );
    }

    function averagePublishedSales(uint256 merchantId) public view returns (uint256) {
        uint256 dayCount = publishedDayCount[merchantId];

        if (dayCount == 0) {
            return 0;
        }

        return totalPublishedSales[merchantId] / dayCount;
    }

    function previewCompetitorSignal(uint256 merchantId, uint256 grossSales) public view returns (CompetitorSignal) {
        uint256 baseline = averagePublishedSales(merchantId);

        if (baseline == 0) {
            return CompetitorSignal.NoBaseline;
        }

        if (grossSales * 100 >= baseline * 125) {
            return CompetitorSignal.StrongDay;
        }

        if (grossSales * 100 <= baseline * 75) {
            return CompetitorSignal.WeakDay;
        }

        return CompetitorSignal.Stable;
    }

    function getReport(uint256 merchantId, uint256 dayIndex)
        external
        view
        returns (PublicSalesReport memory report)
    {
        report = reports[merchantId][dayIndex];

        if (!report.exists) {
            revert ReportNotPublished();
        }
    }
}
