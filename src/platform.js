import {Capacitor} from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const websiteURL = 'https://saanku.github.io/SONIX/';
export const accountRedirectURL = isNative ? websiteURL : location.origin + location.pathname;
if (isNative) document.documentElement.classList.add('native-app');
