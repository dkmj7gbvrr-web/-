import Foundation

/// 「直近1年の手取りの割合を5%単位で丸めたもの」を計算する。
enum IncomeRatioCalculator {
    /// 指定した年月を含む直近12ヶ月分の手取り合計から、Aの負担割合(0-100, 5%刻み)を返す。
    /// データが無い場合は 50 を返す。
    static func aPercent(asOf ym: YearMonth, records: [IncomeRecord]) -> Int {
        let windowStart = ym.adding(months: -11)
        let windowRecords = records.filter { $0.yearMonth >= windowStart && $0.yearMonth <= ym }

        let aSum = windowRecords.filter { $0.person == .a }.reduce(Decimal(0)) { $0 + $1.netIncome }
        let bSum = windowRecords.filter { $0.person == .b }.reduce(Decimal(0)) { $0 + $1.netIncome }
        let total = aSum + bSum

        guard total > 0 else { return 50 }

        let rawPercent = (aSum / total) * 100
        return roundedToNearest5(rawPercent)
    }

    private static func roundedToNearest5(_ value: Decimal) -> Int {
        let doubleValue = NSDecimalNumber(decimal: value).doubleValue
        let rounded = (doubleValue / 5.0).rounded() * 5.0
        return min(100, max(0, Int(rounded)))
    }
}
