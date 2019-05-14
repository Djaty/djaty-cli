import {UserConfigOptions, DefaultStages, AllowedCustomLoggers} from '@djaty/djaty-nodejs';

//noinspection JSUnusedGlobalSymbols
export const nodejsAgentConfig: UserConfigOptions = {
  tags: ['DjatyCli'],
  stage: DefaultStages.PROD,
  allowAutoSubmission: true,
  apiKey: 'djaty-cli-api-key',
  apiSecret: 'djaty-cli-api-secret',
  release: '1.0.0',
  trackingOptions: {
    allowedWrappers: {
      http: true,
      customLoggers: [{
        name: AllowedCustomLoggers.winston,
      }],
    },
  },
};
