import XCTest
@testable import WarikanKakeibo

final class BillingCycleTests: XCTestCase {
    private var calendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        return cal
    }

    func testDateOnClosingDayBelongsToCurrentMonthStatement() {
        let date = dateFor(year: 2026, month: 8, day: 6)
        let cycle = BillingCycleCalculator.cycle(containing: date, closingDay: 6, calendar: calendar)
        XCTAssertEqual(cycle.statementYearMonth, YearMonth(year: 2026, month: 8))
    }

    func testDateAfterClosingDayBelongsToNextMonthStatement() {
        let date = dateFor(year: 2026, month: 8, day: 7)
        let cycle = BillingCycleCalculator.cycle(containing: date, closingDay: 6, calendar: calendar)
        XCTAssertEqual(cycle.statementYearMonth, YearMonth(year: 2026, month: 9))
    }

    func testCycleStartIsDayAfterPreviousClosing() {
        // 8/1 は締め日(6日)以前なので8月分の締めに属し、開始日は前月の締め日の翌日(7/7)になる。
        let date = dateFor(year: 2026, month: 8, day: 1)
        let cycle = BillingCycleCalculator.cycle(containing: date, closingDay: 6, calendar: calendar)
        let expectedStart = dateFor(year: 2026, month: 7, day: 7)
        XCTAssertEqual(calendar.startOfDay(for: cycle.start), calendar.startOfDay(for: expectedStart))
    }

    func testDateWellAfterClosingDayBelongsToNextMonthStatement() {
        // 8/15 は締め日(6日)より後なので9月分の締め(8/7〜9/6)に属する。
        let date = dateFor(year: 2026, month: 8, day: 15)
        let cycle = BillingCycleCalculator.cycle(containing: date, closingDay: 6, calendar: calendar)
        XCTAssertEqual(cycle.statementYearMonth, YearMonth(year: 2026, month: 9))
        let expectedStart = dateFor(year: 2026, month: 8, day: 7)
        XCTAssertEqual(calendar.startOfDay(for: cycle.start), calendar.startOfDay(for: expectedStart))
    }

    func testClosingDayBeyondMonthLengthIsClampedToMonthEnd() {
        // 締め日を31日に設定した場合、2月は28日（うるう年でなければ）にクランプされる。
        let cycle = BillingCycleCalculator.cycle(forStatement: YearMonth(year: 2026, month: 2), closingDay: 31, calendar: calendar)
        let comps = calendar.dateComponents([.day], from: cycle.end)
        XCTAssertEqual(comps.day, 28)
    }

    private func dateFor(year: Int, month: Int, day: Int) -> Date {
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = day
        comps.hour = 12
        return calendar.date(from: comps)!
    }
}
