import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId: "69bf5d0a924e0a8766577274",
  token,
  functionsVersion,
  requiresAuth: false,
  appBaseUrl
});
