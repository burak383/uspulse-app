// Normalde Expo bunu kendisi (node_modules/expo/AppEntry.js) yapar --
// registerRootComponent'i burada elle çağırmamızın TEK nedeni, ana ekran
// widget'ının (bkz. src/widgets/) Android'deki "headless" görev işleyicisini
// de AYNI giriş noktasında kaydetmemiz gerekmesi: widget OS tarafından
// (örn. periyodik yenileme, widget yeniden eklendiğinde) uygulamanın kendisi
// hiç açılmadan tetiklenebiliyor, ve registerWidgetTaskHandler bu görevi
// AppRegistry'ye burada -- normal ekran akışının hiç çalışmadığı bir
// bağlamda -- kaydetmek zorunda (bkz. react-native-android-widget'ın kendi
// dokümantasyonundaki standart kurulum deseni). package.json'daki "main"
// alanı da bu yüzden "node_modules/expo/AppEntry.js" yerine bu dosyayı
// gösterecek şekilde güncellendi.
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './src/widgets/widget-task-handler';

registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
