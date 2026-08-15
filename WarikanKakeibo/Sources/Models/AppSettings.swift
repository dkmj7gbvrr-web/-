import Foundation
import SwiftData

/// アプリ全体の設定。常に1件だけ存在する想定のシングルトン的モデル。
@Model
final class AppSettings {
    var personAName: String
    var personBName: String
    /// クレジットカードの締め日（毎月1〜28日）。デフォルトは6日締め。
    var cardClosingDay: Int

    init(personAName: String = "A", personBName: String = "B", cardClosingDay: Int = 6) {
        self.personAName = personAName
        self.personBName = personBName
        self.cardClosingDay = cardClosingDay
    }
}
