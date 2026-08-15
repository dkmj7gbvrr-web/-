import Foundation

/// クレジットカードの締めサイクル1回分（締め日の翌日〜締め日）を表す。
struct BillingCycle: Hashable {
    let start: Date // 含む（サイクル開始日 00:00）
    let end: Date   // 含む（締め日 23:59:59）
    let statementYearMonth: YearMonth // このサイクルが「何月分の締め」かを表す年月

    var label: String { "\(statementYearMonth.displayString)締め分" }
}

enum BillingCycleCalculator {
    /// 指定した日付がどの締めサイクルに属するかを計算する。
    static func cycle(containing date: Date, closingDay: Int, calendar: Calendar = .current) -> BillingCycle {
        let cal = tokyoCalendar(from: calendar)
        let day = cal.component(.day, from: date)

        let statementYM: YearMonth
        if day > closingDay {
            let nextMonthDate = cal.date(byAdding: .month, value: 1, to: date) ?? date
            let comps = cal.dateComponents([.year, .month], from: nextMonthDate)
            statementYM = YearMonth(year: comps.year ?? 2000, month: comps.month ?? 1)
        } else {
            let comps = cal.dateComponents([.year, .month], from: date)
            statementYM = YearMonth(year: comps.year ?? 2000, month: comps.month ?? 1)
        }

        return cycle(forStatement: statementYM, closingDay: closingDay, calendar: cal)
    }

    /// 「何月分の締め」かを直接指定してサイクルの開始日・終了日を求める。
    static func cycle(forStatement ym: YearMonth, closingDay: Int, calendar: Calendar = .current) -> BillingCycle {
        let cal = tokyoCalendar(from: calendar)

        var endComponents = DateComponents()
        endComponents.year = ym.year
        endComponents.month = ym.month
        endComponents.day = clampedDay(closingDay, year: ym.year, month: ym.month, calendar: cal)
        endComponents.hour = 23
        endComponents.minute = 59
        endComponents.second = 59
        let end = cal.date(from: endComponents) ?? .now

        let prevYM = ym.adding(months: -1)
        var startBaseComponents = DateComponents()
        startBaseComponents.year = prevYM.year
        startBaseComponents.month = prevYM.month
        startBaseComponents.day = clampedDay(closingDay, year: prevYM.year, month: prevYM.month, calendar: cal)
        startBaseComponents.hour = 0
        startBaseComponents.minute = 0
        startBaseComponents.second = 0
        let startBase = cal.date(from: startBaseComponents) ?? .now
        let start = cal.date(byAdding: .day, value: 1, to: startBase) ?? startBase

        return BillingCycle(start: start, end: end, statementYearMonth: ym)
    }

    private static func tokyoCalendar(from calendar: Calendar) -> Calendar {
        var cal = calendar
        cal.timeZone = TimeZone(identifier: "Asia/Tokyo") ?? calendar.timeZone
        return cal
    }

    /// 締め日が月の日数を超える場合（2月に31日など）は月末日にクランプする。
    private static func clampedDay(_ day: Int, year: Int, month: Int, calendar: Calendar) -> Int {
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        guard let date = calendar.date(from: comps),
              let range = calendar.range(of: .day, in: .month, for: date) else {
            return day
        }
        return min(day, range.count)
    }
}
