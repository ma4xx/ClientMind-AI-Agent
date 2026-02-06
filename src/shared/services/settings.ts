import { getTranslations } from 'next-intl/server';

import { Tab } from '@/shared/types/blocks/common';

export interface Setting {
  name: string;
  title: string;
  type: string;
  placeholder?: string;
  options?: {
    title: string;
    value: string;
  }[];
  tip?: string;
  value?: string | string[] | boolean | number;
  group?: string;
  tab?: string;
  attributes?: Record<string, any>;
}

export interface SettingGroup {
  name: string;
  title: string;
  description?: string;
  tab: string;
}

export async function getSettingTabs(tab: string) {
  const t = await getTranslations('admin.settings');

  const tabs: Tab[] = [
    {
      name: 'general',
      title: t('edit.tabs.general'),
      url: '/admin/settings/general',
      is_active: tab === 'general',
    },
    {
      name: 'auth',
      title: t('edit.tabs.auth'),
      url: '/admin/settings/auth',
      is_active: tab === 'auth',
    },
    {
      name: 'email',
      title: t('edit.tabs.email'),
      url: '/admin/settings/email',
      is_active: tab === 'email',
    },
    {
      name: 'ai',
      title: t('edit.tabs.ai'),
      url: '/admin/settings/ai',
      is_active: tab === 'ai',
    },
  ];

  return tabs;
}

export async function getSettingGroups() {
  const t = await getTranslations('admin.settings');
  const settingGroups: SettingGroup[] = [
    {
      name: 'appinfo',
      title: t('groups.appinfo'),
      description: 'custom your app info',
      tab: 'general',
    },
    {
      name: 'user_role',
      title: t('groups.user_role'),
      description: 'custom user role settings',
      tab: 'general',
    },
    {
      name: 'email_auth',
      title: t('groups.email_auth'),
      description: 'custom your email auth settings',
      tab: 'auth',
    },
    {
      name: 'google_auth',
      title: t('groups.google_auth'),
      description: 'custom your google auth settings',
      tab: 'auth',
    },
    {
      name: 'github_auth',
      title: t('groups.github_auth'),
      description: 'custom your github auth settings',
      tab: 'auth',
    },
    {
      name: 'resend',
      title: t('groups.resend'),
      description: 'custom your resend settings',
      tab: 'email',
    },
    {
      name: 'openrouter',
      title: t('groups.openrouter'),
      description: `Custom <a href="https://openrouter.ai" class="text-primary" target="_blank">OpenRouter</a> settings`,
      tab: 'ai',
    },
    {
      name: 'replicate',
      title: t('groups.replicate'),
      description: `Custom <a href="https://replicate.com" class="text-primary" target="_blank">Replicate</a> settings`,
      tab: 'ai',
    },
    {
      name: 'fal',
      title: 'Fal',
      description: `Custom <a href="https://fal.ai" class="text-primary" target="_blank">Fal</a> settings`,
      tab: 'ai',
    },
    {
      name: 'gemini',
      title: 'Gemini',
      description: `Custom <a href="https://aistudio.google.com/api-keys" class="text-primary" target="_blank">Gemini</a> settings`,
      tab: 'ai',
    },
    {
      name: 'kie',
      title: 'Kie',
      description: `Custom <a href="https://kie.ai" class="text-primary" target="_blank">Kie</a> settings`,
      tab: 'ai',
    },
  ];
  return settingGroups;
}

