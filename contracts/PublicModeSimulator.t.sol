// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PublicModeSimulator.sol";

contract PublicModeSimulatorTest {
    uint256 private constant MERCHANT_ID = 101;
    uint16 private constant REPAYMENT_BPS = 800;

    function testPublishesSalesAndProjectedRepayment() public {
        PublicModeSimulator simulator = new PublicModeSimulator();

        (uint256 projectedRepayment, PublicModeSimulator.CompetitorSignal signal) =
            simulator.reportPublicSales(MERCHANT_ID, 1, 1_240, REPAYMENT_BPS);

        PublicModeSimulator.PublicSalesReport memory report = simulator.getReport(MERCHANT_ID, 1);

        require(projectedRepayment == 99, "projected repayment mismatch");
        require(signal == PublicModeSimulator.CompetitorSignal.NoBaseline, "first signal mismatch");
        require(report.grossSales == 1_240, "gross sales leaked mismatch");
        require(report.projectedRepayment == 99, "stored repayment mismatch");
        require(simulator.averagePublishedSales(MERCHANT_ID) == 1_240, "average mismatch");
    }

    function testDetectsStrongPublicSalesDay() public {
        PublicModeSimulator simulator = new PublicModeSimulator();

        simulator.reportPublicSales(MERCHANT_ID, 1, 1_000, REPAYMENT_BPS);
        simulator.reportPublicSales(MERCHANT_ID, 2, 1_020, REPAYMENT_BPS);

        (uint256 projectedRepayment, PublicModeSimulator.CompetitorSignal signal) =
            simulator.reportPublicSales(MERCHANT_ID, 3, 1_500, REPAYMENT_BPS);

        require(projectedRepayment == 120, "projected repayment mismatch");
        require(signal == PublicModeSimulator.CompetitorSignal.StrongDay, "strong day not detected");
    }

    function testDetectsWeakPublicSalesDay() public {
        PublicModeSimulator simulator = new PublicModeSimulator();

        simulator.reportPublicSales(MERCHANT_ID, 1, 1_000, REPAYMENT_BPS);
        simulator.reportPublicSales(MERCHANT_ID, 2, 1_020, REPAYMENT_BPS);

        (, PublicModeSimulator.CompetitorSignal signal) =
            simulator.reportPublicSales(MERCHANT_ID, 3, 700, REPAYMENT_BPS);

        require(signal == PublicModeSimulator.CompetitorSignal.WeakDay, "weak day not detected");
    }

    function testDetectsStablePublicSalesDay() public {
        PublicModeSimulator simulator = new PublicModeSimulator();

        simulator.reportPublicSales(MERCHANT_ID, 1, 1_000, REPAYMENT_BPS);
        simulator.reportPublicSales(MERCHANT_ID, 2, 1_020, REPAYMENT_BPS);

        (, PublicModeSimulator.CompetitorSignal signal) =
            simulator.reportPublicSales(MERCHANT_ID, 3, 1_100, REPAYMENT_BPS);

        require(signal == PublicModeSimulator.CompetitorSignal.Stable, "stable day not detected");
    }

    function testRejectsDuplicatePublicReport() public {
        PublicModeSimulator simulator = new PublicModeSimulator();

        simulator.reportPublicSales(MERCHANT_ID, 1, 1_240, REPAYMENT_BPS);

        try simulator.reportPublicSales(MERCHANT_ID, 1, 1_300, REPAYMENT_BPS) {
            revert("expected duplicate report");
        } catch (bytes memory) {
            require(true, "duplicate report rejected");
        }
    }

    function testRejectsInvalidRepaymentRate() public {
        PublicModeSimulator simulator = new PublicModeSimulator();

        try simulator.reportPublicSales(MERCHANT_ID, 1, 1_240, 10_001) {
            revert("expected invalid repayment rate");
        } catch (bytes memory) {
            require(true, "invalid repayment rate rejected");
        }
    }
}
