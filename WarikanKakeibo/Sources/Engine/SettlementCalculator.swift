import Foundation

/// 1つの締めサイクル分の集計結果。
struct MonthlySettlement {
    let cycle: BillingCycle
    let totalAmount: Decimal
    let paidByA: Decimal
    let paidByB: Decimal
    let burdenA: Decimal
    let burdenB: Decimal
    let bySplitType: [SplitType: Decimal]

    /// 正の値: Bが立て替えすぎているA分の差額 = Bが受け取るべき金額（AがBに支払う）
    /// 実際には「Aが払った額 - Aが本来負担すべき額」。正ならAが多く払っているのでBがAに払う。
    var netTransferFromBToA: Decimal { paidByA - burdenA }

    /// 実際に必要な精算（誰が誰にいくら払うか）。精算不要なら nil。
    var settlementDescription: (payer: PersonRole, receiver: PersonRole, amount: Decimal)? {
        let diff = netTransferFromBToA
        if diff > 0 {
            return (payer: .b, receiver: .a, amount: diff)
        } else if diff < 0 {
            return (payer: .a, receiver: .b, amount: -diff)
        }
        return nil
    }
}

enum SettlementCalculator {
    static func settlement(
        for expenses: [Expense],
        cycle: BillingCycle,
        incomeRecords: [IncomeRecord],
        closingDay: Int
    ) -> MonthlySettlement {
        let targetExpenses = expenses.filter { $0.date >= cycle.start && $0.date <= cycle.end }

        var paidByA = Decimal(0)
        var paidByB = Decimal(0)
        var burdenA = Decimal(0)
        var burdenB = Decimal(0)
        var total = Decimal(0)
        var bySplitType: [SplitType: Decimal] = [:]

        for expense in targetExpenses {
            total += expense.amount

            switch expense.paidBy {
            case .a: paidByA += expense.amount
            case .b: paidByB += expense.amount
            }

            let burden = SplitCalculator.burden(for: expense, incomeRecords: incomeRecords, closingDay: closingDay)
            burdenA += burden.aAmount
            burdenB += burden.bAmount

            bySplitType[expense.splitType, default: 0] += expense.amount
        }

        return MonthlySettlement(
            cycle: cycle,
            totalAmount: total,
            paidByA: paidByA,
            paidByB: paidByB,
            burdenA: burdenA,
            burdenB: burdenB,
            bySplitType: bySplitType
        )
    }
}
