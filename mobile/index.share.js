// Entry point for the iOS share extension ("Save to Honey, Dinner?").
// The first argument MUST be "shareExtension".
import { AppRegistry } from 'react-native';
import ShareExtensionRoot from './src/share/ShareExtensionRoot';

AppRegistry.registerComponent('shareExtension', () => ShareExtensionRoot);
