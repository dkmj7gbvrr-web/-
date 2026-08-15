import SwiftUI
import SwiftData

struct IncomeListView: View {
    @Query(sort: [SortDescriptor(\IncomeRecord.year, order: .reverse), SortDescriptor(\IncomeRecord.month, order: .reverse)])
    private var records: [IncomeRecord]
    @Query private var settingsList: [AppSettings]
    @Environment(\.modelContext) private var modelContext

    @State private var isPresentingAdd = false
    @State private var editingRecord: IncomeRecord?

    private var settings: AppSettings { settingsList.first ?? AppSettings() }

    private var groupedByMonth: [(yearMonth: YearMonth, records: [IncomeRecord])] {
        let grouped = Dictionary(grouping: records) { $0.yearMonth }
        return grouped
            .map { (yearMonth: $0.key, records: $0.value) }
            .sorted { $0.yearMonth > $1.yearMonth }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    let currentRatio = IncomeRatioCalculator.aPercent(asOf: YearMonth.current, records: records)
                    LabeledContent("現在の収入割合（直近12ヶ月・5%刻み）") {
                        Text("\(settings.personAName) \(currentRatio)% : \(settings.personBName) \(100 - currentRatio)%")
                    }
                }

                ForEach(groupedByMonth, id: \.yearMonth) { group in
                    Section(group.yearMonth.displayString) {
                        ForEach(group.records) { record in
                            HStack {
                                Text(record.person == .a ? settings.personAName : settings.personBName)
                                Spacer()
                                Text(CurrencyFormatter.string(from: record.netIncome))
                            }
                            .contentShape(Rectangle())
                            .onTapGesture { editingRecord = record }
                        }
                        .onDelete { offsets in
                            delete(offsets: offsets, in: group.records)
                        }
                    }
                }
            }
            .navigationTitle("収入（手取り）")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { isPresentingAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $isPresentingAdd) {
                AddEditIncomeView(settings: settings)
            }
            .sheet(item: $editingRecord) { record in
                AddEditIncomeView(settings: settings, record: record)
            }
            .overlay {
                if records.isEmpty {
                    ContentUnavailableView(
                        "収入データがありません",
                        systemImage: "yensign.circle",
                        description: Text("「収入割合で負担する費用」を使うには、毎月の手取りを登録してください")
                    )
                }
            }
        }
    }

    private func delete(offsets: IndexSet, in recordsInSection: [IncomeRecord]) {
        for index in offsets {
            modelContext.delete(recordsInSection[index])
        }
    }
}
