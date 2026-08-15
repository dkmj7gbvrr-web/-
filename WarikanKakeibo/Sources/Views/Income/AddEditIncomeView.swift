import SwiftUI
import SwiftData

struct AddEditIncomeView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let settings: AppSettings
    var record: IncomeRecord?

    @State private var year: Int = Calendar.current.component(.year, from: .now)
    @State private var month: Int = Calendar.current.component(.month, from: .now)
    @State private var person: PersonRole = .a
    @State private var netIncomeText: String = ""

    private var isEditing: Bool { record != nil }

    var body: some View {
        NavigationStack {
            Form {
                Picker("対象", selection: $person) {
                    Text(settings.personAName).tag(PersonRole.a)
                    Text(settings.personBName).tag(PersonRole.b)
                }
                .pickerStyle(.segmented)

                Stepper("年: \(year)", value: $year, in: 2000...2100)
                Stepper("月: \(month)", value: $month, in: 1...12)

                TextField("手取り額（円）", text: $netIncomeText)
                    .keyboardType(.numberPad)
            }
            .navigationTitle(isEditing ? "収入を編集" : "収入を追加")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(Decimal(string: netIncomeText) == nil)
                }
            }
            .onAppear(perform: loadIfEditing)
        }
    }

    private func loadIfEditing() {
        guard let record else { return }
        year = record.year
        month = record.month
        person = record.person
        netIncomeText = NSDecimalNumber(decimal: record.netIncome).stringValue
    }

    private func save() {
        guard let netIncome = Decimal(string: netIncomeText) else { return }
        if let record {
            record.year = year
            record.month = month
            record.person = person
            record.netIncome = netIncome
        } else {
            let newRecord = IncomeRecord(year: year, month: month, person: person, netIncome: netIncome)
            modelContext.insert(newRecord)
        }
        dismiss()
    }
}
