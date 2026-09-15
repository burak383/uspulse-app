// Android ana ekran widget'ının GÖRSEL kısmı -- react-native-android-widget
// bu JSX'i gerçek bir Android RemoteViews ağacına çeviriyor, yani burada
// normal View/Text yerine kütüphanenin kendi FlexWidget/TextWidget
// bileşenleri kullanılıyor (bkz. https://saleksovski.github.io/
// react-native-android-widget/). İki yerden çağrılıyor: snapshot.ts
// (uygulama açıkken anında tazeleme) ve widget-task-handler.tsx (OS'in
// tetiklediği "headless" güncellemeler, ör. widget yeniden eklendiğinde).
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetSnapshot } from './snapshot';

// theme.ts'teki colors.card/colors.foreground/colors.mutedForeground'a yakın
// sabit tonlar -- widget tamamen ayrı bir (headless olabilen) JS bağlamında
// render edildiği için uygulamanın theme modülünü içe aktarmak yerine
// birkaç rengi burada sabit kodluyoruz.
const BACKGROUND = '#2A1B30';
const FOREGROUND = '#F2E9E4';
const MUTED = '#C9B8C4';

export function UsPulseWidget({ snapshot }: { snapshot: WidgetSnapshot | null }) {
  const hasData = snapshot != null && snapshot.daysTogether != null;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: BACKGROUND,
        borderRadius: 20,
        padding: 16,
        justifyContent: 'center',
      }}
    >
      <TextWidget text="💜 UsPulse" style={{ fontSize: 12, color: MUTED, fontWeight: 'bold' }} />

      {hasData ? (
        <>
          <TextWidget
            text={`${snapshot!.daysTogether} gün`}
            style={{ fontSize: 26, color: FOREGROUND, fontWeight: 'bold', marginTop: 4 }}
          />
          <TextWidget
            text={snapshot!.partnerName ? `${snapshot!.partnerName} ile birlikte` : 'Birlikte'}
            style={{ fontSize: 12, color: MUTED, marginTop: 2 }}
            maxLines={1}
            truncate="END"
          />
          {snapshot!.distanceKm != null && (
            <TextWidget
              text={`~${snapshot!.distanceKm} km uzakta`}
              style={{ fontSize: 11, color: MUTED, marginTop: 6 }}
            />
          )}
        </>
      ) : (
        <TextWidget text="Açmak için dokun" style={{ fontSize: 12, color: MUTED, marginTop: 4 }} />
      )}
    </FlexWidget>
  );
}

export function renderUsPulseWidget(snapshot: WidgetSnapshot | null) {
  return <UsPulseWidget snapshot={snapshot} />;
}
