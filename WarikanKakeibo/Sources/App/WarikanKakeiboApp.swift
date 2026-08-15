import SwiftUI
import SwiftData

@main
struct WarikanKakeiboApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Expense.self,
            IncomeRecord.self,
            AppSettings.self
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("ModelContainerの作成に失敗しました: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(sharedModelContainer)
    }
}
