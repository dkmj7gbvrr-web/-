import Foundation
import SwiftData

/// ある年月における1人分の手取り収入。収入割合の算出に使う。
@Model
final class IncomeRecord {
    var id: UUID
    var year: Int
    var month: Int // 1...12
    var personRaw: String
    var netIncome: Decimal

    init(id: UUID = UUID(), year: Int, month: Int, person: PersonRole, netIncome: Decimal) {
        self.id = id
        self.year = year
        self.month = month
        self.personRaw = person.rawValue
        self.netIncome = netIncome
    }

    var person: PersonRole {
        get { PersonRole(rawValue: personRaw) ?? .a }
        set { personRaw = newValue.rawValue }
    }

    var yearMonth: YearMonth { YearMonth(year: year, month: month) }
}
