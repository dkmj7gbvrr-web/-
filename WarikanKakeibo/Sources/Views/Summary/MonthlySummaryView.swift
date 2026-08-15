import SwiftUI
import SwiftData

struct MonthlySummaryView: View {
    @Query(sort: \Expense.date) private var expenses: [Expense]
    @Query private var incomeRecords: [IncomeRecord]
    @Query private var settingsList: [AppSettings]

    @State private var selectedCycleIndex: Int = 0

    private var settings: AppSettings { settingsList.first ?? AppSettings() }

    private var availableCycles: [BillingCycle] {
        let closingDay = settings.cardClosingDay
        let cycles = Set(expenses.map { BillingCycleCalculator.cycle(containing: $0.date, closingDay: closingDay) })
        let sorted = cycles.sorted { $0.start > $1.start }
        if sorted.isEmpty {
            return [BillingCycleCalculator.cycle(containing: .now, closingDay: closingDay)]
        }
        return sorted
    }

    private var selectedCycle: BillingCycle {
        let clampedIndex = min(selectedCycleIndex, availableCycles.count - 1)
        return availableCycles[max(0, clampedIndex)]
    }

    private var settlement: MonthlySettlement {
        SettlementCalculator.settlement(
            for: expenses,
            cycle: selectedCycle,
            incomeRecords: incomeRecords,
            closingDay: settings.cardClosingDay
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("集計月", selection: $selectedCycleIndex) {
                        ForEach(Array(availableCycles.enumerated()), id: \.offset) { index, cycle in
                            Text(cycle.label).tag(index)
                        }
                    }
                    Text("\(dateString(selectedCycle.start)) 〜 \(dateString(selectedCycle.end))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("負担額（本来支払うべき金額）") {
                    LabeledContent(settings.personAName, value: CurrencyFormatter.string(from: settlement.burdenA))
                    LabeledContent(settings.personBName, value: CurrencyFormatter.string(from: settlement.burdenB))
                    LabeledContent("合計", value: CurrencyFormatter.string(from: settlement.totalAmount))
                }

                Section("実際の立替額") {
                    LabeledContent(settings.personAName, value: CurrencyFormatter.string(from: settlement.paidByA))
                    LabeledContent(settings.personBName, value: CurrencyFormatter.string(from: settlement.paidByB))
                }

                Section("精算") {
                    if let result = settlement.settlementDescription {
                        let payerName = result.payer == .a ? settings.personAName : settings.personBName
                        let receiverName = result.receiver == .a ? settings.personAName : settings.personBName
                        Text("\(payerName) → \(receiverName)　\(CurrencyFormatter.string(from: result.amount))")
                            .font(.headline)
                    } else {
                        Text("精算の必要はありません")
                    }
                }

                Section("内訳（負担パターン別）") {
                    ForEach(SplitType.allCases) { type in
                        if let amount = settlement.bySplitType[type], amount > 0 {
                            LabeledContent(
                                type.displayName(aName: settings.personAName, bName: settings.personBName),
                                value: CurrencyFormatter.string(from: amount)
                            )
                        }
                    }
                }
            }
            .navigationTitle("集計")
        }
    }

    private func dateString(_ date: Date) -> String {
        date.formatted(.dateTime.year().month().day())
    }
}
