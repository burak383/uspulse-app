// Android'in widget'ı için (yeniden) çizim istediği her an -- widget ana
// ekrana eklendiğinde, periyodik yenilemede (app.json'daki
// updatePeriodMillis) ya da yeniden boyutlandırıldığında -- çağrılan
// "headless" görev. Uygulamanın kendisi hiç açık olmayabilir; bu yüzden
// veriyi ağdan DEĞİL, uygulamanın son GET /me çekişinde yazdığı yerel
// anlık görüntüden okuyor (bkz. snapshot.ts). index.js'te
// registerWidgetTaskHandler ile kaydediliyor.
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { readWidgetSnapshot } from './snapshot';
import { renderUsPulseWidget } from './UsPulseWidget';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const snapshot = await readWidgetSnapshot();
      props.renderWidget(renderUsPulseWidget(snapshot));
      break;
    }
    default:
      break;
  }
}
