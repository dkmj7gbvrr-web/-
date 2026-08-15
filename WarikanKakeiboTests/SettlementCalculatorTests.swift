import XCTest
@testable import WarikanKakeibo

final class SettlementCalculatorTests: XCTestCase {
    func testSettlementNetsOutBetweenPayerAndBurden() {
        let cycle = BillingCycleCalculator.cycle(forStatement: YearMonth(year: 2026, month: 8), closingDay: 6)
        let d = dateFor(year: 2026, month: 8, day: 1)

        // Aが10000円立て替え、半々負担 -> Bが5000円払うべき
        let expense1 = Expense(date: d, amount: 10000, splitType: .equalSplit, paidBy: .a)
        // Bが3000円立て替え、全額Aの負担 -> Aが3000円払うべき
        let expense2 = Expense(date: d, amount: 3000, splitType: .aOnly, paidBy: .b)

        let settlement = SettlementCalculator.settlement(
            for: [expense1, expense2],
            cycle: cycle,
            incomeRecords: [],
            closingDay: 6
        )

        // 差し引き: BがAに5000円、AがBに3000円 => 実質BがAに2000円支払う
        XCTAssertEqual(settlement.netTransferFromBToA, 2000)
        XCTAssertEqual(settlement.settlementDescription?.payer, .b)
        XCTAssertEqual(settlement.settlementDescription?.receiver, .a)
        XCTAssertEqual(settlement.settlementDescription?.amount, 2000)
    }

    func testNoSettlementNeededWhenBalanced() {
        let cycle = BillingCycleCalculator.cycle(forStatement: YearMonth(year: 2026, month: 8), closingDay: 6)
        let d = dateFor(year: 2026, month: 8, day: 1)
        let expense = Expense(date: d, amount: 2000, splitType: .equalSplit, paidBy: .a)

        let settlement = SettlementCalculator.settlement(
            for: [expense],
            cycle: cycle,
            incomeRecords: [],
            closingDay: 6
        )

        XCTAssertEqual(settlement.settlementDescription?.amount, 1000)
    }

    func testExpensesOutsideCycleAreExcluded() {
        let cycle = BillingCycleCalculator.cycle(forStatement: YearMonth(year: 2026, month: 8), closingDay: 6)
        let outsideDate = dateFor(year: 2026, month: 6, day: 1)
        let expense = Expense(date: outsideDate, amount: 10000, splitType: .equalSplit, paidBy: .a)

        let settlement = SettlementCalculator.settlement(
            for: [expense],
            cycle: cycle,
            incomeRecords: [],
            closingDay: 6
        )

        XCTAssertEqual(settlement.totalAmount, 0)
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
