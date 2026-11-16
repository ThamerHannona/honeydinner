import { router } from 'expo-router';

/** Close the current screen. When the app was opened straight onto it (from the
 *  share panel or a link) there is nothing behind it, so go home instead of
 *  leaving the user stuck. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
