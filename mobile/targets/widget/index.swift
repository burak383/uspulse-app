import WidgetKit
import SwiftUI

// Sadece TEK bir statik (Timeline tabanlı) widget dışa aktarılıyor --
// `create-target widget` şablonunun varsayılan olarak getirdiği Live
// Activity / Control Widget / yapılandırılabilir AppIntent burada bilinçli
// olarak KULLANILMIYOR: UsPulse'un ihtiyacı olan tek şey "birlikte X
// gündür" gibi kısa ömürlü olmayan, sürekli görünen bir bilgi -- Live
// Activity ise doğası gereği geçici/canlı olaylar (bir teslimat, bir yolculuk
// takibi) için tasarlanmış, kapsam dışı bırakıldı.
@main
struct UsPulseWidgetBundle: WidgetBundle {
    var body: some Widget {
        UsPulseWidget()
    }
}
