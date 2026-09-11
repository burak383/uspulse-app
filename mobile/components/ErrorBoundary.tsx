import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Herhangi bir ekranda render sırasında yakalanmamış bir JS hatası (null
// pointer vb.) oluşursa, React'in varsayılan davranışı tüm uygulamayı
// kırmızı/beyaz bir ekrana düşürmek. Bu, App.tsx'te NavigationContainer'ı
// sarmalayarak böyle bir hatayı yakalar ve kullanıcıya en azından "tekrar
// dene" imkânı sunan bir kurtarma ekranı gösterir -- veri kaybetmeden
// (yalnızca bu alt ağacı yeniden mount eder) uygulamanın tamamen kilitli
// kalmasını önler.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    // component stack de loglanıyor ki bir dahaki sefere hangi bileşenden
    // geldiğini bulmak için cihaz logunu (adb logcat / Xcode konsolu) tekrar
    // taramak yeterli olsun -- bkz. GNNSorusu.tsx Avatar bileşenindeki "Text
    // strings must be rendered within a <Text> component." hatası, bu
    // sayede logcat'ten teşhis edildi.
    // eslint-disable-next-line no-console
    console.error('Yakalanmamış render hatası:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Bir şeyler ters gitti</Text>
          <Text style={styles.body}>
            Beklenmeyen bir hata oluştu. Tekrar denemek uygulamayı düzeltebilir.
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Tekrar dene</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  title: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 22,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
  },
});