export async function getSettings() {
  const settings: Setting[] = [
    {
      name: 'app_name',
      title: 'App Name',
      placeholder: 'ClientMind AI Agent',
      type: 'text',
      group: 'appinfo',
      tab: 'general',
    },
    {
      name: 'app_description',
      title: 'App Description',
      placeholder:
        'ClientMind AI Agent is a NextJS boilerplate for building AI SaaS startups. ',
      type: 'textarea',
      group: 'appinfo',
      tab: 'general',
    },
    {
      name: 'app_logo',
      title: 'App Logo',
      type: 'upload_image',
      group: 'appinfo',
      tab: 'general',
    },
    {
      name: 'app_preview_image',
      title: 'App Preview Image',
      type: 'upload_image',
      group: 'appinfo',
      tab: 'general',
    },
    {
      name: 'initial_role_enabled',
      title: 'Initial Role Enabled',
      type: 'switch',
      value: 'false',
      group: 'user_role',
      tab: 'general',
      tip: 'whether assign initial role for new user',
    },
    {
      name: 'initial_role_name',
      title: 'Initial Role',
      type: 'select',
      value: 'viewer',
      options: [
        { title: 'Viewer', value: 'viewer' },
        { title: 'Editor', value: 'editor' },
        { title: 'Admin', value: 'admin' },
        { title: 'Super Admin', value: 'super_admin' },
      ],
      group: 'user_role',
      tab: 'general',
      tip: 'the initial role for new user',
    },
    {
      name: 'email_auth_enabled',
      title: 'Enabled',
      type: 'switch',
      value: 'true',
      group: 'email_auth',
      tab: 'auth',
    },
    {
      name: 'email_verification_enabled',
      title: 'Email Verification Required',
      type: 'switch',
      value: 'false',
      group: 'email_auth',
      tab: 'auth',
      tip: 'Require users to verify their email before they can sign in. Requires a configured email provider (e.g. Resend).',
    },
    {
      name: 'google_auth_enabled',
      title: 'Auth Enabled',
      type: 'switch',
      value: 'false',
      group: 'google_auth',
      tab: 'auth',
    },
    {
      name: 'google_one_tap_enabled',
      title: 'OneTap Enabled',
      type: 'switch',
      value: 'false',
      group: 'google_auth',
      tab: 'auth',
    },
    {
      name: 'google_client_id',
      title: 'Google Client ID',
      type: 'text',
      placeholder: '',
      group: 'google_auth',
      tab: 'auth',
    },
    {
      name: 'google_client_secret',
      title: 'Google Client Secret',
      type: 'password',
      placeholder: '',
      group: 'google_auth',
      tab: 'auth',
    },
    {
      name: 'github_auth_enabled',
      title: 'Auth Enabled',
      type: 'switch',
      group: 'github_auth',
      tab: 'auth',
    },
    {
      name: 'github_client_id',
      title: 'Github Client ID',
      type: 'text',
      placeholder: '',
      group: 'github_auth',
      tab: 'auth',
    },
    {
      name: 'github_client_secret',
      title: 'Github Client Secret',
      type: 'password',
      placeholder: '',
      group: 'github_auth',
      tab: 'auth',
    },
    {
      name: 'resend_api_key',
      title: 'Resend API Key',
      type: 'password',
      placeholder: '',
      group: 'resend',
      tab: 'email',
    },
    {
      name: 'resend_sender_email',
      title: 'Resend Sender Email',
      type: 'text',
      placeholder: 'ClientMind AI Agent Two <no-reply@mail.clientmind-ai-agent.site>',
      group: 'resend',
      tab: 'email',
    },
    {
      name: 'openrouter_api_key',
      title: 'OpenRouter API Key',
      type: 'password',
      placeholder: 'sk-or-xxx',
      group: 'openrouter',
      tab: 'ai',
    },
    {
      name: 'openrouter_base_url',
      title: 'OpenRouter Base URL',
      type: 'url',
      placeholder: 'https://openrouter.ai/api/v1',
      tip: 'Set any OpenAI compatible API URL, leave empty to use the default OpenRouter API URL',
      group: 'openrouter',
      tab: 'ai',
    },
    {
      name: 'replicate_api_token',
      title: 'Replicate API Token',
      type: 'password',
      placeholder: 'r8_xxx',
      group: 'replicate',
      tab: 'ai',
    },
    {
      name: 'replicate_custom_storage',
      title: 'Replicate Custom Storage',
      type: 'switch',
      value: 'false',
      group: 'replicate',
      tab: 'ai',
      tip: 'Use custom storage to save files generated by Replicate',
    },
    {
      name: 'fal_api_key',
      title: 'Fal API Key',
      type: 'password',
      placeholder: 'fal_xxx',
      group: 'fal',
      tip: 'Fal API Key is used to access the Fal API',
      tab: 'ai',
    },
    {
      name: 'fal_custom_storage',
      title: 'Fal Custom Storage',
      type: 'switch',
      value: 'false',
      group: 'fal',
      tab: 'ai',
      tip: 'Use custom storage to save files generated by Fal',
    },
    {
      name: 'gemini_api_key',
      title: 'Gemini API Key',
      type: 'password',
      placeholder: 'AIza...',
      group: 'gemini',
      tip: 'Google Gemini API Key',
      tab: 'ai',
    },
    {
      name: 'kie_api_key',
      title: 'Kie API Key',
      type: 'password',
      placeholder: 'xxx',
      group: 'kie',
      tip: 'Kie API Key is used to access the Kie API',
      tab: 'ai',
    },
    {
      name: 'kie_custom_storage',
      title: 'Kie Custom Storage',
      type: 'switch',
      value: 'false',
      group: 'kie',
      tab: 'ai',
      tip: 'Use custom storage to save files generated by Kie',
    },
  ];

  return settings;
}

export const publicSettingNames = [
  'email_auth_enabled',
  'google_auth_enabled',
  'google_one_tap_enabled',
  'google_client_id',
  'github_auth_enabled',
];

export async function getAllSettingNames() {
  const settings = await getSettings();
  const settingNames: string[] = [];

  settings.forEach((setting: Setting) => {
    settingNames.push(setting.name);
  });

  return settingNames;
}
