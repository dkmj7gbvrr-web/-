import Foundation

/// 家計を共有する2人のうちどちらかを表す。表示名は AppSettings でカスタマイズ可能。
enum PersonRole: String, Codable, CaseIterable, Identifiable {
    case a
    case b

    var id: String { rawValue }
}
