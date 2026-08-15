import Foundation

/// 年月だけを表す軽量な値。収入データの集計キーや請求サイクルのラベルに使う。
struct YearMonth: Hashable, Comparable, Codable {
    var year: Int
    var month: Int // 1...12

    static func < (lhs: YearMonth, rhs: YearMonth) -> Bool {
        (lhs.year, lhs.month) < (rhs.year, rhs.month)
    }

    /// delta ヶ月だけ加算（負数で減算）した YearMonth を返す。
    func adding(months delta: Int) -> YearMonth {
        let totalMonths = (year * 12 + (month - 1)) + delta
        let newYear = totalMonths >= 0 ? totalMonths / 12 : (totalMonths - 11) / 12
        let newMonth = ((totalMonths % 12) + 12) % 12 + 1
        return YearMonth(year: newYear, month: newMonth)
    }

    var displayString: String { "\(year)年\(month)月" }

    static var current: YearMonth {
        let comps = Calendar.current.dateComponents([.year, .month], from: .now)
        return YearMonth(year: comps.year ?? 2000, month: comps.month ?? 1)
    }
}
