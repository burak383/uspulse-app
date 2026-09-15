import WidgetKit
import SwiftUI

// bkz. mobile/src/widgets/snapshot.ts -- uygulama her başarılı GET /me
// çekişinde bu App Group'taki UserDefaults'a yazıyor ve reloadWidget()
// çağırıyor. Bu widget'ın KENDİ ağ/oturum mantığı yok, sadece uygulamanın
// zaten bildiği son veriyi yansıtıyor. Grup adı app.json'daki
// ios.entitlements ve expo-target.config.js ile birebir eşleşmeli.
private let appGroup = "group.app.uspulse.mobile"

struct UsPulseEntry: TimelineEntry {
    let date: Date
    let daysTogether: Int?
    let partnerName: String?
    let distanceKm: Int?
}

struct UsPulseProvider: TimelineProvider {
    func placeholder(in context: Context) -> UsPulseEntry {
        UsPulseEntry(date: Date(), daysTogether: 128, partnerName: "Partnerin", distanceKm: 12)
    }

    func getSnapshot(in context: Context, completion: @escaping (UsPulseEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<UsPulseEntry>) -> Void) {
        let entry = readEntry()
        // Bu sadece bir güvenlik ağı -- normalde uygulama snapshot.ts
        // üzerinden anında reloadWidget() tetikliyor. Uygulama uzun süre hiç
        // açılmazsa bile widget kendini en geç 30 dakikada bir tazeler.
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func readEntry() -> UsPulseEntry {
        let defaults = UserDefaults(suiteName: appGroup)
        // -1 / boş metin: "henüz veri yok ya da paylaşılmıyor" için, JS
        // tarafının (ExtensionStorage sadece düz string/number yazabiliyor)
        // null göndermesinin yerini tutan sentinel değerler (bkz. snapshot.ts).
        let daysRaw = defaults?.object(forKey: "daysTogether") as? Int ?? -1
        let partnerRaw = defaults?.string(forKey: "partnerName") ?? ""
        let distanceRaw = defaults?.object(forKey: "distanceKm") as? Int ?? -1

        return UsPulseEntry(
            date: Date(),
            daysTogether: daysRaw >= 0 ? daysRaw : nil,
            partnerName: partnerRaw.isEmpty ? nil : partnerRaw,
            distanceKm: distanceRaw >= 0 ? distanceRaw : nil
        )
    }
}

struct UsPulseWidgetView: View {
    var entry: UsPulseProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("💜 UsPulse")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(Color(white: 0.75))

            if let days = entry.daysTogether {
                Text("\(days) gün")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.top, 2)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)

                Text(entry.partnerName.map { "\($0) ile birlikte" } ?? "Birlikte")
                    .font(.system(size: 12))
                    .foregroundColor(Color(white: 0.75))
                    .lineLimit(1)

                if let distance = entry.distanceKm {
                    Text("~\(distance) km uzakta")
                        .font(.system(size: 11))
                        .foregroundColor(Color(white: 0.75))
                        .padding(.top, 4)
                }
            } else {
                Text("Açmak için dokun")
                    .font(.system(size: 12))
                    .foregroundColor(Color(white: 0.75))
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding()
        .containerBackground(for: .widget) {
            // theme.ts'teki colors.card'a yakın bir ton -- widget hedefi
            // uygulamanın theme modülünü içe aktaramadığı için sabit kodlu.
            Color(red: 0.165, green: 0.106, blue: 0.188)
        }
    }
}

struct UsPulseWidget: Widget {
    let kind: String = "UsPulseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: UsPulseProvider()) { entry in
            UsPulseWidgetView(entry: entry)
        }
        .configurationDisplayName("UsPulse")
        .description("Birlikte kaç gündür olduğunuzu ve aranızdaki mesafeyi gösterir.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemSmall) {
    UsPulseWidget()
} timeline: {
    UsPulseEntry(date: .now, daysTogether: 128, partnerName: "Ayşe", distanceKm: 12)
    UsPulseEntry(date: .now, daysTogether: nil, partnerName: nil, distanceKm: nil)
}
