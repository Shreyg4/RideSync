const { withPodfile } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

/**
 * Raises every Pods target (including resource-bundle targets such as
 * AsyncStorage_resources, RNSVGFilters and Sentry) to React Native's minimum
 * iOS version. Xcode 27 rejects deployment targets below 15.0 outright.
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withPodsDeploymentTarget = (config) =>
  withPodfile(config, (config) => {
    config.modResults.contents = mergeContents({
      tag: 'ridesync-pods-deployment-target',
      src: config.modResults.contents,
      newSrc: [
        '    installer.pods_project.targets.each do |target|',
        '      target.build_configurations.each do |build_config|',
        "        if build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < min_ios_version_supported.to_f",
        "          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios_version_supported",
        '        end',
        '      end',
        '    end',
      ].join('\n'),
      anchor: /:ccache_enabled => ccache_enabled\?\(podfile_properties\),/,
      offset: 2,
      comment: '#',
    }).contents;
    return config;
  });

module.exports = withPodsDeploymentTarget;
