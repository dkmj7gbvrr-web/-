import SwiftUI

struct ExpenseRowView: View {
    let expense: Expense
    let settings: AppSettings

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(expense.memo.isEmpty ? expense.splitType.shortLabel : expense.memo)
                    .font(.body)
                HStack(spacing: 6) {
                    Text(expense.date, format: .dateTime.month().day())
                    Text("・")
                    Text(expense.splitType.displayName(aName: settings.personAName, bName: settings.personBName))
                    Text("・")
                    Text("立替: \(expense.paidBy == .a ? settings.personAName : settings.personBName)")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Text(CurrencyFormatter.string(from: expense.amount))
                .font(.body.monospacedDigit())
        }
        .padding(.vertical, 2)
    }
}
