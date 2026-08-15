import SwiftUI
import SwiftData

struct ExpenseListView: View {
    @Query(sort: \Expense.date, order: .reverse) private var expenses: [Expense]
    @Query private var settingsList: [AppSettings]
    @Environment(\.modelContext) private var modelContext

    @State private var isPresentingAddExpense = false
    @State private var editingExpense: Expense?

    private var settings: AppSettings { settingsList.first ?? AppSettings() }

    private var groupedByCycle: [(cycle: BillingCycle, expenses: [Expense])] {
        let closingDay = settings.cardClosingDay
        let grouped = Dictionary(grouping: expenses) { expense in
            BillingCycleCalculator.cycle(containing: expense.date, closingDay: closingDay)
        }
        return grouped
            .map { (cycle: $0.key, expenses: $0.value.sorted { $0.date > $1.date }) }
            .sorted { $0.cycle.start > $1.cycle.start }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(groupedByCycle, id: \.cycle) { group in
                    Section(group.cycle.label) {
                        ForEach(group.expenses) { expense in
                            ExpenseRowView(expense: expense, settings: settings)
                                .contentShape(Rectangle())
                                .onTapGesture { editingExpense = expense }
                        }
                        .onDelete { offsets in
                            delete(offsets: offsets, in: group.expenses)
                        }
                    }
                }
            }
            .navigationTitle("支出")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isPresentingAddExpense = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $isPresentingAddExpense) {
                AddEditExpenseView(settings: settings)
            }
            .sheet(item: $editingExpense) { expense in
                AddEditExpenseView(settings: settings, expense: expense)
            }
            .overlay {
                if expenses.isEmpty {
                    ContentUnavailableView(
                        "支出がありません",
                        systemImage: "tray",
                        description: Text("右上の + から支出を追加してください")
                    )
                }
            }
        }
    }

    private func delete(offsets: IndexSet, in expensesInSection: [Expense]) {
        for index in offsets {
            modelContext.delete(expensesInSection[index])
        }
    }
}
