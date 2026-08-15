import XCTest
@testable import WarikanKakeibo

final class IncomeRatioCalculatorTests: XCTestCase {
    func testEvenSplitRoundsTo50() {
        let records = [
            IncomeRecord(year: 2026, month: 1, person: .a, netIncome: 300_000),
            IncomeRecord(year: 2026, month: 1, person: .b, netIncome: 300_000)
        ]
        let percent = IncomeRatioCalculator.aPercent(asOf: YearMonth(year: 2026, month: 1), records: records)
        XCTAssertEqual(percent, 50)
    }

    func testRoundsToNearest5Percent() {
        let records = [
            IncomeRecord(year: 2026, month: 1, person: .a, netIncome: 620_000),
            IncomeRecord(year: 2026, month: 1, person: .b, netIncome: 380_000)
        ]
        // A = 62% -> 直近の5%単位は60%
        let percent = IncomeRatioCalculator.aPercent(asOf: YearMonth(year: 2026, month: 1), records: records)
        XCTAssertEqual(percent, 60)
    }

    func testNoDataFallsBackTo50() {
        let percent = IncomeRatioCalculator.aPercent(asOf: YearMonth(year: 2026, month: 1), records: [])
        XCTAssertEqual(percent, 50)
    }

    func testOnlyUsesTrailing12Months() {
        let records = [
            IncomeRecord(year: 2024, month: 1, person: .a, netIncome: 1_000_000), // 12ヶ月より前なので除外される
            IncomeRecord(year: 2026, month: 1, person: .a, netIncome: 400_000),
            IncomeRecord(year: 2026, month: 1, person: .b, netIncome: 600_000)
        ]
        let percent = IncomeRatioCalculator.aPercent(asOf: YearMonth(year: 2026, month: 1), records: records)
        XCTAssertEqual(percent, 40)
    }
}
