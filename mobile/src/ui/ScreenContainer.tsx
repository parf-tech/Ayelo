import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MAX_CONTENT_WIDTH, useTheme } from '../theme';

export type ScreenContainerProps = {
  children: React.ReactNode;
  /** Contenu défilant (formulaires). Sinon, le contenu occupe l'écran. */
  scroll?: boolean;
  /** Zone fixe en bas (actions principales : le pouce d'abord, docs/06). */
  footer?: React.ReactNode;
  testID?: string;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Conteneur d'écran : zones sûres, fond du thème, clavier, largeur centrée sur tablette. */
export function ScreenContainer({ children, scroll = false, footer, testID, contentStyle }: ScreenContainerProps) {
  const { colors, space } = useTheme();

  const inner: ViewStyle = {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space[5],
  };

  return (
    <SafeAreaView testID={testID} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[inner, { paddingTop: space[5], paddingBottom: space[5], flexGrow: 1 }, contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[inner, { flex: 1, paddingTop: space[5] }, contentStyle]}>{children}</View>
        )}
        {footer ? (
          <View
            style={{
              ...inner,
              paddingTop: space[3],
              paddingBottom: space[4],
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.bg,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
