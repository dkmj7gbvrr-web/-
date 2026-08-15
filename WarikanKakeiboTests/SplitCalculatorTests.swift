import XCTest
@testable import WarikanKakeibo

final class SplitCalculatorTests: XCTestCase {
    func testAOnly() {
        let expense = Expense(amount: 1000, splitType: .aOnly, paidBy: .a)
        let burden = SplitCalculator.burden(for: expense, incomeRecords: [], closingDay: 6)
        XCTAssertEqual(burden.aAmount, 1000)
        XCTAssertEqual(burden.bAmount, 0)
    }

    func testBOnly() {
        let expense = Expense(amount: 1000, splitType: .bOnly, paidBy: .a)
        let burden = SplitCalculator.burden(for: expense, incomeRecords: [], closingDay: 6)
        XCTAssertEqual(burden.aAmount, 0)
        XCTAssertEqual(burden.bAmount, 1000)
    }

    func testEqualSplitWithOddAmountGivesRemainderToB() {
        let expense = Expense(amount: 1001, splitType: .equalSplit, paidBy: .a)
        let burden = SplitCalculator.burden(for: expense, incomeRecords: [], closingDay: 6)
        XCTAssertEqual(burden.aAmount, 500)
        XCTAssertEqual(burden.bAmount, 501)
        XCTAssertEqual(burden.aAmount + burden.bAmount, expense.amount)
    }

    func testCustomRatio() {
        let expense = Expense(amount: 10000, splitType: .customRatio, customAPercent: 70, paidBy: .a)
        let burden = SplitCalculator.burden(for: expense, incomeRecords: [], closingDay: 6)
        XCTAssertEqual(burden.aAmount, 7000)
        XCTAssertEqual(burden.bAmount, 3000)
    }

    func testIncomeRatioUsesTrailing12MonthsAsOfStatementMonth() {
        let records = [
            IncomeRecord(year: 2026, month: 8, person: .a, netIncome: 600_000),
            IncomeRecord(year: 2026, month: 8, person: .b, netIncome: 400_000)
        ]
        let date = dateFor(year: 2026, month: 8, day: 3) // 締め日(6日)より前なので8月分の締めに属する
        let expense = Expense(date: date, amount: 10000, splitType: .incomeRatio, paidBy: .a)
        let burden = SplitCalculator.burden(for: expense, incomeRecords: records, closingDay: 6)
        XCTAssertEqual(burden.aAmount, 6000)
        XCTAssertEqual(burden.bAmount, 4000)
    }

    private func dateFor(year: Int, month: Int, day: Int) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = day
        comps.hour = 12
        return cal.date(from: comps)!
    }
}
