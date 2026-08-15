import SwiftUI
import SwiftData

struct RootView: View {
    @Query private var settingsList: [AppSettings]
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        TabView {
            ExpenseListView()
                .tabItem { Label("支出", systemImage: "list.bullet") }

            MonthlySummaryView()
                .tabItem { Label("集計", systemImage: "chart.pie") }

            IncomeListView()
                .tabItem { Label("収入", systemImage: "yensign.circle") }

            SettingsView()
                .tabItem { Label("設定", systemImage: "gearshape") }
        }
        .onAppear(perform: ensureSettingsExist)
    }

    private func ensureSettingsExist() {
        guard settingsList.isEmpty else { return }
        modelContext.insert(AppSettings())
    }
}
