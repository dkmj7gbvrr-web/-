import SwiftUI
import SwiftData

struct SettingsView: View {
    // AppSettings の初回作成は RootView が一元的に行う。ここでは読み取り/編集のみ。
    @Query private var settingsList: [AppSettings]

    var body: some View {
        NavigationStack {
            Group {
                if let settings = settingsList.first {
                    SettingsForm(settings: settings)
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("設定")
        }
    }
}

private struct SettingsForm: View {
    @Bindable var settings: AppSettings

    var body: some View {
        Form {
            Section("表示名") {
                TextField("Aさんの名前", text: $settings.personAName)
                TextField("Bさんの名前", text: $settings.personBName)
            }

            Section("クレジットカード") {
                Stepper("締め日: 毎月\(settings.cardClosingDay)日", value: $settings.cardClosingDay, in: 1...28)
                Text("締め日の翌日から翌月の締め日までを1ヶ月分（1つの請求サイクル）として、「集計」タブで集計します。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
