import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { definePreset } from '@primeuix/themes';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

const StcTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fff1f0',
      100: '#ffe0dd',
      200: '#ffc5bf',
      300: '#ff9b90',
      400: '#f06e62',
      500: '#e14d3f',
      600: '#b7392c',
      700: '#963025',
      800: '#7a2419',
      900: '#5f1c14',
      950: '#3e0f0a',
      color: '#e14d3f',
      contrastColor: '#ffffff',
      hoverColor: '#b7392c',
      activeColor: '#963025',
    },
    focusRing: {
      color: '#e14d3f',
      shadow: '0 0 0 3px rgba(225, 77, 63, 0.18)',
    },
    formField: {
      background: '#fdfbf9',
      borderColor: '#ece0d8',
      hoverBorderColor: '#9c9088',
      focusBorderColor: '#e14d3f',
      invalidBorderColor: '#b42318',
      color: '#4a3e38',
      placeholderColor: '#9c9088',
      iconColor: '#9c9088',
      borderRadius: '10px',
      focusRing: {
        color: '#e14d3f',
        shadow: '0 0 0 3px rgba(225, 77, 63, 0.18)',
      },
    },
  },
  components: {
    button: {
      root: {
        borderRadius: '10px',
        primary: {
          background: '#e14d3f',
          hoverBackground: '#b7392c',
          activeBackground: '#963025',
          borderColor: '#e14d3f',
          hoverBorderColor: '#b7392c',
          activeBorderColor: '#963025',
          color: '#ffffff',
          hoverColor: '#ffffff',
          activeColor: '#ffffff',
          focusRing: {
            color: '#e14d3f',
            shadow: '0 0 0 3px rgba(225, 77, 63, 0.18)',
          },
        },
      },
    },
    inputtext: {
      root: {
        background: '{form.field.background}',
        borderColor: '{form.field.border.color}',
        hoverBorderColor: '{form.field.hover.border.color}',
        focusBorderColor: '{form.field.focus.border.color}',
        invalidBorderColor: '{form.field.invalid.border.color}',
        color: '{form.field.color}',
        placeholderColor: '{form.field.placeholder.color}',
        borderRadius: '{form.field.border.radius}',
        focusRing: {
          color: '{form.field.focus.ring.color}',
          shadow: '{form.field.focus.ring.shadow}',
        },
      },
    },
    password: {
      icon: {
        color: '{form.field.icon.color}',
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: StcTheme,
      },
    }),
  ],
};
