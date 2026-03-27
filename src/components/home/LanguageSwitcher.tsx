import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

interface LanguageSwitcherProps {
  languageMenuVisible: boolean;
  setLanguageMenuVisible: (visible: boolean) => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  languageMenuVisible,
  setLanguageMenuVisible,
}) => {
  const { t, i18n } = useTranslation();

  const currentLangLabel = i18n.language === 'zh' ? '中文' : i18n.language === 'ja' ? '日本語' : 'English';

  return (
    <View style={styles.languageSwitcher}>
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.languageDropdownButton}
        onPress={() => setLanguageMenuVisible(!languageMenuVisible)}
      >
        <Text style={styles.languageDropdownText}>🌐 {currentLangLabel} ▼</Text>
      </TouchableOpacity>

      {languageMenuVisible && (
        <View style={styles.languageDropdownMenu}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.languageDropdownItem, i18n.language === 'zh' && styles.languageDropdownItemSelected]}
            onPress={() => { i18n.changeLanguage('zh'); setLanguageMenuVisible(false); }}
          >
            <Text style={[styles.languageDropdownItemText, i18n.language === 'zh' && styles.languageDropdownItemTextSelected]}>中文</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.languageDropdownItem, i18n.language === 'en' && styles.languageDropdownItemSelected]}
            onPress={() => { i18n.changeLanguage('en'); setLanguageMenuVisible(false); }}
          >
            <Text style={[styles.languageDropdownItemText, i18n.language === 'en' && styles.languageDropdownItemTextSelected]}>English</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.languageDropdownItem, i18n.language === 'ja' && styles.languageDropdownItemSelected]}
            onPress={() => { i18n.changeLanguage('ja'); setLanguageMenuVisible(false); }}
          >
            <Text style={[styles.languageDropdownItemText, i18n.language === 'ja' && styles.languageDropdownItemTextSelected]}>日本語</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  languageSwitcher: {
    alignItems: 'flex-end',
    position: 'relative',
  },
  languageDropdownButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  languageDropdownText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  languageDropdownMenu: {
    position: 'absolute',
    top: 45,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    width: 120,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  languageDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageDropdownItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  languageDropdownItemText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  languageDropdownItemTextSelected: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
});

export default LanguageSwitcher;
