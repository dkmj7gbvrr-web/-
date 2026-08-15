import Foundation

/// 1件の支出をAとBの負担額に分解した結果。aAmount + bAmount は必ず元の金額と一致する。
struct Burden {
    let aAmount: Decimal
    let bAmount: Decimal
}

enum SplitCalculator {
    static func burden(for expense: Expense, incomeRecords: [IncomeRecord], closingDay: Int) -> Burden {
        let amount = expense.amount

        switch expense.splitType {
        case .aOnly:
            return Burden(aAmount: amount, bAmount: 0)
        case .bOnly:
            return Burden(aAmount: 0, bAmount: amount)
        case .equalSplit:
            return splitByPercent(amount: amount, aPercent: 50)
        case .incomeRatio:
            let cycle = BillingCycleCalculator.cycle(containing: expense.date, closingDay: closingDay)
            let aPercent = IncomeRatioCalculator.aPercent(asOf: cycle.statementYearMonth, records: incomeRecords)
            return splitByPercent(amount: amount, aPercent: aPercent)
        case .customRatio:
            let aPercent = expense.customAPercent ?? 50
            return splitByPercent(amount: amount, aPercent: aPercent)
        }
    }

    /// Aの割合(%)で分割する。Aの金額を四捨五入し、Bの金額は残り(合計 - Aの金額)として求めるため、
    /// 端数が生じても合計は必ず元の金額と一致する（例: 1001円を50%ずつ分けるとA=501円, B=500円）。
    private static func splitByPercent(amount: Decimal, aPercent: Int) -> Burden {
        let clamped = min(100, max(0, aPercent))
        var aAmount = (amount * Decimal(clamped) / 100)
        var rounded = Decimal()
        NSDecimalRound(&rounded, &aAmount, 0, .plain)
        let bAmount = amount - rounded
        return Burden(aAmount: rounded, bAmount: bAmount)
    }
}
