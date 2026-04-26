import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="rounds"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && styles.iconPillOn]}>
              <TabBarIcon name="flag" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="rounds"
        options={{
          title: 'Rounds',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && styles.iconPillOn]}>
              <TabBarIcon name="plus" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && styles.iconPillOn]}>
              <TabBarIcon name="line-chart" color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surfaceBright,
    borderTopColor: colors.outlineVariant,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 12,
    height: 70,
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillOn: {
    backgroundColor: colors.primaryContainer,
  },
});
