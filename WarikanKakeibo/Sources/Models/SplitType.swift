import Foundation

/// 支出の負担の分け方。5パターンのみをサポートする。
enum SplitType: String, Codable, CaseIterable, Identifiable {
    case aOnly
    case bOnly
    case equalSplit
    case incomeRatio
    case customRatio

    var id: String { rawValue }

    /// 表示名をAさん・Bさんの名前を差し込んで生成する。
    func displayName(aName: String, bName: String) -> String {
        switch self {
        case .aOnly: return "\(aName)が100%負担"
        case .bOnly: return "\(bName)が100%負担"
        case .equalSplit: return "半々で負担"
        case .incomeRatio: return "収入割合で負担"
        case .customRatio: return "任意の割合で負担"
        }
    }

    var shortLabel: String {
        switch self {
        case .aOnly: return "A 100%"
        case .bOnly: return "B 100%"
        case .equalSplit: return "半々"
        case .incomeRatio: return "収入割合"
        case .customRatio: return "任意割合"
        }
    }
}
