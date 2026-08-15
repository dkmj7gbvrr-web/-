import SwiftUI
import SwiftData

struct AddEditExpenseView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let settings: AppSettings
    var expense: Expense?

    @State private var date: Date = .now
    @State private var amountText: String = ""
    @State private var memo: String = ""
    @State private var splitType: SplitType = .equalSplit
    @State private var customAPercent: Double = 50
    @State private var paidBy: PersonRole = .a

    private var isEditing: Bool { expense != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section("内容") {
                    TextField("メモ（例: スーパーで食材）", text: $memo)
                    DatePicker("日付", selection: $date, displayedComponents: .date)
                    TextField("金額（円）", text: $amountText)
                        .keyboardType(.numberPad)
                }

                Section("負担の分け方") {
                    Picker("パターン", selection: $splitType) {
                        ForEach(SplitType.allCases) { type in
                            Text(type.displayName(aName: settings.personAName, bName: settings.personBName))
                                .tag(type)
                        }
                    }
                    if splitType == .customRatio {
                        VStack(alignment: .leading) {
                            Text("\(settings.personAName): \(Int(customAPercent))%　\(settings.personBName): \(100 - Int(customAPercent))%")
                            Slider(value: $customAPercent, in: 0...100, step: 5)
                        }
                    }
                }

                Section("支払い") {
                    Picker("実際に立て替えた人", selection: $paidBy) {
                        Text(settings.personAName).tag(PersonRole.a)
                        Text(settings.personBName).tag(PersonRole.b)
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle(isEditing ? "支出を編集" : "支出を追加")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(Decimal(string: amountText) == nil)
                }
            }
            .onAppear(perform: loadIfEditing)
        }
    }

    private func loadIfEditing() {
        guard let expense else { return }
        date = expense.date
        amountText = NSDecimalNumber(decimal: expense.amount).stringValue
        memo = expense.memo
        splitType = expense.splitType
        customAPercent = Double(expense.customAPercent ?? 50)
        paidBy = expense.paidBy
    }

    private func save() {
        guard let amount = Decimal(string: amountText) else { return }
        let customPercent = splitType == .customRatio ? Int(customAPercent) : nil

        if let expense {
            expense.date = date
            expense.amount = amount
            expense.memo = memo
            expense.splitType = splitType
            expense.customAPercent = customPercent
            expense.paidBy = paidBy
        } else {
            let newExpense = Expense(
                date: date,
                amount: amount,
                memo: memo,
                splitType: splitType,
                customAPercent: customPercent,
                paidBy: paidBy
            )
            modelContext.insert(newExpense)
        }
        dismiss()
    }
}
