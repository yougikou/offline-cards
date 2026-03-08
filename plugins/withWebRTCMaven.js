/**
 * Expo Config Plugin to fix react-native-webrtc Maven dependency resolution.
 * 
 * Problem: react-native-webrtc depends on 'org.jitsi:webrtc:124.+' (dynamic version).
 * Gradle must query ALL repositories to list available versions for dynamic deps.
 * JitPack times out, causing the entire resolution to fail.
 * 
 * Solution: Force the exact version '124.0.0' (available on Maven Central)
 * so Gradle doesn't need to enumerate versions from every repository.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

function withWebRTCMaven(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;

      // Add a subprojects block that forces the exact version of org.jitsi:webrtc
      // This prevents Gradle from querying all repos for dynamic version '124.+'
      const forceBlock = `
subprojects {
    project.configurations.all {
        resolutionStrategy.force 'org.jitsi:webrtc:124.0.0'
    }
}
`;

      // Add before 'apply plugin' lines at the end
      if (!contents.includes('resolutionStrategy.force')) {
        contents = contents.replace(
          /apply plugin/,
          `${forceBlock}\napply plugin`
        );
      }

      config.modResults.contents = contents;
    }
    return config;
  });
}

module.exports = withWebRTCMaven;
