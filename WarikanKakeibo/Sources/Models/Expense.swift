import Foundation
import SwiftData

@Model
final class Expense {
    var id: UUID
    var date: Date
    var amount: Decimal
    var memo: String
    var splitTypeRaw: String
    /// splitType が .customRatio のときのみ使用。Aの負担割合(0-100)。
    var customAPercent: Int?
    /// 実際にこの支出を立て替えた人。
    var paidByRaw: String
    var createdAt: Date

    init(
        id: UUID = UUID(),
        date: Date = .now,
        amount: Decimal,
        memo: String = "",
        splitType: SplitType,
        customAPercent: Int? = nil,
        paidBy: PersonRole,
        createdAt: Date = .now
    ) {
        self.id = id
        self.date = date
        self.amount = amount
        self.memo = memo
        self.splitTypeRaw = splitType.rawValue
        self.customAPercent = customAPercent
        self.paidByRaw = paidBy.rawValue
        self.createdAt = createdAt
    }

    var splitType: SplitType {
        get { SplitType(rawValue: splitTypeRaw) ?? .equalSplit }
        set { splitTypeRaw = newValue.rawValue }
    }

    var paidBy: PersonRole {
        get { PersonRole(rawValue: paidByRaw) ?? .a }
        set { paidByRaw = newValue.rawValue }
    }
}
