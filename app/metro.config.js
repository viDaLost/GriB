// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Модель распознавания (.tflite) лежит в assets/model и попадает в APK как ассет.
config.resolver.assetExts.push('tflite');

module.exports = config;
